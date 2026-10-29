'use client'

export default function InventoryError({ reset }: { reset: () => void }) {
  return <div role="alert" className="space-y-4 rounded-xl border border-border bg-surface p-8">
    <h2 className="text-lg font-semibold">No se pudo cargar Inventarios</h2>
    <p className="text-sm text-muted">Intenta de nuevo. No se ha modificado ningún inventario.</p>
    <button type="button" onClick={reset} className="btn-secondary">Reintentar</button>
  </div>
}
