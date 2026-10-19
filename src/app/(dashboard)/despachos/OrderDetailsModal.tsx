import { Modal } from '@/components/Modal'
import { X, Building2, MapPin, Hash, User, Layout, Clock, MessageSquare, Trash2, Truck } from 'lucide-react'

interface OrderDetailsModalProps {
  pedido: any
  onClose: () => void
  onDelete?: () => void
  onAssign?: () => void
  isAdmin: boolean
}

export function OrderDetailsModal({ pedido, onClose, onDelete, onAssign, isAdmin }: OrderDetailsModalProps) {
  if (!pedido) return null

  const timestamp = new Date(pedido.created_at).toLocaleString([], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <Modal onClose={onClose} titleId="order-details-title" size="medium">
      <div>
        
        {/* Header con el Punto */}
        <div className={`p-6 flex items-center justify-between border-b border-border ${
          pedido.punto === 'Principal' ? 'bg-warning-soft' : 'bg-info-soft'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl border ${
              pedido.punto === 'Principal' ? 'bg-warning-soft border-warning/20 text-warning' : 'bg-info-soft border-info/20 text-info'
            }`}>
              {pedido.punto === 'Principal' ? <Building2 className="w-6 h-6" /> : <MapPin className="w-6 h-6" />}
            </div>
            <div>
              <h3 id="order-details-title" className="text-lg font-semibold text-foreground">Detalle de Factura</h3>
              <p className="text-sm text-muted font-medium">{pedido.punto}</p>
            </div>
          </div>
          <button aria-label="Cerrar ventana" onClick={onClose} className="p-2 text-muted hover:text-foreground hover:bg-hover rounded-xl transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {/* Grid de Información Principal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-secondary">
            
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted font-bold flex items-center gap-1.5">
                <Hash className="w-3 h-3" /> Facturas
              </p>
              <p className="text-base font-mono text-foreground leading-tight break-words">{pedido.numero_factura}</p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted font-bold flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Fecha y Hora
              </p>
              <p className="text-sm font-medium text-foreground">{timestamp}</p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted font-bold flex items-center gap-1.5">
                <Layout className="w-3 h-3" /> Área de Revisión
              </p>
              <p className="text-sm font-medium text-foreground">{pedido.area}</p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted font-bold flex items-center gap-1.5">
                <User className="w-3 h-3" /> Revisado por
              </p>
              <p className="text-sm font-medium text-foreground">{pedido.revisado_por}</p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-muted font-bold flex items-center gap-1.5">
                <Hash className="w-3 h-3" /> Mesa
              </p>
              <p className="text-sm font-medium text-foreground">{pedido.mesa}</p>
            </div>

            {pedido.detalles && (
              <div className="sm:col-span-2 space-y-1 pt-4 border-t border-border">
                <p className="text-[10px] uppercase tracking-widest text-muted font-bold flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3" /> Observaciones
                </p>
                <p className="text-sm italic text-muted">&quot;{pedido.detalles}&quot;</p>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="flex gap-4 pt-6 border-t border-border">
            {isAdmin && onDelete && (
              <button 
                onClick={() => {
                  if (confirm('¿Eliminar definitivamente este registro?')) {
                    onDelete()
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-subtle border border-border hover:border-danger/50 hover:text-danger text-muted rounded-2xl font-bold transition-all shadow-sm active:scale-[0.98]"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar Registro
              </button>
            )}
            
            <button
              onClick={onClose}
              className="flex-1 px-5 py-3.5 bg-subtle hover:bg-hover text-foreground rounded-2xl font-bold transition-all active:scale-[0.98]"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
