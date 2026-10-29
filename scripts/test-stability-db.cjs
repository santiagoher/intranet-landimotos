const fs=require('node:fs')
const path=require('node:path')
const assert=require('node:assert/strict')
const {createRequire}=require('node:module')
const {PGlite}=createRequire(path.resolve(process.argv[2],'package.json'))('@electric-sql/pglite')
async function main(){
  const db=new PGlite()
  try {
    await db.exec(`create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated;
      create table perfiles(id uuid primary key,nombre text);
      create table pedidos(id bigint primary key,created_at timestamptz);
      create table mensajeros_rutas(id bigint primary key,mensajero_id uuid,estado text,created_at timestamptz);
      create table mensajeros_almuerzos(id bigint primary key,mensajero_id uuid,created_at timestamptz);
      alter table perfiles enable row level security;
      create policy "Usuarios pueden ver su propio perfil" on perfiles for select using(auth.uid()=id);
      grant select on perfiles to authenticated;
      insert into perfiles values('00000000-0000-4000-8000-000000000001','A'),('00000000-0000-4000-8000-000000000002','B');
      insert into pedidos values(1,now());
      insert into mensajeros_rutas values(1,null,'en_ruta',now());
      insert into mensajeros_almuerzos values(1,null,now());`)
    async function visible(id){
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id])
      await db.exec('set role authenticated')
      try{return (await db.query('select * from perfiles order by id')).rows} finally {await db.exec('reset role')}
    }
    const own='00000000-0000-4000-8000-000000000001'
    const before=await visible(own)
    const migration=fs.readFileSync('supabase/migrations/20261022144854_estabilidad_indices_lectura.sql','utf8')
    await db.exec(migration)
    await db.exec(migration)
    assert.deepEqual(await visible(own),before)
    assert.equal(before.length,1)
    assert.equal((await visible('00000000-0000-4000-8000-000000000003')).length,0)
    assert.equal((await visible('')).length,0)
    for(const table of ['pedidos','mensajeros_rutas','mensajeros_almuerzos'])assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n,1)
    assert.equal((await db.query("select count(*)::int n from pg_indexes where indexname like '%_lectura_idx'")).rows[0].n,5)
    console.log('PASS: five indexes, idempotent migration, unchanged profile RLS visibility and retained rows. Isolated in-memory database only.')
  } finally {await db.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
