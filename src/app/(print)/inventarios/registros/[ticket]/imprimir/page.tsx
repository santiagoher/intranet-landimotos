import type { Metadata } from 'next'
import { getDifferencePrintData } from '@/modules/inventarios/operations/difference-print.server'
import { DifferencePrintPreview } from '@/modules/inventarios/operations/DifferencePrintPreview'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Diferencias de inventario | Landimotos', robots: { index: false, follow: false } }

export default async function DifferencePrintPage({ params }: { params: Promise<{ ticket: string }> }) {
  const { ticket } = await params
  const result = await getDifferencePrintData(ticket)
  if (!result.data) return <main className="mx-auto max-w-xl space-y-4 p-8"><h1 className="text-xl font-semibold">No se pudo abrir la impresión</h1><p role="alert">{result.error}</p><a className="btn-secondary" href="/inventarios/registros">Volver a Inventarios</a></main>
  return <DifferencePrintPreview data={result.data} />
}
