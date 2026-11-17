'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { guardarMesaCompras } from './actions'
import { inputClass } from './components'
import type { Encargado } from './types'

function EncargadoRow({persona}:{persona:Encargado}) {
  const [mesa,setMesa]=useState(persona.mesa_id?String(persona.mesa_id):'')
  const [activo,setActivo]=useState(persona.activo)
  const [message,setMessage]=useState('');const [error,setError]=useState('')
  const [pending,start]=useTransition();const router=useRouter()
  return <form className="grid items-end gap-4 rounded-xl border border-border bg-surface p-5 sm:grid-cols-[minmax(0,1fr)_180px_auto_auto]" onSubmit={event=>{
    event.preventDefault();setError('');setMessage('');start(async()=>{
      try{const result=await guardarMesaCompras({id:persona.id,mesa_id:mesa?Number(mesa):null,activo,version:persona.version})
        if(result.error)setError(result.error);else{setMessage('Asignación guardada.');router.refresh()}}
      catch{setError('No se pudo guardar. Actualiza antes de intentar nuevamente.')}
    })
  }}>
    <div><h2 className="font-semibold">{persona.nombre}</h2><p className="mt-1 text-xs text-muted">{persona.mesa_id?`Mesa actual: ${persona.mesa_id}`:'Sin mesa asignada'}</p></div>
    <label className="text-sm">Mesa de trabajo<select className={`${inputClass} mt-1`} value={mesa} onChange={e=>setMesa(e.target.value)} disabled={pending}><option value="">Sin asignar</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>Mesa {n}</option>)}</select></label>
    <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={activo} onChange={e=>setActivo(e.target.checked)} disabled={pending}/>Activo</label>
    <button className="btn-primary" disabled={pending}>{pending?'Guardando…':'Guardar mesa'}</button>
    {error&&<p role="alert" className="text-sm text-danger sm:col-span-4">{error}</p>}
    {message&&<p role="status" className="text-sm text-success sm:col-span-4">{message}</p>}
  </form>
}
export function ComprasTeam({personas}:{personas:Encargado[]}) {
  return <div className="space-y-4"><div className="rounded-xl border border-border bg-subtle p-4 text-sm text-muted"><p>Asigna la mesa de trabajo de cada encargado. Al crear una revisión, su mesa se seleccionará automáticamente.</p><p className="mt-2">Una cuenta compartida puede consultar y gestionar las revisiones de todos sus encargados. Los nombres indican a quién se asignó el trabajo; las acciones quedan registradas a nombre de la cuenta utilizada.</p><p className="mt-2">Cambiar la mesa o desactivar un encargado afecta las nuevas asignaciones. Las facturas existentes conservan sus datos y su historial.</p></div>
    {!personas.length&&<p className="rounded-xl border border-border p-6 text-sm text-muted">Todavía no hay encargados configurados.</p>}
    {personas.map(persona=><EncargadoRow key={`${persona.id}:${persona.version}`} persona={persona}/>)}
  </div>
}
