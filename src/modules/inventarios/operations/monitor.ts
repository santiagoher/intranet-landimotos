import { type OperationData, type Task } from './types'
import { normalizePriority, type Priority } from './task-list'

export type MonitorView = 'state' | 'operator' | 'table'
export type MonitorSort = 'activity' | 'newest' | 'oldest'
export interface MonitorFilters { search: string; warehouse: string; operator: string; state: string; priority: Priority | ''; origin: string }
export const emptyMonitorFilters: MonitorFilters = { search: '', warehouse: '', operator: '', state: '', priority: '', origin: '' }
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()

export function monitorName(data: OperationData, id: string | null): string {
  return [...data.context.members, ...data.context.people, ...data.context.users].find(p => p.id === id)?.name ?? (id ? 'Operador no disponible' : 'Sin asignar')
}

export function filterMonitorTasks(data: OperationData, filters: MonitorFilters, sort: MonitorSort): Task[] {
  const activity = new Map(data.tasks.map(t => [t.id, Date.parse(lastKnownActivity(t, data))]))
  return monitoredTasks(data).filter(t => (!filters.warehouse || t.bodega_id === filters.warehouse)
    && (!filters.operator || (filters.operator === 'unassigned' ? !t.asignado_a : t.asignado_a === filters.operator))
    && (!filters.state || (filters.state === 'differences' ? t.estado === 'verificado_con_diferencias' || !!t.cierre_con_diferencias : t.estado === filters.state))
    && (!filters.priority || normalizePriority(t.prioridad) === filters.priority)
    && (!filters.origin || (filters.origin === 'trial' ? !!t.es_prueba : !t.es_prueba))
    && normalize(`${t.numero} ${data.categories.find(c => c.id === t.categoria_id)?.nombre ?? ''} ${monitorName(data,t.asignado_a)}`).includes(normalize(filters.search.trim())))
    .sort((a,b) => (sort === 'activity' ? activity.get(b.id)! - activity.get(a.id)! : (Date.parse(b.asignado_at) - Date.parse(a.asignado_at)) * (sort === 'oldest' ? -1 : 1)) || a.id.localeCompare(b.id))
}

export function statusTone(state: string, differences = false): string {
  if (differences || state === 'verificado_con_diferencias') return 'danger'
  if (['cerrado','verificado_sin_diferencias'].includes(state)) return 'success'
  if (['en_verificacion','enviado_verificacion'].includes(state)) return 'warning'
  return state === 'en_proceso' ? 'info' : 'neutral'
}

export function monitoredTasks(data: OperationData): Task[] {
  const allowed = new Set(data.context.warehouses.filter(w => data.context.globalAdmin || w.role !== 'operador').map(w => w.id))
  return data.tasks.filter(t => allowed.has(t.bodega_id))
}

export function lastKnownActivity(task: Task, data: OperationData): string {
  return [task.asignado_at, task.iniciado_at, task.enviado_at, task.verificacion_iniciada_at,
    task.verificacion_finalizada_at, task.cerrado_at,
    ...(data.notifications ?? []).filter(n => n.ticket_id === task.id).map(n => n.created_at)]
    .filter((value): value is string => !!value && Number.isFinite(Date.parse(value)))
    .sort((a,b) => Date.parse(b)-Date.parse(a))[0] ?? task.asignado_at
}

export function closedToday(tasks: Task[], now: number): number {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })
  return tasks.filter(t => t.estado === 'cerrado' && t.cerrado_at && day.format(new Date(t.cerrado_at)) === day.format(now)).length
}

export function groupMonitorTasks(tasks: Task[], mode: 'state' | 'operator'): Map<string, Task[]> {
  const groups = new Map<string, Task[]>()
  if (mode === 'state') {
    for (const state of ['pendiente_asignacion','asignado','aceptado','en_proceso','enviado_verificacion','en_verificacion','verificado_sin_diferencias','verificado_con_diferencias','cerrado','cancelado']) {
      groups.set(state, [])
    }
  }
  for (const task of tasks) {
    const key = mode === 'operator' ? task.asignado_a ?? 'unassigned' : task.estado
    groups.set(key, [...(groups.get(key) ?? []), task])
  }
  return new Map([...groups].filter(([,list]) => list.length))
}
