/** Server configuration only. Never accept an environment/source from a request. */
export function demoEnvironment(env: Record<string, string | undefined>): {enabled:boolean; reason:string; host?:string} {
  const blocked = (reason:string) => ({enabled:false,reason})
  if(env.VERCEL_ENV==='production'||!['development','staging'].includes(env.APP_ENV??''))
    return blocked('Nuevo inventario DEMO requiere un ambiente de desarrollo o staging independiente.')
  let url:URL
  try {url=new URL(env.NEXT_PUBLIC_SUPABASE_URL??'')} catch {return blocked('Configura la conexión a la base de pruebas.')}
  const production=['loajbvlgpsxrkfzyxbui.supabase.co',`${env.SUPABASE_PRODUCTION_PROJECT_REF}.supabase.co`]
  // Explicit server-side opt-in for the current shared project, authorized by its owner.
  // The database must also return a matching private installation marker.
  const shared=env.INVENTORY_DEMO_SHARED_PROJECT_REF
  const sharedAuthorized=!!shared&&url.hostname===`${shared}.supabase.co`&&env.APP_ENV==='development'
  if(sharedAuthorized&&!/^[a-f0-9]{64}$/.test(env.INVENTORY_DEMO_SERVER_KEY??''))return blocked('Falta configurar la clave privada del servidor local para DEMO.')
  if(production.includes(url.hostname)&&!sharedAuthorized)return blocked('La conexión actual apunta a producción. La creación DEMO está bloqueada.')
  const local=['localhost','127.0.0.1'].includes(url.hostname)
  if(url.username||url.password||url.pathname!=='/'||url.search||url.hash||(!local&&url.protocol!=='https:'))return blocked('La URL de pruebas no es válida.')
  if(!env.SUPABASE_PRODUCTION_PROJECT_REF||!env.INVENTORY_DEMO_TARGET_HOST||url.host!==env.INVENTORY_DEMO_TARGET_HOST)
    return blocked('Falta validar el destino independiente de pruebas.')
  if(env.INVENTORY_SELF_START_ENABLED!=='true'||env.INVENTORY_CATALOG_SOURCE!=='demo')
    return blocked('La creación DEMO está pendiente de habilitación en este ambiente.')
  return {enabled:true,reason:'',host:url.host}
}
