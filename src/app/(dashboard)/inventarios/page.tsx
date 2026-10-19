'use client'

import { useEffect, useState } from 'react'
import { Plus, Search, Edit2, Trash2 } from 'lucide-react'
import { getContenedores, deleteContenedor } from './actions'
import { ContainerForm } from './ContainerForm'
import { useRole } from '@/hooks/useRole'
import { TablePagination, usePagination } from '@/components/TablePagination'

export default function InventariosPage() {
  const [contenedores, setContenedores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingContainer, setEditingContainer] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const { isAdmin, loading: loadingRole } = useRole()
  const [currentPage, setCurrentPage] = useState(1)

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

  const { totalItems, totalPages, pageSize, paginate } = usePagination(filteredContenedores, 15)
  const paginatedContenedores = paginate(currentPage)

  // Reset to page 1 when filter changes
  useEffect(() => { setCurrentPage(1) }, [searchTerm])

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'disponible': return 'text-success bg-success-soft border-success/20'
      case 'en_uso': return 'text-accent-foreground bg-accent-soft border-accent/20'
      case 'mantenimiento': return 'text-warning bg-warning-soft border-warning/20'
      default: return 'text-muted bg-border-strong border-border-strong'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            Inventario de Contenedores
          </h2>
          <p className="text-muted text-sm mt-1">Gestión y control de disponibilidad de contenedores.</p>
        </div>
        <button 
          onClick={() => {
            setEditingContainer(null)
            setShowForm(true)
          }}
          className="flex items-center gap-2 bg-success-solid hover:bg-success-solid text-on-accent px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-none active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Contenedor</span>
        </button>
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-x-auto">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between bg-surface">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input 
              type="text"
              placeholder="Buscar por código o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-subtle border border-border rounded-xl text-sm text-foreground focus:ring-2 focus:ring-success outline-none transition-all"
            />
          </div>
        </div>

          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="bg-subtle">
                <th className="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-wider">Código</th>
                <th className="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-wider">Descripción</th>
                <th className="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-wider">Actualizado</th>
                {isAdmin && <th className="px-6 py-4 text-right"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading || loadingRole ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted">
                    Cargando inventario...
                  </td>
                </tr>
              ) : filteredContenedores.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted">
                    No se encontraron contenedores.
                  </td>
                </tr>
              ) : (
                paginatedContenedores.map((c) => (
                  <tr key={c.id} className="hover:bg-hover transition-colors group">
                    <td className="px-6 py-4 font-medium text-foreground">{c.codigo}</td>
                    <td className="px-6 py-4 text-muted text-sm max-w-xs truncate">
                      {c.descripcion || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider ${getStatusColor(c.estado)}`}>
                        {c.estado.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted text-sm">
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
                            className="p-2 text-muted hover:text-success hover:bg-success-soft rounded-lg transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(c.id)}
                            className="p-2 text-muted hover:text-danger hover:bg-danger-soft rounded-lg transition-all"
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
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
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
