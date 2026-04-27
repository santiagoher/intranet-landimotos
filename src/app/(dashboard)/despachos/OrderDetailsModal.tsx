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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
        
        {/* Header con el Punto */}
        <div className={`p-6 flex items-center justify-between border-b border-neutral-800/50 ${
          pedido.punto === 'Principal' ? 'bg-amber-500/5' : 'bg-purple-500/5'
        }`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl border ${
              pedido.punto === 'Principal' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-purple-500/10 border-purple-500/20 text-purple-500'
            }`}>
              {pedido.punto === 'Principal' ? <Building2 className="w-6 h-6" /> : <MapPin className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Detalle de Factura</h3>
              <p className="text-sm text-neutral-400 font-medium">{pedido.punto}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-xl transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {/* Grid de Información Principal */}
          <div className="grid grid-cols-2 gap-8 text-neutral-300">
            
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold flex items-center gap-1.5">
                <Hash className="w-3 h-3" /> Facturas
              </p>
              <p className="text-lg font-mono text-white leading-tight">{pedido.numero_factura}</p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Fecha y Hora
              </p>
              <p className="text-sm font-medium text-white">{timestamp}</p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold flex items-center gap-1.5">
                <Layout className="w-3 h-3" /> Área de Revisión
              </p>
              <p className="text-sm font-medium text-white">{pedido.area}</p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold flex items-center gap-1.5">
                <User className="w-3 h-3" /> Revisado por
              </p>
              <p className="text-sm font-medium text-white">{pedido.revisado_por}</p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold flex items-center gap-1.5">
                <Hash className="w-3 h-3" /> Mesa
              </p>
              <p className="text-sm font-medium text-white">{pedido.mesa}</p>
            </div>

            {pedido.detalles && (
              <div className="col-span-2 space-y-1 pt-4 border-t border-neutral-800/50">
                <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3" /> Observaciones
                </p>
                <p className="text-sm italic text-neutral-400">"{pedido.detalles}"</p>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="flex gap-4 pt-6 border-t border-neutral-800">
            {isAdmin && onDelete && (
              <button 
                onClick={() => {
                  if (confirm('¿Eliminar definitivamente este registro?')) {
                    onDelete()
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-neutral-950 border border-neutral-800 hover:border-red-500/50 hover:text-red-500 text-neutral-400 rounded-2xl font-bold transition-all shadow-lg active:scale-[0.98]"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar Registro
              </button>
            )}
            
            <button
              onClick={onClose}
              className="flex-1 px-5 py-3.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-2xl font-bold transition-all active:scale-[0.98]"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
