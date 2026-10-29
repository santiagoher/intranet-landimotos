import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const directory = dirname(fileURLToPath(import.meta.url))
function load(name, overrides = {}) {
  const file = resolve(directory, name)
  const vmModule = { exports: {} }
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  vm.runInNewContext(source, { module: vmModule, exports: vmModule.exports, require: name =>
    name in overrides ? overrides[name] : name === 'server-only' ? {} : name.startsWith('./') ? load(`${name.slice(2)}.ts`) : require(name),
  }, { filename: file })
  return vmModule.exports
}
const { inventoryCapabilities } = load('permissions.ts')
const profile = { rol: 'Operativo', estado: 'activo', modulos_permitidos: ['inventarios'] }
const membership = { bodegaId: '00000000-0000-4000-8000-000000000001', bodegaNombre: 'TEST', codigoErp: 'TEST', rol: 'operador', esResponsable: false }

test('perfil inactivo o módulo revocado no obtiene permisos aunque conserve membresías', () => {
  for (const p of [null, { ...profile, estado: 'inactivo' }, { ...profile, estado: null }, { ...profile, modulos_permitidos: [] }]) {
    const access = inventoryCapabilities(p, [membership], 'ready')
    assert.equal(access.canEnter, false)
    assert.equal(access.canViewReports, false)
    assert.equal(access.canConfigure, false)
    assert.equal(access.memberships.length, 0)
  }
})

test('operador, líder y administrador funcional mantienen capacidades distintas', () => {
  for (const rol of ['operador', 'lider', 'administrador']) {
    const access = inventoryCapabilities(profile, [{ ...membership, rol }], 'ready')
    assert.equal(access.canEnter, true)
    assert.equal(access.canViewReports, rol !== 'operador')
    assert.equal(access.canConfigure, rol === 'administrador')
  }
  const access = inventoryCapabilities({ ...profile, rol: 'Admin' }, [], 'schema_pending')
  assert.equal(access.canConfigure, true)
  assert.equal(access.memberships.length, 0, 'Admin prepara el módulo sin obtener ninguna bodega')
})

function fakeService({ user = { id: 'TEST-USER' }, profileData = profile, rows = [], code = null, throws = false } = {}) {
  const queries = []
  const supabase = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    from(table) {
      const filters = []
      queries.push({ table, filters })
      const response = () => ({ data: table === 'perfiles' ? profileData : rows, error: table === 'perfiles' || !code ? null : { code } })
      const builder = {
        select() { return builder },
        eq(...filter) { filters.push(filter); return builder },
        single: async () => response(),
        then(resolve, reject) { return (throws ? Promise.reject(new Error('TEST')) : Promise.resolve(response())).then(resolve, reject) },
      }
      return builder
    },
  }
  const { getInventoryAccess } = load('access.server.ts', {
    react: { cache: fn => fn }, '@/utils/supabase/server': { createClient: async () => supabase },
    '@/utils/supabase/session.server': { getAuthUser:()=>supabase.auth.getUser(),getProfile:id=>supabase.from('perfiles').select().eq('id',id).single() },
    '@/utils/supabase/auth-errors': {invalidSession:()=>false},
  })
  return { getInventoryAccess, queries }
}

test('acceso anónimo o deshabilitado no consulta membresías', async () => {
  for (const config of [{ user: null }, { profileData: { ...profile, estado: 'inactivo' } }]) {
    const { getInventoryAccess, queries } = fakeService(config)
    assert.equal((await getInventoryAccess()).canEnter, false)
    assert.ok(queries.every(q => q.table !== 'inventario_usuarios_bodegas'))
  }
})

test('el loader consulta únicamente el usuario autenticado y bodegas activas reales', async () => {
  const row = { bodega_id: membership.bodegaId, rol: 'lider', es_responsable: true,
    bodega: { id: membership.bodegaId, nombre: 'TEST', codigo_erp: 'TEST', activa: true } }
  const { getInventoryAccess, queries } = fakeService({ rows: [row] })
  const access = await getInventoryAccess()
  assert.equal(access.status, 'ready')
  assert.equal(access.memberships.length, 1)
  assert.equal(access.memberships[0].rol, 'lider')
  assert.ok(queries[1].filters.some(([key, value]) => key === 'perfil_id' && value === 'TEST-USER'))
  assert.ok(queries[1].filters.some(([key, value]) => key === 'activo' && value === true))
  const inactive = fakeService({ rows: [{ ...row, bodega: { ...row.bodega, activa: false } }] })
  assert.equal((await inactive.getInventoryAccess()).memberships.length, 0)
})

test('esquema pendiente es distinto de un error y ninguno inventa autorizaciones', async () => {
  for (const code of ['42P01', 'PGRST205', '42501', 'PGRST200']) {
    const { getInventoryAccess } = fakeService({ code })
    const access = await getInventoryAccess()
    assert.equal(access.status, ['42P01', 'PGRST205'].includes(code) ? 'schema_pending' : 'error')
    assert.equal(access.memberships.length, 0)
    assert.equal(access.canViewReports, false)
  }
  assert.equal((await fakeService({ throws: true }).getInventoryAccess()).canEnter, false)
  assert.equal((await fakeService({ rows: [{ ...membership, rol: 'root' }] }).getInventoryAccess()).status, 'error')
})
