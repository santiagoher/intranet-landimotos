// In-memory PostgreSQL only. No env loading, network, or production identities.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const {createRequire}=require('node:module')
const {PGlite}=createRequire(path.resolve(process.argv[2],'package.json'))('@electric-sql/pglite')
const metadata=JSON.parse(fs.readFileSync('docs/recuperacion-profiles/perfiles-metadatos-actuales.json','utf8')).metadata
const functions=JSON.parse(fs.readFileSync('docs/recuperacion-profiles/dependencias-actuales.json','utf8')).evidence.perfiles_functions
const db=new PGlite(),id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const q=async(sql,params=[])=>(await db.query(sql,params)).rows
const quote=name=>'"'+name.replaceAll('"','""')+'"'
async function as(user,fn,role='authenticated'){
 await q("select set_config('request.jwt.claim.sub',$1,false)",[user?id(user):''])
 await db.exec('set role '+role)
 try{return await fn()}finally{await db.exec('reset role')}
}
async function main(){
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create role supabase_auth_admin;
 create schema auth;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated,supabase_auth_admin;
 grant execute on function auth.uid() to anon,authenticated;
 grant insert,select on auth.users to supabase_auth_admin;`)
 await db.exec('create table public.perfiles ('+metadata.columns.map(c=>quote(c.name)+' '+c.type+(c.not_null?' not null':'')+(c.default?' default '+c.default:'')).join(',')+');')
 for(const c of metadata.constraints.filter(c=>c.table==='perfiles'))await db.exec('alter table public.perfiles add constraint '+quote(c.name)+' '+c.definition)
 for(const fn of functions)await db.exec(fn.definition)
 await db.exec('alter table perfiles enable row level security;grant all on perfiles to anon,authenticated,service_role;')
 for(const p of metadata.policies)await db.exec('create policy '+quote(p.policyname)+' on public.perfiles as '+p.permissive+' for '+p.cmd+' to '+p.roles.join(',')+(p.qual?' using ('+p.qual+')':'')+(p.with_check?' with check ('+p.with_check+')':'')+';')
 for(let n=1;n<=4;n++){
  await q('insert into auth.users(id,email) values($1,$2)',[id(n),`test${n}@example.invalid`])
  await q('insert into perfiles(id,email,nombre,rol,estado,modulos_permitidos) values($1,$2,$3,$4,$5,$6)',[id(n),`test${n}@example.invalid`,`TEST ${n}`,n===1?'Admin':'Operativo',n===4?'inactivo':'activo',n===2?['inventarios']:['despachos','mensajeros']])
 }
 await db.exec(metadata.triggers[0])
 const before=await q('select * from perfiles order by id')
 const schemaBefore=await q("select conname,pg_get_constraintdef(oid) definition from pg_constraint where conrelid='perfiles'::regclass order by conname")
 const policiesBefore=await q("select * from pg_policies where tablename='perfiles' order by policyname")
 // Demonstrate the original metadata-derived privilege issue only in memory.
 await db.exec('begin')
 await q('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id(90),'before@example.invalid',{nombre:'TEST BEFORE',rol:'Admin'}])
 assert.equal((await q('select rol from perfiles where id=$1',[id(90)]))[0].rol,'Admin')
 await db.exec('rollback')
 const draft=fs.readFileSync('docs/recuperacion-profiles/propuestas/20261022204950_perfiles_alta_segura_revision.sql','utf8')
 await db.exec(draft);await db.exec(draft)
 assert.deepEqual(await q('select * from perfiles order by id'),before)
 assert.deepEqual(await q("select conname,pg_get_constraintdef(oid) definition from pg_constraint where conrelid='perfiles'::regclass order by conname"),schemaBefore)
 assert.deepEqual(await q("select * from pg_policies where tablename='perfiles' order by policyname"),policiesBefore)
 assert.equal((await q("select to_regclass('public.profiles') as table"))[0].table,null)
 assert.equal((await as(3,()=>q('select * from perfiles'))).length,1)
 assert.equal((await as(1,()=>q('select * from perfiles'))).length,4)
 assert.equal((await as(null,()=>q('select * from perfiles'),'anon')).length,0)
 assert.equal((await as(3,()=>q("update perfiles set rol='Admin' where id=$1 returning id",[id(3)]))).length,0)
 assert.equal((await as(3,()=>q("update perfiles set nombre='Changed' where id=$1 returning id",[id(2)]))).length,0)
 await assert.rejects(()=>as(3,()=>q('insert into perfiles(id,email) values($1,$2)',[id(99),'forged@example.invalid'])),e=>e.code==='42501')
 await as(null,()=>q('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)',[id(5),'new@example.invalid',{nombre:'TEST NEW',rol:'Admin',modulos_permitidos:['inventarios']}]),'supabase_auth_admin')
 const added=(await q('select * from perfiles where id=$1',[id(5)]))[0]
 assert.equal(added.rol,'Operativo');assert.deepEqual(added.modulos_permitidos,[]);assert.equal(added.nombre,'TEST NEW')
 await q('update auth.users set raw_user_meta_data=$1 where id=$2',[{rol:'Admin'},id(5)])
 assert.equal((await q('select rol from perfiles where id=$1',[id(5)]))[0].rol,'Operativo')
 // A replayed event must not overwrite any already populated profile fields.
 await db.exec('create temporary table replay (like auth.users);create trigger replay_profile after insert on replay for each row execute function public.handle_new_user();')
 await q('insert into replay(id,email,raw_user_meta_data) values($1,$2,$3)',[id(1),'replaced@example.invalid',{nombre:'REPLACED',rol:'Operativo'}])
 assert.deepEqual(await q('select * from perfiles where id=any($1) order by id',[[1,2,3,4].map(id)]),before)
 assert.equal((await q("select has_function_privilege('authenticated','public.handle_new_user()','EXECUTE') allowed"))[0].allowed,false)
 // Reproduce (do not silently change) the broad existing policies found in
 // production. This is a known risk, not evidence of secure resource isolation.
 const audit=JSON.parse(fs.readFileSync('docs/recuperacion-profiles/auditoria-funcional-actual.json','utf8'))
 for(const table of ['pedidos','mensajeros','mensajeros_rutas']){
  const policy=audit.policies.find(p=>p.tablename===table&&p.cmd==='ALL'&&p.qual==='true'&&p.with_check==='true')
  assert.ok(policy,'Expected broad-policy finding must be re-reviewed if the source changed')
  await db.exec('create table '+quote(table)+'(id integer primary key,detalle text);alter table '+quote(table)+' enable row level security;grant all on '+quote(table)+' to authenticated;')
  await db.exec('create policy '+quote(policy.policyname)+' on '+quote(table)+' for all to authenticated using(true) with check(true);')
  await q('insert into '+quote(table)+' values(1,$1)',['TEST SHARED RESOURCE'])
  assert.equal((await as(3,()=>q('update '+quote(table)+' set detalle=$1 where id=1 returning id',['TEST CHANGE']))).length,1)
 }
 console.log('KNOWN RISK reproduced locally: authenticated users can modify shared pedidos/mensajeros/mensajeros_rutas through existing ALL true policies; this proposal does not alter them.')
 console.log('PASS perfiles: no public.profiles needed; 4 existing users unchanged; schema/RLS unchanged; own-profile access; admin reads; unauthorized writes rejected; metadata Admin rejected on new signup; replay does not overwrite; Auth trigger works with revoked public execute. Isolated PostgreSQL only.')
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.close())
