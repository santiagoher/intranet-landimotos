'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { createMensajero, updateMensajero } from './actions'

const messengerSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  telefono: z.string().min(7, 'El teléfono debe tener al menos 7 dígitos'),
  estado: z.enum(['disponible', 'en_ruta', 'inactivo']),
})

type MessengerFormData = z.infer<typeof messengerSchema>

interface MessengerFormProps {
  initialData?: any
  onSuccess: () => void
  onCancel: () => void
}

export function MessengerForm({ initialData, onSuccess, onCancel }: MessengerFormProps) {
  const [error, setError] = useState<string | null>(null)
  const isEditing = !!initialData

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MessengerFormData>({
    resolver: zodResolver(messengerSchema),
    defaultValues: initialData || {
      nombre: '',
      telefono: '',
      estado: 'disponible',
    },
  })

  const onSubmit = async (data: MessengerFormData) => {
    setError(null)
    const result = isEditing 
      ? await updateMensajero(initialData.id, data)
      : await createMensajero(data)

    if (result.error) {
      setError(typeof result.error === 'string' ? result.error : 'Error en el formulario')
    } else {
      onSuccess()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-neutral-800 bg-neutral-900/50">
          <h3 className="text-xl font-bold text-white">
            {isEditing ? 'Editar Mensajero' : 'Registrar Mensajero'}
          </h3>
          <button 
            onClick={onCancel}
            className="p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Nombre Completo</label>
            <input
              {...register('nombre')}
              className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="Ej. Juan Pérez"
            />
            {errors.nombre && <p className="mt-1 text-xs text-red-500">{errors.nombre.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Teléfono / WhatsApp</label>
            <input
              {...register('telefono')}
              className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="Ej. +57 321..."
            />
            {errors.telefono && <p className="mt-1 text-xs text-red-500">{errors.telefono.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Estado</label>
            <select
              {...register('estado')}
              className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all appearance-none"
            >
              <option value="disponible" className="bg-neutral-950">Disponible</option>
              <option value="en_ruta" className="bg-neutral-950">En Ruta</option>
              <option value="inactivo" className="bg-neutral-950">Inactivo</option>
            </select>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              <p>{error}</p>
            </div>
          )}

          <div className="flex gap-3 mt-6">
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
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {isEditing ? 'Guardar Cambios' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
