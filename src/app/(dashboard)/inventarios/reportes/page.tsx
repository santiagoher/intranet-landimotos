import { getInventoryAccess } from '@/modules/inventarios/access.server'
import { InventoryAccessState } from '@/modules/inventarios/components/InventoryAccessState'
import { getOperationData } from '@/modules/inventarios/operations/service.server'
import { OperationsPanel } from '@/modules/inventarios/operations/OperationsPanel'
import { getHistoricalInventory } from '@/modules/inventarios/local/source.server'
import { InventoryExcel } from '@/modules/inventarios/components/InventoryExcel'

export default async function InventoryReportsPage() {
  const access = await getInventoryAccess()
  if (access.status === 'error') return <InventoryAccessState error />
  if (!access.canViewReports) return <InventoryAccessState />
  const historical = await getHistoricalInventory()
  const data = await getOperationData({reports:true})
  return <div className="space-y-8"><OperationsPanel data={data} initialNow={data.fetchedAt} reports />
    {historical && <details className="rounded-xl border border-border p-5">
      <summary className="cursor-pointer text-sm font-medium">Histórico del Excel y control por categoría</summary>
      <div className="mt-6"><InventoryExcel data={historical} reports today={new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())} /></div>
    </details>}
  </div>
}
