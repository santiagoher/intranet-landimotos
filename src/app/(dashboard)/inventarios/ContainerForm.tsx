'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { createContenedor, updateContenedor } from './actions'

const containerSchema = z.object({
  codigo: z.string().min(3, 'El código debe tener al menos 3 caracteres'),
  descripcion: z.string().optional(),
  estado: z.enum(['disponible', 'en_uso', 'mantenimiento']),
})

type ContainerFormData = z.infer<typeof containerSchema>

interface ContainerFormProps {
  initialData?: any
  onSuccess: () => void
  onCancel: () => void
}

export function ContainerForm({ initialData, onSuccess, onCancel }: ContainerFormProps) {
  const [error, setError] = useState<string | null>(null)
  const isEditing = !!initialData

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContainerFormData>({
    resolver: zodResolver(containerSchema),
    defaultValues: initialData || {
      codigo: '',
      descripcion: '',
      estado: 'disponible',
    },
  })

  const onSubmit = async (data: ContainerFormData) => {
    setError(null)
    const result = isEditing 
      ? await updateContenedor(initialData.id, data)
      : await createContenedor(data)

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
            {isEditing ? 'Editar Contenedor' : 'Registrar Contenedor'}
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
            <label className="block text-sm font-medium text-neutral-400 mb-1">Código del Contenedor</label>
            <input
              {...register('codigo')}
              className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="Ej. CONT-001"
            />
            {errors.codigo && <p className="mt-1 text-xs text-red-500">{errors.codigo.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Descripción (Opcional)</label>
            <textarea
              {...register('descripcion')}
              className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all min-h-[100px]"
              placeholder="Detalles sobre el contenedor..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Estado</label>
            <select
              {...register('estado')}
              className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all appearance-none"
            >
              <option value="disponible" className="bg-neutral-950">Disponible</option>
              <option value="en_uso" className="bg-neutral-950">En Uso</option>
              <option value="mantenimiento" className="bg-neutral-950">Mantenimiento</option>
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
              {isEditing ? 'Guardar' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
