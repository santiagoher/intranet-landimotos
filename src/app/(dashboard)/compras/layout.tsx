import { requireCompras, ComprasError } from '@/modules/compras/service.server'
import { ComprasMessage } from '@/modules/compras/components'
import { ComprasHeader } from '@/modules/compras/Header'

export default async function ComprasLayout({children}:{children:React.ReactNode}) {
  try { await requireCompras() }
  catch(error){if(error instanceof ComprasError)return <ComprasMessage message={error.message}/>;throw error}
  return (
    <div className="space-y-7">
      <ComprasHeader />
      {children}
    </div>
  )
}
