import 'server-only'

import { G21_INTEGRATION_STATUS } from './contracts'
import type { G21ReadAdapter, G21Result } from './contracts'

/** Future transport configuration; only populated after confirming the vendor contract. */
export interface G21VerifiedTransportConfig {
  readonly contractVersion: string
  readonly baseUrl: URL
  readonly routes: Readonly<Record<'warehouses' | 'categories' | 'products' | 'stock' | 'movements' | 'barcodes', string>>
  readonly timeoutMs: number
  /** Implemented using backend secrets, never serialized in a Client Component or log. */
  readonly getAuthorizationHeaders: () => Promise<Readonly<Record<string, string>>>
}

/** No endpoint or credential is assumed. Replacing this adapter requires a reviewed ERP contract. */
async function pending<T>(): Promise<G21Result<T>> {
  return {
    ok: false,
    error: {
      code: 'G21_INTEGRATION_PENDING',
      message: G21_INTEGRATION_STATUS.message,
      retryable: false,
    },
  }
}

export function getG21ReadAdapter(): G21ReadAdapter {
  return Object.freeze({
    listWarehouses: pending,
    listCategories: pending,
    listProducts: pending,
    listBarcodes: pending,
    resolveBarcode: pending,
    captureStockSnapshot: pending,
    listMovements: pending,
  })
}
