// Only an in-memory engine is constructed. No Supabase URL, keys or network client.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const dependencyRoot = process.argv[2]
if (!dependencyRoot) throw new Error('Indica la carpeta temporal donde instalaste @electric-sql/pglite@0.3.14.')
const requireTest = createRequire(path.resolve(dependencyRoot, 'package.json'))
const { PGlite } = requireTest('@electric-sql/pglite')
const sql = fs.readFileSync(path.join(__dirname, '../docs/sql/inventarios-propuesta.sql'), 'utf8')
const db = new PGlite()
let checks = 0
function pass(label) { checks++; console.log(`PASS ${checks}: ${label}`) }
async function rows(query, params = []) { return (await db.query(query, params)).rows }
async function insert(table, values) {
  const columns = Object.keys(values)
  return (await rows(`insert into public.${table} (${columns.join(',')}) values (${columns.map((_, i) => `$${i + 1}`).join(',')}) returning *`, Object.values(values)))[0]
}
async function asUser(id, fn, role = 'authenticated') {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id ?? ''])
  await db.exec(`set role ${role}`)
  try { return await fn() } finally { await db.exec('reset role') }
}
async function rejectCode(fn, code) {
  await assert.rejects(fn, error => error.code === code)
}
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

async function main() {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth, public to authenticated, anon, service_role;
    grant execute on function auth.uid() to authenticated, anon, service_role;
    create table public.perfiles (
      id uuid primary key references auth.users(id) on delete cascade,
      email text not null unique, nombre text,
      rol text default 'Operativo' check (rol in ('Admin','Operativo')),
      estado text default 'activo' check (estado in ('activo','inactivo')),
      created_at timestamptz default now(), modulos_permitidos text[] default '{}'
    );
    alter table public.perfiles enable row level security;
    create function public.es_admin() returns boolean language sql security definer
      set search_path = '' as $$ select exists(select 1 from public.perfiles where id=auth.uid() and rol='Admin') $$;
    create policy propio on public.perfiles for select using (auth.uid()=id);
    create policy admin on public.perfiles for all using (public.es_admin());
    grant select on public.perfiles to authenticated;
  `)
  console.log('Motor aislado:', (await rows('select version()'))[0].version)
  assert.match(sql, /rollback;\s*$/i)
  await db.exec(sql)
  assert.equal((await rows("select count(*)::int n from pg_tables where tablename like 'inventario_%'"))[0].n, 0)
  pass('el SQL original compila y ROLLBACK no deja tablas')
  // Change only the in-memory copy, after proving the original rollback.
  await db.exec(sql.replace(/rollback;\s*$/i, 'commit;'))
  const tables = await rows("select schemaname,tablename from pg_tables where tablename like 'inventario_%' or schemaname='inventario_private'")
  assert.equal(tables.length, 18)
  assert.equal((await rows("select count(*)::int n from pg_policies where tablename like 'inventario_%'"))[0].n, 17)
  pass('18 tablas y 17 políticas se crean correctamente')

  for (let i = 1; i <= 6; i++) {
    await db.query('insert into auth.users values ($1)', [uuid(i)])
    await insert('perfiles', { id: uuid(i), email: `test-${i}@example.invalid`, rol: i === 5 ? 'Admin' : 'Operativo', estado: i === 6 ? 'inactivo' : 'activo', modulos_permitidos: ['inventarios'] })
  }
  const warehouses = []
  for (const key of ['A','B']) warehouses.push(await insert('inventario_bodegas', { id_erp: `TEST-ID-${key}`, codigo_erp: `TEST-${key}`, nombre: `TEST ${key}`, erp_confirmada_at: '2026-01-01T00:00:00Z' }))
  const [a,b] = warehouses
  const memberships = [[1,a,'operador'],[2,a,'operador'],[3,a,'lider'],[3,b,'operador'],[4,a,'administrador'],[6,a,'operador']]
  for (const [user,warehouse,rol] of memberships) await insert('inventario_usuarios_bodegas', { perfil_id: uuid(user), bodega_id: warehouse.id, rol })
  const fixtures = []
  for (let i = 0; i < 3; i++) {
    const warehouse = i === 2 ? b : a
    const category = await insert('inventario_categorias', { bodega_id: warehouse.id, id_erp: `CAT-ID-${i}`, codigo_erp: `CAT-${i}`, nombre: `TEST CAT ${i}`, sincronizada_at: '2026-01-01T00:00:00Z' })
    const product = await insert('inventario_productos', { bodega_id: warehouse.id, categoria_id: category.id, id_erp: `PRODUCT-ID-${i}`, sku_erp: `SKU-${i}`, nombre: `TEST SKU ${i}`, unidad_base_erp: 'UND', sincronizado_at: '2026-01-01T00:00:00Z' })
    const session = await insert('inventario_sesiones', { bodega_id: warehouse.id, categoria_id: category.id, alcance_descripcion: 'TEST', alcance_hash: `TEST-${i}`, erp_snapshot_id: `TEST-${i}`, erp_corte_at: '2026-01-01T00:00:00Z', total_sku: 1, snapshot_completo: true })
    const item = await insert('inventario_sesion_items', { sesion_id: session.id, bodega_id: warehouse.id, producto_id: product.id, sku_erp: product.sku_erp, nombre_producto: product.nombre, unidad_base_erp: 'UND' })
    const ticket = await insert('inventario_tickets', { numero: `TEST-${i}`, sesion_id: session.id, bodega_id: warehouse.id, asignado_a: uuid(i + 1), asignado_por: uuid(3), estado: 'asignado', asignado_at: '2026-01-01T01:00:00Z' })
    await insert('inventario_saldos_base', { item_id: item.id, sesion_id: session.id, bodega_id: warehouse.id, cantidad_erp: '10', referencia_erp: 'TEST' })
    const count = await insert('inventario_conteos', { ticket_id: ticket.id, item_id: item.id, sesion_id: session.id, bodega_id: warehouse.id, contado_por: uuid(i + 1), ronda: 1, revision: 1, cantidad_unidad_lectura: '0', unidad_lectura_erp: 'UND', factor_unidades_base: '1', origen: 'manual' })
    await insert('inventario_notificaciones', { destinatario_id: uuid(i + 1), bodega_id: warehouse.id, sesion_id: session.id, ticket_id: ticket.id, tipo: 'asignado', evento_clave: uuid(100+i) })
    await insert('inventario_notificaciones', { destinatario_id: uuid(i + 1), bodega_id: warehouse.id, sesion_id: session.id, ticket_id: ticket.id, tipo: 'diferencias_confirmadas', evento_clave: uuid(200+i) })
    const verificationTicket = await insert('inventario_tickets', { numero: `TEST-VERIFY-${i}`, sesion_id: session.id, bodega_id: warehouse.id, tipo: 'verificacion', ticket_origen_id: ticket.id })
    const verification = await insert('inventario_verificaciones', { ticket_id: verificationTicket.id, item_id: item.id, conteo_id: count.id, sesion_id: session.id, bodega_id: warehouse.id, verificado_por: uuid(3), cantidad_verificada: '0', observacion: 'TEST' })
    const difference = await insert('inventario_diferencias', { item_id: item.id, conteo_id: count.id, verificacion_id: verification.id, sesion_id: session.id, bodega_id: warehouse.id, saldo_al_corte: '10', cantidad_fisica: '0', movimientos_desde: '2026-01-01T00:00:00Z', movimientos_hasta: '2026-01-01T01:00:00Z' })
    await insert('inventario_ajustes', { bodega_id: warehouse.id, diferencia_id: difference.id, propuesto_por: uuid(3), motivo: 'TEST' })
    await insert('inventario_auditoria', { bodega_id: warehouse.id, sesion_id: session.id, ticket_id: ticket.id, actor_id: uuid(i+1), actor_original_id: uuid(i+1), actor_rol: 'operador', evento: 'TEST', entidad_tipo: 'ticket', entidad_id: ticket.id, operacion_clave: uuid(300+i) })
    fixtures.push({ warehouse, category, product, session, item, ticket, count })
  }
  const countRows = async table => Number((await rows(`select count(*) n from public.${table}`))[0].n)
  await asUser(uuid(1), async () => {
    assert.equal(await countRows('inventario_tickets'), 1)
    assert.equal(await countRows('inventario_sesion_items'), 1)
    assert.equal(await countRows('inventario_productos'), 1)
    assert.equal(await countRows('inventario_conteos'), 1)
    assert.equal(await countRows('inventario_notificaciones'), 1)
    for (const table of ['inventario_saldos_base','inventario_verificaciones','inventario_diferencias','inventario_ajustes','inventario_auditoria']) assert.equal(await countRows(table), 0)
    const joined = await rows('select s.cantidad_erp from public.inventario_sesion_items i left join public.inventario_saldos_base s on s.item_id=i.id')
    assert.equal(joined.length, 1)
    assert.equal(joined[0].cantidad_erp, null)
  })
  pass('operador solo lee tarea propia; ni consulta directa ni JOIN revelan el saldo')
  await asUser(uuid(3), async () => {
    assert.equal(await countRows('inventario_tickets'), 5)
    assert.equal(await countRows('inventario_saldos_base'), 2)
    assert.ok((await rows('select bodega_id from public.inventario_saldos_base')).every(x => x.bodega_id === a.id))
  })
  pass('líder A/operador B no hereda permisos de líder sobre B')
  await asUser(uuid(4), async () => {
    assert.equal(await countRows('inventario_tickets'), 4)
    assert.equal(await countRows('inventario_saldos_base'), 2)
    for (const table of ['inventario_verificaciones','inventario_diferencias','inventario_ajustes','inventario_auditoria']) assert.equal(await countRows(table), 2)
  })
  pass('administrador funcional limitado a su bodega')
  for (const user of [5,6]) await asUser(uuid(user), async () => {
    assert.equal(await countRows('inventario_bodegas'), 0)
    assert.equal(await countRows('inventario_tickets'), 0)
    assert.equal(await countRows('inventario_saldos_base'), 0)
  })
  pass('Admin global sin membresía y perfil inactivo no obtienen acceso')
  for (const role of ['authenticated','anon','service_role']) {
    for (const table of tables) {
      const full = `${table.schemaname}.${table.tablename}`
      const privileges = (await rows("select has_table_privilege($1,$2,'INSERT,UPDATE,DELETE,TRUNCATE') allowed", [role,full]))[0]
      assert.equal(privileges.allowed, false)
    }
    await asUser(uuid(4), () => rejectCode(() => db.exec("update public.inventario_tickets set estado='cerrado'"), '42501'), role)
  }
  await asUser(null, () => rejectCode(() => rows('select * from public.inventario_tickets'), '42501'), 'anon')
  pass('anon, authenticated y service_role no pueden escribir ni saltar estados')

  await db.query('update public.inventario_usuarios_bodegas set activo=false where perfil_id=$1', [uuid(1)])
  await asUser(uuid(1), async () => assert.equal(await countRows('inventario_tickets'), 0))
  await db.query('update public.inventario_usuarios_bodegas set activo=true where perfil_id=$1', [uuid(1)])
  await db.query("update public.perfiles set modulos_permitidos='{}' where id=$1", [uuid(1)])
  await asUser(uuid(1), async () => assert.equal(await countRows('inventario_tickets'), 0))
  await db.query("update public.perfiles set modulos_permitidos='{inventarios}' where id=$1", [uuid(1)])
  pass('revocar membresía o módulo revoca también el acceso SQL')

  const f = fixtures[0]
  await rejectCode(() => db.query("update public.inventario_tickets set estado='cancelado',cancelado_at=now() where id=$1", [f.ticket.id]), '23514')
  await rejectCode(() => db.query("update public.inventario_tickets set estado='inventado' where id=$1", [f.ticket.id]), '23514')
  await rejectCode(() => insert('inventario_usuarios_bodegas', { perfil_id: uuid(1), bodega_id: a.id, rol: 'operador' }), '23505')
  await rejectCode(() => db.query("update public.inventario_sesiones set snapshot_completo=false where id=$1", [f.session.id]), '23514')
  await rejectCode(() => db.query("update public.inventario_conteos set cantidad_unidad_lectura=-1 where id=$1", [f.count.id]), '23514')
  await rejectCode(() => db.query("update public.inventario_conteos set cantidad_unidad_lectura='NaN' where id=$1", [f.count.id]), '23514')
  assert.equal(Number((await rows('select cantidad_base from public.inventario_conteos where id=$1', [f.count.id]))[0].cantidad_base), 0)
  pass('motivo obligatorio, estados, duplicados, fotografía completa y cero explícito')
  await rejectCode(() => db.query('update public.inventario_sesion_items set producto_id=$1 where id=$2', [fixtures[2].product.id,f.item.id]), '23503')
  await rejectCode(() => insert('inventario_verificaciones', { ticket_id: f.ticket.id, item_id: f.item.id, conteo_id: fixtures[1].count.id, sesion_id: f.session.id, bodega_id: a.id, verificado_por: uuid(3), cantidad_verificada: '0', observacion: 'TEST' }), '23503')
  pass('FK impiden mezclar bodegas o conteos de otro SKU/sesión')
  await db.query("update public.inventario_tickets set estado='cancelado',cancelado_at=now(),cancelacion_motivo='TEST cancelación' where id=$1", [f.ticket.id])
  assert.equal(await countRows('inventario_conteos'), 3)
  await db.query('delete from auth.users where id=$1', [uuid(1)])
  const audit = (await rows('select actor_id,actor_original_id from public.inventario_auditoria where ticket_id=$1', [f.ticket.id]))[0]
  assert.equal(audit.actor_id, null)
  assert.equal(audit.actor_original_id, uuid(1))
  assert.equal((await rows('select contado_por from public.inventario_conteos where id=$1', [f.count.id]))[0].contado_por, null)
  assert.equal(await countRows('inventario_conteos'), 3)
  pass('cancelación y eliminación de cuenta conservan conteos')
  console.log(`${checks} grupos de comprobaciones aprobados. Sin cambios remotos.`)
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => db.close())
