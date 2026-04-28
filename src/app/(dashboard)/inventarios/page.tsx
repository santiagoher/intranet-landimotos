'use client'

import { useEffect, useState } from 'react'
import { Archive, Plus, Search, Edit2, Trash2 } from 'lucide-react'
import { getContenedores, deleteContenedor } from './actions'
import { ContainerForm } from './ContainerForm'
import { useRole } from '@/hooks/useRole'

export default function InventariosPage() {
  const [contenedores, setContenedores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingContainer, setEditingContainer] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const { isAdmin, loading: loadingRole } = useRole()

  const fetchContenedores = async () => {
    setLoading(true)
    try {
      const data = await getContenedores()
      setContenedores(data)
    } catch (error) {
      console.error('Error fetching contenedores:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContenedores()
  }, [])

  const handleDelete = async (id: string) => {
    if (!isAdmin) return
    if (confirm('¿Estás seguro de eliminar este contenedor?')) {
      const result = await deleteContenedor(id)
      if (result.success) {
        fetchContenedores()
      } else {
        alert('Error al eliminar: ' + result.error)
      }
    }
  }

  const filteredContenedores = contenedores.filter(c => 
    c.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.descripcion && c.descripcion.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'disponible': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
      case 'en_uso': return 'text-blue-400 bg-blue-400/10 border-blue-400/20'
      case 'mantenimiento': return 'text-amber-400 bg-amber-400/10 border-amber-400/20'
      default: return 'text-neutral-400 bg-neutral-400/10 border-neutral-400/20'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Archive className="w-6 h-6 text-emerald-500" />
            Inventario de Contenedores
          </h2>
          <p className="text-neutral-400 text-sm mt-1">Gestión y control de disponibilidad de contenedores.</p>
        </div>
        <button 
          onClick={() => {
            setEditingContainer(null)
            setShowForm(true)
          }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Contenedor</span>
        </button>
      </div>

      <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 rounded-2xl overflow-x-auto">
        <div className="p-4 border-b border-neutral-800 flex flex-col sm:flex-row gap-4 justify-between bg-neutral-900/30">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input 
              type="text"
              placeholder="Buscar por código o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
        </div>

          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-neutral-950/50">
                <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Código</th>
                <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Descripción</th>
                <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Actualizado</th>
                {isAdmin && <th className="px-6 py-4 text-right"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {loading || loadingRole ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-neutral-500">
                    Cargando inventario...
                  </td>
                </tr>
              ) : filteredContenedores.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-neutral-500">
                    No se encontraron contenedores.
                  </td>
                </tr>
              ) : (
                filteredContenedores.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-800/30 transition-colors group">
                    <td className="px-6 py-4 font-medium text-white">{c.codigo}</td>
                    <td className="px-6 py-4 text-neutral-400 text-sm max-w-xs truncate">
                      {c.descripcion || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider ${getStatusColor(c.estado)}`}>
                        {c.estado.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-neutral-500 text-sm">
                      {new Date(c.updated_at).toLocaleDateString()}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              setEditingContainer(c)
                              setShowForm(true)
                            }}
                            className="p-2 text-neutral-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(c.id)}
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
        <ContainerForm 
          initialData={editingContainer}
          onSuccess={() => {
            setShowForm(false)
            fetchContenedores()
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
