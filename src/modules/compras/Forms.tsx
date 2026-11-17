'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Loader2 } from 'lucide-react'
import { mutarCompra } from './actions'
import { inputClass } from './components'
import type { Catalogos, Revision } from './types'
import type { Mutacion } from './validation'
import { AssignmentFields, assignmentFromForm } from './AssignmentFields'

async function guardar(input: unknown) {
  try { return await mutarCompra(input) }
  catch { return {error:'Se perdió la conexión. Actualiza y verifica el registro antes de repetir la acción.'} }
}

export function NuevaRevision({catalogos}:{catalogos:Catalogos}) {
  const router=useRouter(); const [error,setError]=useState(''); const [pending,start]=useTransition()
  const [proveedor,setProveedor]=useState('')
  const [localProveedores,setLocalProveedores]=useState(catalogos.proveedores)
  function submit(form:FormData) {
    setError('');start(async()=>{
      const result=await guardar({accion:'crear',factura:form.get('factura'),numero_articulos:Number(form.get('numero_articulos')),proveedor_id:proveedor,...assignmentFromForm(form)})
      if(result.error)setError(result.error)
      else router.push(`/compras/registros/${result.id}`)
    })
  }
  function addProveedor(form:FormData){setError('');start(async()=>{
    const nombre=String(form.get('nombre')); const nit=String(form.get('nit')); const result=await guardar({accion:'proveedor',nombre,nit})
    if(result.error)setError(result.error)
    else if(result.id){setLocalProveedores(p=>[...p,{id:result.id!,nombre,nit,activo:true}]);setProveedor(result.id);router.refresh()}
  })}
  return <details className="group rounded-xl border border-border bg-surface"><summary className="flex cursor-pointer list-none items-center gap-2 p-5 font-semibold text-accent-foreground"><Plus className="size-5"/>Nueva revisión</summary><div className="border-t border-border p-5">
    {!catalogos.operadores.length&&<p className="mb-4 rounded-lg bg-warning-soft p-3 text-sm text-warning">No hay encargados disponibles. Configura sus mesas desde <a href="/compras/equipo" className="underline">Equipo y mesas de Compras</a>. Las cuentas deben estar activas y tener el módulo Compras habilitado.</p>}
    <form action={submit} className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Número de factura<input name="factura" required maxLength={100} className={`${inputClass} mt-1`} placeholder="Ej. FE-2048"/></label>
      <label className="text-sm">Proveedor<select required value={proveedor} onChange={e=>setProveedor(e.target.value)} className={`${inputClass} mt-1`}><option value="">Seleccionar proveedor</option>{localProveedores.filter(p=>p.activo!==false).map(p=><option key={p.id} value={p.id}>{p.nombre}{p.nit?` - NIT ${p.nit}`:""}</option>)}</select></label>
      <label className="text-sm sm:col-span-2">Número de artículos<input name="numero_articulos" type="number" inputMode="numeric" min={1} max={2147483647} step={1} required className={`${inputClass} mt-1 sm:max-w-xs block`} placeholder="Ej. 120"/><span className="mt-1 block text-xs text-muted">Cantidad de artículos que trae la factura.</span></label>
      <AssignmentFields operadores={catalogos.operadores}/>
      <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted">La fecha y el administrador se registran automáticamente.</p><button disabled={pending||!catalogos.operadores.length} className="btn-primary disabled:opacity-50">{pending&&<Loader2 className="size-4 animate-spin"/>}Crear y notificar</button></div>
    </form>
    <details className="mt-5 border-t border-border pt-4"><summary className="cursor-pointer text-sm text-muted">Agregar un proveedor al catálogo</summary><form action={addProveedor} className="mt-3 flex flex-wrap items-end gap-3"><label className="min-w-48 flex-1 text-sm">Nombre del proveedor<input name="nombre" minLength={2} maxLength={200} required className={`${inputClass} mt-1`}/></label><label className="text-sm">NIT<input name="nit" inputMode="numeric" pattern="[0-9]{5,15}" minLength={5} maxLength={15} required className={`${inputClass} mt-1`}/></label><button className="btn-secondary" disabled={pending}>Guardar proveedor</button></form></details>
    {error&&<p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
  </div></details>
}

export function AccionesRevision({registro:r,admin,userId,catalogos}:{registro:Revision;admin:boolean;userId:string;catalogos:Catalogos}) {
  const router=useRouter();const [error,setError]=useState('');const [success,setSuccess]=useState('');const [pending,start]=useTransition()
  const [contenido,setContenido]=useState('')
  function run(data:Mutacion,confirm?:string){
    if(confirm&&!window.confirm(confirm))return
    setError('');setSuccess('');start(async()=>{const result=await guardar(data)
      if(result.error)setError(result.error)
      else{setSuccess('Cambio guardado correctamente.');if(data.accion==='observar')setContenido('');router.refresh()}
    })
  }
  const base={id:r.id,version:r.version};const owner=r.encargado_id===userId
  return <section className="rounded-xl border border-border bg-surface p-5"><h2 className="mb-4 font-semibold">Gestionar revisión</h2>
    <fieldset disabled={pending} className="space-y-4 disabled:opacity-60">
      {owner&&['asignado','devuelto'].includes(r.estado)&&<button className="btn-primary" onClick={()=>run({accion:'iniciar',...base})}>Iniciar revisión</button>}
      {owner&&r.estado==='en_revision'&&<><form onSubmit={e=>{e.preventDefault();run({accion:'observar',...base,contenido})}}><label className="text-sm">Agregar observación<textarea required maxLength={4000} rows={4} value={contenido} onChange={e=>setContenido(e.target.value)} className={`${inputClass} mt-2`} placeholder="Describe las novedades de la factura o mercancía…"/></label><button className="btn-secondary mt-2">Guardar observación</button></form><button className="btn-primary" onClick={()=>run({accion:'finalizar',...base},'¿Finalizar la revisión y notificar al administrador? No podrás editarla mientras espera validación.')}>Finalizar revisión y notificar</button></>}
      {admin&&r.estado==='pendiente_cierre'&&<><form onSubmit={e=>{e.preventDefault();run({accion:'cerrar',...base,cpm:String(new FormData(e.currentTarget).get('cpm'))},'¿Confirmas que verificaste la revisión y deseas cerrar definitivamente el registro con este CPM?')}}><label className="text-sm font-medium">Número CPM obligatorio<input name="cpm" required maxLength={100} className={`${inputClass} mt-2`} placeholder="Número CPM"/></label><p className="mt-2 text-xs text-muted">Verifica las observaciones y el historial antes de cerrar. El cierre bloquea cambios posteriores.</p><button className="btn-primary mt-3">Validar y cerrar registro</button></form><form className="border-t border-border pt-4" onSubmit={e=>{e.preventDefault();run({accion:'devolver',...base,motivo:String(new FormData(e.currentTarget).get('motivo'))})}}><label className="text-sm">Motivo de devolución<textarea name="motivo" required maxLength={4000} rows={3} className={`${inputClass} mt-2`}/></label><button className="btn-secondary mt-2">Devolver para corrección</button></form></>}
      {admin&&['asignado','devuelto'].includes(r.estado)&&<details><summary className="cursor-pointer text-sm text-accent-foreground">Reasignar mesa o encargado</summary><form className="mt-4 space-y-3" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);run({accion:'reasignar',...base,...assignmentFromForm(f),motivo:String(f.get('motivo'))},'¿Reasignar la revisión y notificar al nuevo encargado?')}}><AssignmentFields key={r.version} operadores={catalogos.operadores} initialId={r.encargado_persona_id??r.encargado_id} initialMesa={String(r.mesa_id)}/><label className="block text-sm">Motivo<textarea name="motivo" required maxLength={4000} className={`${inputClass} mt-1`}/></label><button className="btn-secondary">Guardar reasignación</button></form></details>}
      {r.estado==='pendiente_cierre'&&!admin&&<p className="text-sm text-muted">El administrador recibió la notificación. La revisión está bloqueada mientras espera validación.</p>}
      {r.estado==='cerrado'&&<p className="text-sm text-success">Registro cerrado con CPM {r.cpm}. Disponible únicamente para consulta.</p>}
      {admin&&!owner&&r.estado==='en_revision'&&<p className="text-sm text-muted">El encargado está revisando la factura. Podrás validarla cuando finalice.</p>}
    </fieldset>{pending&&<p role="status" className="mt-4 text-sm text-muted">Guardando…</p>}{error&&<div role="alert" className="mt-4 text-sm text-danger">{error}<button onClick={()=>router.refresh()} className="ml-2 underline">Actualizar registro</button></div>}{success&&<p role="status" className="mt-4 text-sm text-success">{success}</p>}
  </section>
}
