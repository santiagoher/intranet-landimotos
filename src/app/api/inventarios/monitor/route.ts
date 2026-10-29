import { getOperationData } from '@/modules/inventarios/operations/service.server'
export const dynamic='force-dynamic'
export async function GET(request:Request) {
  const headers={'Cache-Control':'private, no-store'}
  try {
    const params=new URL(request.url).searchParams
    const data=await getOperationData({reports:params.get('reports')==='true',compact:params.get('compact')==='true',signal:request.signal})
    return Response.json(data,{headers})
  }catch(error){
    const status=error&&typeof error==='object'&&'status' in error&&typeof error.status==='number'?error.status:503
    return Response.json({error:'No se pudo actualizar el inventario.'},{status,headers:{...headers,'Retry-After':'30'}})
  }
}
