export const estados = {
  asignado: 'Asignado', en_revision: 'En revisión', pendiente_cierre: 'Pendiente de cierre', devuelto: 'Devuelto', cerrado: 'Cerrado',
} as const
export type Estado = keyof typeof estados
export const eventos: Record<string, string> = {
  crear: 'Revisión asignada', iniciar: 'Revisión iniciada', observar: 'Observación agregada',
  finalizar: 'Revisión finalizada · pendiente de cierre', devolver: 'Devuelta para corrección', cerrar: 'Registro cerrado', reasignar: 'Revisión reasignada',
}
export interface Revision {
  segundos_laborales: number; jornadas_laborales: number; vencida: boolean
  id: string; factura: string; numero_articulos: number | null; proveedor_id: string; proveedor_nombre: string; mesa_id: number
  encargado_id: string; encargado_persona_id?: string | null; encargado_nombre: string; asignado_por: string; asignador_nombre: string
  estado: Estado; version: number; creado_at: string; actualizado_at: string
  iniciado_at: string | null; iniciado_por: string | null; finalizado_at: string | null
  finalizado_por: string | null; cerrado_at: string | null; cerrado_por: string | null
  cerrador_nombre: string | null; cpm: string | null; segundos_revision: number; tramo_inicio: string | null
}
export interface Observacion { id: string; revision_id: string; contenido: string; autor_id: string; autor_nombre: string; creado_at: string }
export interface Movimiento {
  id: string; revision_id: string; evento: string; estado_anterior: Estado | null; estado_nuevo: Estado
  actor_id: string; actor_nombre: string; detalle: string | null; creado_at: string
  datos: Revision & { notificados: string[] }
}
export interface Notificacion {
  id: string; revision_id: string; tipo: string; creado_at: string; leido_at: string | null
  contexto: { factura: string; proveedor: string; mesa: number; encargado: string; fecha: string; motivo: string | null; observaciones: { contenido: string; autor: string; fecha: string }[] }
}
export interface Proveedor { id: string; nombre: string; nit?: string | null; activo?: boolean }
export interface Operador { id: string; nombre: string; email: string; persona_id?: string | null; mesa_id?: number | null }
export interface Encargado { id: string; perfil_id: string; nombre: string; mesa_id: number | null; activo: boolean; version: number }
export interface Catalogos { proveedores: Proveedor[]; operadores: Operador[] }
export interface Resumen {
  vencidas: number
  registros: Revision[]; total: number; asignado: number; en_revision: number; pendiente_cierre: number; devuelto: number; cerrado: number
  total_articulos: number; sin_numero_articulos: number
  promedio_segundos: number; por_mesa: {mesa_id: number; cantidad: number}[]; por_operador: {encargado_id: string; encargado_persona_id?: string | null; nombre: string; cantidad: number}[]
}
export interface Filtros { factura?: string; cpm?: string; proveedor_id?: string; encargado_id?: string; encargado_persona_id?: string; mesa_id?: string; estado?: string; desde?: string; hasta?: string }
export interface Detalle { registro: Revision; observaciones: Observacion[]; historial: Movimiento[] }
export function fecha(value: string | null) {
  return value ? new Intl.DateTimeFormat('es-CO', {timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short'}).format(new Date(value)) : '—'
}
