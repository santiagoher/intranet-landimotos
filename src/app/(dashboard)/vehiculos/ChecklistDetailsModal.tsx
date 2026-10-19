'use client'

import { X, ClipboardCheck, AlertTriangle, CheckCircle, Calendar, User, Truck, ShieldAlert } from 'lucide-react'
import { Checklist } from './types'
import { VehicleBlueprint, CATEGORIES } from './ChecklistForm'

interface ChecklistDetailsModalProps {
  checklist: Checklist
  onClose: () => void
}

export function ChecklistDetailsModal({ checklist, onClose }: ChecklistDetailsModalProps) {
  const categories = [
    { label: '1. Documentación (SOAT/Tecno)', value: checklist.documentos },
    { label: '2. Fluidos (Aceite/Nivel)', value: checklist.aceite_motor },
    { label: '3. Nivel Líquido de Frenos', value: checklist.liquido_frenos },
    { label: '4. Sistema de Luces', value: checklist.luces },
    { label: '5. Suspensión y Dirección (Llantas)', value: checklist.llantas },
    { label: '6. Espejos Retrovisores', value: checklist.espejos },
    { label: '7. Estado Carrocería', value: checklist.carroceria },
    { label: '8. Sistema de Frenos', value: checklist.frenos }
  ]

  const getStatusBadge = (status: string) => {
    const val = (status || 'b').toLowerCase()
    switch (val) {
      case 'm':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-danger-soft border border-danger/20 text-danger rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5" /> Malo
          </span>
        )
      case 'na':
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-subtle border border-border text-muted rounded-lg">
            N/A
          </span>
        )
      case 'b':
      default:
        return (
          <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-success-soft border border-success/20 text-success rounded-lg">
            <CheckCircle className="w-3.5 h-3.5" /> Bueno
          </span>
        )
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-xl bg-surface border border-border rounded-2xl shadow-sm overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-surface">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-soft rounded-xl flex items-center justify-center text-accent-foreground">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">Detalle de Inspección</h3>
              <p className="text-xs text-muted mt-1">Historial del control preoperacional diario</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-muted hover:text-foreground hover:bg-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Driver & Vehicle info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-subtle p-4 rounded-xl border border-border text-xs">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted" />
              <div>
                <p className="font-semibold text-[10px] uppercase text-muted tracking-wider">Conductor / Cargo</p>
                <p className="text-foreground font-bold mt-0.5">
                  {checklist.conductor_nombre || checklist.usuario?.nombre || 'Operador'}
                  {checklist.conductor_cargo && <span className="text-[10px] font-normal text-muted"> ({checklist.conductor_cargo})</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-muted" />
              <div>
                <p className="font-semibold text-[10px] uppercase text-muted tracking-wider">Vehículo asignado</p>
                <p className="text-foreground font-bold mt-0.5">
                  {checklist.vehiculo?.placa || 'N/A'}
                  {checklist.vehiculo?.marca && <span className="text-[10px] font-normal text-muted font-sans"> ({checklist.vehiculo?.marca} {checklist.vehiculo?.modelo})</span>}
                </p>
              </div>
            </div>
            {checklist.conductor_cedula && (
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 text-muted font-bold font-mono text-[9px] flex items-center justify-center border border-border rounded">ID</span>
                <div>
                  <p className="font-semibold text-[10px] uppercase text-muted tracking-wider">Cédula Conductor</p>
                  <p className="text-foreground font-bold mt-0.5 font-mono">{checklist.conductor_cedula}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-muted" />
              <div>
                <p className="font-semibold text-[10px] uppercase text-muted tracking-wider">Kilometraje reportado</p>
                <p className="text-foreground font-bold font-mono mt-0.5">{checklist.kilometraje.toLocaleString()} km</p>
              </div>
            </div>
            <div className="col-span-1 sm:col-span-2 flex items-center gap-2 pt-2 border-t border-border">
              <Calendar className="w-4 h-4 text-muted" />
              <div>
                <p className="font-semibold text-[10px] uppercase text-muted tracking-wider">Fecha del Registro</p>
                <p className="text-foreground font-medium mt-0.5">
                  {new Date(checklist.created_at).toLocaleDateString()} a las {new Date(checklist.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>

          {/* Estado general alert */}
          {checklist.tiene_novedad ? (
            <div className="flex items-start gap-3 p-4 bg-danger-soft border border-danger/20 text-danger rounded-xl leading-relaxed">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Inspección con Novedades</p>
                <p className="mt-0.5 text-xs text-muted">Este vehículo reportó fallas críticas o elementos en mal estado. Requiere revisión técnica.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 bg-success-soft border border-success/20 text-success rounded-xl leading-relaxed">
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Inspección Correcta</p>
                <p className="mt-0.5 text-xs text-muted">Todos los sistemas obligatorios del vehículo cumplen con los criterios de seguridad.</p>
              </div>
            </div>
          )}

          {/* Croquis Blueprint Diagnóstico */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-muted uppercase tracking-wider">Croquis de Diagnóstico Preoperacional</h4>
            <div className="p-4 bg-[#0a1d37] border border-accent/60 rounded-2xl flex flex-col justify-center items-center relative min-h-[200px] overflow-hidden">
              <VehicleBlueprint tipo={checklist.vehiculo?.tipo || 'Moto'} checklist={checklist} />
            </div>
          </div>

          {/* Categorías evaluadas */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-muted uppercase tracking-wider">Detalle del Registro por Componente</h4>
            {checklist.evaluaciones && Object.keys(checklist.evaluaciones).length > 0 ? (
              <div className="space-y-4">
                {CATEGORIES.map((cat) => (
                  <div key={cat.id} className="bg-subtle border border-border p-4 rounded-xl space-y-3 shadow-inner">
                    <h5 className="text-xs font-bold text-accent-foreground uppercase tracking-wider border-b border-border pb-1.5">{cat.title}</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {cat.items.map((item) => {
                        const val = checklist.evaluaciones ? checklist.evaluaciones[item.id] : 'b'
                        return (
                          <div key={item.id} className="flex justify-between items-center bg-subtle p-2.5 rounded-lg border border-border hover:bg-hover transition-colors">
                            <span className="text-xs text-secondary pr-3 leading-tight">{item.label}</span>
                            {getStatusBadge(val)}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-border bg-subtle border border-border rounded-xl overflow-hidden">
                {categories.map((cat, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3.5 text-sm hover:bg-hover transition-colors">
                    <span className="text-secondary font-medium">{cat.label}</span>
                    {getStatusBadge(cat.value)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Observaciones */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-muted uppercase tracking-wider">Observaciones / Comentarios del Conductor</h4>
            <div className="bg-subtle p-4 rounded-xl text-secondary text-sm italic border border-border leading-relaxed">
              {checklist.observaciones ? (
                `“${checklist.observaciones}”`
              ) : (
                <span className="text-muted font-normal">Sin observaciones ni reportes detallados ingresados.</span>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border bg-surface">
          <button 
            type="button" 
            onClick={onClose} 
            className="w-full px-5 py-2.5 bg-subtle hover:bg-hover text-foreground rounded-xl font-medium transition-all text-sm"
          >
            Cerrar Ventana
          </button>
        </div>

      </div>
    </div>
  )
}
