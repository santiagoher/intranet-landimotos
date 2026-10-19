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
    <div className="flex min-h-dvh bg-subtle items-center justify-center p-4 relative">

      <div className="relative w-full max-w-md z-10">
        <div className="bg-surface rounded-xl shadow-sm border border-border p-5 sm:p-8">
          
          <div className="flex flex-col items-center mb-6 sm:mb-8">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-accent rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4 shadow-none">
              <Package className="w-6 h-6 sm:w-8 sm:h-8 text-on-accent" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Portal Logístico</h1>
            <p className="text-muted mt-1.5 text-xs sm:text-sm text-center">
              Ingresa tus credenciales para acceder a tu panel de control.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1" htmlFor="email">
                Correo Electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="ejemplo@empresa.com"
                className="w-full px-4 py-3 bg-surface border border-border-strong rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder:text-muted"
                {...register('email')}
              />
              {errors.email && (
                <p className="text-danger text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-secondary" htmlFor="password">
                  Contraseña
                </label>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-surface border border-border-strong rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder:text-muted"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-danger text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            {serverError && (
              <div className="flex flex-row items-center gap-2 p-3 bg-danger-soft border border-danger/20 rounded-xl text-danger text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p>{serverError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center py-3 px-4 bg-accent hover:bg-accent-hover text-on-accent rounded-xl font-medium transition-all shadow-none active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none"
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
