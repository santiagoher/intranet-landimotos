import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),ts=require('typescript')
function load(file,overrides={}){
 const mod={exports:{}}
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,URL,Error,require:name=>overrides[name]??(name==='server-only'?{}:require(name))})
 return mod.exports
}
const {demoEnvironment}=load('./demo-environment.ts')
const environment={APP_ENV:'staging',SUPABASE_PRODUCTION_PROJECT_REF:'loajbvlgpsxrkfzyxbui',NEXT_PUBLIC_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',INVENTORY_DEMO_TARGET_HOST:'abcdefghijklmnopqrst.supabase.co',INVENTORY_SELF_START_ENABLED:'true',INVENTORY_CATALOG_SOURCE:'demo'}
test('DEMO fails closed for production, missing/mismatched hosts, disabled flags and forged production ref',()=>{
 assert.equal(demoEnvironment(environment).enabled,true)
 for(const patch of [{APP_ENV:undefined},{APP_ENV:'production'},{VERCEL_ENV:'production'},{INVENTORY_SELF_START_ENABLED:'false'},{INVENTORY_CATALOG_SOURCE:'g21'},{SUPABASE_PRODUCTION_PROJECT_REF:undefined},{INVENTORY_DEMO_TARGET_HOST:undefined},{NEXT_PUBLIC_SUPABASE_URL:'https://other.supabase.co'},{NEXT_PUBLIC_SUPABASE_URL:'invalid'},{NEXT_PUBLIC_SUPABASE_URL:'https://loajbvlgpsxrkfzyxbui.supabase.co',INVENTORY_DEMO_TARGET_HOST:'loajbvlgpsxrkfzyxbui.supabase.co',SUPABASE_PRODUCTION_PROJECT_REF:'forged'}])assert.equal(demoEnvironment({...environment,...patch}).enabled,false,JSON.stringify(patch))
 assert.equal(demoEnvironment({...environment,NEXT_PUBLIC_SUPABASE_URL:'http://localhost:54321',INVENTORY_DEMO_TARGET_HOST:'localhost:54321'}).enabled,true)
})
test('shared project requires explicit server authorization and is never enabled on Vercel Production',()=>{
 const shared={...environment,APP_ENV:'development',NEXT_PUBLIC_SUPABASE_URL:'https://loajbvlgpsxrkfzyxbui.supabase.co',INVENTORY_DEMO_TARGET_HOST:'loajbvlgpsxrkfzyxbui.supabase.co',INVENTORY_DEMO_SHARED_PROJECT_REF:'loajbvlgpsxrkfzyxbui',INVENTORY_DEMO_SERVER_KEY:'a'.repeat(64)}
 assert.equal(demoEnvironment(shared).enabled,true)
 for(const patch of [{INVENTORY_DEMO_SERVER_KEY:''},{INVENTORY_DEMO_SHARED_PROJECT_REF:''},{INVENTORY_DEMO_SHARED_PROJECT_REF:'another'},{APP_ENV:'production'},{APP_ENV:'staging'},{VERCEL_ENV:'production'},{INVENTORY_SELF_START_ENABLED:'false'}])assert.equal(demoEnvironment({...shared,...patch}).enabled,false)
})
function provider({enabled=true,authenticated=true,host='test',dbHost='test',rpcError=null}={}){
 const calls=[]
 const db={auth:{getUser:async()=>({data:{user:authenticated?{id:'OP'}:null}})},rpc:(name,args)=>{calls.push({name,args});const builder={setHeader:(name,value)=>{assert.equal(name,'x-inventory-demo-key');assert.equal(value,'test-server-key');return builder},retry:async retry=>{assert.equal(retry,false);return name==='inventario_demo_contexto'?{data:{enabled:true,host:dbHost}}:{error:rpcError,data:name==='inventario_demo_catalogo'?[{id:'I',code:'DEMO',name:'Demo',unit:'UN',barcodes:['B'],expected:'SECRET'}]:'T'}}};return builder}}
 const {demoSource}=load('./demo-source.server.ts',{'./features.server':{selfStartStatus:()=>({enabled,host,reason:'blocked'}),demoServerKey:()=> 'test-server-key'},'@/utils/supabase/server':{createClient:async()=>db}})
 return {demoSource,calls}
}
test('server provider blocks before RPC without isolation/authentication and before writes for a different database marker',async()=>{
 for(const config of [{enabled:false},{authenticated:false},{dbHost:'other'}]){
  const {demoSource,calls}=provider(config)
  await assert.rejects(()=>demoSource())
  assert.ok(calls.every(c=>c.name==='inventario_demo_contexto'))
 }
})
test('DEMO DTO strips unexpected reference fields; creation keeps idempotency key and never retries automatically',async()=>{
 const {demoSource,calls}=provider(),source=await demoSource()
 const products=await source.products('W','C')
 assert.deepEqual(Object.keys(products[0]).sort(),['barcodes','brand','code','id','name','subcategory','unit'])
 const input={key:'K',warehouse:'W',category:'C',note:'N',productIds:['I']}
 assert.equal(await source.create(input),'T')
 assert.equal(calls.at(-1).name,'inventario_demo_autoiniciar');assert.equal(calls.at(-1).args.p_clave,'K')
 assert.ok(!calls.some(c=>/g21/.test(c.name)))
})
test('failed RPC never yields a success ticket',async()=>{
 const source=await provider({rpcError:{code:'PT409',message:'Conflicto'}}).demoSource()
 await assert.rejects(()=>source.create({key:'K',warehouse:'W',category:'C',note:'',productIds:['I']}),/Conflicto/)
})

test('filtered creation sends the selected scope and IDs without reference quantities',async()=>{
 const {demoSource,calls}=provider(),source=await demoSource()
 await source.create({key:'K',warehouse:'W',category:'C',subcategory:'Transmisión',brand:'Marca A',note:'',productIds:['I']})
 const call=calls.at(-1)
 assert.equal(call.name,'inventario_demo_autoiniciar_filtrado')
 assert.equal(call.args.p_subcategoria,'Transmisión');assert.equal(call.args.p_marca,'Marca A')
 assert.deepEqual(call.args.p_ids,['I'])
})

const {filterCatalog,catalogOptions}=load('./catalog-filters.ts')
test('catalog filters support whole categories, subcategory, brand alone and intersections',()=>{
 const products=[{id:'1',subcategory:'Motor',brand:'A'},{id:'2',subcategory:'Motor',brand:'B'},{id:'3',subcategory:'Frenos',brand:'A'},{id:'4',subcategory:null,brand:null}]
 const ids=items=>Array.from(items,p=>p.id)
 assert.deepEqual(ids(filterCatalog(products,'','')),['1','2','3','4'])
 assert.deepEqual(ids(filterCatalog(products,'Motor','')),['1','2'])
 assert.deepEqual(ids(filterCatalog(products,'','A')),['1','3'])
 assert.deepEqual(ids(filterCatalog(products,'Motor','B')),['2'])
 assert.deepEqual(ids(filterCatalog(products,'Frenos','B')),[])
 assert.deepEqual(Array.from(catalogOptions(filterCatalog(products,'Frenos',''),'brand')),['A'])
})
