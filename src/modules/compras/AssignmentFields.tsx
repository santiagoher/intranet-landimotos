'use client'
import { useState } from 'react'
import { inputClass } from './components'
import type { Operador } from './types'

export function assignmentFromForm(form:FormData) {
  const persona=String(form.get('encargado_persona_id')??'')
  return {encargado_id:String(form.get('encargado_id')??''),mesa_id:Number(form.get('mesa_id')),
    ...(persona?{encargado_persona_id:persona}:{})}
}
export function AssignmentFields({operadores,initialId='',initialMesa=''}:{operadores:Operador[];initialId?:string;initialMesa?:string}) {
  const [selected,setSelected]=useState(operadores.some(p=>(p.persona_id??p.id)===initialId)?initialId:'')
  const [mesa,setMesa]=useState(initialMesa)
  const operador=operadores.find(p=>(p.persona_id??p.id)===selected)
  return <>
    <label className="block text-sm">Encargado de revisar
      <select required value={selected} onChange={e=>setSelected(e.target.value)} className={`${inputClass} mt-1`}>
        <option value="">Seleccionar encargado</option>
        {operadores.map(p=><option disabled={!!p.persona_id&&!p.mesa_id} key={p.persona_id??p.id} value={p.persona_id??p.id}>{p.nombre}{p.persona_id?(p.mesa_id?` · Mesa ${p.mesa_id}`:' · Sin mesa asignada'):` · ${p.email}`}</option>)}
      </select>
    </label>
    {operadores.some(p=>p.persona_id&&!p.mesa_id)&&<p className="text-xs text-muted">Hay encargados sin mesa asignada. Configúrala en <a href="/compras/equipo" className="text-accent-foreground underline">Equipo y mesas</a> para poder seleccionarlos.</p>}
    <input type="hidden" name="encargado_id" value={operador?.id??''}/>
    <input type="hidden" name="encargado_persona_id" value={operador?.persona_id??''}/>
    <label className="block text-sm">Área de revisión
      <select required value={operador?.persona_id?String(operador.mesa_id):mesa} disabled={!!operador?.persona_id} onChange={e=>setMesa(e.target.value)} className={`${inputClass} mt-1`}>
        <option value="">Seleccionar mesa</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>Mesa {n}</option>)}
      </select>
      {operador?.persona_id&&<span className="mt-1 block text-xs text-muted">Mesa configurada en Equipo y mesas.</span>}
    </label>
    <input type="hidden" name="mesa_id" value={operador?.persona_id?String(operador.mesa_id):mesa}/>
  </>
}
