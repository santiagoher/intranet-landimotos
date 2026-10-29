/** Internal contracts, not a claim about the ERP's unconfirmed HTTP API. */
export const G21_INTEGRATION_STATUS = Object.freeze({
  status: 'pending' as const,
  label: 'Integración pendiente',
  message: 'Se requieren los endpoints y saldos oficiales de G21 para habilitar inventarios físicos.',
  canReadOfficialStock: false,
  canCreateInventory: false,
  canSendAdjustments: false,
})

/** Normalized ISO 8601 UTC ending in Z. Validate incoming values at the adapter boundary. */
export type UtcInstant = string
/** Exact decimal string: never coerce ERP quantities or conversion factors into float. */
export type DecimalQuantity = string
export type ErpIdentifier = string

export interface G21Warehouse {
  readonly id: ErpIdentifier
  readonly code: string
  readonly name: string
  readonly active: boolean
}

export interface G21Category {
  readonly id: ErpIdentifier
  readonly code: string
  readonly name: string
  readonly active: boolean
}

export interface G21UnitConversion {
  readonly unitCode: string
  readonly baseUnitCode: string
  readonly baseUnitsPerUnit: DecimalQuantity
  readonly authorizationReference: string
}

export interface G21Barcode {
  readonly value: string
  readonly productId: ErpIdentifier
  readonly unitCode: string
  readonly symbology: string | null
}

export interface G21Location {
  readonly id: ErpIdentifier
  readonly aisle: string | null
  readonly shelf: string | null
  readonly position: string | null
}

export interface G21Product {
  readonly id: ErpIdentifier
  readonly sku: string
  readonly name: string
  readonly categoryId: ErpIdentifier
  readonly baseUnitCode: string
  readonly active: boolean
  readonly barcodes: readonly G21Barcode[]
  readonly conversions: readonly G21UnitConversion[]
}

export interface G21PageRequest {
  readonly cursor: string | null
  readonly limit: number
}

export interface G21Pagination extends G21PageRequest {
  readonly nextCursor: string | null
  readonly totalRecords: number
}

export interface G21Page<T> {
  readonly items: readonly T[]
  readonly pagination: G21Pagination
}

/** Empty product/location arrays are not a valid substitute for an explicit complete scope. */
export interface G21StockScope {
  readonly warehouseId: ErpIdentifier
  readonly categoryId: ErpIdentifier
  readonly productIds?: readonly ErpIdentifier[]
  readonly locationIds?: readonly ErpIdentifier[]
}

export interface G21StockLine {
  readonly product: G21Product
  readonly location: G21Location | null
  readonly quantity: DecimalQuantity
}

export interface G21StockPage extends G21Page<G21StockLine> {
  /** A consistent read/version token issued by the ERP, shared by every page. */
  readonly snapshotId: string
  readonly stockAsOf: UtcInstant
  readonly scope: G21StockScope
  readonly completeness: 'complete' | 'partial' | 'unknown'
}

/** Must be built only after every ERP page passes completeness and consistency validation. */
export interface G21StockSnapshot {
  readonly source: 'g21'
  readonly snapshotId: string
  readonly stockAsOf: UtcInstant
  /** Server capture time, separate from both stockAsOf and the later assignment time. */
  readonly capturedAt: UtcInstant
  readonly scope: G21StockScope
  readonly lines: readonly G21StockLine[]
  readonly totalRecords: number
  readonly complete: true
}

export interface G21MovementRequest extends G21StockScope {
  /** Reconciliation window is (fromExclusive, toInclusive]. */
  readonly fromExclusive: UtcInstant
  readonly toInclusive: UtcInstant
}

export interface G21Movement {
  readonly id: ErpIdentifier
  readonly productId: ErpIdentifier
  readonly warehouseId: ErpIdentifier
  readonly locationId: ErpIdentifier | null
  readonly occurredAt: UtcInstant
  readonly kind: 'entry' | 'exit' | 'transfer_in' | 'transfer_out' | 'adjustment'
  /** Signed delta in the product's base unit; ERP mapping must confirm its semantics. */
  readonly quantityDelta: DecimalQuantity
  readonly baseUnitCode: string
  readonly sourceDocumentId: string
  readonly transferId: string | null
}

export interface G21MovementPage extends G21Page<G21Movement> {
  readonly request: G21MovementRequest
  readonly completeness: 'complete' | 'partial' | 'unknown'
  /** ERP confirmation that even late-posted movements are covered through this point. */
  readonly completeThrough: UtcInstant | null
  readonly reconciliationToken: string | null
}

export type G21ErrorCode =
  | 'G21_INTEGRATION_PENDING'
  | 'G21_UNAUTHORIZED'
  | 'G21_FORBIDDEN'
  | 'G21_UNAVAILABLE'
  | 'G21_RATE_LIMITED'
  | 'G21_INVALID_RESPONSE'
  | 'G21_INCOMPLETE_RESPONSE'
  | 'G21_INCONSISTENT_SNAPSHOT'
  | 'G21_RECONCILIATION_PENDING'
  | 'G21_IDEMPOTENCY_CONFLICT'

export interface G21Error {
  readonly code: G21ErrorCode
  /** Safe message only: never return upstream response bodies, tokens or credentials. */
  readonly message: string
  readonly retryable: boolean
  readonly requestId?: string
  readonly retryAfterSeconds?: number
}

export type G21Result<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: G21Error }

/** Read-only port. Adjustments are deliberately absent until approval/idempotency is validated. */
export interface G21ReadAdapter {
  listWarehouses(page: G21PageRequest): Promise<G21Result<G21Page<G21Warehouse>>>
  listCategories(warehouseId: ErpIdentifier, page: G21PageRequest): Promise<G21Result<G21Page<G21Category>>>
  listProducts(scope: G21StockScope, page: G21PageRequest): Promise<G21Result<G21Page<G21Product>>>
  listBarcodes(productIds: readonly ErpIdentifier[], page: G21PageRequest): Promise<G21Result<G21Page<G21Barcode>>>
  /** Scope a scan to its warehouse; ambiguous codes must not silently pick a product. */
  resolveBarcode(warehouseId: ErpIdentifier, barcode: string): Promise<G21Result<readonly G21Product[]>>
  captureStockSnapshot(scope: G21StockScope): Promise<G21Result<G21StockSnapshot>>
  listMovements(request: G21MovementRequest, page: G21PageRequest): Promise<G21Result<G21MovementPage>>
}

/** Proposed future command contract only; no transport or callable mutation is implemented. */
export interface G21ApprovedAdjustment {
  readonly proposalId: string
  readonly approvedByProfileId: string
  readonly approvedAt: UtcInstant
  readonly warehouseId: ErpIdentifier
  readonly referenceSnapshotId: string
  readonly reconciliationToken: string
  readonly idempotencyKey: string
  readonly lines: readonly {
    readonly productId: ErpIdentifier
    readonly quantityDelta: DecimalQuantity
    readonly baseUnitCode: string
    readonly reason: string
  }[]
}

/** Operator DTO excludes expected stock, movements and differences by construction. */
export interface BlindCountProduct {
  readonly productId: ErpIdentifier
  readonly sku: string
  readonly name: string
  readonly baseUnitCode: string
  readonly location: G21Location | null
  readonly barcodes: readonly G21Barcode[]
  readonly conversions: readonly G21UnitConversion[]
}

/** Future HID/camera/manual input; the server still validates ticket membership and units. */
export interface ScanCapture {
  readonly source: 'hid' | 'camera' | 'manual'
  readonly rawValue: string
  readonly ticketId: string
  readonly idempotencyKey: string
}
