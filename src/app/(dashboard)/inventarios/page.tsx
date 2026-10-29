import { getInventoryAccess } from '@/modules/inventarios/access.server'
import { InventoryAccessState } from '@/modules/inventarios/components/InventoryAccessState'
import { getOperationData } from '@/modules/inventarios/operations/service.server'
import { InventoryOverview } from '@/modules/inventarios/operations/InventoryOverview'
import { NewInventory } from '@/modules/inventarios/operations/NewInventory'

export default async function InventariosPage() {
  const access=await getInventoryAccess()
  if(access.status==='error')return <InventoryAccessState error />
  if(!access.canEnter)return <InventoryAccessState />
  const data=await getOperationData()
  return access.canViewReports?<InventoryOverview data={data}/>:<NewInventory data={data}/>
}
