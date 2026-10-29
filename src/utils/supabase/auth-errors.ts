/** Only confirmed credential/session failures may send the user back to login. */
export function invalidSession(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { name?: string; code?: string; status?: number }
  if (e.status && (e.status >= 500 || [408,429].includes(e.status))) return false
  return e.name === 'AuthSessionMissingError' || e.status === 401 || [
    'session_not_found','session_expired','refresh_token_not_found','refresh_token_already_used',
    'bad_jwt','user_not_found','user_banned',
  ].includes(e.code ?? '')
}
export function authFailureMessage(error: unknown): string {
  return invalidSession(error) ? 'La sesión ya no es válida. Inicia sesión nuevamente.'
    : 'No se pudo verificar la sesión temporalmente. Conservamos tus datos; intenta de nuevo.'
}
