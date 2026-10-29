import type { StoredPriority } from './task-list'
export interface Warehouse { id: string; name: string; role: 'administrador' | 'lider' | 'operador'; origin: string }
export interface Member { id: string; warehouseId: string; name: string; role: string; leader: boolean }
export interface Context { userId: string; globalAdmin: boolean; warehouses: Warehouse[]; members: Member[]; people: { id: string; name: string }[]; users: { id: string; name: string; eligible: boolean }[] }
export interface Category { id: string; bodega_id: string; nombre: string }
export interface Task {
  id: string; numero: string; bodega_id: string; categoria_id: string; asignado_a: string | null;
  asignado_por?: string | null;
  origen_creacion?: 'creado_por_operador' | null; creado_por?: string | null;
  lider_id: string | null; estado: string; prioridad: StoredPriority; version: number; avance_parcial: number;
  asignado_at: string; iniciado_at: string | null; enviado_at: string | null; vencimiento_at: string | null;
  verificacion_iniciada_at: string | null; verificacion_finalizada_at: string | null; cerrado_at: string | null;
  observacion_inicial: string | null;
  total_productos?: number; productos_contados?: number;
  es_prueba?: boolean;
  cierre_con_diferencias?: boolean; justificacion_cierre?: string | null;
}
export interface CountProduct { id: string; code: string; name: string; quantity: string | null; countedAt: string | null; barcodes?:string[]; unit?:string|null }
export interface BlindCatalogProduct {id:string;code:string;name:string;unit:string;barcodes:string[];subcategory?:string|null;brand?:string|null}
export interface ComparisonProduct { id: string; code: string; name: string; expected: string | null; counted: string | null; difference: string | null; result: 'pendiente' | 'sin_referencia' | 'coincide' | 'faltante' | 'sobrante' }
// UI readiness only. The review RPC still validates leader access, version,
// complete references and private DEMO provenance before accepting a close.
export function hasCompleteReviewComparison(task: Task, comparison: ComparisonProduct[]): boolean {
  if (task.origen_creacion === 'creado_por_operador' && task.es_prueba !== true) return false
  return comparison.length > 0 && comparison.length === task.total_productos
    && comparison.every(product => product.expected != null && product.counted != null)
}
export interface Reconciliation { ticketId: string; total: number; pending: number; missingReference: number; matched: number; shortages: number; surpluses: number }
export interface Event { id: string; actor_id: string | null; actor_rol: string; evento: string; motivo: string | null; created_at: string; destinatario_nombre?:string|null; contexto?:string|null; entidad_id?:string|null; entidad_tipo?:string|null; estado_anterior?:string|null; estado_nuevo?:string|null }
export interface OperationData { context: Context; categories: Category[]; catalogComplete?:boolean; tasks: Task[]; reconciliations?: Reconciliation[]; fetchedAt: number; selfStart?:{enabled:boolean;warehouses:string[];reason?:string;source?:'demo';categories?:Category[]}; notifications?:{id:string;ticket_id:string;tipo:string;created_at:string}[] }
export const stateLabels: Record<string, string> = {
  pendiente_asignacion: 'Pendiente', asignado: 'Asignado', aceptado: 'Aceptado', en_proceso: 'En proceso',
  enviado_verificacion: 'Finalizado por operador', en_verificacion: 'En verificación',
  verificado_sin_diferencias: 'Verificado', verificado_con_diferencias: 'Con diferencias',
  cerrado: 'Cerrado', cancelado: 'Cancelado',
}
export function progress(t: Task): number {
  if (t.total_productos && t.total_productos > 0) return Math.round((t.productos_contados ?? 0) / t.total_productos * 100)
  if (['cerrado','verificado_sin_diferencias'].includes(t.estado)) return 100
  if (['en_verificacion','verificado_con_diferencias'].includes(t.estado)) return 85
  if (t.estado === 'enviado_verificacion') return 70
  if (t.estado === 'en_proceso') return Math.max(25, t.avance_parcial)
  return t.estado === 'asignado' ? 10 : 0
}
export const isVerified = (t: Task) => !t.cierre_con_diferencias && ['cerrado','verificado_sin_diferencias'].includes(t.estado)
export function taskCommands(task:Task,role:Warehouse['role']|undefined,userId:string):[string,string][] {
  if(role==='operador' && task.asignado_a===userId) {
    if(task.estado==='asignado')return [['iniciar','Iniciar tarea']]
    if(task.estado==='en_proceso')return task.total_productos?[['finalizar','Finalizar trabajo']]:[['avance','Guardar avance'],['finalizar','Finalizar trabajo']]
  }
  if(role!=='lider' || task.asignado_a===userId)return []
  if(['enviado_verificacion','en_verificacion','verificado_sin_diferencias','verificado_con_diferencias'].includes(task.estado))return [['verificar_cerrar','Verificar y cerrar'],['devolver','Devolver al operador']]
  return []
}
export const isOverdue = (t: Task, now: number) => !!t.vencimiento_at && Date.parse(t.vencimiento_at) < now
  && !['cerrado','cancelado','verificado_sin_diferencias'].includes(t.estado)
export function elapsed(start: string | null, end: string | null, now: number): string {
  if (!start) return '—'
  const minutes = Math.max(0, Math.floor(((end ? Date.parse(end) : now) - Date.parse(start)) / 60000))
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}
