'use client'

import { useState } from 'react'
import { X, Loader2, CheckCircle, AlertOctagon, Calendar, User } from 'lucide-react'
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
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-sm overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-surface">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-danger-soft rounded-xl flex items-center justify-center text-danger">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">Novedad Reportada</h3>
              <p className="text-xs text-muted mt-1">Vehículo: <span className="text-foreground font-bold">{alerta.vehiculo?.placa}</span> ({alerta.vehiculo?.marca} {alerta.vehiculo?.modelo || ''})</p>
            </div>
          </div>
          <button 
            onClick={onCancel} 
            className="p-2 text-muted hover:text-foreground hover:bg-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4 bg-subtle p-4 rounded-xl border border-border text-xs">
            <div className="flex items-center gap-2 text-muted">
              <User className="w-4 h-4 text-muted" />
              <div>
                <p className="font-semibold text-[10px] uppercase tracking-wider">Reportado por</p>
                <p className="text-foreground mt-0.5">{alerta.checklist?.conductor_nombre || alerta.usuario?.nombre || 'Operador'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-muted">
              <Calendar className="w-4 h-4 text-muted" />
              <div>
                <p className="font-semibold text-[10px] uppercase tracking-wider">Fecha Reporte</p>
                <p className="text-foreground mt-0.5">
                  {new Date(alerta.created_at).toLocaleDateString()} a las {new Date(alerta.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>

          {/* Componentes Dañados */}
          <div>
            <h4 className="text-xs font-bold text-danger uppercase tracking-wider mb-2 flex items-center gap-1.5">
              Elementos en mal estado:
            </h4>
            <div className="flex flex-wrap gap-2">
              {badComponents.map((comp) => (
                <span 
                  key={comp} 
                  className="px-2.5 py-1 bg-danger-soft border border-danger/20 text-danger text-xs font-medium rounded-lg"
                >
                  {componentsMap[comp]}
                </span>
              ))}
            </div>
          </div>

          {/* Observaciones del checklist */}
          <div>
            <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-1">Comentarios del Conductor:</h4>
            <div className="bg-subtle p-3 rounded-xl text-secondary text-sm italic border border-border">
              {checklist.observaciones || <span className="text-muted">Sin comentarios ni observaciones registradas.</span>}
            </div>
          </div>

          <div className="border-t border-border my-4"></div>

          {/* Resolución */}
          <div>
            <label className="block text-xs font-bold text-success uppercase tracking-wider mb-2">Comentarios de Resolución / Acciones Tomadas</label>
            <textarea
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              placeholder="Ingresa la acción correctiva realizada (ej: 'Se cambiaron las pastillas de freno y se rellenó líquido...')"
              rows={3}
              className="w-full px-4 py-3 bg-subtle border border-border rounded-xl text-foreground focus:ring-2 focus:ring-success outline-none transition-all resize-none text-sm"
            />
            {error && <p className="mt-1 text-xs text-danger">{error}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-border bg-surface">
          <button 
            type="button" 
            onClick={onCancel} 
            className="flex-1 px-4 py-2.5 bg-subtle hover:bg-hover text-foreground rounded-xl font-medium transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleResolve}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-success-solid hover:bg-success-solid disabled:opacity-50 text-on-accent rounded-xl font-medium transition-all shadow-none"
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
