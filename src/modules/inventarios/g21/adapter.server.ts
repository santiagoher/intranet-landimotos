import 'server-only'

import { G21_INTEGRATION_STATUS } from './contracts'
import type { G21ReadAdapter, G21Result } from './contracts'

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
    captureStockSnapshot: pending,
    listMovements: pending,
  })
}
