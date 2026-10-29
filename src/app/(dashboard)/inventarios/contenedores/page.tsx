import Link from 'next/link'
import { getInventoryAccess } from '@/modules/inventarios/access.server'
import { InventoryAccessState } from '@/modules/inventarios/components/InventoryAccessState'
import ContainersView from '../ContainersView'

export default async function ContainersPage() {
  const access = await getInventoryAccess()
  if (access.status === 'error') return <InventoryAccessState error />
  if (!access.canEnter) return <InventoryAccessState />
  return <div className="space-y-5">
    <Link href="/inventarios/registros" className="text-sm text-accent-foreground hover:underline">Volver a Inventarios</Link>
    <ContainersView />
  </div>
}
