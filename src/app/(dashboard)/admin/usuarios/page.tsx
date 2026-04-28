'use client'

import { useEffect, useState } from 'react'
import { Users, Search, Edit2, Shield, UserX, UserCheck, ShieldPlus } from 'lucide-react'
import { getAllUsers } from './actions'
import { UserEditModal } from './UserEditModal'

export default function UsuariosPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-500" />
            Administración de Usuarios
          </h2>
          <p className="text-neutral-400 text-sm mt-1">Controla el acceso, roles y estados de los perfiles.</p>
        </div>
        
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 text-xs font-medium">
          <ShieldPlus className="w-4 h-4" />
          <span>Control de Acceso Administrativo Activo</span>
        </div>
      </div>

      <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 rounded-2xl overflow-x-auto shadow-xl">
        <div className="p-4 border-b border-neutral-800 bg-neutral-900/30">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input 
              type="text"
              placeholder="Buscar por nombre o correo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
        </div>

          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-neutral-950/50">
                <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Usuario / Email</th>
                <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Rol</th>
                <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Módulos / Permisos</th>
                <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Última Actualización</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-neutral-500">Cargando perfiles...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-neutral-500">No se encontraron usuarios.</td></tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-neutral-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-white shadow-lg ${
                          u.rol?.toLowerCase() === 'admin' ? 'bg-gradient-to-tr from-blue-600 to-indigo-500' : 'bg-neutral-800 border border-neutral-700'
                        }`}>
                          {u.nombre ? u.nombre.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-white">{u.nombre || 'Sin nombre'}</p>
                          <p className="text-xs text-neutral-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {u.rol?.toLowerCase() === 'admin' ? (
                          <Shield className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Users className="w-4 h-4 text-neutral-500" />
                        )}
                        <span className={`text-sm ${u.rol?.toLowerCase() === 'admin' ? 'text-blue-400 font-medium' : 'text-neutral-400'}`}>
                          {u.rol}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {u.rol?.toLowerCase() === 'admin' ? (
                        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-tight">Acceso Total</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.modulos_permitidos && u.modulos_permitidos.length > 0 ? (
                            u.modulos_permitidos.map((m: string) => (
                              <span key={m} className="px-2 py-0.5 bg-neutral-800 border border-neutral-700 text-neutral-400 rounded text-[9px] font-bold uppercase tracking-tighter">
                                {m}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-neutral-600 italic">Sin módulos</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] animate-pulse">
                      <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider w-fit ${
                        u.estado === 'activo' 
                          ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' 
                          : 'text-red-400 bg-red-400/10 border-red-400/20'
                      }`}>
                        {u.estado === 'activo' ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                        {u.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-neutral-500 text-sm">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setEditingUser(u)}
                        className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
