import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'

const require=createRequire(import.meta.url),ts=require('typescript')
const ticket='00000000-0000-4000-8000-000000000001',id='00000000-0000-4000-8000-000000000002'
const source=ts.transpileModule(readFileSync(new URL('./evidence.actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText
function harness(options={}){
  const calls=[]
  const db={auth:{getUser:async()=>({data:{user:options.signedOut?null:{id:'OP'}}})},
    from:()=>({select:()=>({eq:()=>({single:async()=>options.foreign?{error:{}}:{data:{id:ticket,bodega_id:'W',asignado_a:'OP',estado:'en_proceso'}}})})}),
    rpc:(name)=>{
      calls.push(name)
      const result=name==='inventario_contexto'?{data:{warehouses:[{id:'W',role:options.role??'operador'}]}}:
        name==='inventario_observacion_guardar'&&options.noteConflict?{error:{code:'PT409',details:'INVENTORY_VERSION_CONFLICT',message:'La observación cambió. Recarga antes de guardar'}}:
        {data:{id,storage_path:`inventarios/${ticket}/OP/${id}.webp`,estado:options.alreadySaved?'vigente':'pendiente'}}
      const request=Promise.resolve(result)
      request.retry=enabled=>{calls.push(['retry',enabled]);return request}
      return request
    }}
  const admin={storage:{from:()=>({upload:async()=>{calls.push('upload');return options.uploadFailure?{error:{}}:{}},remove:async()=>{calls.push('remove');return options.cleanupFailure?{error:{}}:{}}})},
    rpc:async(_name,args)=>{calls.push(args.p_accion);return options.confirmFailure&&args.p_accion==='confirmar'?{error:{}}:{}},
    from:()=>({select:()=>({eq:()=>({single:async()=>({data:{estado:options.committed?'vigente':'pendiente'}})})})})}
  const mod={exports:{}}
  vm.runInNewContext(source,{module:mod,exports:mod.exports,Buffer,File,FormData,process:{env:{SUPABASE_SERVICE_ROLE_KEY:'TEST_ONLY',NEXT_PUBLIC_SUPABASE_URL:'https://example.invalid'}},require:name=>{
    if(name==='@/utils/supabase/server')return {createClient:async()=>db}
    if(name==='@supabase/supabase-js')return {createClient:()=>{calls.push('admin');return admin}}
    if(name==='next/cache')return {revalidatePath:()=>{}}
    if(name==='./conflicts'){
      const child={exports:{}}
      vm.runInNewContext(ts.transpileModule(readFileSync(new URL('./conflicts.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:child,exports:child.exports})
      return child.exports
    }
    if(name==='./evidence-image.server')return {IMAGE_LIMIT:5242880,safeImageName:()=> 'test.webp',validateEvidenceImage:async()=>{if(options.invalid)throw new Error('Invalid');return {body:Buffer.from('VALIDATED_TEST_IMAGE'),hash:'a'.repeat(64),mime:'image/webp'}}}
    return require(name)
  }})
  const form=new FormData();form.set('ticket',ticket);form.set('id',id);form.set('file',new File(['TEST ONLY'],'test.webp',{type:'image/webp'}))
  return {calls,upload:()=>mod.exports.uploadEvidence(form),note:()=>mod.exports.saveCountNote(ticket,'Borrador',0)}
}

test('stale observation returns a conflict once with mutation retries disabled',async()=>{
  const h=harness({noteConflict:true}),result=await h.note()
  assert.equal(result.conflict,true);assert.equal(h.calls.filter(c=>c==='inventario_observacion_guardar').length,1)
  assert.ok(h.calls.some(c=>Array.isArray(c)&&c[0]==='retry'&&c[1]===false));assert.ok(!h.calls.includes('admin'))
})
test('unauthenticated and out-of-scope uploads never reach privileged storage',async()=>{
  for(const options of [{signedOut:true},{foreign:true},{role:'lider'}]){
    const h=harness(options),r=await h.upload();assert.ok(r.error);assert.ok(!h.calls.includes('admin'));assert.ok(!h.calls.includes('upload'))
  }
})
test('invalid image never reserves a slot or uploads bytes',async()=>{
  const h=harness({invalid:true});assert.ok((await h.upload()).error)
  assert.ok(!h.calls.includes('inventario_evidencia_editar'));assert.ok(!h.calls.includes('upload'))
})
test('upload succeeds only after metadata confirmation',async()=>{
  const h=harness();assert.equal((await h.upload()).ok,true)
  assert.ok(h.calls.indexOf('upload')<h.calls.indexOf('confirmar'));assert.ok(!h.calls.includes('remove'))
})
test('lost confirmation response never deletes a photograph already committed',async()=>{
  const h=harness({confirmFailure:true,committed:true});assert.equal((await h.upload()).ok,true)
  assert.ok(!h.calls.includes('remove'));assert.ok(!h.calls.includes('retirar'))
})
test('failed upload compensates pending metadata only after Storage removal succeeds',async()=>{
  const h=harness({uploadFailure:true});assert.ok((await h.upload()).error)
  assert.ok(h.calls.indexOf('remove')<h.calls.indexOf('retirar'))
})
test('failed cleanup retains reservation and reports failure instead of success',async()=>{
  const h=harness({uploadFailure:true,cleanupFailure:true}),r=await h.upload()
  assert.ok(r.error);assert.ok(!r.ok);assert.ok(!h.calls.includes('retirar'))
})
test('retry of confirmed reservation does not reupload or remove its image',async()=>{
  const h=harness({alreadySaved:true});assert.equal((await h.upload()).ok,true)
  assert.ok(!h.calls.includes('upload'));assert.ok(!h.calls.includes('remove'))
})
