import { z } from 'zod'
const id = z.string().uuid()
const texto = (max: number) => z.string().trim().min(1).max(max)
const base = {id, version: z.number().int().positive()}
export const mutationSchema = z.discriminatedUnion('accion', [
  z.object({accion: z.literal('crear'), factura: texto(100), numero_articulos: z.number().int().positive().max(2147483647), proveedor_id: id, mesa_id: z.number().int().min(1).max(5), encargado_id: id, encargado_persona_id: id.optional()}),
  z.object({accion: z.literal('proveedor'), nombre: z.string().trim().min(2).max(200), nit: z.string().trim().regex(/^[0-9]{5,15}$/)}),
  z.object({accion: z.literal('leer_notificacion'), id}),
  z.object({accion: z.literal('iniciar'), ...base}),
  z.object({accion: z.literal('observar'), ...base, contenido: texto(4000)}),
  z.object({accion: z.literal('finalizar'), ...base}),
  z.object({accion: z.literal('devolver'), ...base, motivo: texto(4000)}),
  z.object({accion: z.literal('cerrar'), ...base, cpm: texto(100)}),
  z.object({accion: z.literal('reasignar'), ...base, mesa_id: z.number().int().min(1).max(5), encargado_id: id, encargado_persona_id: id.optional(), motivo: texto(4000)}),
])
export type Mutacion = z.infer<typeof mutationSchema>
const optionalId = z.union([id,z.literal('')]).optional()
const date = z.union([z.iso.date(),z.literal('')]).optional()
export const filtersSchema = z.object({
  factura: z.string().trim().max(100).optional(), cpm: z.string().trim().max(100).optional(), proveedor_id: optionalId, encargado_id: optionalId, encargado_persona_id: optionalId,
  mesa_id: z.enum(['','1','2','3','4','5']).optional(), estado: z.enum(['','asignado','en_revision','pendiente_cierre','devuelto','cerrado']).optional(), desde: date, hasta: date,
}).refine(f => !f.desde || !f.hasta || f.desde <= f.hasta, 'La fecha inicial no puede ser posterior a la final')
