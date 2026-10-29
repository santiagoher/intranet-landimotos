import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url), ts = require('typescript')
const root = path.dirname(fileURLToPath(import.meta.url))
function load(file, overrides = {}) {
  const filename = path.resolve(root, file), mod = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  vm.runInNewContext(code, { module: mod, exports: mod.exports, require: name => {
    if (name in overrides) return overrides[name]
    if (name === 'server-only' || name.endsWith('.css')) return {}
    if (name.startsWith('.')) { const base = path.resolve(path.dirname(filename), name); return load(base + (fs.existsSync(base + '.ts') ? '.ts' : '.tsx'), overrides) }
    return require(name)
  } })
  return mod.exports
}
const { differenceSign, signedDifference, summarizeDifferences } = load('difference-print.ts')
const { DifferencePrintDocument } = load('DifferencePrintDocument.tsx')
const rows = [
  { id: '1', code: 'SKU-0001', name: 'Producto <completo> & seguro', expected: '10.000000', counted: '7.125000', difference: '-2.875000', result: 'faltante', unit: 'KG' },
  { id: '2', code: 'SKU-0002', name: 'Producto sobrante', expected: '1', counted: '2.000001', difference: '1.000001', result: 'sobrante', unit: 'UN' },
  { id: '3', code: 'NO-IMPRIMIR', name: 'Coincide', expected: '0', counted: '0', difference: '0.000000', result: 'coincide', unit: 'UN' },
]
const document = products => ({ ticket: 'OP-PRUEBA', version: 8, warehouse: 'BODEGA 1', category: 'Categoría de prueba', operator: 'Operador de prueba', leader: 'Líder de prueba', countedAt: '2026-10-22T18:20:00Z', generatedAt: '2026-10-22T19:20:00Z', demo: true, totalProducts: products.length, ...summarizeDifferences(products) })
const render = data => renderToStaticMarkup(React.createElement(DifferencePrintDocument, { data }))

test('print uses existing signed decimals exactly, excludes zero and distinguishes shortages/surpluses', () => {
  for (const zero of ['0','-0','+0.000000','000.000']) assert.equal(differenceSign(zero), 0)
  assert.equal(differenceSign(null), 0)
  assert.equal(signedDifference('99999999999999.123456'), '+99999999999999.123456')
  assert.equal(signedDifference('-0.000001'), '-0.000001')
  assert.equal(document([rows[0]]).shortages, 1)
  assert.equal(document([rows[1]]).surpluses, 1)
  const data = document(rows), html = render(data)
  assert.equal(data.rows.length, 2); assert.equal(data.shortages, 1); assert.equal(data.surpluses, 1)
  assert.match(html, /-2.875/); assert.match(html, /\+1.000001/); assert.match(html, /UM: KG/)
  assert.doesNotMatch(html, /NO-IMPRIMIR/); assert.match(html, /Producto &lt;completo&gt; &amp; seguro/)
})
test('no differences and missing references are separate states, including partial comparisons', () => {
  assert.match(render(document([rows[2]])), /Sin diferencias:/)
  const pending = { ...rows[0], expected: null, difference: null, result: 'sin_referencia' }
  const html = render(document([pending]))
  assert.match(html, /Comparación pendiente/); assert.match(html, /No hay diferencias calculables/); assert.doesNotMatch(html, /Sin diferencias:/)
  const partial = document([pending, rows[1], { ...rows[0], counted: null, difference: null }])
  assert.equal(partial.rows.length, 1); assert.equal(partial.missingReference, 1); assert.equal(partial.pendingCount, 1)
  assert.match(render(partial), /documento es parcial/)
  assert.match(render(document([])), /no tiene productos registrados/)
})
test('print document includes identity/dates, demo warning, empty verified cells and observations without signatures', () => {
  const html = render(document(rows))
  for (const text of ['LANDIMOTOS', 'CONTROL DE INVENTARIOS', 'DIFERENCIAS DE INVENTARIO', 'OP-PRUEBA', 'BODEGA 1', 'Operador de prueba', 'Líder de prueba', '22/10/2026', 'DOCUMENTO DE PRUEBA — NO OFICIAL', 'Observaciones de verificación']) assert.ok(html.includes(text), text)
  assert.match(html, /class="difference-verified"[^>]*><\/td>/)
  assert.doesNotMatch(html, /firma|signature|sidebar|<button|<input/i)
  assert.doesNotMatch(render({ ...document(rows), demo: false }), /DOCUMENTO DE PRUEBA/)
})
test('all rows and long names survive rendering, with print pagination and white styles independent of theme', () => {
  const many = Array.from({ length: 120 }, (_, i) => ({ ...rows[i % 2], id: String(i), code: `SKU-${i}-` + 'X'.repeat(50), name: `Producto ${i} ` + 'descripción completa '.repeat(8) }))
  const html = render(document(many)), css = fs.readFileSync(path.join(root, 'difference-print.css'), 'utf8')
  assert.equal((html.match(/class="difference-verified"/g) ?? []).length, 120)
  assert.match(html, /Producto 119/); assert.doesNotMatch(html, /ellipsis|line-clamp|firma/i)
  for (const text of ['@media print', 'size: A5 portrait', 'size: A4 portrait', 'table-header-group', 'break-inside: avoid', 'color-scheme: light', 'overflow-wrap: anywhere']) assert.ok(css.includes(text), text)
})

const ticket = '00000000-0000-4000-8000-000000000001'
function serverFixture({ role = 'lider', wrongWarehouse = false, auth = true, contextError = false, snapshotError = false, changed = false, comparison = rows, pageCount = rows.length } = {}) {
  const log = [], context = { userId: 'U', globalAdmin: role === 'administrador', warehouses: [{ id: wrongWarehouse ? 'OTHER' : 'W', role, name: 'BODEGA 1' }], people: [{ id: 'OP', name: 'Operador' }, { id: 'LEADER', name: 'Líder' }], members: [], users: [] }
  const db = {
    rpc: async name => { log.push(name); assert.equal(name, 'inventario_contexto'); return { data: context, error: contextError ? {} : null } },
    from: table => { let columns; const b = { select: c => { columns = c; return b }, eq: () => b, single: async () => { log.push(`${table}:${columns}`); return { data: table === 'inventario_categorias' ? { nombre: 'Categoría real' } : columns === 'bodega_id' ? { bodega_id: 'W' } : { version: changed ? 9 : 8 }, error: null } } }; return b },
  }
  const api = load('difference-print.server.ts', {
    '@/utils/supabase/server': { createClient: async () => db },
    '@/utils/supabase/session.server': { getAuthUser: async () => ({ data: { user: auth ? { id: 'U' } : null }, error: null }) },
    './actions': {
      getTaskSnapshot: async (id, supervisor) => { log.push('comparison'); assert.equal(id, ticket); assert.equal(supervisor, true); return snapshotError ? { error: 'Acceso revocado' } : { task: { numero: 'OP-REAL', version: 8, bodega_id: 'W', categoria_id: 'C', total_productos: pageCount, asignado_a: 'OP', lider_id: 'LEADER', es_prueba: true }, comparison } },
      getCountProducts: async () => { log.push('units'); return { products: comparison.map(p => ({ id: p.id, unit: p.unit, countedAt: '2026-10-22T18:20:00Z' })) } },
    },
  })
  return { read: () => api.getDifferencePrintData(ticket), log }
}
test('server denies anonymous/operators/unauthorized warehouse before requesting quantities', async () => {
  for (const options of [{ auth: false }, { role: 'operador' }, { wrongWarehouse: true }, { contextError: true }]) {
    const f = serverFixture(options), result = await f.read()
    assert.ok(result.error); assert.equal(result.data, undefined); assert.ok(!f.log.includes('comparison'))
  }
})
test('leader and authorized administrator receive real ticket data with no mutations', async () => {
  for (const role of ['lider', 'administrador']) {
    const f = serverFixture({ role }), result = await f.read()
    assert.equal(result.error, undefined); assert.equal(result.data.ticket, 'OP-REAL'); assert.equal(result.data.rows.length, 2)
    assert.equal(result.data.operator, 'Operador'); assert.equal(result.data.leader, 'Líder'); assert.equal(result.data.category, 'Categoría real')
    assert.equal(result.data.rows[0].unit, 'KG'); assert.equal(result.data.countedAt, '2026-10-22T18:20:00Z')
    assert.equal(f.log.filter(x => x === 'comparison').length, 1)
  }
})
test('revoked access, concurrent update and truncated comparison never return a printable payload', async () => {
  for (const options of [{ snapshotError: true }, { changed: true }, { pageCount: 100 }]) {
    const result = await serverFixture(options).read(); assert.ok(result.error); assert.equal(result.data, undefined)
  }
})
