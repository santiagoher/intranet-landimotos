'use client'

import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { Printer, X } from 'lucide-react'
import { DifferencePrintDocument } from './DifferencePrintDocument'
import type { DifferencePrintData } from './difference-print'
import './difference-print.css'

export function DifferencePrintPreview({ data }: { data: DifferencePrintData }) {
  const [paper, setPaper] = useState<'A5' | 'A4'>('A5')
  const [printedAt, setPrintedAt] = useState(data.generatedAt)
  useEffect(() => {
    const updateTime = () => flushSync(() => setPrintedAt(new Date().toISOString()))
    window.addEventListener('beforeprint', updateTime)
    return () => window.removeEventListener('beforeprint', updateTime)
  }, [])
  return <main className="difference-preview" data-paper={paper}>
    <nav className="difference-toolbar" aria-label="Opciones de impresión">
      <div><strong>Vista previa · {data.ticket}</strong><p>Imprime o guarda como PDF. Tu inventario permanece abierto en la pestaña anterior.</p></div>
      <div className="difference-controls">
        <label>Papel<select value={paper} onChange={event => setPaper(event.target.value as 'A5' | 'A4')}><option value="A5">A5 vertical</option><option value="A4">A4 vertical</option></select></label>
        <button type="button" onClick={() => window.location.reload()}>Actualizar datos</button>
        <button type="button" onClick={() => { flushSync(() => setPrintedAt(new Date().toISOString())); window.print() }}><Printer size={16} aria-hidden="true" />Imprimir</button>
        <button type="button" onClick={() => window.close()} aria-label="Cerrar vista previa"><X size={16} aria-hidden="true" /></button>
      </div>
      <p className="difference-print-tip">Revisa el papel y desactiva los encabezados y pies de página del navegador en el diálogo de impresión.</p>
    </nav>
    <DifferencePrintDocument data={data} printedAt={printedAt} />
  </main>
}
