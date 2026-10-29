import 'server-only'

import { z } from 'zod'
import type { BlindCountProduct, G21Result, G21StockScope, G21StockSnapshot } from './contracts'

const identifier = z.string().trim().min(1).max(200)
const optionalText = z.string().max(200).nullable()
const uniqueIdentifiers = z.array(identifier).min(1).refine(values => new Set(values).size === values.length)
export const utcInstantSchema = z.iso.datetime({ offset: false })
export const decimalQuantitySchema = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/)
export const positiveDecimalSchema = decimalQuantitySchema.refine(value => !value.startsWith('-') && /[1-9]/.test(value))

export const warehouseSchema = z.object({ id: identifier, code: identifier, name: identifier, active: z.boolean() })
export const categorySchema = z.object({ id: identifier, code: identifier, name: identifier, active: z.boolean() })
export const barcodeSchema = z.object({
  value: z.string().min(1).max(256),
  productId: identifier,
  unitCode: identifier,
  symbology: optionalText,
})
export const conversionSchema = z.object({
  unitCode: identifier,
  baseUnitCode: identifier,
  baseUnitsPerUnit: positiveDecimalSchema,
  authorizationReference: identifier,
})
export const productSchema = z.object({
  id: identifier,
  sku: identifier,
  name: z.string().trim().min(1).max(500),
  categoryId: identifier,
  baseUnitCode: identifier,
  active: z.boolean(),
  barcodes: z.array(barcodeSchema),
  conversions: z.array(conversionSchema),
}).superRefine((product, ctx) => {
  const units = new Set([product.baseUnitCode])
  for (const conversion of product.conversions) {
    if (conversion.baseUnitCode !== product.baseUnitCode || units.has(conversion.unitCode)) {
      ctx.addIssue({ code: 'custom', message: 'Conversión de unidad inconsistente.' })
    }
    units.add(conversion.unitCode)
  }
  const codes = new Set<string>()
  for (const barcode of product.barcodes) {
    if (barcode.productId !== product.id || !units.has(barcode.unitCode) || codes.has(barcode.value)) {
      ctx.addIssue({ code: 'custom', message: 'Código de barras inconsistente.' })
    }
    codes.add(barcode.value)
  }
})

export const stockScopeSchema = z.object({
  warehouseId: identifier,
  categoryId: identifier,
  productIds: uniqueIdentifiers.optional(),
  locationIds: uniqueIdentifiers.optional(),
})
export const paginationSchema = z.object({
  cursor: identifier.nullable(),
  nextCursor: identifier.nullable(),
  limit: z.number().int().positive().max(1000),
  totalRecords: z.number().int().nonnegative(),
})
export const locationSchema = z.object({
  id: identifier,
  aisle: optionalText,
  shelf: optionalText,
  position: optionalText,
})
export const stockPageSchema = z.object({
  snapshotId: identifier,
  stockAsOf: utcInstantSchema,
  scope: stockScopeSchema,
  completeness: z.enum(['complete', 'partial', 'unknown']),
  pagination: paginationSchema,
  items: z.array(z.object({
    product: productSchema,
    location: locationSchema.nullable(),
    quantity: decimalQuantitySchema,
  })),
})

export const movementRequestSchema = stockScopeSchema.extend({
  fromExclusive: utcInstantSchema,
  toInclusive: utcInstantSchema,
}).refine(value => Date.parse(value.fromExclusive) < Date.parse(value.toInclusive), {
  message: 'El intervalo de conciliación debe tener inicio y fin válidos.',
})

export const movementPageSchema = z.object({
  request: movementRequestSchema,
  completeness: z.enum(['complete', 'partial', 'unknown']),
  completeThrough: utcInstantSchema.nullable(),
  reconciliationToken: identifier.nullable(),
  pagination: paginationSchema,
  items: z.array(z.object({
    id: identifier,
    productId: identifier,
    warehouseId: identifier,
    locationId: identifier.nullable(),
    occurredAt: utcInstantSchema,
    kind: z.enum(['entry', 'exit', 'transfer_in', 'transfer_out', 'adjustment']),
    quantityDelta: decimalQuantitySchema,
    baseUnitCode: identifier,
    sourceDocumentId: identifier,
    transferId: identifier.nullable(),
  })),
}).superRefine((page, ctx) => {
  if (page.items.length > page.pagination.limit) {
    ctx.addIssue({ code: 'custom', message: 'Página de movimientos fuera del límite.' })
  }
  const ids = new Set<string>()
  for (const movement of page.items) {
    const timestamp = Date.parse(movement.occurredAt)
    const outsideScope = movement.warehouseId !== page.request.warehouseId
      || (page.request.productIds && !page.request.productIds.includes(movement.productId))
      || (page.request.locationIds && (!movement.locationId || !page.request.locationIds.includes(movement.locationId)))
    const outsideWindow = timestamp <= Date.parse(page.request.fromExclusive) || timestamp > Date.parse(page.request.toInclusive)
    const negative = movement.quantityDelta.startsWith('-')
    const nonzero = /[1-9]/.test(movement.quantityDelta)
    const inconsistentSign = (['entry', 'transfer_in'].includes(movement.kind) && negative)
      || (['exit', 'transfer_out'].includes(movement.kind) && !negative && nonzero)
    if (outsideScope || outsideWindow || ids.has(movement.id) || inconsistentSign) {
      ctx.addIssue({ code: 'custom', message: 'Movimiento fuera de alcance o inconsistente.' })
    }
    if (movement.kind.startsWith('transfer_') && !movement.transferId) {
      ctx.addIssue({ code: 'custom', message: 'Transferencia sin referencia.' })
    }
    ids.add(movement.id)
  }
  if (page.completeness === 'complete' && (!page.reconciliationToken || !page.completeThrough
    || Date.parse(page.completeThrough) < Date.parse(page.request.toInclusive))) {
    ctx.addIssue({ code: 'custom', message: 'Falta confirmar el corte de movimientos.' })
  }
})

function scopeKey(scope: G21StockScope): string {
  return JSON.stringify([
    scope.warehouseId,
    scope.categoryId,
    scope.productIds ? [...scope.productIds].sort() : null,
    scope.locationIds ? [...scope.locationIds].sort() : null,
  ])
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

/** Called by a future server adapter after collecting ALL pages from one ERP consistent read. */
export function assembleStockSnapshot(expectedScope: G21StockScope, rawPages: unknown): G21Result<G21StockSnapshot> {
  const requested = stockScopeSchema.safeParse(expectedScope)
  const parsed = z.array(stockPageSchema).min(1).safeParse(rawPages)
  if (!requested.success || !parsed.success) {
    return { ok: false, error: { code: 'G21_INVALID_RESPONSE', message: 'G21 devolvió un formato de saldo no válido.', retryable: false } }
  }
  const pages = parsed.data
  const first = pages[0]
  const lines: G21StockSnapshot['lines'][number][] = []
  const rowKeys = new Set<string>()
  const cursors = new Set<string | null>()
  const barcodeOwners = new Map<string, string>()
  const products = new Map<string, string>()
  let cursor: string | null = null

  for (const page of pages) {
    if (page.snapshotId !== first.snapshotId || page.stockAsOf !== first.stockAsOf
      || scopeKey(page.scope) !== scopeKey(requested.data)
      || page.pagination.totalRecords !== first.pagination.totalRecords) {
      return { ok: false, error: { code: 'G21_INCONSISTENT_SNAPSHOT', message: 'Las páginas de G21 no pertenecen al mismo corte y alcance.', retryable: true } }
    }
    if (page.completeness !== 'complete' || page.pagination.cursor !== cursor || cursors.has(cursor)
      || page.items.length > page.pagination.limit || page.items.length === 0) {
      return { ok: false, error: { code: 'G21_INCOMPLETE_RESPONSE', message: 'G21 no confirmó todas las páginas y productos del inventario.', retryable: true } }
    }
    cursors.add(cursor)
    for (const line of page.items) {
      const rowKey = JSON.stringify([line.product.id, line.location?.id ?? null])
      const outsideScope = line.product.categoryId !== requested.data.categoryId
        || (requested.data.productIds && !requested.data.productIds.includes(line.product.id))
        || (requested.data.locationIds && (!line.location || !requested.data.locationIds.includes(line.location.id)))
      const priorProduct = products.get(line.product.id)
      if (outsideScope || rowKeys.has(rowKey) || (priorProduct && priorProduct !== JSON.stringify(line.product))) {
        return { ok: false, error: { code: 'G21_INCONSISTENT_SNAPSHOT', message: 'El corte contiene productos duplicados, incompatibles o fuera de alcance.', retryable: false } }
      }
      for (const barcode of line.product.barcodes) {
        const owner = barcodeOwners.get(barcode.value)
        if (owner && owner !== line.product.id) {
          return { ok: false, error: { code: 'G21_INCONSISTENT_SNAPSHOT', message: 'Un código de barras identifica más de un producto.', retryable: false } }
        }
        barcodeOwners.set(barcode.value, line.product.id)
      }
      products.set(line.product.id, JSON.stringify(line.product))
      rowKeys.add(rowKey)
      lines.push(line)
    }
    cursor = page.pagination.nextCursor
  }

  if (cursor !== null || lines.length !== first.pagination.totalRecords || lines.length === 0) {
    return { ok: false, error: { code: 'G21_INCOMPLETE_RESPONSE', message: 'El saldo está incompleto o no contiene productos para asignar.', retryable: true } }
  }
  if (requested.data.productIds?.some(id => !products.has(id))) {
    return { ok: false, error: { code: 'G21_INCOMPLETE_RESPONSE', message: 'Faltan productos del alcance solicitado; un saldo cero debe recibirse explícitamente.', retryable: false } }
  }
  const capturedAt = new Date().toISOString()
  if (Date.parse(first.stockAsOf) > Date.parse(capturedAt)) {
    return { ok: false, error: { code: 'G21_INCONSISTENT_SNAPSHOT', message: 'La fecha de corte del ERP es posterior a la captura del servidor.', retryable: false } }
  }
  return {
    ok: true,
    data: deepFreeze({ source: 'g21', snapshotId: first.snapshotId, stockAsOf: first.stockAsOf,
      capturedAt, scope: requested.data, lines, totalRecords: lines.length, complete: true }),
  }
}

/** Only an authorized server service may choose which snapshot/ticket the operator can see. */
export function toBlindCountProducts(snapshot: G21StockSnapshot): readonly BlindCountProduct[] {
  return snapshot.lines.map(({ product, location }) => ({
    productId: product.id,
    sku: product.sku,
    name: product.name,
    baseUnitCode: product.baseUnitCode,
    location,
    barcodes: product.barcodes,
    conversions: product.conversions,
  }))
}
