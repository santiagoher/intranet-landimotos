// Isolated PostgreSQL: no environment files, network or production users.
const {PGlite}=require('@electric-sql/pglite')
const fs=require('node:fs'),assert=require('node:assert/strict')
const db=new PGlite(),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const q=async(sql,args=[])=>(await db.query(sql,args)).rows
async function as(n,fn){await q("select set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']);await db.exec('set role authenticated');try{return await fn()}finally{await db.exec('reset role')}}
const mutate=(n,action,data)=>as(n,async()=>(await q('select public.compras_mutar($1,$2::jsonb) id',[action,JSON.stringify(data)]))[0].id)
const read=(n,table)=>as(n,()=>q('select * from public.'+table))
let checks=0
async function reject(fn,re){await assert.rejects(fn,re);checks++}
async function main(){
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table public.perfiles(id uuid primary key,nombre text,email text,rol text,estado text,modulos_permitidos text[]);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`)
 const migration=fs.readdirSync('supabase/migrations').find(f=>f.endsWith('_compras_revisiones.sql'))
 const sql=fs.readFileSync('supabase/migrations/'+migration,'utf8')
 assert.equal(sql,fs.readFileSync('docs/sql/compras-propuesta.sql','utf8'))
 await db.exec(sql)
 for(let n=1;n<=6;n++)await q('insert into perfiles values($1,$2,$3,$4,$5,$6)',[id(n),'Test '+n,`test${n}@example.invalid`,n===1?'Admin':'Operativo',n===5?'inactivo':'activo',n===4?[]:['compras']])
 await reject(()=>mutate(2,'proveedor',{nombre:'Proveedor test'}),/administrador/i)
 const proveedor=await mutate(1,'proveedor',{nombre:'Proveedor test'})
 const create={factura:'FACT-001',proveedor_id:proveedor,mesa_id:1,encargado_id:id(2)}
 for(const n of [null,4,5,2])await reject(()=>mutate(n,'crear',create),/permiso|administrador/i)
 await reject(()=>mutate(1,'crear',{...create,encargado_id:id(4)}),/encargado/i)
 const record=await mutate(1,'crear',create)
 await reject(()=>mutate(1,'crear',create),/unique/i)
 await reject(()=>mutate(1,'crear',{...create,factura:'FACT-002',mesa_id:6}),/Mesa/i)
 assert.equal((await read(2,'compras_revisiones')).length,1)
 assert.equal((await read(3,'compras_revisiones')).length,0)
 assert.equal((await read(4,'compras_revisiones')).length,0)
 assert.equal((await read(5,'compras_revisiones')).length,0)
 assert.equal((await read(2,'compras_notificaciones'))[0].tipo,'crear')
 await reject(()=>mutate(3,'iniciar',{id:record,version:1}),/disponible/i)
 await reject(()=>mutate(2,'cerrar',{id:record,version:1,cpm:'123'}),/administrador/i)
 await reject(()=>mutate(2,'finalizar',{id:record,version:1}),/iniciar/i)
 await reject(()=>as(2,()=>q("update compras_revisiones set estado='cerrado' where id=$1",[record])),/permission/i)
 await mutate(2,'iniciar',{id:record,version:1})
 await reject(()=>mutate(2,'observar',{id:record,version:1,contenido:'Stale'}),/cambió/i)
 await mutate(2,'observar',{id:record,version:2,contenido:'Revisar empaque'})
 await mutate(2,'finalizar',{id:record,version:3})
 const notices=await read(1,'compras_notificaciones')
 assert.equal(notices.length,1);assert.equal(notices[0].contexto.observaciones[0].contenido,'Revisar empaque')
 await reject(()=>mutate(2,'observar',{id:record,version:4,contenido:'Blocked'}),/durante/i)
 const before=await q('select count(*)::int total from compras_historial')
 for(const cpm of [undefined,'','   '])await reject(()=>mutate(1,'cerrar',{id:record,version:4,cpm}),/CPM/i)
 assert.deepEqual(await q('select count(*)::int total from compras_historial'),before)
 await reject(()=>mutate(1,'devolver',{id:record,version:4,motivo:''}),/motivo/i)
 await mutate(1,'devolver',{id:record,version:4,motivo:'Verificar referencia'})
 await mutate(1,'reasignar',{id:record,version:5,encargado_id:id(3),mesa_id:2,motivo:'Cambio de turno'})
 for(const table of ['compras_revisiones','compras_observaciones','compras_historial','compras_notificaciones'])assert.equal((await read(2,table)).length,0)
 assert.equal((await read(3,'compras_notificaciones'))[0].tipo,'reasignar')
 await mutate(3,'iniciar',{id:record,version:6})
 await mutate(3,'finalizar',{id:record,version:7})
 await mutate(1,'cerrar',{id:record,version:8,cpm:'000-CPM-001'})
 const closed=(await read(1,'compras_revisiones'))[0]
 assert.equal(closed.cpm,'000-CPM-001');assert.equal(closed.estado,'cerrado');assert.equal(closed.cerrado_por,id(1));assert.ok(closed.cerrado_at)
 await reject(()=>mutate(1,'devolver',{id:record,version:9,motivo:'No'}),/cerrado/i)
 await reject(()=>as(1,()=>q('delete from compras_historial where revision_id=$1',[record])),/permission/i)
 const history=await read(1,'compras_historial');assert.equal(history.length,9)
 assert.ok(history.some(h=>h.evento==='crear'&&h.datos.encargado_id===id(2)&&h.datos.mesa_id===1))
 assert.ok(history.some(h=>h.evento==='reasignar'&&h.datos.encargado_id===id(3)&&h.datos.mesa_id===2))
 const notification=(await read(3,'compras_notificaciones'))[0]
 await reject(()=>mutate(2,'leer_notificacion',{id:notification.id}),/disponible/i)
 await mutate(3,'leer_notificacion',{id:notification.id});assert.ok((await read(3,'compras_notificaciones'))[0].leido_at)
 const summary=await as(1,()=>q("select compras_consultar('{\"cpm\":\"CPM\"}',1,25) data"))
 assert.equal(summary[0].data.total,1);assert.equal(summary[0].data.cerrado,1);assert.equal(summary[0].data.por_mesa[0].mesa_id,2)
 const exported=(await as(1,()=>q("select compras_exportar('{\"cpm\":\"CPM\"}') data")))[0].data
 assert.equal(exported.registros.length,1);assert.equal(exported.observaciones.length,1);assert.equal(exported.historial.length,9)
 await reject(()=>as(3,()=>q('select compras_exportar()')),/administrador/i)
 const dateFilter=(await as(1,()=>q("select compras_consultar(jsonb_build_object('desde',to_char(now() at time zone 'America/Bogota','YYYY-MM-DD'),'hasta',to_char(now() at time zone 'America/Bogota','YYYY-MM-DD')),1,25) data")))[0].data
 assert.equal(dateFilter.total,1)
 const filtered=await as(3,()=>q("select compras_consultar('{\"mesa_id\":\"1\"}',1,25) data"));assert.equal(filtered[0].data.total,0)
 await reject(()=>as(2,()=>q('select compras_operadores()')),/administrador/i)
 await q("update perfiles set modulos_permitidos='{}' where id=$1",[id(3)])
 assert.equal((await read(3,'compras_revisiones')).length,0)
 await reject(()=>mutate(3,'leer_notificacion',{id:notification.id}),/permiso/i)
 await db.exec('set role anon');await reject(()=>q('select compras_mutar($1,$2)',['crear','{}']),/permission/i);await db.exec('reset role')
 await as(1,()=>q("select compras_mutar('crear',jsonb_build_object('factura','BULK-'||n,'proveedor_id',$1::text,'mesa_id',1,'encargado_id',$2::text)) from generate_series(1,505) n",[proveedor,id(2)]))
 const paged=(await as(1,()=>q("select compras_consultar('{\"factura\":\"BULK-\"}',2,500) data")))[0].data
 assert.equal(paged.total,505);assert.equal(paged.registros.length,5)
 const fullExport=(await as(1,()=>q("select compras_exportar('{\"factura\":\"BULK-\"}') data")))[0].data
 assert.equal(fullExport.registros.length,505);assert.equal(fullExport.historial.length,505)
 const other=(await as(6,()=>q("select compras_consultar('{\"mesa_id\":\"1\"}',1,25) data")))[0].data
 assert.equal(other.total,0)
 console.log(`Compras SQL OK: flujo completo, RLS, CPM, historial, notificaciones, reasignación y ${checks} intentos rechazados.`)
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.close())
