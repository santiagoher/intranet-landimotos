'use client'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, X } from 'lucide-react'
import { cargarNotificacionesCompras, mutarCompra } from './actions'
import { eventos, fecha, type Notificacion } from './types'

export function ComprasNotifications(){
  const [items,setItems]=useState<Notificacion[]>([]);const [error,setError]=useState('');const [busy,setBusy]=useState('');const router=useRouter()
  const [open,setOpen]=useState(false)
  const [loading,setLoading]=useState(true)
  const container=useRef<HTMLDivElement>(null)
  const trigger=useRef<HTMLButtonElement>(null)
  const closeButton=useRef<HTMLButtonElement>(null)
  const panelId=useId()
  const titleId=useId()
  function close(){setOpen(false);trigger.current?.focus()}
  useEffect(()=>{
    if(!open)return
    closeButton.current?.focus()
    function outside(event:PointerEvent){if(!container.current?.contains(event.target as Node))setOpen(false)}
    function escape(event:KeyboardEvent){if(event.key==='Escape'){event.preventDefault();setOpen(false);trigger.current?.focus()}}
    document.addEventListener('pointerdown',outside)
    document.addEventListener('keydown',escape)
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)}
  },[open])
  useEffect(()=>{
    let alive=true,loading=false
    async function load(){
      if(loading||document.visibilityState==='hidden')return
      loading=true
      try{const result=await cargarNotificacionesCompras();if(alive){if(result.data){setItems(result.data);setError('')}else {setItems([]);setError(result.error??'No se pudieron cargar las notificaciones.')}}}
      catch{if(alive)setError('No se pudieron actualizar las notificaciones.')}
      finally{loading=false;if(alive)setLoading(false)}
    }
    void load();const timer=setInterval(()=>void load(),30000)
    const visible=()=>{if(document.visibilityState==='visible'){void load();router.refresh()}}
    window.addEventListener('focus',visible)
    return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',visible)}
  },[router])
  async function mark(id:string){setBusy(id);try{const result=await mutarCompra({accion:'leer_notificacion',id});if(result.error)setError(result.error);else {setItems(prev=>prev.filter(n=>n.id!==id));setError('')}}catch{setError('No se pudo marcar la notificación. Intenta nuevamente.')}finally{setBusy('')}}
  const count=items.length===50?'50+':String(items.length)
  return <div ref={container} className="relative shrink-0" onBlur={event=>{
    if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget as Node))setOpen(false)
  }}>
    <button ref={trigger} type="button" onClick={()=>setOpen(value=>!value)}
      className={`icon-button relative size-10 rounded-full border border-border ${open?'bg-active text-accent-foreground':'bg-surface text-muted hover:text-foreground'}`}
      aria-label={`Notificaciones de Compras${items.length?`, ${count} pendientes`:''}${error?', no se pudieron actualizar':''}`}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open?panelId:undefined} title="Notificaciones de Compras">
      <Bell className="size-5" aria-hidden="true"/>
      {items.length>0&&<span aria-hidden="true" className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-5 text-on-accent ring-2 ring-background">{count}</span>}
      {error&&items.length===0&&<span aria-hidden="true" className="absolute right-0 top-0 size-2.5 rounded-full bg-danger ring-2 ring-background"/>}
    </button>
    {open&&<section id={panelId} role="dialog" aria-labelledby={titleId}
      className="absolute right-0 top-full z-50 mt-3 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-surface shadow-xl">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div><h2 id={titleId} className="text-sm font-semibold">Notificaciones</h2><p className="mt-0.5 text-xs text-muted">Compras · {count} pendientes</p></div>
        <button ref={closeButton} type="button" onClick={close} className="icon-button" aria-label="Cerrar notificaciones"><X className="size-4" aria-hidden="true"/></button>
      </div>
      {error&&<p role="alert" className="border-b border-border bg-danger-soft px-4 py-3 text-xs text-danger">{error}</p>}
      <div className="max-h-[min(28rem,65dvh)] divide-y divide-border overflow-y-auto overscroll-contain">
        {loading?<p role="status" className="p-6 text-center text-sm text-muted">Cargando notificaciones…</p>:!items.length&&!error&&<div className="px-6 py-10 text-center"><Bell className="mx-auto mb-3 size-6 text-muted" aria-hidden="true"/><p className="text-sm font-medium">Estás al día</p><p className="mt-1 text-xs text-muted">No tienes notificaciones pendientes.</p></div>}
        {items.map(n=><article key={n.id} className="flex items-start gap-2 p-4 hover:bg-hover">
          <Link href={`/compras/registros/${n.revision_id}`} onClick={()=>setOpen(false)} className="min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <p className="break-words text-sm font-semibold text-accent-foreground">{eventos[n.tipo]??n.tipo} · {n.contexto.factura}</p>
            <p className="mt-1 text-xs text-muted">{n.contexto.proveedor} · Mesa {n.contexto.mesa} · {n.contexto.encargado}</p>
            <p className="mt-2 text-xs text-muted">{fecha(n.creado_at)}</p>
            {n.contexto.motivo&&<p className="mt-2 whitespace-pre-wrap break-words text-sm">{n.contexto.motivo}</p>}
            {n.contexto.observaciones?.length>0&&<p className="mt-2 text-xs text-muted">{n.contexto.observaciones.length} observaciones disponibles en el registro.</p>}
          </Link>
          <button type="button" disabled={!!busy} onClick={()=>void mark(n.id)} className="icon-button shrink-0" title="Marcar como leída" aria-label={`Marcar como leída la notificación de ${n.contexto.factura}`}><Check className="size-4" aria-hidden="true"/></button>
        </article>)}
      </div>
    </section>}
  </div>
}
