import 'server-only'
import { getInventoryAccess } from '../access.server'
import source from './excel-source.json'
import { normalizeExcel } from './model'

// The workbook is an administrative import under review, not ERP warehouse data.
// No name-based account/warehouse matching, memberships or stock are fabricated.
export async function getHistoricalInventory() {
  const access = await getInventoryAccess()
  if (access.status !== 'ready' || !access.canConfigure || !access.platformAdmin) return null
  return normalizeExcel(source)
}
