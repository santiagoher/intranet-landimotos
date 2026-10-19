'use client'

import { X, MapPin, Package, Clock, User, ClipboardList, Calendar, Flag, Navigation, Timer } from 'lucide-react'

interface RouteDetailsModalProps {
  route: any
  onClose: () => void
}

export function RouteDetailsModal({ route, onClose }: RouteDetailsModalProps) {
  if (!route) return null

  const calculateDuration = (start: string, end: string) => {
    const s = new Date(start)
    const e = new Date(end)
    const diffMs = e.getTime() - s.getTime()
    const diffMins = Math.round(diffMs / 60000)
    if (diffMins < 60) return `${diffMins} min`
    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    return `${hours}h ${mins}m`
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80  animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-surface border border-border rounded-xl shadow-sm overflow-hidden animate-in zoom-in duration-300">
        {/* Header */}
        <div className="relative p-8 border-b border-border bg-surface">
          <button 
            onClick={onClose}
            className="absolute right-6 top-6 p-2 text-muted hover:text-foreground hover:bg-hover rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-subtle border border-border-strong flex items-center justify-center overflow-hidden">
               {route.mensajero?.foto_url ? (
                 <img src={route.mensajero.foto_url} alt="Profile" className="w-full h-full object-cover" />
               ) : (
                 <span className="text-2xl font-semibold tracking-tight text-accent-foreground">
                   {route.mensajero?.nombre_conductor?.charAt(0).toUpperCase()}
                 </span>
               )}
            </div>
            <div>
               <h3 className="text-xl font-bold text-foreground tracking-tight">{route.mensajero?.nombre_conductor}</h3>
               <p className="text-xs font-mono text-muted mt-1 uppercase tracking-widest">{route.mensajero?.placa_conductor}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8">
          {/* Ubicación y Pedidos */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-muted uppercase text-[10px] font-semibold tracking-widest">
                <MapPin className="w-3 h-3" /> Destino
              </div>
              <p className="text-foreground text-sm font-medium">{route.lugar_entrega}</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-muted uppercase text-[10px] font-semibold tracking-widest">
                <Package className="w-3 h-3" /> Cantidad
              </div>
              <p className="text-foreground text-sm font-medium">{route.numero_pedidos} Pedidos</p>
            </div>
          </div>

          <div className="h-px bg-subtle"></div>

          {/* Facturas */}
          <div className="space-y-3">
             <div className="flex items-center gap-2 text-muted uppercase text-[10px] font-semibold tracking-widest">
               <ClipboardList className="w-3 h-3" /> Detalle de Facturas
             </div>
             <div className="bg-subtle p-4 rounded-2xl border border-border max-h-32 overflow-y-auto">
                <p className="text-secondary text-sm leading-relaxed whitespace-pre-wrap">
                  {route.numero_factura}
                </p>
             </div>
          </div>

          <div className="h-px bg-subtle"></div>

          {/* Tiempos - Línea de Tiempo Premium */}
          <div className="space-y-6">
             <div className="flex items-center gap-2 text-muted uppercase text-[10px] font-semibold tracking-widest">
               <Timer className="w-3 h-3" /> Análisis de Tiempo
             </div>
             
             <div className="bg-subtle p-8 rounded-xl border border-border relative overflow-hidden group">
                {/* Background Glow */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-blue-500/5 to-emerald-500/5 opacity-50"></div>
                
                <div className="relative flex items-center justify-between">
                  {/* Salida */}
                  <div className="flex flex-col items-center gap-3 z-10">
                    <div className="w-12 h-12 rounded-2xl bg-accent-soft border border-accent/20 flex items-center justify-center text-accent-foreground shadow-none">
                      <Navigation className="w-5 h-5 rotate-45" />
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-muted font-bold uppercase tracking-tighter">Salida</p>
                      <p className="text-base font-mono text-foreground font-bold">
                        {new Date(route.hora_salida).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  {/* Línea Central */}
                  <div className="flex-1 relative mx-4 h-0.5">
                    <div className="absolute inset-0 bg-subtle rounded-full"></div>
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"></div>
                    
                    {/* Badge de Duración */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div className="bg-surface border border-border-strong px-4 py-1.5 rounded-full shadow-sm flex items-center gap-2 group-hover:scale-110 transition-transform duration-300">
                        <Timer className="w-3.5 h-3.5 text-accent-foreground" />
                        <span className="text-xs font-semibold text-foreground whitespace-nowrap tracking-tight">
                          {calculateDuration(route.hora_salida, route.hora_llegada)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Llegada */}
                  <div className="flex flex-col items-center gap-3 z-10">
                    <div className="w-12 h-12 rounded-2xl bg-success-soft border border-success/20 flex items-center justify-center text-success shadow-none">
                      <Flag className="w-5 h-5" />
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-muted font-bold uppercase tracking-tighter">Llegada</p>
                      <p className="text-base font-mono text-foreground font-bold">
                        {new Date(route.hora_llegada).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
             </div>
             
             <p className="text-[10px] text-muted text-center italic font-medium">
                Operación registrada el {new Date(route.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
             </p>
          </div>

          {/* Responsable */}
          <div className="flex items-center justify-between pt-4">
             <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted" />
                <span className="text-xs text-muted">Despachado por:</span>
                <span className="text-xs text-foreground font-bold">{route.revisor}</span>
             </div>
             <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted" />
                <span className="text-[10px] text-muted font-mono">{new Date(route.created_at).toLocaleDateString()}</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  )
}
