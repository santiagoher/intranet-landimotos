import { ComprasBoard } from '@/modules/compras/Board'
import { ComprasError } from '@/modules/compras/service.server'
import { ComprasMessage } from '@/modules/compras/components'
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  try{return await ComprasBoard({params:await searchParams})}
  catch(error){if(error instanceof ComprasError)return <ComprasMessage message={error.message}/>;throw error}
}
