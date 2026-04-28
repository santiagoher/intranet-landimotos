'use client'

import { useEffect, useState } from 'react'
import { Truck, Plus, Search, Edit2, Trash2, MoreHorizontal } from 'lucide-react'
import { getMensajeros, deleteMensajero } from './actions'
import { MessengerForm } from './MessengerForm'
import { useRole } from '@/hooks/useRole'

export default function MensajerosPage() {
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
    if (confirm('¿Estás seguro de eliminar este mensajero?')) {
      const result = await deleteMensajero(id)
      if (result.success) {
        fetchMensajeros()
      } else {
        alert('Error al eliminar: ' + result.error)
      }
    }
  }

  const filteredMensajeros = mensajeros.filter(m => 
    m.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.telefono.includes(searchTerm)
  )

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'disponible': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
      case 'en_ruta': return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
      case 'inactivo': return 'text-neutral-400 bg-neutral-400/10 border-neutral-400/20'
      default: return 'text-neutral-400 bg-neutral-400/10 border-neutral-400/20'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-500" />
            Gestión de Mensajeros
          </h2>
          <p className="text-neutral-400 text-sm mt-1">Administra el personal de entregas y su disponibilidad.</p>
        </div>
        <button 
          onClick={() => {
            setEditingMessenger(null)
            setShowForm(true)
          }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Mensajero</span>
        </button>
      </div>

      <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 rounded-2xl overflow-x-auto">
        <div className="p-4 border-b border-neutral-800 flex flex-col sm:flex-row gap-4 justify-between bg-neutral-900/30">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input 
              type="text"
              placeholder="Buscar por nombre o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 rounded-xl border border-neutral-800 text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all">
              Filtros
            </button>
          </div>
        </div>

          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-neutral-950/50">
                <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Teléfono</th>
                <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Creado</th>
                {isAdmin && <th className="px-6 py-4 text-right"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {loading || loadingRole ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-neutral-500">
                    Cargando mensajeros...
                  </td>
                </tr>
              ) : filteredMensajeros.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-neutral-500">
                    No se encontraron mensajeros.
                  </td>
                </tr>
              ) : (
                filteredMensajeros.map((m) => (
                  <tr key={m.id} className="hover:bg-neutral-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-neutral-800 flex items-center justify-center text-blue-500 font-bold border border-neutral-700">
                          {m.nombre.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-white">{m.nombre}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-neutral-400 text-sm">{m.telefono}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider ${getStatusColor(m.estado)}`}>
                        {m.estado.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-neutral-500 text-sm">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              setEditingMessenger(m)
                              setShowForm(true)
                            }}
                            className="p-2 text-neutral-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
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
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
