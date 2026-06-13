'use client'

import { useState } from 'react'
import { X, Loader2, CheckCircle, AlertOctagon, Calendar, User, Wrench } from 'lucide-react'
import { resolveAlerta } from './actions'
import { Alerta } from './types'

interface AlertResolutionModalProps {
  alerta: Alerta
  onSuccess: () => void
  onCancel: () => void
}

export function AlertResolutionModal({ alerta, onSuccess, onCancel }: AlertResolutionModalProps) {
  const [comentarios, setComentarios] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleResolve = async () => {
    if (!comentarios.trim()) {
      setError('Por favor, ingresa los comentarios de resolución')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const res = await resolveAlerta(alerta.id, comentarios)
      if (res.error) {
        setError(res.error)
      } else {
        onSuccess()
      }
    } catch {
      setError('Error al solucionar la alerta')
    } finally {
      setSubmitting(false)
    }
  }

  // Identificar qué componentes del checklist están reportados como 'm' (mal)
  const checklist = (alerta.checklist || {}) as Record<string, any>
  const componentsMap: Record<string, string> = {
    luces: 'Luces y Direccionales',
    frenos: 'Frenos (Servicio/Mano)',
    llantas: 'Llantas y Labrado',
    espejos: 'Espejos Retrovisores',
    aceite_motor: 'Aceite Motor',
    liquido_frenos: 'Líquido de Frenos',
    carroceria: 'Carrocería / Plásticos',
    documentos: 'SOAT y Tecnomecánica'
  }

  const badComponents = Object.keys(componentsMap).filter(
    (key) => checklist[key] === 'm'
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Novedad Reportada</h3>
              <p className="text-xs text-neutral-400 mt-1">Vehículo: <span className="text-white font-bold">{alerta.vehiculo?.placa}</span> ({alerta.vehiculo?.marca} {alerta.vehiculo?.modelo || ''})</p>
            </div>
          </div>
          <button 
            onClick={onCancel} 
            className="p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4 bg-neutral-950/40 p-4 rounded-xl border border-neutral-800/60 text-xs">
            <div className="flex items-center gap-2 text-neutral-400">
              <User className="w-4 h-4 text-neutral-500" />
              <div>
                <p className="font-semibold text-[10px] uppercase tracking-wider">Reportado por</p>
                <p className="text-neutral-200 mt-0.5">{alerta.checklist?.conductor_nombre || alerta.usuario?.nombre || 'Operador'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-neutral-400">
              <Calendar className="w-4 h-4 text-neutral-500" />
              <div>
                <p className="font-semibold text-[10px] uppercase tracking-wider">Fecha Reporte</p>
                <p className="text-neutral-200 mt-0.5">
                  {new Date(alerta.created_at).toLocaleDateString()} a las {new Date(alerta.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>

          {/* Componentes Dañados */}
          <div>
            <h4 className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5" />
              Elementos en mal estado:
            </h4>
            <div className="flex flex-wrap gap-2">
              {badComponents.map((comp) => (
                <span 
                  key={comp} 
                  className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium rounded-lg"
                >
                  {componentsMap[comp]}
                </span>
              ))}
            </div>
          </div>

          {/* Observaciones del checklist */}
          <div>
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Comentarios del Conductor:</h4>
            <div className="bg-neutral-950 p-3 rounded-xl text-neutral-300 text-sm italic border border-neutral-850">
              {checklist.observaciones || <span className="text-neutral-600">Sin comentarios ni observaciones registradas.</span>}
            </div>
          </div>

          <div className="border-t border-neutral-800 my-4"></div>

          {/* Resolución */}
          <div>
            <label className="block text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2">Comentarios de Resolución / Acciones Tomadas</label>
            <textarea
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              placeholder="Ingresa la acción correctiva realizada (ej: 'Se cambiaron las pastillas de freno y se rellenó líquido...')"
              rows={3}
              className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none text-sm"
            />
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-neutral-800 bg-neutral-900/50">
          <button 
            type="button" 
            onClick={onCancel} 
            className="flex-1 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl font-medium transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleResolve}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-medium transition-all shadow-lg shadow-emerald-600/20"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            <span>Solucionado</span>
          </button>
        </div>
      </div>
    </div>
  )
}
