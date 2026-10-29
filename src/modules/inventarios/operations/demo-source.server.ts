import 'server-only'
import {createClient} from '@/utils/supabase/server'
import {selfStartStatus,demoServerKey} from './features.server'
import type {BlindCatalogProduct} from './types'

/** DEMO and G21 have separate transports. This provider never calls the ERP. */
export async function demoSource() {
  const status=selfStartStatus()
  if(!status.enabled)throw new Error(status.reason)
  const db=await createClient()
  const {data:{user},error}=await db.auth.getUser()
  if(error||!user)throw new Error('Inicia sesión para continuar.')
  const context=await db.rpc('inventario_demo_contexto').setHeader('x-inventory-demo-key',demoServerKey()).retry(false)
  if(context.error||!context.data?.enabled||context.data.host!==status.host)
    throw new Error('La base de pruebas no tiene validado el módulo DEMO. No se guardó ningún inventario.')
  return {
    async products(warehouse:string,category:string):Promise<BlindCatalogProduct[]> {
      const result=await db.rpc('inventario_demo_catalogo',{p_bodega:warehouse,p_categoria:category}).setHeader('x-inventory-demo-key',demoServerKey()).retry(false)
      if(result.error)throw new Error(['P0001','42501'].includes(result.error.code)?result.error.message:'No se pudo consultar el catálogo DEMO.')
      return (result.data as BlindCatalogProduct[]).map(p=>({id:p.id,code:p.code,name:p.name,unit:p.unit,barcodes:p.barcodes,subcategory:p.subcategory??null,brand:p.brand??null}))
    },
    async create(input:{key:string;warehouse:string;category:string;subcategory?:string;brand?:string;note:string;productIds:string[]}):Promise<string> {
      const filtered=!!(input.subcategory||input.brand)
      const result=await db.rpc(filtered?'inventario_demo_autoiniciar_filtrado':'inventario_demo_autoiniciar',{p_clave:input.key,p_bodega:input.warehouse,p_categoria:input.category,p_observacion:input.note,p_ids:input.productIds,...(filtered?{p_subcategoria:input.subcategory||null,p_marca:input.brand||null}:{})}).setHeader('x-inventory-demo-key',demoServerKey()).retry(false)
      if(result.error)throw new Error(['P0001','42501','PT409'].includes(result.error.code)?result.error.message:'No se pudo confirmar el inventario. Reintenta con los mismos datos.')
      if(typeof result.data!=='string'||!result.data)throw new Error('El servidor no confirmó el ticket. Reintenta con los mismos datos.')
      return result.data
    },
  }
}
