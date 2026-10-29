'use client'
/* eslint-disable @next/next/no-img-element -- Short-lived private URLs and local upload previews. */
import {useEffect,useRef,useState,useImperativeHandle,type Ref} from 'react'
import {Camera,Trash2,X,ImagePlus,MessageSquare} from 'lucide-react'
import {inventoryFieldClass as field} from '../components/InventoryPrimitives'
import {formatInventoryDate} from '../types'
import {getEvidence,uploadEvidence,deleteEvidence,saveCountNote} from './evidence.actions'
import type {Evidence,CountNote} from './evidence-types'
import {startPolling} from '../../../utils/polling'

function PhotoViewer({url,close}:{url:string;close:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null)
  useEffect(()=>{dialog.current?.showModal()},[])
  return <dialog ref={dialog} onCancel={close} aria-label="Fotografía de evidencia" className="m-auto max-h-[95dvh] max-w-[95vw] rounded-xl bg-surface p-3 text-foreground backdrop:bg-black/75"><button className="icon-button ml-auto" onClick={close} aria-label="Cerrar fotografía"><X className="size-5"/></button><img src={url} alt="Evidencia ampliada del inventario" className="max-h-[80dvh] max-w-full object-contain"/></dialog>
}
export interface EvidenceViewerHandle {open:(id:string)=>Promise<void>}
export function EvidenceGallery({items,editable,uploadsEnabled,busy,name,onOpen,onRemove,onAdd}:{items:Evidence[];editable:boolean;uploadsEnabled:boolean;busy:boolean;name:(id:string)=>string;onOpen:(url:string)=>void;onRemove:(id:string)=>void;onAdd:()=>void}) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{items.map(item=><div key={item.id} className="inv-photo min-w-0 space-y-2 rounded-xl border border-border bg-surface p-2">
    {item.url?<button className="group block w-full rounded-lg focus-visible:outline-2 focus-visible:outline-accent" onClick={()=>onOpen(item.url!)} aria-label={`Ampliar ${item.nombre_original}`}><img src={item.url} alt={item.nombre_original} className="aspect-[4/3] max-h-52 w-full rounded-lg bg-subtle object-contain transition-opacity group-hover:opacity-90 motion-reduce:transition-none"/></button>:<div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-subtle p-2 text-center text-xs text-muted">{item.estado==='vigente'?'Vista previa no disponible':'Carga pendiente'}</div>}
    <div className="px-1 py-1"><p className="break-words text-xs font-medium text-secondary">{name(item.usuario_id)}</p><p className="mt-1 text-[11px] text-muted">{formatInventoryDate(item.uploaded_at??item.created_at)}</p></div>
    {editable&&uploadsEnabled&&<button disabled={busy} className="flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs text-danger transition-colors hover:bg-danger-soft" onClick={()=>onRemove(item.id)} aria-label={`Eliminar ${item.nombre_original}`}><Trash2 className="size-3.5"/>Eliminar</button>}
  </div>)}{editable&&uploadsEnabled&&items.length<3&&<button disabled={busy} className={`${items.length===2?'col-span-full sm:col-span-1 ':''}inv-add-photo flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-subtle p-3 text-accent-foreground`} onClick={onAdd} aria-label="Agregar fotografía"><span className="rounded-full bg-accent-soft p-3"><ImagePlus className="size-5" aria-hidden="true"/></span><span className="text-xs font-semibold">Agregar evidencia</span><span className="text-[11px] text-muted">{3-items.length} {3-items.length===1?'espacio disponible':'espacios disponibles'}</span></button>}
    {!items.length&&!editable&&<p className="col-span-full rounded-lg bg-subtle p-4 text-sm text-muted">Sin evidencias fotográficas.</p>}
  </div>
}
export function EvidencePanel({ticket,editable,onBlocked,name,viewerRef}:{ticket:string;editable:boolean;onBlocked:(value:boolean)=>void;name:(id:string)=>string;viewerRef?:Ref<EvidenceViewerHandle>}){
  const [items,setItems]=useState<Evidence[]>([]),[saved,setSaved]=useState<CountNote|null>(null),[note,setNote]=useState('')
  const [enabled,setEnabled]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const [uploadsEnabled,setUploadsEnabled]=useState(false)
  const [noteConflict,setNoteConflict]=useState(false),[noteReviewed,setNoteReviewed]=useState(false)
  const [noteBaseVersion,setNoteBaseVersion]=useState<number|null>(null)
  const [preview,setPreview]=useState<string|null>(null),[zoom,setZoom]=useState<string|null>(null)
  const file=useRef<HTMLInputElement>(null),camera=useRef<HTMLInputElement>(null),dirty=useRef(false),inFlight=useRef(false)
  const modified=note!==(saved?.texto??'')
  const noteStale=noteConflict||(modified&&noteBaseVersion!==null&&noteBaseVersion!==(saved?.version??0))
  useImperativeHandle(viewerRef,()=>({open:async(id:string)=>{
    try {
      const result=await getEvidence(ticket)
      if(result.error){setError(result.error);return}
      const photo=result.items?.find(item=>item.id===id&&item.estado==='vigente')
      if(photo?.url){setError('');setZoom(photo.url)}
      else setError('Esta evidencia fue retirada o no está disponible para visualizar. Su registro permanece en el historial.')
    } catch {setError('No se pudo abrir la evidencia. Inténtalo nuevamente.')}
  }}),[ticket])
  useEffect(()=>{dirty.current=modified},[modified])
  useEffect(()=>{
    let active=true
    const poll=startPolling({initial:true,interval:240000,canRun:()=>document.visibilityState==='visible'&&navigator.onLine&&!inFlight.current,
      run:async()=>{try{const r=await getEvidence(ticket);if(!active)return false
        if(r.error){setError(r.error);return false}
        setItems(r.items??[]);setSaved(r.note??null);if(!dirty.current){setNote(r.note?.texto??'');setNoteBaseVersion(null)}setEnabled(r.enabled??false);setUploadsEnabled(r.uploadsEnabled??false);return true
      }catch{if(active)setError('No se pudieron consultar las evidencias. Vuelve a abrir el detalle para reintentar.');return false}
      finally{if(active)setLoading(false)}}})
    return()=>{active=false;poll.stop()}
  },[ticket])
  useEffect(()=>{onBlocked(editable&&(loading||busy||modified||noteStale||items.some(i=>i.estado!=='vigente')))},[editable,loading,busy,modified,noteStale,items,onBlocked])
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview)},[preview])
  async function reload(){try{const r=await getEvidence(ticket);if(r.error){setError(r.error);return false}setItems(r.items??[]);setSaved(r.note??null);setEnabled(r.enabled??false);setUploadsEnabled(r.uploadsEnabled??false);return true}catch{setError('No se pudo consultar la observación actual. Tu texto se conserva.');return false}}
  async function refreshNoteConflict(){setNoteReviewed(false);setNoteReviewed(await reload())}
  async function upload(selected:File|undefined){
    if(!selected||inFlight.current)return
    if(!['image/jpeg','image/png','image/webp'].includes(selected.type)||selected.size>5*1024*1024){setError('Utiliza JPEG, PNG o WebP de hasta 5 MB.');return}
    if(items.length>=3){setError('Ya tienes tres fotografías. Retira una para reemplazarla.');return}
    inFlight.current=true;setBusy(true);setError('');setPreview(URL.createObjectURL(selected))
    try{const form=new FormData();form.set('ticket',ticket);form.set('id',crypto.randomUUID());form.set('file',selected)
      const result=await uploadEvidence(form);if(result.error)setError(result.error);await reload()
    }catch{setError('No se pudo confirmar la carga. Actualiza las evidencias antes de reintentar.')}
    finally{inFlight.current=false;setBusy(false);setPreview(null)}
  }
  async function remove(id:string){
    if(inFlight.current)return
    inFlight.current=true;setBusy(true);setError('')
    try{const r=await deleteEvidence(ticket,id);if(r.error)setError(r.error);await reload()}catch{setError('No se pudo eliminar. Reintenta para completar la limpieza.')}
    finally{inFlight.current=false;setBusy(false)}
  }
  async function save(){
    if(inFlight.current||noteStale)return
    inFlight.current=true;setBusy(true);setError('')
    try{const r=await saveCountNote(ticket,note,noteBaseVersion??saved?.version??0);if(r.error){setError(r.error);if(r.conflict){setNoteConflict(true);await refreshNoteConflict()}}else{dirty.current=false;setNoteBaseVersion(null);await reload()}}
    catch{setError('No se pudo confirmar el guardado. Revisa el texto actual antes de reintentar.');setNoteConflict(true);await refreshNoteConflict()}
    finally{inFlight.current=false;setBusy(false)}
  }
  return <section className="inv-detail-section space-y-4 rounded-xl border border-border bg-subtle p-4">
    <h3 className="flex items-center gap-2 text-sm font-semibold"><span className="inv-section-icon"><MessageSquare className="size-4" aria-hidden="true"/></span>Observaciones y evidencias</h3>
    {loading?<p role="status" className="text-sm text-muted">Consultando evidencias…</p>:<>
      {!enabled&&<p className="text-sm text-muted">Las evidencias están pendientes de habilitación en el servidor.</p>}
      {enabled&&!uploadsEnabled&&<p className="text-sm text-muted">Las fotografías están pendientes de configurar. Puedes guardar tus observaciones.</p>}
      {editable&&enabled?<><label className="block text-sm font-medium">Observación del conteo<textarea className={`${field} mt-2`} placeholder="Describe lo que encontraste durante el conteo…" rows={3} maxLength={2000} value={note} disabled={busy} onChange={e=>{dirty.current=true;setNoteBaseVersion(value=>value??saved?.version??0);setNote(e.target.value)}}/></label><button disabled={busy||!modified||noteStale} className="btn-secondary" onClick={()=>void save()}>Guardar observaciones</button>{modified&&<span className="ml-2 text-xs text-muted">Cambios sin guardar</span>}</>:<p className="inv-note whitespace-pre-wrap text-sm">{saved?.texto||'Sin observaciones registradas.'}</p>}
      {noteStale&&<div role="alert" className="space-y-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm text-foreground"><p>La observación cambió. Revisa ambos textos antes de guardar.</p><p className="whitespace-pre-wrap">Tu borrador: {note||'Vacío'}</p><p className="whitespace-pre-wrap">Último texto guardado: {saved?.texto||'Sin observación'}</p><button disabled={busy} className="btn-secondary" onClick={()=>void refreshNoteConflict()}>Consultar texto actual</button>{noteReviewed&&<button disabled={busy} className="btn-secondary ml-2" onClick={()=>{setNoteBaseVersion(saved?.version??0);setNoteConflict(false);setNoteReviewed(false);setError('')}}>Revisé el texto; conservar mi borrador</button>}</div>}
      {saved&&<p className="text-xs text-muted">{name(saved.usuario_id)} · {formatInventoryDate(saved.updated_at)}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-medium">Evidencias fotográficas ({items.length} de 3)</h4>{editable&&uploadsEnabled&&<button disabled={busy||items.length>=3} className="btn-secondary" onClick={()=>camera.current?.click()}><Camera className="size-4"/>Tomar foto</button>}</div>
      <input ref={file} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{void upload(e.target.files?.[0]);e.target.value=''}}/>
      <input ref={camera} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>{void upload(e.target.files?.[0]);e.target.value=''}}/>
      <EvidenceGallery items={items} editable={editable} uploadsEnabled={uploadsEnabled} busy={busy} name={name} onOpen={setZoom} onRemove={id=>void remove(id)} onAdd={()=>file.current?.click()}/>
      {preview&&<div className="flex items-center gap-3"><img src={preview} alt="Fotografía en carga" className="size-12 rounded-md object-cover"/><p role="status" className="text-xs text-muted">Validando y subiendo fotografía…</p><progress aria-label="Carga de fotografía" className="h-1 w-20"/></div>}
      {busy&&!preview&&<p role="status" className="text-xs text-muted">Guardando cambios…</p>}
      {editable&&enabled&&<p className="text-xs text-muted">Hasta 3 fotos · JPEG, PNG o WebP · máximo 5 MB cada una. Se conservan al entregar el conteo.</p>}
    </>}
    {error&&<div role="alert" className="text-sm text-red-700 dark:text-red-300"><p>{error}</p><button className="btn-secondary mt-2" disabled={busy} onClick={()=>void reload()}>Actualizar evidencias</button></div>}
    {zoom&&<PhotoViewer url={zoom} close={()=>setZoom(null)}/>}
  </section>
}
