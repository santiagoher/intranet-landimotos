import type { ComparisonProduct } from './types'

const labels={pendiente:'Pendiente de conteo',sin_referencia:'Sin referencia',coincide:'Coincide',faltante:'Faltante',sobrante:'Sobrante'}
const decimal=(value:string)=>value.includes('.')?value.replace(/0+$/,'').replace(/\.$/,''):value
export function ComparisonTable({products}:{products:ComparisonProduct[]}) {
  return <div className="overflow-x-auto"><table className="data-table">
    <thead><tr>{['Código','Producto','Referencia','Contado','Diferencia','Resultado'].map(label=><th key={label}>{label}</th>)}</tr></thead>
    <tbody>{products.map(p=><tr key={p.id}><td>{p.code}</td><td>{p.name}</td><td>{p.expected===null?'Sin referencia':decimal(p.expected)}</td><td>{p.counted===null?'Pendiente':decimal(p.counted)}</td><td>{p.difference===null?'—':decimal(p.difference)}</td>
      <td><span className={`badge ${p.result==='coincide'?'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300':p.result==='faltante'||p.result==='sobrante'?'bg-amber-500/10 text-amber-700 dark:text-amber-300':'bg-subtle text-muted'}`}>{labels[p.result]}</span></td></tr>)}</tbody>
  </table></div>
}
