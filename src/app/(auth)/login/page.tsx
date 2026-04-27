'use client'

import { useState } from 'react'
import { login } from './actions'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Package, Loader2, AlertCircle } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
  password: z.string().min(6, 'La contraseña es requerida'),
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [serverError, setServerError] = useState<string | null>(null)
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null)
    const formData = new FormData()
    formData.append('email', data.email)
    formData.append('password', data.password)
    
    // Server action call
    const result = await login(formData)
    
    if (result?.error) {
      setServerError(result.error)
    }
  }

  return (
    <div className="flex min-h-screen bg-neutral-900 items-center justify-center p-4">
      {/* Elementos decorativos (Glassmorphism) */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full mix-blend-screen filter blur-[128px] opacity-50"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/20 rounded-full mix-blend-screen filter blur-[128px] opacity-50"></div>

      <div className="relative w-full max-w-md z-10">
        <div className="bg-neutral-800/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-neutral-700 p-8">
          
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
              <Package className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Portal Logístico</h1>
            <p className="text-neutral-400 mt-2 text-sm text-center">
              Ingresa tus credenciales para acceder a tu panel de control.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-1" htmlFor="email">
                Correo Electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="ejemplo@empresa.com"
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-neutral-600"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-neutral-300" htmlFor="password">
                  Contraseña
                </label>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-neutral-900 border border-neutral-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-neutral-600"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            {serverError && (
              <div className="flex flex-row items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{serverError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-500/25 active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
