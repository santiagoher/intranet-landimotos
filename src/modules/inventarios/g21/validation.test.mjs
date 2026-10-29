import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const directory = dirname(fileURLToPath(import.meta.url))
const loaded = new Map()
function load(name) {
  const file = resolve(directory, name)
  if (loaded.has(file)) return loaded.get(file)
  const vmModule = { exports: {} }
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  vm.runInNewContext(source, {
    module: vmModule, exports: vmModule.exports, Date, Object, Set, Map,
    require: name => name === 'server-only' ? {} : name.startsWith('./') ? load(`${name.slice(2)}.ts`) : require(name),
  }, { filename: file })
  loaded.set(file, vmModule.exports)
  return vmModule.exports
}

const { assembleStockSnapshot, toBlindCountProducts, movementPageSchema } = load('validation.server.ts')
const { getG21ReadAdapter } = load('adapter.server.ts')
const scope = { warehouseId: 'TEST-WAREHOUSE', categoryId: 'TEST-CATEGORY' }
function product(id) {
  return {
    id, sku: `TEST-${id}`, name: `Producto de prueba ${id}`, categoryId: scope.categoryId,
    baseUnitCode: 'UND', active: true,
    barcodes: [{ value: `TEST-BARCODE-${id}`, productId: id, unitCode: 'UND', symbology: null }],
    conversions: [{ unitCode: 'CAJA', baseUnitCode: 'UND', baseUnitsPerUnit: '12', authorizationReference: 'TEST-AUTH' }],
  }
}
function page(items, options = {}) {
  return {
    snapshotId: 'TEST-SNAPSHOT', stockAsOf: '2026-01-01T10:00:00.000Z', scope,
    completeness: 'complete', items,
    pagination: { cursor: null, nextCursor: null, limit: 10, totalRecords: items.length },
    ...options,
  }
}
function line(id, quantity = '0') { return { product: product(id), quantity, location: null } }
function assertError(result, code) {
  assert.equal(result.ok, false)
  assert.equal(result.error.code, code)
}

test('el adaptador pendiente falla cerrado sin exponer ninguna mutación ERP', async () => {
  const adapter = getG21ReadAdapter()
  for (const operation of Object.values(adapter)) {
    assertError(await operation(scope), 'G21_INTEGRATION_PENDING')
  }
  assert.equal('sendAdjustment' in adapter, false)
})

test('un corte paginado completo conserva decimales y ceros sin pérdida e impide modificar la fotografía', () => {
  const first = page([line('A', '9007199254740993.125')], {
    pagination: { cursor: null, nextCursor: 'next', limit: 1, totalRecords: 2 },
  })
  const second = page([line('B', '0')], {
    pagination: { cursor: 'next', nextCursor: null, limit: 1, totalRecords: 2 },
  })
  const result = assembleStockSnapshot(scope, [first, second])
  assert.equal(result.ok, true)
  assert.equal(result.data.lines[0].quantity, '9007199254740993.125')
  assert.equal(result.data.lines[1].quantity, '0')
  assert.equal(Object.isFrozen(result.data.lines[0].product.conversions[0]), true)
  first.items[0].quantity = '1'
  assert.equal(result.data.lines[0].quantity, '9007199254740993.125')
  assert.ok(result.data.capturedAt.endsWith('Z'))
})

test('falta de páginas, cursor repetido o datos parciales impiden generar una fotografía', () => {
  const partial = page([line('A')], { pagination: { cursor: null, nextCursor: 'next', limit: 1, totalRecords: 2 } })
  assertError(assembleStockSnapshot(scope, [partial]), 'G21_INCOMPLETE_RESPONSE')
  assertError(assembleStockSnapshot(scope, [partial, partial]), 'G21_INCOMPLETE_RESPONSE')
  assertError(assembleStockSnapshot(scope, [page([line('A')], { completeness: 'unknown' })]), 'G21_INCOMPLETE_RESPONSE')
  assertError(assembleStockSnapshot(scope, [page([])]), 'G21_INCOMPLETE_RESPONSE')
})

test('cortes distintos o una bodega fuera de alcance se rechazan', () => {
  assertError(assembleStockSnapshot(scope, [page([line('A')], { scope: { ...scope, warehouseId: 'OTHER' } })]), 'G21_INCONSISTENT_SNAPSHOT')
  const first = page([line('A')], { pagination: { cursor: null, nextCursor: 'next', limit: 1, totalRecords: 2 } })
  const second = page([line('B')], { snapshotId: 'OTHER', pagination: { cursor: 'next', nextCursor: null, limit: 1, totalRecords: 2 } })
  assertError(assembleStockSnapshot(scope, [first, second]), 'G21_INCONSISTENT_SNAPSHOT')
})

test('un producto ausente no se interpreta como saldo cero', () => {
  const selected = { ...scope, productIds: ['A', 'B'] }
  assertError(assembleStockSnapshot(selected, [page([line('A')], { scope: selected })]), 'G21_INCOMPLETE_RESPONSE')
})

test('cantidades flotantes, unidades sin autorización y códigos ambiguos se rechazan', () => {
  assertError(assembleStockSnapshot(scope, [page([{ ...line('A'), quantity: 0 }])]), 'G21_INVALID_RESPONSE')
  const invalidUnit = line('A')
  invalidUnit.product.conversions[0].baseUnitsPerUnit = '0'
  assertError(assembleStockSnapshot(scope, [page([invalidUnit])]), 'G21_INVALID_RESPONSE')
  const ambiguousCode = line('B')
  ambiguousCode.product.barcodes[0].value = 'TEST-BARCODE-A'
  assertError(assembleStockSnapshot(scope, [page([line('A'), ambiguousCode])]), 'G21_INCONSISTENT_SNAPSHOT')
  assertError(assembleStockSnapshot(scope, [page([line('A'), line('A')])]), 'G21_INCONSISTENT_SNAPSHOT')
})

test('el DTO del conteo ciego no contiene saldos, diferencias ni metadatos del corte', () => {
  const result = assembleStockSnapshot(scope, [page([line('A', '12345.67')])])
  assert.equal(result.ok, true)
  const serialized = JSON.stringify(toBlindCountProducts(result.data))
  assert.ok(serialized.includes('TEST-A'))
  for (const prohibited of ['12345.67', 'quantity', 'stockAsOf', 'snapshotId', 'difference', 'movement']) {
    assert.equal(serialized.includes(prohibited), false)
  }
})

test('los movimientos respetan (corte, fin], el signo y la confirmación de completitud', () => {
  const request = { ...scope, fromExclusive: '2026-01-01T10:00:00.000Z', toInclusive: '2026-01-01T10:30:00.000Z' }
  const movement = {
    id: 'TEST-MOVEMENT', productId: 'A', warehouseId: scope.warehouseId, locationId: null,
    occurredAt: request.toInclusive, kind: 'exit', quantityDelta: '-1', baseUnitCode: 'UND',
    sourceDocumentId: 'TEST-DOCUMENT', transferId: null,
  }
  const payload = { request, completeness: 'complete', completeThrough: request.toInclusive,
    reconciliationToken: 'TEST-RECONCILIATION', pagination: { cursor: null, nextCursor: null, totalRecords: 1, limit: 10 }, items: [movement] }
  assert.equal(movementPageSchema.safeParse(payload).success, true)
  assert.equal(movementPageSchema.safeParse({ ...payload, items: [{ ...movement, occurredAt: request.fromExclusive }] }).success, false)
  assert.equal(movementPageSchema.safeParse({ ...payload, items: [{ ...movement, quantityDelta: '1' }] }).success, false)
  assert.equal(movementPageSchema.safeParse({ ...payload, reconciliationToken: null }).success, false)
  assert.equal(movementPageSchema.safeParse({ ...payload, completeThrough: request.fromExclusive }).success, false)
})
