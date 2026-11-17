// Explicit user request: local private account inventory, without resetting passwords.
const fs=require('node:fs'),path=require('node:path')
const {createClient}=require('@supabase/supabase-js')
require('@next/env').loadEnvConfig(process.cwd(),false,{info(){},error(){}})
async function main(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL
 if(new URL(url).hostname!=='loajbvlgpsxrkfzyxbui.supabase.co')throw Error('Unexpected project')
 const db=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
 const directory=path.join(process.cwd(),'.local-backups')
 const saved=JSON.parse(fs.readFileSync(path.join(directory,'compras-cuentas-20261117.json'),'utf8'))
 const profiles=new Map()
 for(let offset=0;;offset+=500){
  const {data,error}=await db.from('perfiles').select('id,nombre,email').order('id').range(offset,offset+499)
  if(error)throw Error(error.message)
  for(const p of data)profiles.set(p.id,p)
  if(data.length<500)break
 }
 const accounts=[]
 for(let page=1;;page++){
  const {data,error}=await db.auth.admin.listUsers({page,perPage:100})
  if(error)throw Error(error.message)
  for(const u of data.users){
   const known=saved.accounts.find(a=>a.id===u.id&&a.email===u.email)
   accounts.push({email:u.email??null,nombre:profiles.get(u.id)?.nombre??u.user_metadata?.nombre??null,password:known?.password??null,created:true,id:u.id})
  }
  if(data.users.length<100)break
 }
 accounts.sort((a,b)=>(a.email??'').localeCompare(b.email??''))
 const file=path.join(directory,'usuarios-disponibles-20261117.json')
 fs.writeFileSync(file,JSON.stringify({accounts},null,2)+'\n',{mode:0o600})
 for(const a of saved.accounts)if(profiles.has(a.id))a.nombre=profiles.get(a.id).nombre
 fs.writeFileSync(path.join(directory,'compras-cuentas-20261117.json'),JSON.stringify(saved,null,2)+'\n',{mode:0o600})
 console.log(JSON.stringify({file,accounts:accounts.length,passwordsAvailable:accounts.filter(a=>a.password!==null).length}))
}
main().catch(e=>{console.error(e.message);process.exitCode=1})
