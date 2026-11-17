const {PGlite}=require('@electric-sql/pglite')
const fs=require('node:fs'),assert=require('node:assert/strict')
const db=new PGlite(),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const q=async(s,p=[])=>(await db.query(s,p)).rows
async function as(n,fn){await q("select set_config('request.jwt.claim.sub',$1,false)",[id(n)]);await db.exec('set role authenticated');try{return await fn()}finally{await db.exec('reset role')}}
const mutate=(n,a,d)=>as(n,async()=>(await q('select compras_mutar($1,$2) id',[a,JSON.stringify(d)]))[0].id)
const mesa=(n,p,m,v=1,active=true)=>as(n,()=>q('select compras_guardar_mesa($1,$2::smallint,$3,$4)',[p,m,active,v]))
async function main(){
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create table perfiles(id uuid primary key,nombre text,email text,rol text,estado text,modulos_permitidos text[]);`)
 await db.exec(fs.readFileSync('supabase/migrations/20261110183815_compras_revisiones.sql','utf8'))
 for(let n=1;n<=4;n++)await q('insert into perfiles values($1,$2,$3,$4,$5,$6)',[id(n),`Cuenta ${n}`,`test${n}@example.invalid`,n===1?'Admin':'Operativo','activo',['compras']])
 const legacySupplier=await mutate(1,'proveedor',{nombre:'Proveedor anterior'})
 const legacy=await mutate(1,'crear',{factura:'ANTERIOR',proveedor_id:legacySupplier,mesa_id:1,encargado_id:id(4)})
 const before=(await q('select to_jsonb(r) data from compras_revisiones r where id=$1',[legacy]))[0].data
 const migration=fs.readdirSync('supabase/migrations').find(f=>f.endsWith('_compras_equipo_proveedores.sql'))
 await db.exec(fs.readFileSync('supabase/migrations/'+migration,'utf8'))
 const after=(await q('select to_jsonb(r) data from compras_revisiones r where id=$1',[legacy]))[0].data
 for(const key of Object.keys(before))assert.deepEqual(after[key],before[key])
 const suppliers=JSON.parse(fs.readFileSync('data/compras-proveedores-activos.json','utf8'))
 assert.equal(suppliers.length,69);assert.equal(new Set(suppliers.map(p=>p[0])).size,69)
 for(const [nit,nombre] of suppliers){const [p]=await q('select * from compras_proveedores where nit=$1',[nit]);assert.equal(p.nombre,nombre);assert.equal(p.activo,true)}
 await q('insert into compras_administradores(perfil_id) values($1)',[id(3)])
 const people=[]
 for(const nombre of ['Ángel Pachón','Holman Rojas','Juan Carlos Mosquera','Nelson Pérez'])people.push((await q('insert into compras_encargados(perfil_id,nombre) values($1,$2) returning id',[id(2),nombre]))[0].id)
 assert.equal((await as(3,()=>q('select compras_es_admin() admin')))[0].admin,true)
 assert.equal((await q('select rol from perfiles where id=$1',[id(3)]))[0].rol,'Operativo')
 assert.equal((await as(2,()=>q('select compras_es_admin() admin')))[0].admin,false)
 await assert.rejects(()=>mesa(2,people[0],1),/administrador/i)
 await assert.rejects(()=>as(3,()=>q("update perfiles set rol='Admin' where id=$1",[id(3)])),/permission/i)
 assert.equal((await as(3,()=>q('select compras_operadores() data')))[0].data.some(p=>p.id===id(2)),false)
 await mesa(3,people[0],1);await mesa(3,people[1],2)
 await assert.rejects(()=>mesa(3,people[0],3),/cambi/i)
 assert.equal((await q('select count(*)::int n from compras_equipo_historial'))[0].n,2)
 const operators=(await as(3,()=>q('select compras_operadores() data')))[0].data
 assert.equal(operators.filter(p=>p.id===id(2)).length,2)
 const base={factura:'NUEVA',proveedor_id:legacySupplier,mesa_id:1,encargado_id:id(2),encargado_persona_id:people[0]}
 await assert.rejects(()=>mutate(3,'crear',{...base,mesa_id:2}),/coincidir/i)
 await assert.rejects(()=>mutate(3,'crear',{...base,encargado_persona_id:undefined}),/compartida/i)
 const first=await mutate(3,'crear',base)
 const second=await mutate(3,'crear',{...base,factura:'NUEVA-2',mesa_id:2,encargado_persona_id:people[1]})
 assert.equal((await as(2,()=>q('select count(*)::int n from compras_revisiones')))[0].n,2)
 await mutate(2,'iniciar',{id:first,version:1})
 await mutate(2,'finalizar',{id:first,version:2})
 assert.equal((await as(3,()=>q("select count(*)::int n from compras_notificaciones where tipo='finalizar'")))[0].n,1)
 await mutate(3,'cerrar',{id:first,version:3,cpm:'CPM-1'})
 const history=(await q("select * from compras_historial where revision_id=$1 and evento='finalizar'",[first]))[0]
 assert.equal(history.actor_id,id(2));assert.equal(history.actor_nombre,'Cuenta 2');assert.equal(history.datos.encargado_nombre,'Ángel Pachón')
 const summary=(await as(3,()=>q("select compras_consultar(jsonb_build_object('encargado_persona_id',$1::text)) data",[people[1]])))[0].data
 assert.equal(summary.total,1);assert.equal(summary.registros[0].id,second)
 await mesa(3,people[0],3,2)
 assert.equal((await q('select mesa_id from compras_revisiones where id=$1',[first]))[0].mesa_id,1)
 await q("update perfiles set modulos_permitidos='{}' where id=$1",[id(3)])
 assert.equal((await as(3,()=>q('select compras_es_admin() admin')))[0].admin,false)
 await assert.rejects(()=>mesa(3,people[1],5,2),/administrador/i)
 assert.equal((await q("select has_function_privilege('anon','public.compras_guardar_mesa(uuid,smallint,boolean,integer)','EXECUTE') allowed"))[0].allowed,false)
 const articlesMigration=fs.readdirSync('supabase/migrations').find(f=>f.endsWith('_compras_numero_articulos.sql'))
 await db.exec(fs.readFileSync('supabase/migrations/'+articlesMigration,'utf8'))
 assert.equal((await q('select numero_articulos from compras_revisiones where id=$1',[legacy]))[0].numero_articulos,null)
 const articleInput={factura:'ARTICULOS',proveedor_id:legacySupplier,mesa_id:1,encargado_id:id(4)}
 for(const numero_articulos of [undefined,null,0,-2,1.5,'20',2147483648])await assert.rejects(()=>mutate(1,'crear',{...articleInput,numero_articulos}),/artículos/i)
 const articleRecord=await mutate(1,'crear',{...articleInput,numero_articulos:120})
 await mutate(4,'iniciar',{id:articleRecord,version:1})
 await mutate(4,'finalizar',{id:articleRecord,version:2})
 await mutate(1,'cerrar',{id:articleRecord,version:3,cpm:'ART-CPM'})
 assert.equal((await q('select numero_articulos from compras_revisiones where id=$1',[articleRecord]))[0].numero_articulos,120)
 const audit=await q('select datos from compras_historial where revision_id=$1',[articleRecord]);assert.ok(audit.every(h=>h.datos.numero_articulos===120))
 const articlesSummary=(await as(1,()=>q("select compras_consultar('{}') data")))[0].data
 assert.equal(articlesSummary.total_articulos,120);assert.equal(articlesSummary.sin_numero_articulos,3)
 const articlesFilter=(await as(1,()=>q("select compras_consultar('{\"factura\":\"ARTICULOS\"}') data")))[0].data
 assert.equal(articlesFilter.total_articulos,120);assert.equal(articlesFilter.sin_numero_articulos,0)
 const articlesExport=(await as(1,()=>q("select compras_exportar('{\"factura\":\"ARTICULOS\"}') data")))[0].data
 assert.equal(articlesExport.registros[0].numero_articulos,120)
 await q("update perfiles set modulos_permitidos='{compras}' where id=$1",[id(3)])
 const selfPerson=(await q("insert into compras_encargados(perfil_id,nombre) values($1,'Camilo de prueba') returning id",[id(3)]))[0].id
 await mesa(3,selfPerson,3)
 assert.ok((await as(3,()=>q('select compras_operadores() data')))[0].data.some(p=>p.persona_id===selfPerson))
 const selfRecord=await mutate(3,'crear',{...articleInput,factura:'PROPIA',encargado_id:id(3),encargado_persona_id:selfPerson,mesa_id:3,numero_articulos:12})
 await mutate(3,'iniciar',{id:selfRecord,version:1})
 await mutate(3,'observar',{id:selfRecord,version:2,contenido:'Revisión propia'})
 await mutate(3,'finalizar',{id:selfRecord,version:3})
 await mutate(3,'cerrar',{id:selfRecord,version:4,cpm:'CPM-PROPIA'})
 assert.equal((await as(2,()=>q('select count(*)::int n from compras_revisiones where id=$1',[selfRecord])))[0].n,0)
 assert.equal((await q('select estado from compras_revisiones where id=$1',[selfRecord]))[0].estado,'cerrado')
 await db.exec(fs.readFileSync('supabase/migrations/'+fs.readdirSync('supabase/migrations').find(f=>f.endsWith('_compras_horario_laboral.sql')),'utf8'))
 const tramo=async(a,b)=>(await q('select * from compras_private.tramo_laboral($1,$2)',[a,b]))[0]
 for(const [a,b,seconds,days] of [
  ['2026-11-16 08:20-05','2026-11-16 17:00-05',25800,1],
  ['2026-11-21 08:20-05','2026-11-21 15:00-05',20400,1],
  ['2026-11-16 12:00-05','2026-11-16 13:30-05',0,0],
  ['2026-11-22 00:00-05','2026-11-23 08:20-05',0,0],
  ['2026-11-20 08:20-05','2026-11-21 15:00-05',46200,2],
  ['2026-11-21 14:00-05','2026-11-23 09:20-05',7200,3600/20400+3600/25800],
  ['2026-11-16 11:50-05','2026-11-16 13:40-05',1200,1200/25800],
  ['2026-11-16 17:00-05','2026-11-16 08:20-05',0,0],
 ]){const t=await tramo(a,b);assert.equal(Number(t.segundos),seconds);assert.ok(Math.abs(Number(t.jornadas)-days)<1e-9)}
 // Historical corrections count independently; waiting for an admin never counts.
 await q("update compras_historial set creado_at=case evento when 'iniciar' then '2026-11-16 08:20-05'::timestamptz else '2026-11-18 08:21-05'::timestamptz end where revision_id=$1 and evento in ('iniciar','finalizar')",[articleRecord])
 const timing=(await as(1,()=>q('select compras_tiempo($1) data',[articleRecord])))[0].data
 assert.equal(timing.segundos_laborales,51660);assert.equal(timing.vencida,true)
 assert.equal((await as(2,()=>q('select compras_tiempo($1) data',[articleRecord])))[0].data,null)
 const report=(await as(1,()=>q("select compras_consultar('{\"factura\":\"ARTICULOS\"}') data")))[0].data
 assert.equal(report.promedio_segundos,51660);assert.equal(report.vencidas,1)
 assert.equal(report.registros[0].segundos_laborales,51660)
 const exported=(await as(1,()=>q("select compras_exportar('{\"factura\":\"ARTICULOS\"}') data")))[0].data
 assert.equal(exported.registros[0].vencida,true)
 const overdue=await mutate(1,'crear',{...articleInput,factura:'VENCIDA',numero_articulos:1})
 await mutate(4,'iniciar',{id:overdue,version:1})
 await q("update compras_revisiones set tramo_inicio=now()-interval '10 days' where id=$1",[overdue])
 assert.equal((await as(4,()=>q('select compras_tiempo($1) data',[overdue])))[0].data.vencida,true)
 await mutate(4,'finalizar',{id:overdue,version:2})
 assert.equal((await q('select estado from compras_revisiones where id=$1',[overdue]))[0].estado,'pendiente_cierre')
 await db.exec(fs.readFileSync('supabase/migrations/'+fs.readdirSync('supabase/migrations').find(f=>f.endsWith('_compras_encargados_sin_mesa.sql')),'utf8'))
 await mesa(3,selfPerson,null,2)
 const available=(await as(3,()=>q('select compras_operadores() data')))[0].data
 assert.ok(available.some(p=>p.persona_id===selfPerson&&p.mesa_id===null))
 await assert.rejects(()=>mutate(3,'crear',{...articleInput,factura:'SIN-MESA',encargado_id:id(3),encargado_persona_id:selfPerson,mesa_id:3,numero_articulos:1}),/mesa|configuracion/i)
 await assert.rejects(()=>as(2,()=>q('select compras_operadores()')),/administrador/i)
 console.log('Compras OK: permisos, artículos, horario laboral, plazo y encargados visibles sin mesa.')
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.close())
