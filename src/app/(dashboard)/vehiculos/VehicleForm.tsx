'use client'

import { useState } from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, X, AlertCircle } from 'lucide-react'
import { createVehiculo, updateVehiculo } from './actions'

import { Vehicle } from './types'

const vehicleFormSchema = z.object({
  placa: z.string()
    .min(1, 'La placa es requerida')
    .max(20, 'La placa no puede exceder 20 caracteres')
    .regex(/^[A-Za-z0-9-]{3,10}$/, 'Formato de placa inválido (letras, números o guion)'),
  marca: z.string().min(1, 'La marca es requerida'),
  modelo: z.string().optional().default(''),
  tipo: z.enum(['Moto', 'Carro', 'Camión', 'Otro']),
  kilometraje: z.coerce.number().min(0, 'El kilometraje debe ser mayor o igual a 0'),
  estado: z.enum(['activo', 'mantenimiento', 'inactivo']).default('activo'),
})

type VehicleFormData = z.infer<typeof vehicleFormSchema>

interface VehicleFormProps {
  vehicle?: Vehicle // Si viene, se está editando
  onSuccess: () => void
  onCancel: () => void
}

export function VehicleForm({ vehicle, onSuccess, onCancel }: VehicleFormProps) {
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState,
  } = useForm<any>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      placa: vehicle?.placa || '',
      marca: vehicle?.marca || '',
      modelo: vehicle?.modelo || '',
      tipo: vehicle?.tipo || 'Moto',
      kilometraje: vehicle?.kilometraje || 0,
      estado: vehicle?.estado || 'activo',
    },
  })

  const errors = formState.errors as any
  const isSubmitting = formState.isSubmitting

  const handleFormSubmit: SubmitHandler<any> = async (data) => {
    setError(null)
    try {
      const result = vehicle 
        ? await updateVehiculo(vehicle.id, data)
        : await createVehiculo(data)

      if (result.error) {
        if (typeof result.error === 'object') {
          // Si es un error de validación de campo devuelto por el servidor
          const firstKey = Object.keys(result.error)[0]
          const fieldErrors = (result.error as Record<string, string[]>)[firstKey]
          setError(fieldErrors[0] || 'Error al guardar el vehículo')
        } else {
          setError(result.error)
        }
      } else {
        onSuccess()
      }
    } catch {
      setError('Error al conectar con el servidor')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-neutral-800 bg-neutral-900/50">
          <div>
            <h3 className="text-xl font-bold text-white">
              {vehicle ? 'Editar Vehículo' : 'Registrar Nuevo Vehículo'}
            </h3>
            <p className="text-xs text-neutral-400 mt-1">
              {vehicle ? `Modificando placa ${vehicle.placa}` : 'Completa los datos de la unidad automotriz'}
            </p>
          </div>
          <button 
            onClick={onCancel} 
            className="p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">Placa / ID</label>
              <input
                {...register('placa')}
                disabled={!!vehicle} // No permitimos editar placa para evitar problemas de referencia
                placeholder="ABC123"
                className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all uppercase disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {errors.placa && <p className="mt-1 text-xs text-red-500">{errors.placa.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">Tipo</label>
              <select
                {...register('tipo')}
                className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
              >
                <option value="Moto">Moto</option>
                <option value="Carro">Carro</option>
                <option value="Camión">Camión</option>
                <option value="Otro">Otro</option>
              </select>
              {errors.tipo && <p className="mt-1 text-xs text-red-500">{errors.tipo.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">Marca</label>
              <input
                {...register('marca')}
                placeholder="Yamaha / Chevrolet"
                className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
              {errors.marca && <p className="mt-1 text-xs text-red-500">{errors.marca.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">Modelo / Año</label>
              <input
                {...register('modelo')}
                placeholder="FZ-25 / 2023"
                className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
              {errors.modelo && <p className="mt-1 text-xs text-red-500">{errors.modelo.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">Kilometraje Inicial</label>
              <input
                type="number"
                {...register('kilometraje')}
                placeholder="0"
                className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
              {errors.kilometraje && <p className="mt-1 text-xs text-red-500">{errors.kilometraje.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">Estado</label>
              <select
                {...register('estado')}
                className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
              >
                <option value="activo">Activo</option>
                <option value="mantenimiento">Mantenimiento</option>
                <option value="inactivo">Inactivo</option>
              </select>
              {errors.estado && <p className="mt-1 text-xs text-red-500">{errors.estado.message}</p>}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-pulse">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-neutral-800">
            <button 
              type="button" 
              onClick={onCancel} 
              className="flex-1 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-medium transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-600/20"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              <span>Guardar</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
