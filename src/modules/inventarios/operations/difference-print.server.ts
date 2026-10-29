import 'server-only'
import { z } from 'zod'
import { createClient } from '@/utils/supabase/server'
import { getAuthUser } from '@/utils/supabase/session.server'
import { getTaskSnapshot, getCountProducts } from './actions'
import type { Context } from './types'
import { summarizeDifferences, type DifferencePrintData } from './difference-print'

export async function getDifferencePrintData(ticket: string): Promise<{ data?: DifferencePrintData; error?: string }> {
  if (!z.string().uuid().safeParse(ticket).success) return { error: 'Inventario no válido.' }
  const { data: { user }, error: authError } = await getAuthUser()
  if (authError || !user) return { error: 'Inicia sesión para consultar este documento.' }
  const db = await createClient()
  // Existing RPC checks active profile, module access and warehouse memberships.
  const result = await db.rpc('inventario_contexto')
  const context = result.data as Context | null
  if (result.error || !context || context.userId !== user.id) return { error: 'No se pudo validar tu acceso a Inventarios.' }
  const authorized = context.warehouses.filter(w => w.role === 'lider' || w.role === 'administrador')
  if (!authorized.length) return { error: 'La impresión está disponible para líderes y administradores autorizados.' }
  // Check this particular warehouse before requesting any reference quantities.
  const scope = await db.from('inventario_tickets').select('bodega_id').eq('id', ticket).single()
  const warehouse = authorized.find(w => w.id === scope.data?.bodega_id)
  if (scope.error || !warehouse) return { error: 'No tienes permiso para imprimir este inventario.' }
  const snapshot = await getTaskSnapshot(ticket, true)
  if (snapshot.error || !snapshot.task || !snapshot.comparison) return { error: snapshot.error ?? 'No se pudo cargar la comparación.' }
  const task = snapshot.task
  if (task.bodega_id !== warehouse.id) return { error: 'El inventario cambió. Vuelve a abrir la vista previa.' }
  const [counts, category] = await Promise.all([
    getCountProducts(ticket),
    db.from('inventario_categorias').select('nombre').eq('id', task.categoria_id).eq('bodega_id', warehouse.id).single(),
  ])
  if (counts.error || !counts.products || category.error || !category.data) return { error: 'No se pudieron cargar los datos completos del documento. Intenta de nuevo.' }
  // Snapshot reads, metadata and product units must belong to the same version.
  const current = await db.from('inventario_tickets').select('version').eq('id', ticket).single()
  if (current.error || current.data?.version !== task.version) return { error: 'El inventario cambió durante la consulta. Recarga la vista previa.' }
  const products = new Map(counts.products.map(p => [p.id, p]))
  if (snapshot.comparison.length !== (task.total_productos ?? 0) || products.size !== snapshot.comparison.length
    || snapshot.comparison.some(p => !products.has(p.id))) return { error: 'La comparación está incompleta. Recarga la vista previa antes de imprimir.' }
  const people = [...context.people, ...context.members, ...context.users]
  const name = (id: string | null) => people.find(p => p.id === id)?.name || 'Sin nombre registrado'
  const lastCount = counts.products.map(p => p.countedAt).filter((d): d is string => !!d && Number.isFinite(Date.parse(d)))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null
  return { data: {
    ticket: task.numero, version: task.version, warehouse: warehouse.name, category: category.data.nombre,
    operator: name(task.asignado_a), leader: name(task.lider_id), countedAt: lastCount,
    generatedAt: new Date().toISOString(), demo: task.es_prueba === true, totalProducts: task.total_productos ?? 0,
    ...summarizeDifferences(snapshot.comparison.map(p => ({ ...p, unit: products.get(p.id)?.unit ?? null }))),
  } }
}
