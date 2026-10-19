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
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-sm overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-border bg-surface">
          <h3 className="text-xl font-bold text-foreground">
            {isEditing ? 'Editar Contenedor' : 'Registrar Contenedor'}
          </h3>
          <button 
            onClick={onCancel}
            className="p-2 text-muted hover:text-foreground hover:bg-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Código del Contenedor</label>
            <input
              {...register('codigo')}
              className="w-full px-4 py-2.5 bg-subtle border border-border rounded-xl text-foreground focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all"
              placeholder="Ej. CONT-001"
            />
            {errors.codigo && <p className="mt-1 text-xs text-danger">{errors.codigo.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">Descripción (Opcional)</label>
            <textarea
              {...register('descripcion')}
              className="w-full px-4 py-2.5 bg-subtle border border-border rounded-xl text-foreground focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all min-h-[100px]"
              placeholder="Detalles sobre el contenedor..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">Estado</label>
            <select
              {...register('estado')}
              className="w-full px-4 py-2.5 bg-subtle border border-border rounded-xl text-foreground focus:ring-2 focus:ring-accent focus:border-transparent outline-none transition-all appearance-none"
            >
              <option value="disponible" className="bg-subtle">Disponible</option>
              <option value="en_uso" className="bg-subtle">En Uso</option>
              <option value="mantenimiento" className="bg-subtle">Mantenimiento</option>
            </select>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-danger-soft border border-danger/20 rounded-xl text-danger text-sm">
              <AlertCircle className="w-4 h-4" />
              <p>{error}</p>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-subtle hover:bg-hover text-foreground rounded-xl font-medium transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-on-accent rounded-xl font-medium transition-all shadow-none"
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
