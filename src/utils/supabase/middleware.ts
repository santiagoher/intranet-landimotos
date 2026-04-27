import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Recurperamos el usuario para validar auth
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Definir comportamiento de rutas protegidas
  const isLoginPage = request.nextUrl.pathname.startsWith('/login')
  
  if (!user && !isLoginPage) {
    // Si no hay usuario y trata de entrar a rutas protegidas, al login
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isLoginPage) {
    // Si hay usuario y trata de ir al login, al dashboard
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Validación de Rutas por Rol y Estado
  if (user && !isLoginPage) {
    // Obtener perfil completo
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol, estado')
      .eq('id', user.id)
      .single()

    // 1. Bloqueo por estado inactivo
    if (perfil?.estado === 'inactivo') {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      // Podríamos agregar un query param para mostrar un mensaje específico
      url.searchParams.set('error', 'cuenta_desactivada')
      
      // Intentamos cerrar sesión en el servidor para limpiar cookies
      await supabase.auth.signOut()
      
      return NextResponse.redirect(url)
    }

    // 2. Bloqueo de rutas administrativas
    if (request.nextUrl.pathname.startsWith('/admin') && perfil?.rol !== 'Admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
