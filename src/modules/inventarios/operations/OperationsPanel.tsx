'use client'

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { X, ArrowRight, ArrowLeft, Check, PackageCheck, MessageSquare, Printer } from 'lucide-react'
import { TablePagination } from '@/components/TablePagination'
import { inventoryFieldClass as field } from '../components/InventoryPrimitives'
import { formatInventoryDate } from '../types'
import { assignInventory, updateInventory, getTaskEvents, getTaskSnapshot, saveCountProduct, getTrialProducts } from './actions'
import { elapsed, progress, stateLabels, isVerified, taskCommands, hasCompleteReviewComparison, type OperationData, type Task, type Event, type CountProduct, type ComparisonProduct } from './types'
import { parseAssignmentReport, filterProducts, type AssignmentProduct, type ReportFilters } from './report'
import { ComparisonTable } from './ComparisonTable'
import { OperatorTaskList } from './OperatorTaskList'
import { LeaderMonitor } from './LeaderMonitor'
import { monitoredTasks } from './monitor'
import { TaskProgress as Bar, TaskStatus as Badge, PriorityBadge } from './TaskPresentation'
import { assignedByName, normalizePriority, priorities, priorityLabels, type Priority } from './task-list'
import { InventoryHistory } from './InventoryHistory'
import { EvidencePanel, type EvidenceViewerHandle } from './EvidencePanel'
import { CountRow } from './CountRow'
import { draftNeedsReview, type CountDraft } from './conflicts'
import './operator-experience.css'
import { useInventoryMonitor } from './useInventoryMonitor'

function Modal({ title, close, children, wide=false,operatorView=false,busy=false }: { title: string; close: () => void; children: ReactNode;wide?:boolean;operatorView?:boolean;busy?:boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [closing,setClosing]=useState(false)
  const closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null)
  useEffect(() => { ref.current?.showModal() }, [])
  useEffect(()=>()=>{if(closeTimer.current)clearTimeout(closeTimer.current)},[])
  const dismiss=()=>{if(busy||closing)return;if(!operatorView){close();return}setClosing(true);closeTimer.current=setTimeout(close,140)}
  return <dialog ref={ref} data-closing={closing} onCancel={e=>{e.preventDefault();dismiss()}} aria-label={title} className={`${operatorView?'inventory-operator ':''}m-auto max-h-[94dvh] ${wide?'w-[min(97vw,1080px)]':'w-[min(95vw,720px)]'} overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/60`}>
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface px-5 py-3"><h2 className="font-semibold">{title}</h2>
      <button type="button" disabled={busy||closing} className="icon-button" aria-label="Cerrar" onClick={dismiss}><X className="h-5 w-5" /></button></header>
    <div className="p-5 sm:p-7">{children}</div>
  </dialog>
}
function Wizard({ data, close }: { data: OperationData; close: () => void }) {
  const router = useRouter()
  const available = data.context.warehouses.filter(w => w.role === 'lider')
  const [step, setStep] = useState(0)
  const [warehouse, setWarehouse] = useState(available[0]?.id ?? '')
  const [category, setCategory] = useState('')
  const [operator, setOperator] = useState('')
  const [priority, setPriority] = useState<Priority>('media')
  const [note, setNote] = useState('')
  const [products,setProducts]=useState<AssignmentProduct[]>([])
  const [source,setSource]=useState<'report'|'trial'>('report')
  const [filters,setFilters]=useState<ReportFilters>({family:'',group:'',subgroup:'',brand:''})
  const [fileName,setFileName]=useState('')
  const [importing,setImporting]=useState(false)
  const [reportError,setReportError]=useState('')
  const selectedProducts=filterProducts(products,filters)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const requestKey = useRef<string | null>(null)
  const operators = data.context.members.filter(m => m.warehouseId === warehouse && m.role === 'operador')
  const categories = data.categories.filter(c => c.bodega_id === warehouse)
  function submit() {
    if (!requestKey.current) requestKey.current = crypto.randomUUID()
    start(async () => {
      try {
        const result = await assignInventory({ key: requestKey.current, warehouse, category, operator, priority,
          note, source, products: products.length ? selectedProducts : undefined })
        if (result.error) setError(result.error)
        else { router.refresh(); close() }
      } catch { setError('No se pudo confirmar la asignación. Reintenta con los mismos datos.') }
    })
  }
  return <Modal title="Asignar inventario" close={() => { if (!pending) close() }}>
    <div className="space-y-6">
      <div><div className="mb-3 flex justify-between text-sm"><span className="text-muted">Paso {step + 1} de 3</span><span>{['Contexto','Responsable','Confirmación'][step]}</span></div>
        <div className="flex gap-1.5" aria-hidden="true">{[0,1,2].map(n => <div key={n} className={`h-1 flex-1 rounded-full ${n <= step ? 'bg-blue-500' : 'bg-subtle'}`} />)}</div></div>
      {step === 0 && <div className="space-y-4">
        <label className="block space-y-2 text-sm">Bodega<select disabled={importing} className={field} value={warehouse} onChange={e => { setWarehouse(e.target.value); setCategory(''); setOperator(''); setProducts([]); setSource('report'); setFileName(''); setReportError(''); requestKey.current=null }}>
          {available.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
        <label className="block space-y-2 text-sm">Categoría<select className={field} value={category} onChange={e => { setCategory(e.target.value); requestKey.current=null }}>
          <option value="">Selecciona una categoría</option>{categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
        <div className="space-y-3 rounded-xl border border-border p-4">
          <button className="btn-secondary" type="button" disabled={importing || !warehouse} onClick={async()=>{
            setImporting(true);setReportError('');setProducts([]);setSource('report');setFileName('');requestKey.current=null
            try { const result=await getTrialProducts(warehouse);if(result.error)throw new Error(result.error)
              setProducts(result.products??[]);setSource('trial');setFileName('Catálogo de prueba');setFilters({family:'',group:'',subgroup:'',brand:''})
            }catch(cause){setReportError(cause instanceof Error?cause.message:'No se pudo cargar el catálogo de prueba.')}
            finally{setImporting(false)}
          }}>{importing?'Cargando…':'Usar productos de prueba'}</button>
          <p className="text-xs text-muted">Permite probar el proceso completo con productos y cantidades supuestos en la bodega seleccionada. Las cantidades de referencia permanecen ocultas al operador.</p>
          <label className="block space-y-2 text-sm font-medium">Reporte de productos (CSV UTF-8)
            <input key={warehouse} type="file" accept=".csv,text/csv" className={`${field} mt-2`} disabled={importing} onChange={async e=>{
              const file=e.target.files?.[0]; if(!file)return
              e.target.value=''
              setImporting(true);setError('');setReportError('');setProducts([]);setSource('report');setFileName('');requestKey.current=null
              try { if(file.size>2_000_000)throw new Error('El archivo supera 2 MB.'); const parsed=parseAssignmentReport(await file.text());setProducts(parsed);setSource('report');setFileName(file.name);setFilters({family:'',group:'',subgroup:'',brand:''}) }
              catch(cause){setReportError(cause instanceof Error?cause.message:'No se pudo leer el CSV.')}
              finally{setImporting(false);e.target.value=''}
            }} />
          </label>
          <p className="text-xs text-muted">Columnas: Código, Nombre y Cantidad; opcionalmente Familia, Grupo, Subgrupo y Marca. La cantidad se guarda como referencia protegida. Sin ella no se calculan diferencias; sin productos, la tarea se sigue por hitos.</p>
          {reportError&&<div role="alert" className="text-sm text-red-600 dark:text-red-300"><p>{reportError}</p><button type="button" className="btn-secondary mt-2" onClick={()=>setReportError('')}>Continuar sin reporte</button></div>}
          {!!products.length && <>
            <p className="text-xs text-muted">{fileName} · {products.length} productos</p>
            <div className="grid grid-cols-2 gap-3">{([['family','Familia'],['group','Grupo'],['subgroup','Subgrupo'],['brand','Marca']] as const).map(([key,label])=>{
              const options=filterProducts(products,{family:key==='family'?'':filters.family,group:['family','group'].includes(key)?'':filters.group,subgroup:key==='brand'?filters.subgroup:'',brand:''})
              return <label key={key} className="text-sm">{label}<select className={field} value={filters[key]} onChange={e=>{
                const value=e.target.value;setFilters(f=>({...f,[key]:value,...(key==='family'?{group:'',subgroup:'',brand:''}:key==='group'?{subgroup:'',brand:''}:key==='subgroup'?{brand:''}:{})}));requestKey.current=null
              }}><option value="">Todos</option>{[...new Set(options.map(p=>p[key]).filter(Boolean))].sort().map(v=><option key={v}>{v}</option>)}</select></label>
            })}</div>
            <p className="text-sm font-medium">{selectedProducts.length} productos para asignar</p>
            <div className="max-h-44 overflow-auto"><table className="data-table"><thead><tr><th>Código</th><th>Producto</th></tr></thead><tbody>{selectedProducts.slice(0,20).map(p=><tr key={p.code}><td>{p.code}</td><td>{p.name}</td></tr>)}</tbody></table></div>
            {selectedProducts.length>20&&<p className="text-xs text-muted">Vista previa de los primeros 20; se asignarán todos los productos filtrados.</p>}
            <p className="text-xs text-muted">{source==='trial'?'Datos de prueba. Se calcularán diferencias contra una referencia supuesta.':products.every(p=>p.expectedQuantity!==undefined)?'Incluye cantidades de referencia protegidas para calcular diferencias.':'Sin cantidad de referencia: permite contar, pero no calcular diferencias.'}</p>
            <button className="btn-secondary" type="button" onClick={()=>{setProducts([]);setSource('report');setFileName('');requestKey.current=null}}>Quitar reporte</button>
          </>}
        </div>
        <div><p className="mb-2 text-sm">Prioridad</p><div className="grid grid-cols-3 gap-2">{priorities.map(p =>
          <button key={p} type="button" aria-pressed={priority === p} onClick={() => { setPriority(p); requestKey.current=null }} className={`min-h-11 rounded-xl border px-3 text-sm capitalize ${priority === p ? 'border-blue-500 bg-blue-500/10' : 'border-border bg-subtle'}`}>{priorityLabels[p]}</button>)}</div></div>
        <label className="block space-y-2 text-sm">Indicaciones<textarea className={field} rows={3} maxLength={2000} value={note} onChange={e => { setNote(e.target.value); requestKey.current=null }} /></label>
      </div>}
      {step === 1 && <div className="space-y-3">
        <label className="block text-sm">Buscar operador<input className={`${field} mt-2`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre del operador" /></label>
        <div className="max-h-64 space-y-2 overflow-y-auto">{operators.filter(m => m.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(m =>
          <button key={m.id} aria-pressed={operator === m.id} onClick={() => { setOperator(m.id); requestKey.current=null }} className={`flex min-h-16 w-full items-center justify-between rounded-xl border p-4 text-left ${operator === m.id ? 'border-blue-500 bg-blue-500/10' : 'border-border bg-subtle'}`}>
            <span><span className="block text-sm font-medium">{m.name}</span><span className="text-xs text-muted">Operador activo de la bodega</span></span>{operator === m.id && <Check className="h-4 w-4 text-blue-500" />}</button>)}</div>
        {!operators.length && <p className="text-sm text-muted">No hay operadores vinculados. El administrador debe asignarlos desde Equipo y bodegas.</p>}
      </div>}
      {step === 2 && <div className="space-y-4"><dl className="space-y-4 rounded-xl border border-border bg-subtle p-5">
        {[
          ['Bodega', available.find(w => w.id === warehouse)?.name],
          ['Categoría', categories.find(c => c.id === category)?.nombre],
          ['Responsable', operators.find(m => m.id === operator)?.name],
          ['Prioridad', priorityLabels[priority]],
          ['Asignación', 'Se registra al confirmar, con la hora del servidor'],
          ['Alcance',products.length ? `${selectedProducts.length} productos · conteo ciego` : 'Categoría · seguimiento por hitos'],
          ['Origen',source==='trial'?'PRUEBA · productos y cantidades supuestos':'Reporte manual'],
        ].map(([label,value]) => <div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>)}</dl>
        <p className="text-xs leading-relaxed text-muted">{products.length ? 'El operador recibirá código, nombre y un campo vacío para su conteo.' : 'Permite registrar hitos y observaciones.'} No genera saldos ni ajustes de stock.</p></div>}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
      <div className="flex gap-3">{step > 0 && <button disabled={pending} className="btn-secondary" onClick={() => { setStep(step-1); setError('') }}><ArrowLeft className="h-4 w-4" /> Atrás</button>}
        <button disabled={pending || importing || !!reportError || (step === 0 && (!category || (products.length>0 && selectedProducts.length===0))) || (step === 1 && !operator)} className="btn-primary flex-1 justify-center" onClick={() => { if (step < 2) setStep(step+1); else submit() }}>
          {pending ? 'Asignando…' : step === 2 ? 'Asignar inventario' : 'Continuar'}<ArrowRight className="h-4 w-4" /></button></div>
    </div>
  </Modal>
}


function TaskDetail({ task:remoteTask, data, close, now }: { task: Task; data: OperationData; close: () => void; now: number }) {
  const [snapshot,setSnapshot]=useState<Task|null>(null)
  const task=snapshot&&snapshot.version>=remoteTask.version?{...remoteTask,...snapshot}:remoteTask
  const [drafts,setDrafts]=useState<Record<string,CountDraft>>({})
  const [loadedVersion,setLoadedVersion]=useState<number|null>(null)
  const [reviewRequired,setReviewRequired]=useState(false)
  const [reading,setReading]=useState(false)
  const readSequence=useRef(0),writeLock=useRef(false)
  const router = useRouter()
  const [note,setNote] = useState('')
  const [advance,setAdvance] = useState(Math.max(26,task.avance_parcial))
  const [events,setEvents] = useState<Event[]>([])
  const [historyError,setHistoryError]=useState('')
  const evidenceViewer=useRef<EvidenceViewerHandle>(null)
  const evidenceSection=useRef<HTMLDivElement>(null)
  const [products,setProducts]=useState<CountProduct[]>([])
  const [comparison,setComparison]=useState<ComparisonProduct[]>([])
  const [productError,setProductError]=useState('')
  const [productSearch,setProductSearch]=useState('')
  const [productPage,setProductPage]=useState(1)
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(true)
  const [pending,start] = useTransition()
  const [evidenceBlocked,setEvidenceBlocked]=useState(false)
  const warehouse = data.context.warehouses.find(w => w.id === task.bodega_id)
  const operator = warehouse?.role === 'operador' && task.asignado_a === data.context.userId
  const manager = !!warehouse && warehouse.role !== 'operador'
  const names = [...data.context.members,...data.context.users,...data.context.people]
  const name = (id: string | null) => names.find(m => m.id === id)?.name ?? (id ? id : 'Sin asignar')
  const refreshDetail=useCallback(async()=>{
    const sequence=++readSequence.current
    setReading(true);setLoadedVersion(null)
    try {
      const result=await getTaskSnapshot(remoteTask.id,manager)
      if(sequence!==readSequence.current)return false
      if(result.error||!result.task){setProductError(result.error??'No se pudo consultar la tarea.');return false}
      setSnapshot(result.task);setProducts(result.products??[]);setComparison(result.comparison??[])
      setLoadedVersion(result.task.version);setProductError('');return true
    }catch{if(sequence===readSequence.current)setProductError('No se pudo actualizar. Los valores sin guardar se conservan en este detalle.');return false}
    finally{if(sequence===readSequence.current)setReading(false)}
  },[remoteTask.id,manager])
  useEffect(()=>{
    const sequence=readSequence
    const timer=setTimeout(()=>void refreshDetail(),0)
    return()=>{clearTimeout(timer);sequence.current++}
  },[remoteTask.version,refreshDetail])
  useEffect(() => {
    let active = true
    if(manager)getTaskEvents(task.id).then(result => { if (active) { setEvents(result.events ?? []); setHistoryError(result.error ?? ''); setLoading(false) } })
      .catch(() => { if (active) { setHistoryError('No se pudo consultar el historial. Vuelve a abrir el inventario para reintentar.'); setLoading(false) } })
    return () => { active=false }
  }, [task.id, task.version, task.total_productos, manager])
  const commands=taskCommands(task,warehouse?.role,data.context.userId)
  const ready=!reading&&!productError&&loadedVersion===task.version
  const hasDrafts=Object.keys(drafts).length>0
  useEffect(()=>{
    if(!hasDrafts)return
    const preventLoss=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''}
    window.addEventListener('beforeunload',preventLoss)
    return()=>window.removeEventListener('beforeunload',preventLoss)
  },[hasDrafts])
  const comparisonReady=ready && hasCompleteReviewComparison(task,comparison)
  const differences=comparison.filter(p=>p.result==='faltante'||p.result==='sobrante').length
  function act(action: string) {
    if(writeLock.current||!ready||reviewRequired||hasDrafts)return
    writeLock.current=true
    start(async () => {
      try {
        const result = await updateInventory({ ticket: task.id, version: task.version, action, progress: action === 'avance' ? advance : null, note })
        if (result.error) {setError(result.error);if('conflict' in result&&result.conflict){setReviewRequired(true);await refreshDetail()}}
        else { setNote('');setError('');await refreshDetail();router.refresh() }
      } catch { setError('No se pudo confirmar el guardado. Revisa los datos actualizados antes de reintentar.');setReviewRequired(true);await refreshDetail() }
      finally{writeLock.current=false}
    })
  }
  function saveProduct(item:CountProduct){
    const draft=drafts[item.id]
    if(writeLock.current||!draft||!ready||reviewRequired||draftNeedsReview(draft,task.version))return
    writeLock.current=true
    start(async()=>{
      const preserve=()=>setDrafts(current=>({...current,[item.id]:{...draft,conflict:true}}))
      try {
        const result=await saveCountProduct({item:item.id,version:draft.version,quantity:draft.value.trim().replace(',','.')})
        if(result.error){setError(result.error);if('conflict' in result&&result.conflict){preserve();await refreshDetail()}}
        else{setDrafts(current=>{const next={...current};delete next[item.id];return next});setError('');await refreshDetail();router.refresh()}
      }catch{preserve();setError('No se pudo confirmar el guardado. Tu valor se conserva; compara con el último conteo guardado.');await refreshDetail()}
      finally{writeLock.current=false}
    })
  }
  const filteredProducts=products.filter(p=>`${p.code} ${p.name} ${(p.barcodes??[]).join(" ")}`.toLocaleLowerCase().includes(productSearch.toLocaleLowerCase()))
  const filteredComparison=comparison.filter(p=>`${p.code} ${p.name}`.toLocaleLowerCase().includes(productSearch.toLocaleLowerCase()))
  const productTotal=manager?filteredComparison.length:filteredProducts.length
  const productPages=Math.max(1,Math.ceil(productTotal/15))
  const currentProductPage=Math.min(productPage,productPages)
  const safeClose=()=>{if(!pending&&(!hasDrafts||window.confirm('Hay cantidades sin guardar. Si cierras el detalle se descartarán esos borradores. ¿Cerrar?')))close()}
  return <Modal wide operatorView={operator} busy={pending} title={task.numero} close={safeClose}>
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2"><Badge state={task.estado} differences={task.cierre_con_diferencias} /><PriorityBadge value={task.prioridad}/></div>
      {manager&&task.cierre_con_diferencias&&<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"><p className="font-medium">Diferencias confirmadas por el líder</p><p className="mt-1 whitespace-pre-wrap">{task.justificacion_cierre}</p><p className="mt-2 text-xs">Este cierre no modifica las existencias.</p></div>}
      {task.origen_creacion==='creado_por_operador'&&<p className="rounded-xl border border-border bg-subtle p-3 text-sm">Inventario creado por el operador. Pendiente de referencia y conciliación G21.</p>}
      {task.es_prueba&&<p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">DEMO · Inventario de prueba · productos y cantidades supuestos. No modifica las existencias reales.</p>}
      <div><p className="mb-1 text-xs font-medium text-muted">{operator?'Tu inventario':'Inventario'}</p><h3 className="text-xl font-semibold tracking-tight">{data.categories.find(c => c.id === task.categoria_id)?.nombre}</h3><p className="mt-1 text-sm text-muted">{warehouse?.name} · {formatInventoryDate(task.asignado_at)}</p></div>
      {operator&&<dl className="inv-summary">
        {[['Bodega',warehouse?.name],['Operador',name(task.asignado_a)],['Asignado por',assignedByName(task,data.context)],['Fecha de asignación',formatInventoryDate(task.asignado_at)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>}
      <div className={operator?'inv-progress-hero':'sticky top-14 z-10 border-b border-border bg-surface py-3'}><Bar task={task} /></div>
      {!!task.total_productos&&<section className={`${operator?'inv-detail-section ':''}space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">{operator&&<span className="inv-section-icon"><PackageCheck className="size-4" aria-hidden="true"/></span>}{manager?'Comparación de cantidades':'Conteo ciego de productos'}</h3>
          {manager&&<a className="btn-secondary" href={`/inventarios/registros/${task.id}/imprimir`} target="_blank" rel="noopener noreferrer" aria-label="Imprimir diferencias (abre vista previa en otra pestaña)"><Printer className="size-4" aria-hidden="true" />Imprimir diferencias</a>}
        </div>
        <p className="text-xs text-muted">{manager?'Diferencia = contado − referencia. Negativo: faltante; positivo: sobrante. Los pendientes no se comparan.':'No se muestran existencias esperadas. Cero es un conteo válido; una casilla vacía significa pendiente.'}</p>
        <input aria-label="Buscar o escanear producto" className={field} placeholder="Escanea un código o escribe SKU / nombre…" value={productSearch} onChange={e=>{setProductSearch(e.target.value);setProductPage(1)}} />
        {manager?<ComparisonTable products={filteredComparison.slice((currentProductPage-1)*15,currentProductPage*15)} />:<div className="overflow-x-auto"><table className="inv-count-table data-table"><thead><tr><th scope="col">Código</th><th scope="col">Producto</th><th scope="col">Cantidad contada</th><th scope="col">Estado</th></tr></thead><tbody>
          {filteredProducts.slice((currentProductPage-1)*15,currentProductPage*15).map(item=><CountRow key={item.id} item={item} version={task.version} draft={drafts[item.id]} editable={operator&&task.estado==='en_proceso'} busy={pending} ready={ready&&!reviewRequired}
            onChange={value=>setDrafts(current=>({...current,[item.id]:{...(current[item.id]??{version:task.version}),value}}))}
            onSave={()=>saveProduct(item)} onResolve={keep=>{setError('');setDrafts(current=>{const next={...current};if(keep&&next[item.id])next[item.id]={value:next[item.id].value,version:task.version};else delete next[item.id];return next})}}/>) }
        </tbody></table></div>}
        <TablePagination currentPage={currentProductPage} totalPages={productPages} totalItems={productTotal} pageSize={15} onPageChange={setProductPage} />
      </section>}
      {hasDrafts&&<p role="status" className="text-sm text-muted">Tienes {Object.keys(drafts).length} cantidad(es) sin guardar. Se conservan al filtrar o actualizar este detalle; guárdalas o descártalas antes de finalizar.</p>}
      {reading&&<p role="status" className="text-sm text-muted">Consultando la versión y los conteos actuales…</p>}
      {(productError||reviewRequired)&&<div role="alert" className="space-y-2 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-foreground">
        <p>{productError||'La tarea cambió. Revisa el estado y las cantidades actuales antes de repetir la acción. La observación escrita se conserva.'}</p>
        <button disabled={pending||reading} className="btn-secondary" onClick={()=>void refreshDetail()}>Consultar datos actuales</button>
        {reviewRequired&&ready&&<button disabled={pending} className="btn-secondary ml-2" onClick={()=>{setReviewRequired(false);setError('')}}>Ya revisé los datos actualizados</button>}
      </div>}
      {manager&&<details className="rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm font-medium">Información y tiempos del inventario</summary><dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">{[
        ['Bodega',warehouse?.name],['Operador',name(task.asignado_a)],['Asignado por',assignedByName(task,data.context)],['Líder responsable',name(task.lider_id)],
        ['Asignación',formatInventoryDate(task.asignado_at)],
        ['Inicio del conteo',formatInventoryDate(task.iniciado_at)],['Envío a revisión',formatInventoryDate(task.enviado_at)],
        ['Inicio de revisión',formatInventoryDate(task.verificacion_iniciada_at)],['Fin de revisión',formatInventoryDate(task.verificacion_finalizada_at)],['Cierre',formatInventoryDate(task.cerrado_at)],
        ['Desde asignación',elapsed(task.asignado_at,task.cerrado_at,now)],['Tiempo de ejecución',elapsed(task.iniciado_at,task.enviado_at,now)],
        ['Tiempo de verificación',elapsed(task.verificacion_iniciada_at,task.verificacion_finalizada_at,now)],
      ].map(([label,value]) => <div key={label}><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}</dl></details>}
      {task.observacion_inicial && <div className="inv-note rounded-xl bg-subtle p-4 text-sm"><p className="mb-2 flex items-center gap-2 text-xs font-semibold text-secondary"><MessageSquare className="size-4" aria-hidden="true"/>Indicaciones del inventario</p><p className="whitespace-pre-wrap">{task.observacion_inicial}</p></div>}
      <div ref={evidenceSection} tabIndex={-1} className="scroll-mt-20"><EvidencePanel ticket={task.id} editable={operator&&task.estado==='en_proceso'} onBlocked={setEvidenceBlocked} name={id=>name(id)} viewerRef={evidenceViewer}/></div>
      {!!commands.length && <div className="space-y-3 border-t border-border pt-4">
        {operator && task.estado === 'en_proceso' && !task.total_productos && <label className="block text-sm">Avance declarado (26–69%)
          <input className={`${field} mt-2`} type="number" min={Math.max(26,task.avance_parcial)} max={69} value={advance} onChange={e => setAdvance(Number(e.target.value))} /></label>}
        {(manager||!task.total_productos)&&<label className="block text-sm">{manager?'Observación de verificación':'Nota del avance'}<textarea className={`${field} mt-2`} rows={2} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></label>}
        {manager&&<p className="text-xs text-muted">La observación es obligatoria. Verificar y cerrar acepta el conteo y finaliza la revisión; no modifica las existencias. Devolver solicita un nuevo conteo al operador.</p>}
        {warehouse?.role==='lider'&&<p role="status" className="text-sm text-muted">{comparisonReady ? (differences ? `Se cerrará con diferencias en ${differences} producto(s). Revisa el detalle antes de confirmar.` : 'Se cerrará sin diferencias: las cantidades contadas coinciden con la referencia.') : 'Cierre no disponible: falta cargar la comparación completa o integrar las referencias del sistema.'}</p>}
        {!!task.total_productos && operator && task.estado==='en_proceso' && task.productos_contados!==task.total_productos && <p className="text-xs text-muted">Cuenta todos los productos para finalizar el trabajo.</p>}
        {operator&&evidenceBlocked&&<p className="text-xs text-muted">Guarda las observaciones y resuelve las cargas pendientes antes de finalizar.</p>}
        <div className="flex flex-wrap gap-2">{commands.map(([action,label]) => <button key={action} disabled={pending || !ready || reviewRequired || hasDrafts || (manager&&!note.trim()) || (action==='verificar_cerrar'&&!comparisonReady) || (action==='finalizar' && (evidenceBlocked|| (!!task.total_productos && task.productos_contados!==task.total_productos)))} className={['finalizar','verificar_cerrar'].includes(action)?'btn-primary':'btn-secondary'} onClick={() => act(action)}>{pending ? 'Guardando…' : label}</button>)}</div>
      </div>}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
      {manager&&<InventoryHistory task={task} events={events} loading={loading} error={historyError} name={name} warehouse={warehouse.name} category={data.categories.find(c=>c.id===task.categoria_id)?.nombre??'Sin categoría'} admin={warehouse.role==='administrador'} onEvidence={id=>{evidenceSection.current?.scrollIntoView({block:'center'});evidenceSection.current?.focus({preventScroll:true});void evidenceViewer.current?.open(id)}}/>}
    </div>
  </Modal>
}

export function TeamPanel({ data }: { data: OperationData }) {
  const [warehouse,setWarehouse] = useState(data.context.warehouses[0]?.id ?? '')
  if (!data.context.globalAdmin) return null
  return <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
    <h2 className="font-semibold">Equipo y bodegas</h2>
    <p className="text-sm text-muted">Consulta de líderes y operadores vinculados. Administración realiza seguimiento; la operación corresponde al líder.</p>
    <div className="max-w-sm">
      <label className="text-sm">Bodega<select className={field} value={warehouse} onChange={e => setWarehouse(e.target.value)}>{data.context.warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
    </div>
    <ul className="divide-y divide-border">{data.context.members.filter(m => m.warehouseId === warehouse).map(m => <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
      <span>{m.name} · {m.role}{m.leader ? ' responsable' : ''}</span>
    </li>)}</ul>
  </section>
}

export function OperationsPanel({ data:initialData, initialNow, reports = false, initialTicket }: { data: OperationData; initialNow: number; reports?: boolean; initialTicket?:string }) {
  const monitor=useInventoryMonitor(initialData,reports)
  const data=monitor.data
  const now=Math.max(initialNow,data.fetchedAt)
  const [wizard,setWizard] = useState(false)
  const [team,setTeam] = useState(false)
  const [detail,setDetail] = useState<string | null>(initialTicket??null)
  const [search,setSearch] = useState('')
  const [warehouse,setWarehouse] = useState('')
  const [state,setState] = useState('')
  const [priority,setPriority] = useState('')
  const [origin,setOrigin] = useState('')
  const [group,setGroup] = useState('state')
  const [page,setPage] = useState(1)
  const refreshNotice=monitor.error?<div role="status" className="mb-4 rounded-xl border border-border bg-subtle p-4 text-sm">{monitor.error}<button type="button" className="btn-secondary ml-3" onClick={monitor.retry}>Reintentar actualización</button></div>:null
  const name = (id: string | null) => [...data.context.members,...data.context.users,...data.context.people].find(m => m.id === id)?.name ?? 'Sin asignar'
  const warehouseName = (id: string) => data.context.warehouses.find(w => w.id === id)?.name ?? 'Bodega'
  const category = (id: string) => data.categories.find(c => c.id === id)?.nombre ?? 'Categoría'
  const manager = data.context.globalAdmin || data.context.warehouses.some(w => w.role !== 'operador')
  const leader = data.context.warehouses.some(w => w.role === 'lider')
  if(monitor.blocked)return <div role="alert" className="space-y-3 p-6"><p>{monitor.error}</p><button className="btn-secondary" onClick={()=>window.location.reload()}>Verificar acceso</button></div>
  if (!manager) {
    const selected = data.tasks.find(t=>t.id===detail && t.asignado_a===data.context.userId && data.context.warehouses.some(w=>w.id===t.bodega_id&&w.role==='operador'))
    return <>{refreshNotice}<OperatorTaskList data={data} onOpen={setDetail}/>{selected&&<TaskDetail key={selected.id} task={selected} data={data} close={()=>setDetail(null)} now={now}/>}</>
  }
  if (!reports) {
    const selected = monitoredTasks(data).find(t => t.id === detail)
    return <>{refreshNotice}<LeaderMonitor data={data} now={now} onOpen={setDetail}
      onAssign={leader ? () => setWizard(true) : undefined}
      onTeam={data.context.globalAdmin ? () => setTeam(!team) : undefined}
      team={team ? <TeamPanel data={data}/> : undefined}/>
      {wizard && <Wizard data={data} close={() => setWizard(false)}/>}
      {selected && <TaskDetail key={selected.id} task={selected} data={data} close={() => setDetail(null)} now={now}/>}
    </>
  }
  const tasks = data.tasks.filter(t => (!warehouse || t.bodega_id === warehouse) && (!state || t.estado === state) && (!priority || normalizePriority(t.prioridad) === priority)
    && (!origin || (origin==='trial'?!!t.es_prueba:!t.es_prueba))
    && `${t.numero} ${category(t.categoria_id)} ${name(t.asignado_a)}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    .sort((a,b) => b.asignado_at.localeCompare(a.asignado_at))
  const grouped = new Map<string,Task[]>()
  const groupKey = (t: Task) => group === 'warehouse' ? t.bodega_id : group === 'operator' ? t.asignado_a ?? 'none' : group === 'leader' ? t.lider_id ?? 'none' : stateLabels[t.estado] ?? t.estado
  const groupLabel = (id: string) => group === 'warehouse' ? warehouseName(id) : ['operator','leader'].includes(group) ? name(id === 'none' ? null : id) : id
  if (group === 'state') ['Asignado','En proceso','Finalizado por operador','En verificación','Verificado','Con diferencias','Cerrado'].forEach(k => grouped.set(k,[]))
  for (const task of tasks) { const k=groupKey(task); grouped.set(k,[...(grouped.get(k) ?? []),task]) }
  const completed = tasks.filter(t => t.enviado_at)
  const durations = completed.filter(t => t.iniciado_at).map(t => Date.parse(t.enviado_at!) - Date.parse(t.iniciado_at!))
  const average = durations.length ? `${Math.round(durations.reduce((a,b)=>a+b,0)/durations.length/60000)} min` : '—'
  const verifications = tasks.filter(t=>t.verificacion_iniciada_at && t.verificacion_finalizada_at)
  const averageVerification = verifications.length ? `${Math.round(verifications.reduce((n,t)=>n+Date.parse(t.verificacion_finalizada_at!)-Date.parse(t.verificacion_iniciada_at!),0)/verifications.length/60000)} min` : '—'
  const stats = [['Finalizadas por operador',completed.length],['Tiempo promedio de ejecución',average],['Tiempo promedio de verificación',averageVerification],['Verificadas sin diferencias',tasks.filter(isVerified).length],['Con diferencias por resolver',tasks.filter(t => t.estado==='verificado_con_diferencias').length],['Cerradas con diferencias',tasks.filter(t=>t.cierre_con_diferencias).length]]
  const selected = data.tasks.find(t => t.id === detail)
  const summaries=new Map((data.reconciliations??[]).map(r=>[r.ticketId,r]))
  const pages = Math.max(1,Math.ceil(tasks.length/15))
  const current = Math.min(page,pages)
  return <div className="space-y-6 pb-6">
    {refreshNotice}
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">{data.context.globalAdmin ? 'Control global' : manager ? 'Supervisión de bodega' : 'Mi trabajo'}</p>
      <h1 className="page-title">{reports ? 'Reportes de inventarios' : manager?'Tareas de inventario':'Mis inventarios'}</h1>
      <p className="mt-2 text-sm text-muted">{reports ? 'Resultados y carga de trabajo del alcance autorizado.' : leader?'Asigna, acompaña y verifica el trabajo de cada bodega.':manager?'Consulta el avance y la trazabilidad de las bodegas.':'Realiza el conteo de tus tareas asignadas.'}</p></div>
    </header>
    <p className="rounded-xl border border-border bg-subtle p-4 text-sm text-muted">{leader?'Como líder puedes asignar, revisar, solicitar reconteos y cerrar tareas. El operador cuenta sin ver las referencias.':manager?'Administración: consulta y seguimiento de tareas, diferencias, responsables e historial. El líder se encarga de la operación.':'Abre tu tarea, inicia el conteo y registra la cantidad que encuentres de cada producto.'} Las tareas de prueba se identifican por separado y no modifican existencias reales.</p>
    {team && <TeamPanel data={data} />}
    {!!data.notifications?.length&&<section className="rounded-xl border border-border bg-surface p-4"><h2 className="text-sm font-semibold">Avisos recientes de inventarios</h2><ul className="mt-2 space-y-2">{data.notifications.map(n=><li key={n.id} className="text-sm"><button className="text-left hover:underline" onClick={()=>setDetail(n.ticket_id)}>{data.tasks.find(t=>t.id===n.ticket_id)?.numero??'Inventario'}: {n.tipo==='iniciado'?'operador inició un inventario':n.tipo==='verificacion_pendiente'?'conteo pendiente de revisión':n.tipo.replaceAll('_',' ')} · {formatInventoryDate(n.created_at)}</button></li>)}</ul></section>}
    <div className="flex flex-wrap gap-3">
      <input aria-label="Buscar tareas" className={`${field} sm:max-w-xs`} placeholder="Buscar ticket, categoría u operador…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} />
      <select aria-label="Filtrar bodega" className={`${field} sm:max-w-48`} value={warehouse} onChange={e=>{setWarehouse(e.target.value);setPage(1)}}><option value="">Todas mis bodegas</option>{data.context.warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>
      <select aria-label="Filtrar estado" className={`${field} sm:max-w-52`} value={state} onChange={e=>{setState(e.target.value);setPage(1)}}><option value="">Todos los estados</option>{Object.entries(stateLabels).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
      <select aria-label="Filtrar prioridad" className={`${field} sm:max-w-44`} value={priority} onChange={e=>{setPriority(e.target.value);setPage(1)}}><option value="">Toda prioridad</option>{priorities.map(p=><option key={p} value={p}>{priorityLabels[p]}</option>)}</select>
      <select aria-label="Filtrar origen" className={`${field} sm:max-w-48`} value={origin} onChange={e=>{setOrigin(e.target.value);setPage(1)}}><option value="">Todos los orígenes</option><option value="trial">Solo pruebas</option><option value="report">Excluir pruebas</option></select>
      {manager && <select aria-label="Agrupar por" className={`${field} sm:max-w-44`} value={group} onChange={e=>setGroup(e.target.value)}>{[['state','Por estado'],['warehouse','Por bodega'],['leader','Por líder'],['operator','Por operador']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>}
    </div>
    <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">{stats.map(([label,value])=><div key={label} className="rounded-xl border border-border bg-surface p-4"><dt className="text-xs text-muted">{label}</dt><dd className="mt-2 text-2xl font-semibold">{value}</dd></div>)}</dl>
    <div className="overflow-x-auto rounded-xl border border-border bg-surface"><table className="data-table">
      <caption className="px-5 py-4 text-left text-sm font-medium">Seguimiento por {group === 'leader' ? 'líder' : group === 'operator' ? 'operador' : group === 'state' ? 'estado' : 'bodega'}</caption>
      <thead><tr>{['Grupo','Tareas','Avance medio','Verificadas / total','Pendientes de revisión'].map(h=><th key={h}>{h}</th>)}</tr></thead>
      <tbody>{[...grouped].map(([label,list])=><tr key={label}><td>{groupLabel(label)}</td><td>{list.length}</td><td>{list.length ? `${Math.round(list.reduce((n,t)=>n+progress(t),0)/list.length)}%` : '—'}</td>
        <td>{list.length ? `${Math.round(list.filter(isVerified).length/list.length*100)}%` : '—'}</td><td>{list.filter(t=>t.estado==='enviado_verificacion').length}</td></tr>)}</tbody>
    </table></div>
    {reports&&manager&&<section className="space-y-3">
      <h2 className="font-semibold">Informe detallado por tarea</h2>
      <p className="text-sm text-muted">Los resultados indican cuántos productos coinciden, faltan o sobran. Abre una tarea para consultar cantidades, responsables y la trazabilidad desde su asignación. Las tareas sin referencia no se presentan como coincidencias.</p>
      <div className="overflow-x-auto rounded-xl border border-border bg-surface"><table className="data-table"><thead><tr>{['Tarea / origen','Bodega / asignado a','Asignado por','Estado','Contados','Coinciden','Faltantes','Sobrantes','Sin referencia','Asignación','Detalle'].map(h=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>{tasks.slice((current-1)*15,current*15).map(t=>{const result=summaries.get(t.id);return <tr key={t.id}>
          <td>{t.numero}<span className="block text-xs text-muted">{t.es_prueba?'Prueba':'Reporte manual'}</span></td><td>{warehouseName(t.bodega_id)}<span className="block text-xs text-muted">{name(t.asignado_a)}</span></td>
          <td>{assignedByName(t,data.context)}</td><td><Badge state={t.estado} differences={t.cierre_con_diferencias}/></td><td>{t.productos_contados??0} / {t.total_productos??0}</td><td>{result?.matched??'—'}</td><td>{result?.shortages??'—'}</td><td>{result?.surpluses??'—'}</td><td>{result?.missingReference??'—'}</td>
          <td>{formatInventoryDate(t.asignado_at)}</td><td><button className="btn-secondary" onClick={()=>setDetail(t.id)}>Ver detalle</button></td>
        </tr>})}</tbody></table></div>
      {!tasks.length&&<p className="text-sm text-muted">No hay tareas para los filtros seleccionados.</p>}
      <TablePagination currentPage={current} totalPages={pages} totalItems={tasks.length} pageSize={15} onPageChange={setPage}/>
    </section>}
    {wizard && <Wizard data={data} close={()=>setWizard(false)} />}
    {selected && <TaskDetail key={selected.id} task={selected} data={data} close={()=>setDetail(null)} now={now} />}
  </div>
}
