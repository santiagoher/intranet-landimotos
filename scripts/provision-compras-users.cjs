// Explicitly requested accounts. Never reset an existing user's password.
// Credentials stay in an ignored local file and are never printed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const {createClient}=require('@supabase/supabase-js')
require('@next/env').loadEnvConfig(process.cwd(),false, {info(){},error(){}})
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY
if(!key||new URL(url).hostname!=='loajbvlgpsxrkfzyxbui.supabase.co')throw Error('Missing credentials or unexpected project')
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
const directory=path.join(process.cwd(),'.local-backups'),file=path.join(directory,'compras-cuentas-20261117.json')
const requested=[{email:'admincompras@gmail.com',nombre:'Camilo Pulido'},{email:'registrocompras@gmail.com',nombre:'Registro Compras'}]
async function main(){
 if(process.argv.includes('--verify')){
   if(!fs.existsSync(file))throw Error('Local credentials are not available')
   for(const account of JSON.parse(fs.readFileSync(file,'utf8')).accounts){
     if(!account.created||!account.password)continue
     const client=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
     const {data,error}=await client.auth.signInWithPassword({email:account.email,password:account.password})
     if(error)throw Error('Login failed for '+account.email+': '+error.message)
     const profile=await client.from('perfiles').select('rol,estado,modulos_permitidos').eq('id',data.user.id).single()
     const admin=await client.rpc('compras_es_admin')
     const team=await client.from('compras_encargados').select('id,nombre,mesa_id')
     const suppliers=await client.from('compras_proveedores').select('id',{count:'exact',head:true}).not('nit','is',null)
     if(profile.error||admin.error||team.error||suppliers.error)throw Error('Verification failed for '+account.email)
     if(profile.data.rol!=='Operativo'||profile.data.estado!=='activo'||JSON.stringify(profile.data.modulos_permitidos)!=='["compras"]'||admin.data!==(account.email==='admincompras@gmail.com')||team.data.length!==(admin.data?5:4)||suppliers.count!==69)throw Error('Unexpected permissions for '+account.email)
     console.log(JSON.stringify({email:account.email,login:true,platformRole:profile.data.rol,comprasAdmin:admin.data,team:team.data.length,importedSuppliers:suppliers.count}))
     await client.auth.signOut({scope:'local'})
   }
   return
 }
 const existing=new Map()
 for(let page=1;;page++){
   const {data,error}=await db.auth.admin.listUsers({page,perPage:100})
   if(error)throw Error(error.message)
   for(const user of data.users)if(requested.some(r=>r.email===user.email?.toLowerCase()))existing.set(user.email.toLowerCase(),user.id)
   if(data.users.length<100)break
 }
 fs.mkdirSync(directory,{recursive:true})
 const saved=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{accounts:[]}
 const save=()=>fs.writeFileSync(file,JSON.stringify(saved,null,2),{mode:0o600})
 for(const requestedAccount of requested){
   if(existing.has(requestedAccount.email)){console.log(JSON.stringify({email:requestedAccount.email,id:existing.get(requestedAccount.email),status:'existing, password unchanged'}));continue}
   let account=saved.accounts.find(a=>a.email===requestedAccount.email)
   if(!account){account={...requestedAccount,password:crypto.randomBytes(21).toString('base64url')+'!7Az',created:false};saved.accounts.push(account);save()}
   const {data,error}=await db.auth.admin.createUser({email:account.email,password:account.password,email_confirm:true,user_metadata:{nombre:account.nombre}})
   if(error)throw Error('Could not create '+account.email+': '+error.message)
   account.id=data.user.id;account.created=true;save()
   console.log(JSON.stringify({email:account.email,id:account.id,status:'created'}))
 }
 console.log('Credentials saved locally: '+file)
}
main().catch(error=>{console.error(error.message);process.exitCode=1})
