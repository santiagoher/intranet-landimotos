'use client'

import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, X, CheckCircle2, AlertCircle, Plus, Trash2, MapPin, Package, User, Clock } from 'lucide-react'
import { createRoute } from './actions'

const routeSchema = z.object({
  mensajero_id: z.string().uuid('Seleccione un mensajero'),
  lugar_entrega: z.string().min(1, 'Especifique el destino'),
  numero_pedidos: z.number().min(1, 'Mínimo 1 pedido'),
  numero_factura: z.array(z.object({
    numero: z.string().min(1, 'Número requerido')
  })).min(1, 'Ingrese al menos una factura'),
  revisor: z.string().min(1, 'Nombre del revisor requerido'),
  hora_salida: z.string().min(1, 'La hora de salida es requerida'),
})

type RouteFormData = z.infer<typeof routeSchema>

interface RouteFormProps {
  mensajeros: any[]
  onSuccess: () => void
  onCancel: () => void
  revisores: string[]
}

export function RouteForm({ mensajeros, onSuccess, onCancel, revisores }: RouteFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RouteFormData>({
    resolver: zodResolver(routeSchema),
    defaultValues: {
      mensajero_id: '',
      lugar_entrega: '',
      numero_pedidos: 1,
      numero_factura: [{ numero: '' }],
      revisor: '',
      hora_salida: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "numero_factura"
  })

  const onSubmit = async (data: RouteFormData) => {
    setServerError(null)
    
    let horaSalidaIso = new Date().toISOString();
    if (data.hora_salida) {
      const now = new Date();
      const [hours, minutes] = data.hora_salida.split(':');
      now.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
      horaSalidaIso = now.toISOString();
    }

    const payload = {
      ...data,
      hora_salida: horaSalidaIso,
      numero_factura: data.numero_factura.map(f => f.numero).join(', ')
    }

    const result = await createRoute(payload)

    if (result.error) {
      setServerError(typeof result.error === 'string' ? result.error : 'Error al crear la ruta')
    } else {
      onSuccess()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 my-8">
        <div className="flex items-center justify-between p-6 border-b border-neutral-800 bg-neutral-900/50">
          <div>
            <h3 className="text-xl font-bold text-white">Asignar Nueva Ruta</h3>
            <p className="text-xs text-neutral-400 mt-1">Registra la salida del mensajero y sus pedidos.</p>
          </div>
          <button onClick={onCancel} className="p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 sm:p-8 space-y-5 sm:space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Mensajero */}
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">Mensajero Disponible</label>
              <select
                {...register('mensajero_id')}
                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none cursor-pointer"
              >
                <option value="">Seleccionar mensajero...</option>
                {mensajeros.map(m => (
                  <option key={m.id} value={m.id}>{m.nombre_conductor}</option>
                ))}
              </select>
              {errors.mensajero_id && <p className="mt-1 text-xs text-red-500">{errors.mensajero_id.message}</p>}
            </div>

            {/* Lugar */}
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">Destino / Lugar</label>
              <div className="relative">
                 <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                 <input
                   {...register('lugar_entrega')}
                   className="w-full pl-10 pr-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                   placeholder="Ej: Zona Norte, Centro, etc."
                 />
              </div>
              {errors.lugar_entrega && <p className="mt-1 text-xs text-red-500">{errors.lugar_entrega.message}</p>}
            </div>

            {/* Número de Pedidos */}
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">Número de Pedidos</label>
              <div className="relative">
                 <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                 <input
                   type="number"
                   {...register('numero_pedidos', { valueAsNumber: true })}
                   className="w-full pl-10 pr-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                 />
              </div>
              {errors.numero_pedidos && <p className="mt-1 text-xs text-red-500">{errors.numero_pedidos.message}</p>}
            </div>

            {/* Hora de Salida */}
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">Hora de Salida</label>
              <div className="relative">
                 <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                 <input
                   type="time"
                   {...register('hora_salida')}
                   className="w-full pl-10 pr-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all [color-scheme:dark]"
                 />
              </div>
              {errors.hora_salida && <p className="mt-1 text-xs text-red-500">{errors.hora_salida.message}</p>}
            </div>

            {/* Revisor */}
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">Revisor / Despachador</label>
              <div className="relative">
                 <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                 <input
                   {...register('revisor')}
                   className="w-full pl-10 pr-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                   placeholder="Nombre de quien revisa..."
                 />
              </div>
              {errors.revisor && <p className="mt-1 text-xs text-red-500">{errors.revisor.message}</p>}
            </div>

            {/* Facturas Dinámicas */}
            <div className="md:col-span-2">
              <label className="flex items-center justify-between text-sm font-medium text-neutral-400 mb-2">
                Números de Factura
                <button 
                  type="button" 
                  onClick={() => append({ numero: '' })}
                  className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Agregar otra
                </button>

       

              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-2">
                    <input
                      {...register(`numero_factura.${index}.numero` as const)}
                      className="flex-1 px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder={`Factura #${index + 1}`}
                    />
                    {fields.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => remove(index)}
                        className="p-2.5 text-neutral-500 hover:text-red-500 bg-neutral-950 border border-neutral-800 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {errors.numero_factura && <p className="mt-1 text-xs text-red-500">Ingrese al menos una factura válida</p>}
            </div>
          </div>

          {serverError && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{serverError}</p>
            </div>
          )}

          <div className="flex gap-4 mt-8">
            <button 
              type="button" 
              onClick={onCancel}
              className="flex-1 px-6 py-3.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-2xl font-bold transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-[2] flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              Asignar Ruta
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
