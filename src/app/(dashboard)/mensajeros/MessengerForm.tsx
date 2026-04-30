'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, X, CheckCircle2, AlertCircle, Upload, Image as ImageIcon } from 'lucide-react'
import { createMensajero, updateMensajero, uploadPhoto } from './actions'

const messengerSchema = z.object({
  nombre_conductor: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  placa_conductor: z.string().min(1, 'La placa es requerida'),
  foto_url: z.string().url('Ingrese una URL válida').or(z.literal('')).optional(),
  estado: z.enum(['disponible', 'en_ruta', 'almorzando', 'inactivo']),
})

type MessengerFormData = z.infer<typeof messengerSchema>

interface MessengerFormProps {
  initialData?: any
  onSuccess: () => void
  onCancel: () => void
}

export function MessengerForm({ initialData, onSuccess, onCancel }: MessengerFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialData?.foto_url || null)
  const [uploading, setUploading] = useState(false)
  const isEditing = !!initialData

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MessengerFormData>({
    resolver: zodResolver(messengerSchema),
    defaultValues: initialData || {
      nombre_conductor: '',
      placa_conductor: '',
      foto_url: '',
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Preview local
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)

    // Subir a Storage
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    
    const result = await uploadPhoto(formData)
    setUploading(false)

    if (result.error) {
      setError(result.error)
    } else if (result.url) {
      // Guardamos la URL final en el formulario de forma invisible
      setValue('foto_url', result.url)
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
            <label className="block text-sm font-medium text-neutral-400 mb-1">Nombre Completo del Conductor</label>
            <input
              {...register('nombre_conductor')}
              className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="Ej. Juan Pérez"
            />
            {errors.nombre_conductor && <p className="mt-1 text-xs text-red-500">{errors.nombre_conductor.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Placa del Vehículo</label>
            <input
              {...register('placa_conductor')}
              className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="Ej. ABC-123"
            />
            {errors.placa_conductor && <p className="mt-1 text-xs text-red-500">{errors.placa_conductor.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-2">Foto de Perfil (Desde equipo)</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-center overflow-hidden relative group">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-neutral-700" />
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                )}
              </div>
              <label className="flex-1">
                <div className="flex items-center justify-center gap-2 px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl cursor-pointer transition-all border border-neutral-700 border-dashed">
                  <Upload className="w-4 h-4" />
                  <span className="text-sm font-medium">Elegir Imagen</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
            {errors.foto_url && <p className="mt-1 text-xs text-red-500">{errors.foto_url.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Estatus del Personal</label>
            <select
              {...register('estado')}
              className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="disponible" className="bg-neutral-950">Activo</option>
              <option value="inactivo" className="bg-neutral-950">Inactivo</option>
            </select>
            <p className="mt-1.5 text-[10px] text-neutral-500 px-1">Solo los mensajeros activos aparecen en el módulo operativo para asignación de rutas.</p>
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
