import { equipoCompras, ComprasError } from '@/modules/compras/service.server'
import { ComprasMessage } from '@/modules/compras/components'
import { ComprasTeam } from '@/modules/compras/Team'
export default async function Page(){
  try{return <ComprasTeam personas={await equipoCompras()}/>}
  catch(error){if(error instanceof ComprasError)return <ComprasMessage message={error.message}/>;throw error}
}
