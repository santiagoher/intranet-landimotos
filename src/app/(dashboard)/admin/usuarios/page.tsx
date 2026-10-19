'use client'

import { useEffect, useState } from 'react'
import { Users, Search, Edit2, Shield, UserX, UserCheck, ShieldPlus } from 'lucide-react'
import { getAllUsers } from './actions'
import { UserEditModal } from './UserEditModal'
import { TablePagination, usePagination } from '@/components/TablePagination'

export default function UsuariosPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const data = await getAllUsers()
      setUsers(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const filteredUsers = users.filter(u => 
    u.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const { totalItems, totalPages, pageSize, paginate } = usePagination(filteredUsers, 15)
  const paginatedUsers = paginate(currentPage)

  // Reset to page 1 when filter changes
  useEffect(() => { setCurrentPage(1) }, [searchTerm])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            Administración de Usuarios
          </h2>
          <p className="text-muted text-sm mt-1">Controla el acceso, roles y estados de los perfiles.</p>
        </div>
        
        <div className="flex items-center gap-2 px-4 py-2 bg-accent-soft border border-accent/20 rounded-xl text-accent-foreground text-xs font-medium">
          <ShieldPlus className="w-4 h-4" />
          <span>Control de Acceso Administrativo Activo</span>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-x-auto shadow-sm">
        <div className="p-4 border-b border-border bg-surface">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input 
              type="text"
              placeholder="Buscar por nombre o correo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-subtle border border-border rounded-xl text-sm text-foreground focus:ring-2 focus:ring-accent outline-none transition-all"
            />
          </div>
        </div>

          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-subtle">
                <th className="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-wider">Usuario / Email</th>
                <th className="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-wider">Rol</th>
                <th className="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-wider">Módulos / Permisos</th>
                <th className="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-xs font-semibold text-muted uppercase tracking-wider">Última Actualización</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-muted">Cargando perfiles...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-muted">No se encontraron usuarios.</td></tr>
              ) : (
                paginatedUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-hover transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-foreground shadow-sm ${
                          u.rol?.toLowerCase() === 'admin' ? 'bg-accent-soft text-accent-foreground' : 'bg-subtle border border-border-strong'
                        }`}>
                          {u.nombre ? u.nombre.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{u.nombre || 'Sin nombre'}</p>
                          <p className="text-xs text-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {u.rol?.toLowerCase() === 'admin' ? (
                          <Shield className="w-4 h-4 text-accent-foreground" />
                        ) : (
                          <Users className="w-4 h-4 text-muted" />
                        )}
                        <span className={`text-sm ${u.rol?.toLowerCase() === 'admin' ? 'text-accent-foreground font-medium' : 'text-muted'}`}>
                          {u.rol}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {u.rol?.toLowerCase() === 'admin' ? (
                        <span className="text-[10px] font-bold text-accent-foreground uppercase tracking-tight">Acceso Total</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.modulos_permitidos && u.modulos_permitidos.length > 0 ? (
                            u.modulos_permitidos.map((m: string) => (
                              <span key={m} className="px-2 py-0.5 bg-subtle border border-border-strong text-muted rounded text-[9px] font-bold uppercase tracking-tighter">
                                {m}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-muted italic">Sin módulos</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] animate-pulse">
                      <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider w-fit ${
                        u.estado === 'activo' 
                          ? 'text-success bg-success-soft border-success/20'
                          : 'text-danger bg-danger-soft border-danger/20'
                      }`}>
                        {u.estado === 'activo' ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                        {u.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted text-sm">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setEditingUser(u)}
                        className="p-2 text-muted hover:text-foreground hover:bg-hover rounded-lg transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
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

      {editingUser && (
        <UserEditModal 
          user={editingUser}
          onSuccess={() => {
            setEditingUser(null)
            fetchUsers()
          }}
          onCancel={() => setEditingUser(null)}
        />
      )}
    </div>
  )
}
