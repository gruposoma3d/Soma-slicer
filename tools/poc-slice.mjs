// Fase 2 — PoC: STL -> motor real (OrcaWasm patch29) -> perfil Ender-3 V3 SE + PLA -> G-code
// Uso: node poc-slice.mjs [filamento]   (padrão: 'Creality Generic PLA @Ender-3V3-all')
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
mkdirSync('./out', { recursive: true })
import {
  loadModule, initSession, applyProfileOnce, projectSetObjectsOnce,
  projectSliceOnce, projectGetAssetOnce, trianglesToStl,
} from './vendor/OrcaWasm/scripts/lib/engine-harness.mjs'
import { loadIndex, flatten } from './flatten-profile.mjs'

const VENDOR = './vendor/orca-profiles/resources/profiles/Creality'
const FILAMENT = process.argv[2] || 'Creality Generic PLA @Ender-3V3-all'
const t0 = Date.now()
const log = (...a) => console.log(`[+${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a)

// --- 1) Cubo de calibração 20 mm (STL binário) ---
const s = 20
const v = [[0,0,0],[s,0,0],[s,s,0],[0,s,0],[0,0,s],[s,0,s],[s,s,s],[0,s,s]]
const f = [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]]
const stl = new Uint8Array(trianglesToStl(v, f))
log('STL gerado:', stl.length, 'bytes')

// --- 2) Perfis achatados (herança resolvida no host) ---
const machine = flatten('Creality Ender-3 V3 SE 0.4 nozzle', loadIndex(VENDOR, 'machine')).merged
const process_ = flatten('0.20mm Standard @Creality Ender3V3SE 0.4', loadIndex(VENDOR, 'process')).merged
const filRaw = flatten(FILAMENT, loadIndex(VENDOR, 'filament')).merged
const META = new Set(['compatible_printers', 'compatible_printers_condition', 'filament_settings_id',
  'id', 'inherits', 'name', 'type', 'version', 'from', 'instantiation', 'setting_id', 'filament_id'])
const filFragment = {}
for (const [k, val] of Object.entries(filRaw)) {
  if (META.has(k)) continue
  const x = Array.isArray(val) ? val[0] : val
  if (x === undefined || x === null || x === '') continue
  filFragment[k] = [x]
}
log('perfil: máquina', Object.keys(machine).length, 'chaves | processo', Object.keys(process_).length,
  '| filamento', Object.keys(filFragment).length, `(${FILAMENT})`)

// --- 3) Motor real ---
const module = await loadModule('./engine', 'slicer-mt')
log('módulo WASM carregado')
const session = module._oneslicer_session_create()
initSession(module, session, JSON.stringify({
  bed_size_x: 220, bed_size_y: 220, printable_height: 250, nozzle_diameter: 0.4,
  layer_height: 0.2, filament_type: 'PLA',
}))
applyProfileOnce(module, session, machine)
applyProfileOnce(module, session, process_)
applyProfileOnce(module, session, filFragment)
// O bridge OrcaWasm força use_relative_e_distances=0 em sessões headless, mas o
// padrão do Orca desktop (PrintConfig.cpp) é true. Perfis Creality usam "G92 E0"
// em before_layer_change_gcode, válido só com extrusão relativa. Replicamos o desktop:
// valor do perfil se definido, senão true.
const relE = machine.use_relative_e_distances ?? process_.use_relative_e_distances ?? 1
applyProfileOnce(module, session, { use_relative_e_distances: Number(relE) }, 'orca.native-json')
log('perfis aplicados (use_relative_e_distances =', relE + ')')

// --- 4) Projeto: 1 placa, 1 objeto centralizado na mesa 220x220 ---
const manifest = {
  schemaVersion: '0.7.0',
  plates: [{ id: 'plate-0', label: 'Plate 0', index: 0 }],
  meshes: [{ id: 'mesh-0', format: 'stl', dataRange: { offset: 0, length: stl.length } }],
  objects: [{ id: 'object-0', meshId: 'mesh-0', extruderId: 0 }],
  instances: [{ id: 'instance-0', objectId: 'object-0', plateId: 'plate-0',
    transform: { matrix: [1,0,0,100, 0,1,0,100, 0,0,1,0, 0,0,0,1] } }],
  modifierVolumes: [],
}
projectSetObjectsOnce(module, session, stl, manifest)
log('objetos carregados')

// --- 5) Fatiar de verdade ---
const result = projectSliceOnce(module, session, {
  schemaVersion: '0.7.0', plateSelection: 'all', includeGcode: true, includeStatistics: true,
})
const pr = result.plateResults[0]
const asset = pr.assets[0]
const gcode = new TextDecoder().decode(projectGetAssetOnce(module, session, asset.id))
log('fatiado:', asset.id, asset.byteLength, 'bytes')
console.log('statistics:', JSON.stringify(pr.statistics).slice(0, 600))

// --- 6) Validação do G-code ---
const lines = gcode.split('\n')
const layers = lines.filter((l) => l.startsWith(';LAYER_CHANGE')).length
const g1 = lines.filter((l) => /^G[01] /.test(l)).length
const extr = lines.filter((l) => /^G1 .*E[-\d.]+/.test(l)).length
const hdr = lines.filter((l) => /^; (total filament|estimated printing time|filament used)/i.test(l)).slice(0, 6)
const temps = lines.filter((l) => /^M10[49]|^M14[01]/.test(l)).slice(0, 4)
console.log({ linhas: lines.length, camadas: layers, movimentosG0G1: g1, extrusoes: extr, temps })
console.log('cabeçalho/estimativas:', hdr)
console.log('início do G-code:\n' + lines.slice(0, 12).join('\n'))
writeFileSync('./out/cube20-ender3v3se.gcode', gcode)
const zs = lines.map((l) => /^;Z:([\d.]+)/.exec(l)).filter(Boolean).map((m) => parseFloat(m[1]))
const topZ = zs[zs.length - 1]
const bad = /\bNaN\b|\binf\b|nan/i.test(gcode.replace(/;.*$/gm, ''))
const hasBed = lines.some((l) => /^M1(40|90) S[1-9]/.test(l))
console.log({ camadasZ: zs.length, topZ, semNaN: !bad, aquecimentoMesa: hasBed })
const ok = zs.length >= 20 && Math.abs(topZ - s) < 0.1 && extr > 500 && !bad && hasBed
log(ok ? 'OK: G-code válido gerado' : 'FALHA: G-code inesperado')
module._oneslicer_session_destroy(session)
process.exit(ok ? 0 : 1)
