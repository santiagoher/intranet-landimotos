/** Keep infrastructure failures retryable during SDK token refresh as well as reads. */
export async function supabaseFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response> {
  const response=await fetch(input,init)
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url)
  if(url.pathname.startsWith('/auth/v1/') && response.status>=500) {
    await response.body?.cancel()
    // auth-js treats transport errors as retryable, preserving refresh tokens.
    // Some gateway 500 responses otherwise become non-retryable AuthApiErrors.
    throw new TypeError('El servicio de autenticación no está disponible temporalmente.')
  }
  return response
}
