import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import {createRequire} from 'node:module'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
const require=createRequire(import.meta.url),ts=require('typescript'),root=path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/,'$1'))
function load(file,overrides={}){
  const filename=path.resolve(root,file),mod={exports:{}}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module:mod,exports:mod.exports,process,require:name=>{
    if(name in overrides)return overrides[name]
    if(name==='server-only')return {}
    if(name==='../components/InventoryPrimitives')return {inventoryFieldClass:'field'}
    if(name.startsWith('.'))return load(path.resolve(path.dirname(filename),name+(fs.existsSync(path.resolve(path.dirname(filename),name+'.ts'))?'.ts':'.tsx')),overrides)
    return require(name)
  }})
  return mod.exports
}
const {isVersionConflict,draftNeedsReview}=load('conflicts.ts')
const message='La tarea cambió. Actualiza antes de continuar'
test('only explicit business version conflicts are classified; real serialization failures remain distinct',()=>{
  for(const code of ['40001','P0001','PT409'])assert.equal(isVersionConflict({code,message}),true)
  assert.equal(isVersionConflict({code:'PT409',details:'INVENTORY_VERSION_CONFLICT'}),true)
  assert.equal(isVersionConflict({code:'40001',message:'could not serialize access due to concurrent update'}),false)
  assert.equal(isVersionConflict({code:'42501',message}),false)
})
test('a draft retains its value across newer versions and cannot save until explicitly reviewed',()=>{
  const draft={value:'19,125',version:2}
  assert.equal(draftNeedsReview(draft,2),false)
  assert.equal(draftNeedsReview(draft,3),true)
  assert.equal(draft.value,'19,125')
  assert.equal(draftNeedsReview({...draft,conflict:true},2),true)
  assert.equal(draftNeedsReview({value:draft.value,version:3},3),false)
})
test('conflict row shows saved count and retained draft; no reference balance, automatic submit or theme-specific fixed background',()=>{
  const {CountRow}=load('CountRow.tsx')
  const html=renderToStaticMarkup(React.createElement('table',{},React.createElement('tbody',{},React.createElement(CountRow,{item:{id:'I',code:'SKU',name:'Item',quantity:'7',countedAt:null},version:3,draft:{value:'19',version:2},editable:true,busy:false,ready:true,onChange(){},onSave(){},onResolve(){}}))))
  assert.match(html,/value="19"/);assert.match(html,/Último conteo guardado/);assert.match(html,/<strong>7<\/strong>/)
  assert.match(html,/disabled="">Guardar/);assert.match(html,/Conservar mi valor para reintentar/)
  assert.match(html,/bg-warning-soft/);assert.match(html,/text-foreground/);assert.doesNotMatch(html,/expectedQuantity/)
})
const item='00000000-0000-4000-8000-000000000001'
test('Server Action executes one mutation, disables SDK retry, and returns structured conflict without revalidation',async()=>{
  let writes=0,retries,refreshes=0
  const db={auth:{getUser:async()=>({data:{user:{id:'OP'}},error:null})},rpc:()=>{writes++;return {retry:value=>{retries=value;return Promise.resolve({error:{code:'PT409',details:'INVENTORY_VERSION_CONFLICT',message}})}}}}
  const actions=load('actions.ts',{'@/utils/supabase/server':{createClient:async()=>db},'@/utils/supabase/auth-errors':{authFailureMessage:()=>''},'next/cache':{revalidatePath:()=>refreshes++},'./catalog.server':{}})
  const result=await actions.saveCountProduct({item,version:2,quantity:'19'})
  assert.equal(result.conflict,true);assert.equal(writes,1);assert.equal(retries,false);assert.equal(refreshes,0)
})
test('installed PostgREST client sends a single POST for PT409, 40001 and transient HTTP errors',async()=>{
  const {createClient}=require('@supabase/supabase-js')
  for(const [status,code] of [[409,'PT409'],[500,'40001'],[503,'PGRST000']]){
    let requests=0
    const db=createClient('https://isolated.test','fake-public-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(_url,options)=>{requests++;assert.equal(options.method,'POST');return Response.json({code,message,details:'INVENTORY_VERSION_CONFLICT'},{status})}}})
    const result=await db.rpc('inventario_contar_producto',{p_item:item,p_version:2,p_cantidad:'19'}).retry(false)
    assert.equal(result.error.code,code);assert.equal(requests,1)
  }
})
test('snapshot refuses to attach new products to an obsolete version, without automatic rereads',async()=>{
  let reads=0,rpcs=0
  const db={auth:{getUser:async()=>({data:{user:{id:'OP'}},error:null})},from:()=>{const b={select:()=>b,eq:()=>b,single:async()=>({data:++reads===1?{id:item,version:2}:{version:3},error:null})};return b},rpc:()=>{rpcs++;return {retry:()=>Promise.resolve({data:[{id:'P',quantity:'7'}],error:null})}}}
  const actions=load('actions.ts',{'@/utils/supabase/server':{createClient:async()=>db},'@/utils/supabase/auth-errors':{authFailureMessage:()=>''},'next/cache':{revalidatePath(){}},'./catalog.server':{}})
  const result=await actions.getTaskSnapshot(item,false)
  assert.match(result.error,/volvió a cambiar/);assert.equal(result.task,undefined);assert.equal(reads,2);assert.equal(rpcs,1)
})
