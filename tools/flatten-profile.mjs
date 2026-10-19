// Resolve a cadeia `inherits` dos perfis nativos do OrcaSlicer (JSON) e
// devolve um perfil achatado (filho sobrescreve pai).
// Uso: node flatten-profile.mjs <dirDosPerfisDoVendor> <out.json>
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export function loadIndex(vendorDir, kind) {
  const dir = join(vendorDir, kind)
  const byName = new Map()
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue
    const json = JSON.parse(readFileSync(join(dir, f), 'utf8'))
    if (json.name) byName.set(json.name, json)
  }
  return byName
}

export function flatten(name, index) {
  const chain = []
  let cur = index.get(name)
  if (!cur) throw new Error(`perfil não encontrado: ${name}`)
  const seen = new Set()
  while (cur) {
    if (seen.has(cur.name)) throw new Error(`ciclo de herança em ${cur.name}`)
    seen.add(cur.name)
    chain.unshift(cur)
    if (!cur.inherits) break
    const parent = index.get(cur.inherits)
    if (!parent) throw new Error(`pai '${cur.inherits}' de '${cur.name}' não encontrado`)
    cur = parent
  }
  const merged = Object.assign({}, ...chain)
  delete merged.inherits
  return { merged, chain: chain.map((c) => c.name) }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [vendorDir, out] = process.argv.slice(2)
  const MACHINE = 'Creality Ender-3 V3 SE 0.4 nozzle'
  const PROCESS = '0.20mm Standard @Creality Ender3V3SE 0.4'
  const result = {}
  for (const [kind, name] of [['machine', MACHINE], ['process', PROCESS]]) {
    const { merged, chain } = flatten(name, loadIndex(vendorDir, kind))
    result[kind] = merged
    console.log(kind, '| cadeia:', chain.join(' <- '), '| chaves:', Object.keys(merged).length)
  }
  // filamentos PLA compatíveis com a máquina
  const fil = loadIndex(vendorDir, 'filament')
  const compat = []
  for (const [n, p] of fil) {
    if (!/PLA/i.test(n)) continue
    try {
      const { merged } = flatten(n, fil)
      const cp = merged.compatible_printers
      if (Array.isArray(cp) && cp.includes(MACHINE)) compat.push(n)
    } catch (e) { /* perfis abstratos/sem pai resolvível */ }
  }
  console.log('filamentos PLA compatíveis:', compat)
  result.filamentCandidates = compat
  if (out) writeFileSync(out, JSON.stringify(result, null, 1))
}
