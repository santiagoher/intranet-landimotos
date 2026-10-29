import { formatInventoryDate } from '../types'
import { displayQuantity } from './quantity'
import { signedDifference, type DifferencePrintData } from './difference-print'

export function DifferencePrintDocument({ data, printedAt = data.generatedAt }: { data: DifferencePrintData; printedAt?: string }) {
  const pending = data.missingReference > 0 || data.pendingCount > 0
  return <article className="difference-sheet" aria-label="Diferencias de inventario">
    <header className="difference-heading">
      <div className="difference-brand"><strong>LANDIMOTOS</strong><span>CONTROL DE INVENTARIOS</span></div>
      <div className="difference-ticket">{data.ticket}</div>
      <h1>DIFERENCIAS DE INVENTARIO</h1>
    </header>
    {data.demo && <p className="difference-demo">DOCUMENTO DE PRUEBA — NO OFICIAL<br /><span>La columna ERP contiene referencias simuladas; no corresponde a existencias de G21.</span></p>}
    <dl className="difference-metadata">
      {[
        ['Bodega', data.warehouse], ['Categoría', data.category], ['Operador', data.operator], ['Líder', data.leader],
        ['Fecha del conteo', formatInventoryDate(data.countedAt)], ['Fecha y hora de impresión', formatInventoryDate(printedAt)],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
    {pending && <p className="difference-notice"><strong>Comparación pendiente.</strong> {data.missingReference} referencia(s) sin saldo teórico y {data.pendingCount} producto(s) sin conteo. Solo se incluyen las diferencias que ya pueden compararse; este documento es parcial.</p>}
    {!data.totalProducts && <p className="difference-notice">Comparación pendiente: este inventario no tiene productos registrados para comparar.</p>}
    {data.rows.length > 0 ? <table className="difference-table">
      <colgroup><col className="difference-col-code" /><col className="difference-col-name" /><col /><col /><col /><col /></colgroup>
      <thead><tr>{['Código SKU', 'Nombre del producto', 'ERP', 'Físico', 'Diferencia', 'Verificado'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
      <tbody>{data.rows.map(row => <tr key={row.id}>
        <td className="difference-code">{row.code}</td><td>{row.name}<small className="difference-unit">{row.unit ? `UM: ${row.unit}` : 'Unidad no registrada'}</small></td>
        <td className="difference-number">{displayQuantity(row.expected)}</td><td className="difference-number">{displayQuantity(row.counted)}</td>
        <td className="difference-number difference-value">{signedDifference(row.difference!)}<small>{row.difference!.startsWith('-') ? 'Faltante' : 'Sobrante'}</small></td>
        <td className="difference-verified" aria-label={`Cantidad verificada de ${row.code}`} />
      </tr>)}</tbody>
    </table> : <p className="difference-empty">{pending || !data.totalProducts ? 'No hay diferencias calculables para imprimir.' : 'Sin diferencias: las cantidades contadas coinciden con las referencias.'}</p>}
    <section className="difference-bottom">
      <dl className="difference-totals">
        <div><dt>Referencias con diferencias</dt><dd>{data.rows.length}</dd></div>
        <div><dt>Con faltantes</dt><dd>{data.shortages}</dd></div>
        <div><dt>Con sobrantes</dt><dd>{data.surpluses}</dd></div>
      </dl>
      <h2>Observaciones de verificación</h2>
      <div className="difference-note-lines" aria-label="Espacio para observaciones manuales"><div /><div /><div /></div>
      <footer>Documento de consulta · No aprueba el conteo ni modifica existencias.<br />Datos consultados: {formatInventoryDate(data.generatedAt)} · Versión {data.version} · Hora de Colombia</footer>
    </section>
  </article>
}
