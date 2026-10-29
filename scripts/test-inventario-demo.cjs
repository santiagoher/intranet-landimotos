// Entirely isolated PostgreSQL WASM. No env loading, network or real profiles.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {createRequire}=require('node:module')
const {PGlite}=createRequire(path.resolve(process.argv[2],'package.json'))('@electric-sql/pglite')
const db=new PGlite(),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const shared=process.argv.includes('--shared')
const q=async(sql,args=[])=>(await db.query(sql,args)).rows
async function as(n,fn){await q("select set_config('request.jwt.claim.sub',$1,false)",[id(n)]);await db.exec('set role authenticated');try{return await fn()}finally{await db.exec('reset role')}}
async function main(){
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create table perfiles(id uuid primary key references auth.users,nombre text,rol text,estado text,modulos_permitidos text[]);
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
 grant usage on schema storage to authenticated,service_role;grant all on storage.objects to authenticated,service_role;`)
 await db.exec(fs.readFileSync('docs/sql/inventarios-propuesta.sql','utf8').replace(/rollback;\s*$/i,'commit;'))
 for(const suffix of ['operacion_categorias','conteo_reporte','referencias_conciliacion','roles_cierre_diferencias','evento_asignacion_unico','prioridades_tres_niveles','autoiniciados','evidencias_conteo','verificar_cerrar','conflictos_version']){
  if(shared&&['prioridades_tres_niveles','autoiniciados'].includes(suffix))continue
  const file=fs.readdirSync('supabase/migrations').find(f=>f.endsWith(`inventarios_${suffix}.sql`))
  await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'))
 }
 if(shared){
  await q("insert into inventario_bodegas(id,nombre,origen,referencia_local) values($1,'HISTORICAL','excel','HISTORICAL')",[id(990)])
  await q("insert into inventario_categorias(id,bodega_id,nombre,origen,referencia_local) values($1,$2,'HISTORICAL','excel','HISTORICAL')",[id(991),id(990)])
  await q("insert into inventario_tickets(id,numero,bodega_id,categoria_id,modo,estado,prioridad) values($1,'HISTORICAL',$2,$3,'categoria','pendiente_asignacion','urgente')",[id(992),id(990),id(991)])
  const before=(await q('select to_jsonb(t) as data from inventario_tickets t'))[0].data
  const policies=await q('select * from pg_policies order by schemaname,tablename,policyname')
  const conflicts=await q("select proname,pg_get_functiondef(oid) as definition from pg_proc where pronamespace='inventario_private'::regnamespace and proname in ('contar_producto','actualizar_tarea','revisar_conteo','observacion_guardar') order by proname")
  const migration=fs.readdirSync('supabase/migrations').find(f=>f.endsWith('_inventarios_demo_compartido.sql'))
  await db.exec(fs.readFileSync('supabase/migrations/'+migration,'utf8'))
  const after=(await q('select to_jsonb(t) as data from inventario_tickets t'))[0].data
  for(const [key,value] of Object.entries(before))assert.deepEqual(after[key],value)
  assert.deepEqual(await q('select * from pg_policies order by schemaname,tablename,policyname'),policies)
  assert.deepEqual(await q("select proname,pg_get_functiondef(oid) as definition from pg_proc where pronamespace='inventario_private'::regnamespace and proname in ('contar_producto','actualizar_tarea','revisar_conteo','observacion_guardar') order by proname"),conflicts)
  assert.equal((await q('select inventario_private.demo_activo() as enabled'))[0].enabled,false)
  await q('delete from inventario_tickets where id=$1',[id(992)])
  await q('delete from inventario_categorias where id=$1',[id(991)])
  await q('delete from inventario_bodegas where id=$1',[id(990)])
  await q('update inventario_private.demo_entorno set enabled=true')
  const serverMigration=fs.readdirSync('supabase/migrations').find(f=>f.endsWith('_inventarios_demo_servidor_local.sql'))
  await db.exec(fs.readFileSync('supabase/migrations/'+serverMigration,'utf8'))
  const testKey='local-test-key-not-a-real-secret'
  await q("update inventario_private.demo_entorno set server_key_sha256=encode(sha256(convert_to($1,'UTF8')),'hex')",[testKey])
  assert.equal((await q('select inventario_private.demo_activo() enabled'))[0].enabled,false)
  await q("select set_config('request.headers',$1,false)",[JSON.stringify({'x-inventory-demo-key':'wrong'})])
  assert.equal((await q('select inventario_private.demo_activo() enabled'))[0].enabled,false)
  await q("select set_config('request.headers',$1,false)",[JSON.stringify({'x-inventory-demo-key':testKey})])
  assert.equal((await q('select inventario_private.demo_activo() enabled'))[0].enabled,true)
  const filtersMigration=fs.readdirSync('supabase/migrations').find(f=>f.endsWith('_inventarios_demo_filtros.sql'))
  await db.exec(fs.readFileSync('supabase/migrations/'+filtersMigration,'utf8'))
 }else{
 const install=fs.readFileSync('supabase/testing/inventarios-demo.sql','utf8')
 await assert.rejects(()=>db.exec(install),/Destino DEMO/);await db.exec('rollback')
 await q("select set_config('landimotos.demo_target_host','loajbvlgpsxrkfzyxbui.supabase.co',false)")
 await assert.rejects(()=>db.exec(install),/Destino DEMO/);await db.exec('rollback')
 await q("select set_config('landimotos.demo_target_host','localhost:54321',false)")
 await db.exec(install)
 }
 for(let n=1;n<=5;n++){await q('insert into auth.users values($1)',[id(n)]);await q("insert into perfiles values($1,$2,'Operativo','activo',array['inventarios'])",[id(n),`DEMO USER ${n}`])}
 await q('insert into inventario_administradores(perfil_id) values($1)',[id(1)])
 for(const n of [10,11]){
  await q("insert into inventario_bodegas(id,nombre,origen,referencia_local) values($1,$2,'excel',$2)",[id(n),`BODEGA DEMO ${n}`])
  await q('select inventario_private.demo_sembrar($1)',[id(n)])
 }
 for(const [warehouse,user,role] of [[10,2,'lider'],[10,3,'operador'],[11,4,'operador'],[11,5,'lider']])
  await q('insert into inventario_usuarios_bodegas(bodega_id,perfil_id,rol,es_responsable) values($1,$2,$3,$4)',[id(warehouse),id(user),role,role==='lider'])
 const context=(await as(3,()=>q('select inventario_demo_contexto() as data')))[0].data
 assert.equal(context.enabled,true);assert.deepEqual(context.warehouses,[id(10)]);assert.equal(context.categories.length,5)
 const category=context.categories[0].id
 const catalog=(await as(3,()=>q('select inventario_demo_catalogo($1,$2) as data',[id(10),category])))[0].data
 assert.equal(catalog.length,2)
 assert.deepEqual(Object.keys(catalog[0]).sort(),shared?['barcodes','brand','code','id','name','subcategory','unit']:['barcodes','code','id','name','unit'])
 await assert.rejects(()=>as(4,()=>q('select inventario_demo_catalogo($1,$2)',[id(10),category])),e=>e.code==='42501')
 const ids=catalog.map(p=>p.id)
 const create=(user=3,key=100,scope=category,products=ids,note='DEMO')=>as(user,()=>q('select inventario_demo_autoiniciar($1,$2,$3,$4,$5) as ticket',[id(key),id(10),scope,note,products]))
 for(const user of [1,2,4])await assert.rejects(()=>create(user),e=>e.code==='42501')
 // The operator's context intentionally hides other members. Creation still
 // validates the responsible leader in the database, independently of that DTO.
 const operatorContext=(await as(3,()=>q('select inventario_contexto() as data')))[0].data
 assert.ok(operatorContext.members.every(m=>m.id===id(3)))
 await q('update inventario_usuarios_bodegas set activo=false where perfil_id=$1',[id(2)])
 await assert.rejects(()=>create(),/responsable activo/)
 assert.equal((await q('select count(*)::int n from inventario_tickets'))[0].n,0)
 await q('update inventario_usuarios_bodegas set activo=true where perfil_id=$1',[id(2)])
 await assert.rejects(()=>create(3,100,context.categories[1].id,ids),/catálogo cambió/)
 await assert.rejects(()=>create(3,100,category,[ids[0]]),/catálogo cambió/)
 await create();await create()
 assert.equal((await q('select count(*)::int n from inventario_tickets'))[0].n,1)
 const task=(await q('select * from inventario_tickets'))[0]
 assert.equal(task.es_prueba,true);assert.equal(task.asignado_a,id(3));assert.equal(task.creado_por,id(3));assert.equal(task.lider_id,id(2));assert.equal(task.asignado_por,null)
 assert.equal(task.estado,'en_proceso');assert.equal(task.total_productos,2);assert.equal(task.productos_contados,0);assert.ok(task.iniciado_at)
 assert.equal((await q('select count(*)::int n from inventario_auditoria'))[0].n,1)
 assert.equal((await as(2,()=>q('select count(*)::int n from inventario_notificaciones')))[0].n,1)
 assert.equal((await as(5,()=>q('select count(*)::int n from inventario_tickets')))[0].n,0)
 assert.equal((await as(5,()=>q('select count(*)::int n from inventario_notificaciones')))[0].n,0)
 await assert.rejects(()=>create(3,100,category,ids,'changed'),/otros datos/)
 await assert.rejects(()=>create(3,101),/inventario activo/)
 await assert.rejects(()=>as(2,()=>q("select inventario_asignar($1,$2,$3,$4,'normal',null,'DEMO')",[id(102),id(10),category,id(3)])),shared?/DEMO/:/inventario activo/)
 for(const table of ['demo_productos','demo_entorno','demo_tickets','referencias_producto'])await assert.rejects(()=>as(3,()=>q('select * from inventario_private.'+table)),/permission denied/)
 const items=(await as(3,()=>q('select inventario_productos_tarea($1) as data',[id(100)])))[0].data
 assert.ok(items.every(p=>p.quantity===null));assert.ok(items.every(p=>!('expected' in p)))
 await assert.rejects(()=>as(3,()=>q("select inventario_actualizar($1,1,'finalizar',null,'DEMO')",[id(100)])),/contar|conteo|productos/i)
 await as(3,()=>q('select inventario_contar_producto($1,1,$2)',[items[0].id,'10']))
 await assert.rejects(()=>as(3,()=>q('select inventario_contar_producto($1,1,$2)',[items[1].id,'0'])),e=>e.code==='PT409')
 await as(3,()=>q('select inventario_contar_producto($1,2,$2)',[items[1].id,'0']))
 assert.equal((await q('select productos_contados from inventario_tickets'))[0].productos_contados,2)
 await as(3,()=>q("select inventario_observacion_guardar($1,'Observación DEMO',0)",[id(100)]))
 await as(3,()=>q("select inventario_actualizar($1,3,'finalizar',null,'DEMO finalizado')",[id(100)]))
 assert.equal((await as(2,()=>q('select count(*)::int n from inventario_notificaciones')))[0].n,2)
 for(const user of [1,3,4,5])await assert.rejects(()=>as(user,()=>q("select inventario_revisar_conteo($1,4,'verificar_cerrar','DEMO')",[id(100)])),e=>e.code==='42501')
 await as(2,()=>q("select inventario_revisar_conteo($1,4,'devolver','Recontar DEMO')",[id(100)]))
 assert.ok((await q('select cantidad_contada from inventario_tarea_productos')).every(p=>p.cantidad_contada===null))
 await as(3,()=>q('select inventario_contar_producto($1,5,$2)',[items[0].id,'9']))
 await as(3,()=>q('select inventario_contar_producto($1,6,$2)',[items[1].id,'0']))
 await as(3,()=>q("select inventario_actualizar($1,7,'finalizar',null,'DEMO reconteo')",[id(100)]))
 await as(2,()=>q("select inventario_revisar_conteo($1,8,'verificar_cerrar','Diferencia DEMO verificada')",[id(100)]))
 const closed=(await q('select * from inventario_tickets'))[0]
 assert.equal(closed.estado,'cerrado');assert.equal(closed.es_prueba,true);assert.equal(closed.cierre_con_diferencias,true);assert.ok(closed.enviado_at);assert.ok(closed.cerrado_at)
 if(shared){
  const first=catalog[0]
  assert.ok(first.subcategory&&first.brand)
  const filtered=(user=3,key=150,products=[first.id],subcategory=first.subcategory,brand=first.brand)=>as(user,()=>q('select inventario_demo_autoiniciar_filtrado($1,$2,$3,$4,$5,$6,$7) as ticket',[id(key),id(10),category,'Filtered DEMO',products,subcategory,brand]))
  for(const user of [1,2,4])await assert.rejects(()=>filtered(user),e=>e.code==='42501')
  await assert.rejects(()=>filtered(3,150,ids),/catálogo cambió/)
  await assert.rejects(()=>filtered(3,150,[first.id],'Invented'),/catálogo cambió/)
  await assert.rejects(()=>filtered(3,150,[first.id,first.id]),/catálogo cambió/)
  await q("select set_config('request.headers','{}',false)")
  await assert.rejects(()=>filtered(),e=>e.code==='42501')
  await q("select set_config('request.headers',$1,false)",[JSON.stringify({'x-inventory-demo-key':'local-test-key-not-a-real-secret'})])
  await filtered();await filtered()
  await assert.rejects(()=>filtered(3,150,[first.id],null,first.brand),/otros datos/)
  await assert.rejects(()=>filtered(3,151),/inventario activo/)
  const filteredTask=(await q('select * from inventario_tickets where id=$1',[id(150)]))[0]
  assert.equal(filteredTask.total_productos,1)
  const selected=(await as(3,()=>q('select inventario_productos_tarea($1) as data',[id(150)])))[0].data
  assert.equal(selected.length,1);assert.equal(selected[0].code,first.code);assert.equal(selected[0].quantity,null)
  const events=await q('select * from inventario_auditoria where ticket_id=$1',[id(150)])
  assert.equal(events.length,1);assert.ok(events[0].contexto.includes(first.brand))
  assert.equal((await q('select subcategoria from inventario_private.demo_tickets where ticket_id=$1',[id(150)]))[0].subcategoria,first.subcategory)
 }
 await q('update inventario_usuarios_bodegas set puede_autoiniciar=false where perfil_id=$1',[id(3)])
 await assert.rejects(()=>create(3,103),e=>e.code==='42501')
 assert.equal((await q('select count(*)::int n from inventario_productos'))[0].n,0)
 assert.equal((await q('select count(*)::int n from inventario_sesiones'))[0].n,0)
 console.log('PASS DEMO: isolated install guard, scoped catalogue, blind DTO, roles/RLS, one ticket/event on retry, duplicate scope, notices, zero/null counts, PT409, completion, recount, leader closure, no ERP writes.')
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.close())
