const {loadEnvConfig}=require('@next/env')

// No imprime claves ni realiza solicitudes. Valida el ambiente efectivo de Next.
function validateEnvironment(env, target) {
  const errors=[]
  if(!['development','staging','production'].includes(target)) return ['Indica development, staging o production.']
  if(env.APP_ENV!==target)errors.push('APP_ENV no coincide con el ambiente solicitado.')
  let hostname=''
  try {hostname=new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname} catch {errors.push('NEXT_PUBLIC_SUPABASE_URL no es una URL valida.')}
  const productionRef=env.SUPABASE_PRODUCTION_PROJECT_REF
  if(!productionRef)errors.push('Falta SUPABASE_PRODUCTION_PROJECT_REF para comprobar aislamiento.')
  if(target!=='production'&&hostname===`${productionRef}.supabase.co`)errors.push('Desarrollo o pruebas apunta a Supabase de produccion.')
  if(target==='production'&&productionRef&&hostname!==`${productionRef}.supabase.co`)errors.push('El destino de produccion no coincide con el proyecto declarado.')
  if(!env.NEXT_PUBLIC_SUPABASE_ANON_KEY || /COMPLETAR|CONFIGURAR/.test(env.NEXT_PUBLIC_SUPABASE_ANON_KEY))errors.push('Falta una clave publica configurada para este ambiente.')
  if(/PROYECTO_DE_PRUEBAS/i.test(hostname))errors.push('La URL conserva el marcador de la plantilla.')
  if(Object.keys(env).some(key=>key.startsWith('NEXT_PUBLIC_')&&/SERVICE_ROLE|SECRET_KEY/.test(key)))errors.push('Una clave privada tiene prefijo publico. Retirala y revisa su exposicion.')
  if(env.VERCEL_ENV==='preview'&&target==='production')errors.push('Un Preview no debe utilizar configuracion de produccion.')
  return errors
}
module.exports={validateEnvironment}
if(require.main===module){
  const target=process.argv[2]||'development'
  loadEnvConfig(process.cwd(),target==='development',{info(){},error(){}})
  const errors=validateEnvironment(process.env,target)
  if(errors.length){console.error(errors.map(message=>`- ${message}`).join('\n'));process.exitCode=1}
  else console.log(`Configuracion ${target} validada sin mostrar credenciales. No comprueba conectividad ni permisos remotos.`)
}
