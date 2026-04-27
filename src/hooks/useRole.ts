'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export function useRole() {
  const [rol, setRol] = useState<'Admin' | 'Operativo' | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function getRole() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: perfil } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', user.id)
          .single()
        
        setRol(perfil?.rol || 'Operativo')
      }
      setLoading(false)
    }

    getRole()
  }, [])

  return { rol, isAdmin: rol === 'Admin', loading }
}
