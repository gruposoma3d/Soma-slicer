// Gera web/bundle.json (perfis achatados da v2.4.2) e STLs de teste.
import { writeFileSync, mkdirSync } from 'node:fs'
mkdirSync('web', { recursive: true })
import { trianglesToStl, sphereStl } from './vendor/OrcaWasm/scripts/lib/engine-harness.mjs'
import { loadIndex, flatten } from './flatten-profile.mjs'
const V = './vendor/orca-profiles/resources/profiles/Creality'
const machine = flatten('Creality Ender-3 V3 SE 0.4 nozzle', loadIndex(V, 'machine')).merged
const process_ = flatten('0.20mm Standard @Creality Ender3V3SE 0.4', loadIndex(V, 'process')).merged
const filRaw = flatten('Creality Generic PLA @Ender-3V3-all', loadIndex(V, 'filament')).merged
const META = new Set(['compatible_printers','compatible_printers_condition','filament_settings_id','id','inherits','name','type','version','from','instantiation','setting_id','filament_id'])
const filament = {}
for (const [k, v] of Object.entries(filRaw)) {
  if (META.has(k)) continue
  const x = Array.isArray(v) ? v[0] : v
  if (x !== undefined && x !== null && x !== '') filament[k] = [x]
}
const init = { bed_size_x: 220, bed_size_y: 220, printable_height: 250, nozzle_diameter: 0.4, layer_height: 0.2, filament_type: 'PLA' }
const relE = Number(machine.use_relative_e_distances ?? process_.use_relative_e_distances ?? 1)
writeFileSync('web/bundle.json', JSON.stringify({ init, machine, process: process_, filament, relE }))
const s = 20
const v = [[0,0,0],[s,0,0],[s,s,0],[0,s,0],[0,0,s],[s,0,s],[s,s,s],[0,s,s]]
const f = [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]]
writeFileSync('web/cube.stl', new Uint8Array(trianglesToStl(v, f)))
writeFileSync('web/sphere.stl', new Uint8Array(sphereStl(6, 30)))
console.log('bundle ok')
