'use client'

import { useState } from 'react'
import { useForm, SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, X, Shield, AlertCircle } from 'lucide-react'
import { updateUserProfile } from './actions'

// 1. Definimos la interfaz de forma explícita
interface UserUpdateFormData {
  nombre: string
  rol: 'Admin' | 'Operativo'
  estado: 'activo' | 'inactivo'
  modulos_permitidos: string[]
}

// 2. Obligamos al esquema a seguir esa interfaz
const userUpdateSchema = z.object({
  nombre: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  rol: z.enum(['Admin', 'Operativo']),
  estado: z.enum(['activo', 'inactivo']),
  modulos_permitidos: z.array(z.string()),
})

interface UserEditModalProps {
  user: any
  onSuccess: () => void
  onCancel: () => void
}

export function UserEditModal({ user, onSuccess, onCancel }: UserEditModalProps) {
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UserUpdateFormData>({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: {
      nombre: user.nombre || '',
      rol: (user.rol === 'Admin' || user.rol === 'Operativo' ? user.rol : 'Operativo'),
      estado: (user.estado === 'activo' || user.estado === 'inactivo' ? user.estado : 'activo'),
      modulos_permitidos: Array.isArray(user.modulos_permitidos) ? user.modulos_permitidos : [],
    },
  })

  const allowedModules = watch('modulos_permitidos')

  const toggleModule = (module: string) => {
    const updated = allowedModules.includes(module)
      ? allowedModules.filter((m) => m !== module)
      : [...allowedModules, module]
    setValue('modulos_permitidos', updated, { shouldValidate: true })
  }

  const handleFormSubmit: SubmitHandler<UserUpdateFormData> = async (data) => {
    setError(null)
    try {
      const result = await updateUserProfile(user.id, data)
      if (result.error) {
        setError(typeof result.error === 'string' ? result.error : 'Error al actualizar')
      } else {
        onSuccess()
      }
    } catch (err) {
      setError('Error de conexión')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-neutral-800 bg-neutral-900/50">
          <div>
            <h3 className="text-xl font-bold text-white">Gestionar Usuario</h3>
            <p className="text-xs text-neutral-400 mt-1">{user.email}</p>
          </div>
          <button onClick={onCancel} className="p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Nombre Completo</label>
            <input
              {...register('nombre')}
              className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
            {errors.nombre && <p className="mt-1 text-xs text-red-500">{errors.nombre.message}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">Rol</label>
              <select
                {...register('rol')}
                className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
              >
                <option value="Operativo">Operativo</option>
                <option value="Admin">Administrador</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">Estado</label>
              <select
                {...register('estado')}
                className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-sm font-bold text-neutral-400 mb-3 uppercase tracking-wider">Módulos de Acceso</label>
            <div className="grid grid-cols-1 gap-2">
              {['despachos', 'mensajeros'].map((module) => (
                <label
                  key={module}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                    allowedModules.includes(module)
                      ? 'bg-blue-600/10 border-blue-500/50 text-white'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-500 hover:border-neutral-700'
                    }`}
                >
                  <span className="capitalize text-sm font-medium">{module}</span>
                  <input
                    type="checkbox"
                    checked={allowedModules.includes(module)}
                    onChange={() => toggleModule(module)}
                    className="w-4 h-4 rounded border-neutral-800 bg-neutral-900 text-blue-600 focus:ring-blue-500"
                  />
                </label>
              ))}
            </div>
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
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-600/20"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
