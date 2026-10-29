'use client'
import type {CountProduct} from './types'
import {displayQuantity} from './quantity'
import {draftNeedsReview,type CountDraft} from './conflicts'
import {inventoryFieldClass as field} from '../components/InventoryPrimitives'

export function CountRow({item,version,draft,editable,busy,ready,onChange,onSave,onResolve}:{
  item:CountProduct;version:number;draft?:CountDraft;editable:boolean;busy:boolean;ready:boolean;
  onChange:(value:string)=>void;onSave:()=>void;onResolve:(keep:boolean)=>void;
}) {
  const quantity=draft?.value??(item.quantity===null?'':displayQuantity(item.quantity))
  const conflict=draftNeedsReview(draft,version)
  return <tr><td><span className="font-semibold">{item.code}</span><span className="block text-xs text-muted">{item.barcodes?.join(' · ')}</span></td><td>{item.name}<span className="block text-xs text-muted">{item.unit}</span></td><td className="tabular-nums">
    {editable?<div className="flex min-w-40 items-center gap-2"><input aria-label={`Cantidad contada de ${item.code}`} inputMode="decimal" disabled={busy||!ready} className={`${field} max-w-32 tabular-nums`} value={quantity} onChange={e=>onChange(e.target.value)}/><button className="btn-secondary" disabled={busy||!ready||conflict||!draft||!quantity.trim()} onClick={onSave}>Guardar</button></div>:displayQuantity(item.quantity)}
    {draft&&conflict&&<div role="alert" className="mt-2 space-y-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-foreground">
      <p>La tarea cambió. Tu valor sin guardar: <strong>{draft.value||'vacío'}</strong>.</p>
      <p>Último conteo guardado: <strong>{item.quantity===null?'Sin contar':displayQuantity(item.quantity)}</strong>. No es la existencia esperada.</p>
      {!ready?<p>Consulta los datos actuales antes de decidir.</p>:editable?<div className="flex flex-wrap gap-2"><button disabled={busy} className="btn-secondary" onClick={()=>onResolve(false)}>Usar cantidad guardada</button><button disabled={busy} className="btn-secondary" onClick={()=>onResolve(true)}>Conservar mi valor para reintentar</button></div>:<p>La tarea ya no permite editar. Puedes copiar tu valor para consultarlo con el líder.</p>}
    </div>}
  </td><td><span data-tone={item.quantity===null?'neutral':'success'} className={`inv-badge rounded-md px-2 py-1 text-xs ${item.quantity===null?'bg-subtle text-muted':'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'}`}>{item.quantity===null?'Pendiente':'Contado'}</span></td></tr>
}
