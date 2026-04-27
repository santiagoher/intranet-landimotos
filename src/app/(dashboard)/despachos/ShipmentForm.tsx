'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, X, Truck, AlertCircle } from 'lucide-react'
import { createEnvio } from './actions'
import { getMensajeros } from '../mensajeros/actions'

const shipmentSchema = z.object({
  pedido_id: z.string().uuid('Pedido inválido'),
  mensajero_id: z.string().uuid('Debes seleccionar un mensajero'),
  direccion: z.string().min(5, 'La dirección es requerida'),
  estado: z.enum(['asignado', 'en_camino', 'entregado', 'fallido']),
})

type ShipmentFormData = z.infer<typeof shipmentSchema>

interface ShipmentFormProps {
  pedido: any
  onSuccess: () => void
  onCancel: () => void
}

export function ShipmentForm({ pedido, onSuccess, onCancel }: ShipmentFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [mensajeros, setMensajeros] = useState<any[]>([])
  const [loadingMensajeros, setLoadingMensajeros] = useState(true)

  useEffect(() => {
    const fetchMensajeros = async () => {
      try {
        const data = await getMensajeros()
        setMensajeros(data.filter(m => m.estado === 'disponible'))
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingMensajeros(false)
      }
    }
    fetchMensajeros()
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ShipmentFormData>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: {
      pedido_id: pedido.id,
      direccion: '',
      estado: 'asignado',
    },
  })

  const onSubmit = async (data: ShipmentFormData) => {
    setError(null)
    const result = await createEnvio(data)

    if (result.error) {
      setError(typeof result.error === 'string' ? result.error : 'Error al registrar envío')
    } else {
      onSuccess()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-neutral-800 bg-neutral-900/50">
          <div>
            <h3 className="text-xl font-bold text-white">Asignar Envío</h3>
            <p className="text-xs text-neutral-400 mt-1">Pedido: {pedido.cliente}</p>
          </div>
          <button onClick={onCancel} className="p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Dirección de Entrega</label>
            <input
              {...register('direccion')}
              className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Calle 123 #45-67, Ciudad"
            />
            {errors.direccion && <p className="mt-1 text-xs text-red-500">{errors.direccion.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Seleccionar Mensajero</label>
            <select
              {...register('mensajero_id')}
              disabled={loadingMensajeros}
              className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none disabled:opacity-50"
            >
              <option value="">{loadingMensajeros ? 'Cargando...' : 'Seleccione un mensajero disponible'}</option>
              {mensajeros.map(m => (
                <option key={m.id} value={m.id} className="bg-neutral-950">{m.nombre}</option>
              ))}
            </select>
            {errors.mensajero_id && <p className="mt-1 text-xs text-red-500">{errors.mensajero_id.message}</p>}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              <p>{error}</p>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onCancel} className="flex-1 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-medium transition-all">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || loadingMensajeros}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-600/20"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
              Registrar Envío
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
