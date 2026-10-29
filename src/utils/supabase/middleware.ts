import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { invalidSession } from './auth-errors'
import { supabaseFetch } from './fetch'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global:{fetch:supabaseFetch},
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies) {
        cookies.forEach(({name,value}) => request.cookies.set(name,value))
        const previous = response.cookies.getAll()
        response = NextResponse.next({request})
        previous.forEach(cookie => response.cookies.set(cookie))
        cookies.forEach(({name,value,options}) => response.cookies.set(name,value,options))
      },
    },
  })
  function finish(next: NextResponse) {
    // Refresh/removal cookies MUST reach redirects and error responses too.
    if(next !== response) response.cookies.getAll().forEach(cookie => next.cookies.set(cookie))
    next.headers.set('Cache-Control','private, no-store')
    return next
  }
  function login(reason?: string) {
    if(request.nextUrl.pathname.startsWith('/api/')) return finish(NextResponse.json({error:'Sesión requerida',code:'SESSION_INVALID'},{status:401}))
    const url=request.nextUrl.clone();url.pathname='/login';url.search=''
    if(reason)url.searchParams.set('error',reason)
    return finish(NextResponse.redirect(url))
  }
  function unavailable() {
    const headers={'Retry-After':'30','Cache-Control':'private, no-store'}
    if(request.method !== 'GET' || request.nextUrl.pathname.startsWith('/api/'))
      return finish(NextResponse.json({error:'Servicio temporalmente no disponible. Reintenta sin cerrar sesión.',code:'SERVICE_UNAVAILABLE'},{status:503,headers}))
    return finish(new NextResponse('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Servicio temporalmente no disponible</title><body><main><h1>No pudimos verificar el acceso en este momento</h1><p>La sesión no se ha cerrado. Espera unos segundos y vuelve a cargar esta página.</p><p>No vuelvas a enviar un conteo sin comprobar antes si quedó guardado.</p></main></body></html>',{status:503,headers:{...headers,'Content-Type':'text/html; charset=utf-8'}}))
  }
  try {
    const {data:{user},error}=await supabase.auth.getUser()
    const isLogin=request.nextUrl.pathname === '/login'
    if(error && !invalidSession(error))return unavailable()
    if(!user || error)return isLogin ? finish(response) : login()
    const {data:profile,error:profileError}=await supabase.from('perfiles').select('rol, estado').eq('id',user.id).single()
    if(profileError || !profile)return unavailable()
    if(profile.estado === 'inactivo') {
      const {error:signOutError}=await supabase.auth.signOut({scope:'local'})
      if(signOutError && !invalidSession(signOutError))return unavailable()
      return isLogin ? finish(response) : login('cuenta_desactivada')
    }
    if(isLogin || (request.nextUrl.pathname.startsWith('/admin') && profile.rol !== 'Admin')) {
      const url=request.nextUrl.clone();url.pathname='/';url.search=''
      return finish(NextResponse.redirect(url))
    }
    return finish(response)
  } catch {
    return unavailable()
  }
}
