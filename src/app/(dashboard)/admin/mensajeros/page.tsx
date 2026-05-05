'use client'

import { useEffect, useState } from 'react'
import { Truck, Plus, Search, Edit2, Trash2, ShieldCheck, User2 } from 'lucide-react'
import { getMensajeros, deleteMensajero } from '../../mensajeros/actions'
import { MessengerForm } from '../../mensajeros/MessengerForm'
import { useRole } from '@/hooks/useRole'

export default function AdminMensajerosPage() {
  const [mensajeros, setMensajeros] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingMessenger, setEditingMessenger] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const { isAdmin, loading: loadingRole } = useRole()

  const fetchMensajeros = async () => {
    setLoading(true)
    try {
      const data = await getMensajeros()
      setMensajeros(data)
    } catch (error) {
      console.error('Error fetching mensajeros:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMensajeros()
  }, [])

  const handleDelete = async (id: string) => {
    if (!isAdmin) return
    if (confirm('¿Estás seguro de eliminar este mensajero? Esta acción no se puede deshacer.')) {
      const result = await deleteMensajero(id)
      if (result.success) {
        fetchMensajeros()
      } else {
        alert('Error al eliminar: ' + result.error)
      }
    }
  }

  const filteredMensajeros = mensajeros.filter(m =>
    m.nombre_conductor.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.placa_conductor.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!isAdmin && !loadingRole) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <ShieldCheck className="w-16 h-16 text-red-500 mb-4 opacity-20" />
        <h2 className="text-2xl font-bold text-white mb-2">Acceso Restringido</h2>
        <p className="text-neutral-400 max-w-sm">Lo sentimos, no tienes permisos de administrador para gestionar el personal de mensajeros.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Administrativo */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <User2 className="w-6 h-6 text-blue-500" />
            Administración de Personal
          </h2>
          <p className="text-neutral-400 text-sm mt-1">Control de flota, conductores y placas vehiculares.</p>
        </div>
        <button
          onClick={() => {
            setEditingMessenger(null)
            setShowForm(true)
          }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Nuevo Conductor</span>
        </button>
      </div>

      {/* Tabla de Gestión */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-neutral-800 bg-neutral-900/30 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
            <input
              type="text"
              placeholder="Buscar por nombre o placa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-neutral-950 border border-neutral-800 rounded-2xl text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <div className="text-sm text-neutral-500 font-medium whitespace-nowrap">
            {filteredMensajeros.length} mensajeros registrados
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-950/30">
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Perfil y Conductor</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Placa de Moto</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-center">Estado</th>
                <th className="px-6 py-4 text-[10px] font-bold text-neutral-500 uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-neutral-500">
                    <div className="flex flex-col items-center gap-3">
                      <span className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                      Cargando personal...
                    </div>
                  </td>
                </tr>
              ) : filteredMensajeros.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-neutral-500 italic">
                    No se encontraron mensajeros que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredMensajeros.map((m) => (
                  <tr key={m.id} className="hover:bg-neutral-800/20 transition-colors group border-b border-neutral-800/50 last:border-0">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-blue-500 font-bold border border-neutral-700 overflow-hidden shadow-sm">
                          {m.foto_url ? (
                            <img src={m.foto_url} alt={m.nombre_conductor} className="w-full h-full object-cover" />
                          ) : (
                            m.nombre_conductor.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{m.nombre_conductor}</p>
                          <p className="text-[10px] text-neutral-500 font-medium">ID: {m.id.substring(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-neutral-400 font-mono text-sm uppercase tracking-wider">{m.placa_conductor}</td>
                    <td className="px-6 py-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${m.estado !== 'inactivo'
                          ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                          : 'text-red-400 bg-red-400/10 border-red-400/20'
                        }`}>
                        {m.estado !== 'inactivo' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingMessenger(m)
                            setShowForm(true)
                          }}
                          className="p-2 text-neutral-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <MessengerForm
          initialData={editingMessenger}
          onSuccess={() => {
            setShowForm(false)
            fetchMensajeros()
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  )
}