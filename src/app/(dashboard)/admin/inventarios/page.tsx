import { getInventoryAccess } from '@/modules/inventarios/access.server'
import { InventoryAccessState } from '@/modules/inventarios/components/InventoryAccessState'
import { InventoryConfiguration } from '@/modules/inventarios/components/InventoryConfiguration'
import { getOperationData } from '@/modules/inventarios/operations/service.server'
import { TeamPanel } from '@/modules/inventarios/operations/OperationsPanel'

export default async function InventoryConfigurationPage() {
  const access = await getInventoryAccess()
  if (access.status === 'error') return <InventoryAccessState error />
  if (!access.canConfigure) return <InventoryAccessState />
  if (access.inventoryAdmin) {
    const data = await getOperationData()
    return <div className="space-y-6"><h1 className="page-title">Configuración de inventarios</h1><TeamPanel data={data} /></div>
  }
  return <InventoryConfiguration access={access} />
}
