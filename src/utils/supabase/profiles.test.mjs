import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),ts=require('typescript')
function load(file,overrides={}){
 const mod={exports:{}}
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,require:n=>overrides[n]??(n==='server-only'?{}:require(n)),FormData})
 return mod.exports
}
const adminId='00000000-0000-4000-8000-000000000001',targetId='00000000-0000-4000-8000-000000000002'
const payload={nombre:'Operador de prueba',rol:'Operativo',estado:'activo',modulos_permitidos:['inventarios']}
function adminService({user={id:adminId,user_metadata:{rol:'Admin'}},profile={rol:'Admin',estado:'activo'},authError=null,profileError=null,row={id:targetId},dbError=null}={}){
 const calls=[]
 const query={select:columns=>{calls.push(['select',columns]);return query},order:async()=>({data:[],error:dbError}),update:data=>{calls.push(['update',data]);return query},eq:(key,value)=>{calls.push(['eq',key,value]);return query},maybeSingle:async()=>({data:row,error:dbError})}
 const actions=load('src/app/(dashboard)/admin/usuarios/actions.ts',{
  '@/utils/supabase/server':{createClient:async()=>({from:table=>{calls.push(['from',table]);return query}})},
  '@/utils/supabase/session.server':{getAuthUser:async()=>({data:{user},error:authError}),getProfile:async id=>{calls.push(['profile',id]);return {data:profile,error:profileError}}},
  'next/cache':{revalidatePath:path=>calls.push(['revalidate',path])},
 })
 return {...actions,calls}
}
test('user administration rejects anonymous, forged metadata admin, inactive and unavailable profiles before querying users',async()=>{
 for(const setup of [{user:null},{authError:{status:503}},{profile:{rol:'Operativo',estado:'activo'}},{profile:{rol:'Admin',estado:'inactivo'}},{profile:null},{profileError:{code:'42P01'}}]){
  const service=adminService(setup)
  await assert.rejects(()=>service.getAllUsers())
  assert.ok((await service.updateUserProfile(targetId,payload)).error)
  assert.ok(!service.calls.some(c=>c[0]==='from'||c[0]==='update'))
 }
})
test('active administrator uses only perfiles and cannot overwrite identity/email/creation fields through form input',async()=>{
 const s=adminService()
 await s.getAllUsers()
 assert.equal((await s.updateUserProfile(targetId,{...payload,id:adminId,email:'changed@example.invalid',created_at:'2000-01-01'})).success,true)
 const written=s.calls.find(c=>c[0]==='update')[1]
 assert.deepEqual(Object.keys(written).sort(),['estado','modulos_permitidos','nombre','rol'])
 assert.ok(s.calls.filter(c=>c[0]==='from').every(c=>c[1]==='perfiles'))
 assert.ok(s.calls.filter(c=>c[0]==='profile').every(c=>c[1]===adminId))
 assert.ok(s.calls.some(c=>c[0]==='eq'&&c[1]==='id'&&c[2]===targetId))
})
test('zero-row update, RLS errors, invalid UUID and invalid role are never reported as success',async()=>{
 for(const config of [{row:null},{dbError:{message:'permission denied'}}]){
  const s=adminService(config)
  assert.ok((await s.updateUserProfile(targetId,payload)).error)
  assert.ok(!s.calls.some(c=>c[0]==='revalidate'))
 }
 const s=adminService()
 assert.ok((await s.updateUserProfile('invalid',payload)).error)
 assert.ok((await s.updateUserProfile(targetId,{...payload,rol:'SuperAdmin'})).error)
 assert.ok(!s.calls.some(c=>c[0]==='update'))
})
test('profile loader reads name, role and permissions only from perfiles filtered by authenticated UUID',async()=>{
 const calls=[];const profile={nombre:'Prueba',rol:'Operativo',estado:'activo',modulos_permitidos:['mensajeros']}
 const query={select:c=>{calls.push(['columns',c]);return query},eq:(key,id)=>{calls.push(['eq',key,id]);return query},single:async()=>({data:profile,error:null})}
 const session=load('src/utils/supabase/session.server.ts',{'react':{cache:fn=>fn},'next/navigation':{redirect:()=>{throw Error('redirect')}},'./auth-errors':{invalidSession:()=>false},'./server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:targetId,user_metadata:{rol:'Admin'}}},error:null})},from:t=>{calls.push(['from',t]);return query}})}})
 const user=await session.requireUser();const result=await session.getProfile(user.id)
 assert.equal(result.data.rol,'Operativo');assert.equal(result.data.nombre,'Prueba')
 assert.deepEqual(calls[0],['from','perfiles']);assert.deepEqual(calls[2],['eq','id',targetId])
})
test('login forwards credentials to Auth, rejects invalid/failed login and never creates profiles',async()=>{
 const calls=[];let error=null
 const login=load('src/app/(auth)/login/actions.ts',{'@/utils/supabase/server':{createClient:async()=>({auth:{signInWithPassword:async data=>{calls.push(data);return {error}}}})},'next/cache':{revalidatePath:()=>{}},'next/navigation':{redirect:url=>{throw Error('redirect:'+url)}}}).login
 const form=new FormData();form.set('email','local@example.invalid');form.set('password','only-test-password')
 error={message:'Invalid credentials'};assert.equal((await login(form)).error,'Invalid credentials')
 error=null;await assert.rejects(()=>login(form),/redirect:\//)
 form.set('email','invalid');assert.ok((await login(form)).error);assert.equal(calls.length,2)
})

test('dispatch and messenger reads use their existing relations without querying profiles',async()=>{
 const calls=[]
 const query={select:s=>{calls.push(['select',s]);return query},eq:()=>query,neq:()=>query,gte:()=>query,order:()=>query,range:()=>query,limit:()=>query,then:resolve=>Promise.resolve({data:[],error:null}).then(resolve)}
 const overrides={'@/utils/supabase/server':{createClient:async()=>({from:t=>{calls.push(['from',t]);assert.notEqual(t,'profiles');return query}})},'next/cache':{revalidatePath:()=>{}},'@/utils/supabase/pagination':{fetchAllSupabaseRows:async build=>{await build();return []}},uuid:{v4:()=>targetId}}
 const dispatch=load('src/app/(dashboard)/despachos/actions.ts',overrides)
 const messengers=load('src/app/(dashboard)/mensajeros/actions.ts',overrides)
 await dispatch.getPedidos();await messengers.getMensajeros();await messengers.getActiveRoutes()
 assert.ok(calls.some(c=>c[0]==='from'&&c[1]==='pedidos'))
 assert.ok(calls.some(c=>c[0]==='from'&&c[1]==='mensajeros'))
 assert.ok(calls.some(c=>c[0]==='from'&&c[1]==='mensajeros_rutas'))
 assert.ok(calls.some(c=>c[0]==='select'&&c[1].includes('mensajero:mensajeros')))
})
