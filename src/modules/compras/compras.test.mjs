import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),ts=require('typescript')
function load(file,overrides={}){
 const mod={exports:{}}
 const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
 vm.runInThisContext(`(function(module,exports,require){${compiled}\n})`)(mod,mod.exports,n=>overrides[n]??(n==='server-only'?{}:n.startsWith('.')?load(path.resolve(path.dirname(file),n+'.ts'),overrides):require(n)))
 return mod.exports
}
const directory='src/modules/compras/'
const id='00000000-0000-4000-8000-000000000001'
test('validation requires CPM, UUIDs, expected version and valid dates',()=>{
 const {mutationSchema,filtersSchema}=load(directory+'validation.ts')
 assert.equal(mutationSchema.safeParse({accion:'cerrar',id,version:1,cpm:'  '}).success,false)
 assert.equal(mutationSchema.safeParse({accion:'iniciar',id,version:0}).success,false)
 assert.equal(mutationSchema.safeParse({accion:'crear',factura:'A',proveedor_id:id,mesa_id:6,encargado_id:id}).success,false)
 assert.equal(filtersSchema.safeParse({desde:'2026-02-30'}).success,false)
 assert.equal(filtersSchema.safeParse({desde:'2026-11-10',hasta:'2026-11-01'}).success,false)
 assert.equal(filtersSchema.safeParse({desde:'2026-11-01',hasta:'2026-11-10'}).success,true)
 const creation={accion:'crear',factura:'A',proveedor_id:id,mesa_id:1,encargado_id:id}
 for(const numero_articulos of [undefined,null,0,-1,1.5,'12',2147483648])assert.equal(mutationSchema.safeParse({...creation,numero_articulos}).success,false)
 assert.equal(mutationSchema.safeParse({...creation,numero_articulos:120}).success,true)
})
test('server access checks stored role/module and blocks operative report access',async()=>{
 for(const [profile,allowed,reportAllowed,moduleAdmin=false] of [
  [{rol:'Admin',estado:'activo',modulos_permitidos:[]},true,true],
  [{rol:'Operativo',estado:'activo',modulos_permitidos:['compras']},true,false],
  [{rol:'Operativo',estado:'activo',modulos_permitidos:['compras']},true,true,true],
  [{rol:'Operativo',estado:'inactivo',modulos_permitidos:['compras']},false,false,true],
  [{rol:'Operativo',estado:'activo',modulos_permitidos:[]},false,false],
  [{rol:'Admin',estado:'inactivo',modulos_permitidos:['compras']},false,false],
 ]){
  const service=load(directory+'service.server.ts',{'react':{cache:f=>f},'@/utils/supabase/session.server':{
   getAuthUser:async()=>({data:{user:{id,user_metadata:{rol:'Admin'}}}}),getProfile:async()=>({data:profile})},'@/utils/supabase/server':{createClient:async()=>({rpc:async()=>({data:moduleAdmin,error:null})})}})
  if(allowed)assert.equal((await service.requireCompras()).userId,id);else await assert.rejects(()=>service.requireCompras())
  if(reportAllowed)assert.equal((await service.requireCompras(true)).admin,true);else await assert.rejects(()=>service.requireCompras(true))
 }
})
test('mutation action rejects forbidden admin changes before RPC and preserves expected version',async()=>{
 const calls=[];let admin=false
 class AccessError extends Error{}
 const actions=load(directory+'actions.ts',{
  './service.server':{ComprasError:AccessError,requireCompras:async only=>{if(only&&!admin)throw new AccessError('Forbidden')},notificacionesCompras:async()=>[]},
  'next/cache':{revalidatePath:p=>calls.push(['revalidate',p])},
  '@/utils/supabase/server':{createClient:async()=>({rpc:async(name,args)=>{calls.push([name,args]);return {data:id,error:null}}})},
 })
 const input={accion:'cerrar',id,version:7,cpm:'000123'}
 assert.equal((await actions.mutarCompra(input)).error,'Forbidden');assert.equal(calls.length,0)
 assert.equal((await actions.guardarMesaCompras({id,mesa_id:1,activo:true,version:1})).error,'Forbidden');assert.equal(calls.length,0)
 admin=true;assert.equal((await actions.mutarCompra(input)).id,id)
 assert.equal(calls[0][1].p_datos.version,7);assert.equal(calls[0][1].p_datos.cpm,'000123')
})
test('Excel exports real XLSX with audit sheets and preserves text without formulas',async()=>{
 const {comprasWorkbook}=load(directory+'excel.server.ts')
 const data={registros:[{id,factura:'=1+1',proveedor_nombre:'Proveedor',mesa_id:1,encargado_nombre:'Operador',encargado_id:id,asignador_nombre:'Admin',asignado_por:id,estado:'cerrado',cpm:'000123',creado_at:'2026-11-10T14:00:00Z',iniciado_at:null,finalizado_at:null,cerrado_at:null,cerrador_nombre:'Admin',cerrado_por:id,segundos_revision:900,segundos_laborales:120,jornadas_laborales:0.01,vencida:false,version:4}],observaciones:[],historial:[]}
 data.registros[0].numero_articulos=120
 const buffer=await comprasWorkbook(data)
 const ExcelJS=require('exceljs'),book=new ExcelJS.Workbook();await book.xlsx.load(buffer)
 assert.deepEqual(book.worksheets.map(s=>s.name),['Revisiones','Observaciones','Historial'])
 const sheet=book.getWorksheet('Revisiones');assert.equal(sheet.getCell('Q2').value,2);assert.equal(sheet.getCell('T2').value,0.01);assert.equal(sheet.getCell('U2').value,'Dentro del plazo')
 assert.equal(sheet.getCell('B2').value,'=1+1');assert.equal(sheet.getCell('B2').type,ExcelJS.ValueType.String)
 assert.equal(sheet.getCell('J2').value,'000123');assert.ok(sheet.getCell('K2').value.includes('9:00'))
 assert.equal(sheet.getCell('S1').value,'Número de artículos');assert.equal(sheet.getCell('S2').value,120);assert.equal(sheet.getCell('S2').type,ExcelJS.ValueType.Number)
})
