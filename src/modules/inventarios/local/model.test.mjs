import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const mod = { exports: {} }
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./model.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: mod.exports, module: mod })
const { normalizeExcel, excelDate, categoryStatus } = mod.exports
const source = JSON.parse(readFileSync(new URL('./excel-source.json', import.meta.url), 'utf8'))
const data = normalizeExcel(source)

test('six source warehouses, 184 history rows and no pivot totals imported as categories', () => {
  assert.equal(data.warehouses.length, 6)
  assert.deepEqual(Array.from(data.warehouses, w => w.records.length), [3, 1, 38, 48, 84, 10])
  for (const w of data.warehouses) {
    assert.ok(w.categories.length > 0)
    assert.equal(w.categories.some(c => /Total general|Etiquetas de fila/.test(c.name)), false)
    assert.equal(w.categories.length, new Set(w.categories.map(c => c.name.toUpperCase())).size)
  }
})
test('empty values and zeros are preserved; confirmed corrections retain original values', () => {
  const b2 = data.warehouses.find(w => w.name === 'BODEGA 2')
  assert.equal(b2.records[0].surplus, null)
  const b1 = data.warehouses[0]
  assert.equal(b1.records.find(r => r.row === 3).surplus, '0')
  const b22 = data.warehouses.find(w => w.name === 'BODEGA 22')
  const lubricants = b22.records.find(r => r.category === 'LUBRICANTES GRAV')
  assert.equal(lubricants.total, '1998')
  assert.equal(lubricants.originalTotal, '8806000')
  const handles = b22.records.find(r => r.category === 'MANIGUETAS')
  assert.equal(handles.total, '4617')
  assert.equal(handles.originalTotal, '4289000')
  assert.ok(handles.correction)
  const updated = structuredClone(source)
  updated.sheets.find(w => w.name === 'BODEGA 22').rows.find(r => r.row === 10).cells.C = '5000'
  const reimported = normalizeExcel(updated).warehouses.find(w => w.name === 'BODEGA 22').records.find(r => r.row === 10)
  assert.equal(reimported.total, '5000')
  assert.equal(reimported.correction, null)
})
test('calendar dates and alert boundaries do not depend on Excel cached TODAY results', () => {
  assert.equal(excelDate('46309'), '2026-10-14')
  assert.equal(excelDate('60'), null)
  assert.equal(excelDate('1', true), '1904-01-02')
  assert.equal(categoryStatus(null, '2026-10-20'), 'Sin inventario')
  assert.equal(categoryStatus('2026-10-11', '2026-10-20'), 'Al día')
  assert.equal(categoryStatus('2026-10-10', '2026-10-20'), 'Por realizar')
  assert.equal(categoryStatus('2026-09-20', '2026-10-20'), 'Por realizar')
  assert.equal(categoryStatus('2026-09-19', '2026-10-20'), 'Crítico')
  assert.equal(categoryStatus('2026-10-21', '2026-10-20'), 'Fecha por revisar')
})
test('server source refuses unlinked or inactive access, independent of client UI', async () => {
  const code = ts.transpileModule(readFileSync(new URL('./source.server.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  for (const access of [
    { status: 'denied', canConfigure: false, platformAdmin: false },
    { status: 'ready', canConfigure: true, platformAdmin: false },
    { status: 'error', canConfigure: true, platformAdmin: true },
    { status: 'ready', canConfigure: true, platformAdmin: true },
  ]) {
    const result = { exports: {} }
    vm.runInNewContext(code, { module: result, exports: result.exports, require: name => {
      if (name === 'server-only') return {}
      if (name === '../access.server') return { getInventoryAccess: async () => access }
      if (name === './excel-source.json') return source
      if (name === './model') return mod.exports
      throw Error(name)
    } })
    const value = await result.exports.getHistoricalInventory()
    assert.equal(value !== null, access.status === 'ready' && access.platformAdmin)
  }
})
