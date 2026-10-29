import Link from 'next/link'
import { Shield, AlertCircle } from 'lucide-react'

export function InventoryAccessState({ error = false }: { error?: boolean }) {
  const Icon = error ? AlertCircle : Shield
  return <section className="rounded-xl border border-border bg-surface p-8 text-center sm:p-12" role={error ? 'alert' : undefined}>
    <Icon className="mx-auto mb-4 size-8 text-muted" aria-hidden="true" />
    <h1 className="text-lg font-semibold">{error ? 'No se pudo comprobar el acceso' : 'Acceso no autorizado'}</h1>
    <p className="mx-auto mt-2 max-w-lg text-sm text-muted">{error
      ? 'Intenta cargar la página de nuevo. Los datos de inventarios permanecen protegidos.'
      : 'Necesitas acceso al módulo y los permisos correspondientes para consultar esta sección.'}</p>
    <Link href="/" className="btn-secondary mt-6 inline-flex">Volver al inicio</Link>
  </section>
}
