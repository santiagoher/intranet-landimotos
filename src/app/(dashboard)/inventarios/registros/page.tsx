import { getInventoryAccess } from '@/modules/inventarios/access.server'
import { InventoryAccessState } from '@/modules/inventarios/components/InventoryAccessState'
import { getOperationData } from '@/modules/inventarios/operations/service.server'
import { OperationsPanel } from '@/modules/inventarios/operations/OperationsPanel'

export default async function InventoryRecordsPage({searchParams}:{searchParams:Promise<{ticket?:string}>}) {
  const access = await getInventoryAccess()
  if (access.status === 'error') return <InventoryAccessState error />
  if (!access.canEnter) return <InventoryAccessState />
  const data = await getOperationData()
  return <OperationsPanel data={data} initialNow={data.fetchedAt} initialTicket={(await searchParams).ticket} />
}
