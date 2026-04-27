'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email('Por favor ingresa un email válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
})

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // Validación Zod
  const validation = loginSchema.safeParse({ email, password })

  if (!validation.success) {
    return { error: validation.error.errors[0].message }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // Retornamos el mensaje real para debug
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}




