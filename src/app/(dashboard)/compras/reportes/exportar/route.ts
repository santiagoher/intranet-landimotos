import { requireCompras, ComprasError } from '@/modules/compras/service.server'
import { createClient } from '@/utils/supabase/server'
import { filtersSchema } from '@/modules/compras/validation'
import { comprasWorkbook, type ExportData } from '@/modules/compras/excel.server'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(request:Request){
  try{
    await requireCompras(true)
    const filters=filtersSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if(!filters.success)return Response.json({error:'Filtros no válidos.'},{status:400})
    const db=await createClient();const {data,error}=await db.rpc('compras_exportar',{p_filtros:filters.data})
    if(error)throw new ComprasError('No se pudo generar el reporte.',503)
    const buffer=await comprasWorkbook(data as ExportData)
    return new Response(new Uint8Array(buffer),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="compras.xlsx"','Cache-Control':'private, no-store'}})
  }catch(error){return Response.json({error:error instanceof ComprasError?error.message:'No se pudo exportar el reporte.'},{status:error instanceof ComprasError?error.status:500,headers:{'Cache-Control':'private, no-store'}})}
}
