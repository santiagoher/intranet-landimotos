'use server'
import {z} from 'zod'
import {revalidatePath} from 'next/cache'
import {demoSource} from './demo-source.server'
import type {BlindCatalogProduct} from './types'
const scope=z.object({warehouse:z.string().uuid(),category:z.string().uuid()})
export async function getBlindCatalog(input:unknown):Promise<{products?:BlindCatalogProduct[];error?:string}> {
  const parsed=scope.strict().safeParse(input)
  if(!parsed.success)return {error:'Selecciona una bodega y categoría válidas.'}
  try {return {products:await (await demoSource()).products(parsed.data.warehouse,parsed.data.category)}}
  catch(error){return {error:error instanceof Error?error.message:'No se pudo consultar el catálogo DEMO.'}}
}
export async function createOwnInventory(input:unknown):Promise<{ticket?:string;error?:string}> {
  const parsed=scope.extend({subcategory:z.string().max(120).default(''),brand:z.string().max(120).default(''),key:z.string().uuid(),note:z.string().max(2000),productIds:z.array(z.string().uuid()).min(1).max(2000)}).strict().safeParse(input)
  if(!parsed.success)return {error:'Revisa el alcance y las observaciones.'}
  try {
    const ticket=await (await demoSource()).create(parsed.data)
    revalidatePath('/inventarios');revalidatePath('/inventarios/registros');revalidatePath('/inventarios/reportes')
    return {ticket}
  } catch(error){return {error:error instanceof Error?error.message:'No se pudo confirmar. Reintenta con los mismos datos.'}}
}
