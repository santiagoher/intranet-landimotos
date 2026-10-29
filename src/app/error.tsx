'use client'
export default function AppError({reset}:{reset:()=>void}) {
  return <main role="alert" className="mx-auto my-12 max-w-xl space-y-4 rounded-xl border border-border bg-surface p-8">
    <h1 className="text-lg font-semibold">No se pudo cargar la página</h1>
    <p className="text-sm text-muted">Puede ser una interrupción temporal. Reintenta sin cerrar sesión. Antes de repetir una operación, comprueba si quedó guardada.</p>
    <button type="button" className="btn-primary" onClick={reset}>Reintentar</button>
  </main>
}
