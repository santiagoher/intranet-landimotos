import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import {createRequire} from 'node:module'
import {NextRequest} from 'next/server.js'
const require=createRequire(import.meta.url),ts=require('typescript')
const root=process.cwd()
function load(file,overrides={},globals={}) {
  const filename=path.resolve(root,file),mod={exports:{}}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,
    {module:mod,exports:mod.exports,process:{env:{}},URL,Request,Response,AbortController,setTimeout,clearTimeout,Date,...globals,require:name=>name in overrides?overrides[name]:name==='server-only'?{}:name.startsWith('.')?load(path.resolve(path.dirname(filename),name+'.ts'),overrides,globals):require(name)})
  return mod.exports
}
const {invalidSession}=load('src/utils/supabase/auth-errors.ts')
test('auth distinguishes confirmed revocation from timeouts, rate limits and permission errors',()=>{
  for(const error of [{status:500},{status:503},{status:504},{status:429},{status:403,code:'insufficient_aal'},{name:'AuthRetryableFetchError'},new TypeError('offline')])assert.equal(invalidSession(error),false)
  for(const error of [{status:401},{status:403,code:'session_not_found'},{status:400,code:'refresh_token_not_found'},{name:'AuthSessionMissingError'}])assert.equal(invalidSession(error),true)
})
function middleware({user={id:'U'},authError=null,profileError=null,role='Operativo',inactive=false,throws=false,rotate=false}={}) {
  const calls=[]
  const createServerClient=(_url,_key,options)=>{
    const builder={select:()=>builder,eq:()=>builder,single:async()=>({data:profileError?null:{rol:role,estado:inactive?'inactivo':'activo'},error:profileError})}
    return {from:()=>builder,auth:{
      getUser:async()=>{
        if(rotate)options.cookies.setAll([{name:'sb-test-auth-token',value:'rotated',options:{httpOnly:true,path:'/'}}])
        if(throws)throw Error('network')
        return {data:{user},error:authError}
      },
      signOut:async options=>{calls.push(options.scope);return {error:null}},
    }}
  }
  const {updateSession}=load('src/utils/supabase/middleware.ts',{'@supabase/ssr':{createServerClient}})
  return {updateSession,calls}
}
test('middleware fails closed on temporary auth/profile errors without logout or login redirect',async()=>{
  for(const config of [{user:null,authError:{status:504}},{profileError:{code:'PGRST000'}},{throws:true}]) {
    const {updateSession,calls}=middleware(config),response=await updateSession(new NextRequest('https://app.test/inventarios/registros'))
    assert.equal(response.status,503);assert.equal(response.headers.get('location'),null);assert.equal(calls.length,0)
    assert.match(response.headers.get('cache-control'),/no-store/)
  }
})
test('confirmed invalid sessions are rejected; API reads get 401 instead of an HTML redirect',async()=>{
  const {updateSession}=middleware({user:null,authError:{status:403,code:'session_not_found'}})
  assert.equal((await updateSession(new NextRequest('https://app.test/inventarios'))).headers.get('location'),'https://app.test/login')
  assert.equal((await updateSession(new NextRequest('https://app.test/api/inventarios/monitor'))).status,401)
})
test('redirects preserve refreshed cookies, administrative guards and local inactive-account logout',async()=>{
  const {updateSession}=middleware({rotate:true})
  const response=await updateSession(new NextRequest('https://app.test/admin/usuarios'))
  assert.equal(response.headers.get('location'),'https://app.test/');assert.equal(response.cookies.get('sb-test-auth-token').value,'rotated')
  const inactive=middleware({inactive:true})
  assert.equal((await inactive.updateSession(new NextRequest('https://app.test/login'))).status,200)
  assert.deepEqual(inactive.calls,['local'])
})
test('auth 5xx are retryable transport failures; 400/403 and database errors retain their semantics',async()=>{
  for(const status of [500,503,504]) {
    const {supabaseFetch}=load('src/utils/supabase/fetch.ts',{}, {fetch:async()=>new Response('{}',{status})})
    await assert.rejects(()=>supabaseFetch('https://test.supabase.co/auth/v1/token'))
    assert.equal((await supabaseFetch('https://test.supabase.co/rest/v1/perfiles')).status,status)
  }
  for(const status of [400,403]) {
    const {supabaseFetch}=load('src/utils/supabase/fetch.ts',{}, {fetch:async()=>new Response('{}',{status})})
    assert.equal((await supabaseFetch('https://test.supabase.co/auth/v1/token')).status,status)
  }
})
function fakeClock(){
  let now=0,id=0;const timers=new Map()
  class Clock extends Date {static now(){return now}}
  const globals={Date:Clock,setTimeout:(fn,delay)=>{timers.set(++id,{fn,at:now+delay});return id},clearTimeout:id=>timers.delete(id)}
  const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve()}
  return {globals,flush,timers,advance:async(ms)=>{const end=now+ms;while(true){const entry=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!entry||entry[1].at>end)break;now=entry[1].at;timers.delete(entry[0]);entry[1].fn();await flush()}now=end;await flush()}}
}
test('eight-hour polling simulation: no overlapping work, no focus storms, hidden pages sleep',async()=>{
  const clock=fakeClock();let visible=true,calls=0
  const {startPolling}=load('src/utils/polling.ts',{},clock.globals)
  const poll=startPolling({run:async()=>{calls++;return true},canRun:()=>visible})
  await clock.advance(8*60*60*1000);assert.equal(calls,960)
  for(let n=0;n<20;n++)poll.wake();await clock.flush();assert.equal(calls,960)
  visible=false;await clock.advance(60000);assert.equal(calls,960)
  poll.stop();assert.equal(clock.timers.size,0)
})
test('polling backs off and stops after three failures, manual recovery resumes safely',async()=>{
  const clock=fakeClock();let calls=0,paused=0,ok=false
  const {startPolling}=load('src/utils/polling.ts',{},clock.globals)
  const poll=startPolling({initial:true,run:async()=>{calls++;return ok},canRun:()=>true,onPause:()=>paused++})
  await clock.advance(0);assert.equal(calls,1)
  await clock.advance(59999);assert.equal(calls,1)
  await clock.advance(120001);assert.equal(calls,3);assert.equal(paused,1)
  await clock.advance(3600000);assert.equal(calls,3)
  ok=true;poll.retry();await clock.flush();assert.equal(calls,4)
  await clock.advance(30000);assert.equal(calls,5);poll.stop()
})
test('unmount aborts in-flight reads and prevents rescheduling',async()=>{
  const clock=fakeClock();let signal,complete
  const {startPolling}=load('src/utils/polling.ts',{},clock.globals)
  const poll=startPolling({initial:true,canRun:()=>true,run:s=>{signal=s;return new Promise(r=>complete=r)}})
  await clock.advance(0);poll.wake();poll.stop();assert.equal(signal.aborted,true)
  complete(true);await clock.flush();assert.equal(clock.timers.size,0)
})
test('optional self-start is off by default and a missing RPC stays disabled until restart',()=>{
  const env={},feature=load('src/modules/inventarios/operations/features.server.ts',{}, {process:{env}})
  assert.equal(feature.selfStartEnabled(),false);env.INVENTORY_SELF_START_ENABLED='true';assert.equal(feature.selfStartEnabled(),false)
  Object.assign(env,{APP_ENV:'development',SUPABASE_PRODUCTION_PROJECT_REF:'loajbvlgpsxrkfzyxbui',NEXT_PUBLIC_SUPABASE_URL:'http://localhost:54321',INVENTORY_DEMO_TARGET_HOST:'localhost:54321',INVENTORY_CATALOG_SOURCE:'demo'})
  assert.equal(feature.selfStartEnabled(),true)
  feature.markSelfStartMissing();assert.equal(feature.selfStartEnabled(),false)
})

test('installed Auth SDK rotates eight tokens, survives a temporary 500, and removes a revoked session',async()=>{
  const {createClient}=require('@supabase/supabase-js')
  const key='isolated-auth-test',store=new Map(),removed=[]
  const session=n=>({access_token:`test-access-${n}`,refresh_token:`test-refresh-${n}`,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'test-user',aud:'authenticated'}})
  store.set(key,JSON.stringify(session(0)))
  let issued=0,failOnce=false,revoked=false
  const {supabaseFetch}=load('src/utils/supabase/fetch.ts',{}, {fetch:async()=>{
    if(revoked)return Response.json({code:'refresh_token_not_found',msg:'Revoked'},{status:400,headers:{'x-supabase-api-version':'2024-01-01'}})
    if(failOnce){failOnce=false;return Response.json({message:'Gateway failure'},{status:500})}
    return Response.json(session(++issued))
  }})
  const client=createClient('https://isolated.test','test-public-key',{global:{fetch:supabaseFetch},auth:{storageKey:key,autoRefreshToken:false,detectSessionInUrl:false,persistSession:true,storage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>{removed.push(k);store.delete(k)}}}})
  await client.auth.initialize()
  for(let n=1;n<=8;n++){
    failOnce=n===4
    const {data,error}=await client.auth.refreshSession()
    assert.equal(error,null);assert.equal(data.session.refresh_token,`test-refresh-${n}`)
    assert.equal(JSON.parse(store.get(key)).refresh_token,`test-refresh-${n}`)
  }
  assert.equal(removed.includes(key),false)
  revoked=true
  const {error}=await client.auth.refreshSession()
  assert.equal(error.code,'refresh_token_not_found');assert.equal(store.has(key),false)
  await client.auth.stopAutoRefresh()
})

test('compact monitoring drops revoked warehouse catalogs and never mixes accounts',()=>{
  const {mergeMonitorSnapshot}=load('src/modules/inventarios/operations/monitor-snapshot.ts')
  const previous={context:{userId:'A',warehouses:[]},categories:[{id:'a',bodega_id:'allowed'},{id:'b',bodega_id:'revoked'}],fetchedAt:1}
  const next={context:{userId:'A',warehouses:[{id:'allowed',role:'lider'}]},categories:[{id:'c',bodega_id:'allowed'}],catalogComplete:false,fetchedAt:2}
  assert.deepEqual(Array.from(mergeMonitorSnapshot(previous,next).categories,c=>c.id),['a','c'])
  assert.equal(mergeMonitorSnapshot(previous,{...next,catalogComplete:true}).categories,next.categories)
  assert.equal(mergeMonitorSnapshot(previous,{...next,context:{userId:'B',warehouses:[]}}).categories,next.categories)
  assert.deepEqual(Array.from(mergeMonitorSnapshot(previous,{...next,context:{userId:'A',warehouses:[{id:'allowed',role:'operador'}]}}).categories,c=>c.id),['c'])
})

test('environment guard rejects production credentials in development and Vercel Preview',()=>{
  const {validateEnvironment}=require('../../../scripts/check-environment.cjs')
  const env={APP_ENV:'development',SUPABASE_PRODUCTION_PROJECT_REF:'production-ref',NEXT_PUBLIC_SUPABASE_URL:'https://dev-ref.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'fake-public'}
  assert.deepEqual(validateEnvironment(env,'development'),[])
  assert.ok(validateEnvironment({...env,NEXT_PUBLIC_SUPABASE_URL:'https://production-ref.supabase.co'},'development').length)
  assert.ok(validateEnvironment({...env,APP_ENV:'production',VERCEL_ENV:'preview'},'production').length)
  assert.ok(validateEnvironment({...env,NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY:'fake'},'development').length)
})

test('inventory loader skips the absent optional RPC, pages full catalogs, and limits compact reads',async()=>{
  const calls=[],categories=Array.from({length:501},(_,n)=>({id:`C${n}`,bodega_id:'B',nombre:`Category ${n}`}))
  const context={userId:'A',globalAdmin:false,warehouses:[{id:'B',role:'lider'}]}
  const db={rpc:name=>{calls.push(name);return {abortSignal:async()=>({data:name==='inventario_contexto'?context:[],error:null})}},from:table=>{
    let start=0,end=999,ids=null
    const query={select:()=>query,eq:()=>query,order:()=>query,limit:()=>query,range:(a,b)=>{start=a;end=b;return query},in:(_key,value)=>{ids=value;return query},abortSignal:async()=>{
      calls.push({table,ids})
      const rows=table==='inventario_tickets'?[{id:'T',categoria_id:'C0'}]:table==='inventario_categorias'?categories:[]
      return {data:rows.filter(row=>!ids||ids.includes(row.id)).slice(start,end+1),error:null}
    }}
    return query
  }}
  const {getOperationData}=load('src/modules/inventarios/operations/service.server.ts',{
    '@/utils/supabase/server':{createClient:async()=>db},
    '@/utils/supabase/session.server':{getAuthUser:async()=>({data:{user:{id:'A'}},error:null})},
    '@/utils/supabase/auth-errors':{invalidSession},
  })
  assert.equal((await getOperationData()).categories.length,501)
  assert.equal(calls.filter(c=>c.table==='inventario_categorias').length,2)
  assert.equal(calls.includes('inventario_resumen_conciliacion'),false)
  assert.equal(calls.includes('inventario_autoinicio_contexto'),false)
  assert.equal(calls.includes('inventario_demo_contexto'),false)
  calls.length=0
  assert.equal((await getOperationData({compact:true})).categories.length,1)
  assert.equal(calls.filter(c=>c.table==='inventario_categorias').length,1)
  await getOperationData({reports:true,compact:true})
  assert.equal(calls.includes('inventario_resumen_conciliacion'),true)
  context.warehouses[0].role='operador'
  calls.length=0
  await assert.rejects(()=>getOperationData({reports:true}),error=>error.status===403)
  assert.deepEqual(calls,['inventario_contexto'])
})
