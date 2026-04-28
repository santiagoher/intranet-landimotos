'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Layout, User, Hash, AlertCircle, Loader2, Building2, MapPin, Globe, Archive } from 'lucide-react'
import { getConfiguraciones, addConfiguracion, deleteConfiguracion } from './actions'

type Config = {
  id: string
  categoria: 'area' | 'revisor' | 'mesa'
  punto: 'Principal' | 'Sucursal'
  valor: string
}

export default function ConfiguracionPage() {
  const [configuraciones, setConfiguraciones] = useState<Config[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'area' | 'revisor' | 'mesa'>('area')
  const [selectedPunto, setSelectedPunto] = useState<'Principal' | 'Sucursal'>('Principal')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Estado para el nombre del nuevo valor
  const [newValor, setNewValor] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await getConfiguraciones()
      setConfiguraciones(data as Config[])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newValor.trim()) return

    setIsSubmitting(true)
    setError(null)
    
    const res = await addConfiguracion({
      categoria: activeTab,
      punto: selectedPunto,
      valor: newValor.trim()
    })

    if (res.error) {
      setError(res.error)
    } else {
      setNewValor('')
      loadData()
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Seguro que quieres eliminar esta opción?')) return
    
    const res = await deleteConfiguracion(id)
    if (res.error) {
      alert(res.error)
    } else {
      loadData()
    }
  }

  const filteredConfig = configuraciones.filter(c => 
    c.categoria === activeTab && c.punto === selectedPunto
  )

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Configuración de Campos</h1>
        <p className="text-neutral-400">Gestiona las opciones que aparecen en el formulario de facturación.</p>
      </header>

      {/* Tabs Principales de Categoría - Scrolleables en móvil si es necesario */}
      <div className="flex p-1 bg-neutral-900 border border-neutral-800 rounded-2xl w-full sm:w-fit overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveTab('area')}
          className={`px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'area' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Layout className="w-4 h-4" /> Áreas
        </button>
        <button
          onClick={() => setActiveTab('revisor')}
          className={`px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'revisor' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <User className="w-4 h-4" /> Revisores
        </button>
        <button
          onClick={() => setActiveTab('mesa')}
          className={`px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'mesa' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Hash className="w-4 h-4" /> Mesas
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Panel Izquierdo: Configuración y Acción */}
        <div className="lg:col-span-1 space-y-6">
          <form onSubmit={handleAdd} className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 h-fit sticky top-6">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              Configurar Contexto
            </h3>
            
            <div className="space-y-6">
              {/* Selector Unificado de Punto */}
              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3">Punto de Venta (Filtro y Destino)</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-950 border border-neutral-800 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setSelectedPunto('Principal')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      selectedPunto === 'Principal' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500 shadow-inner' : 'text-neutral-500 hover:text-white'
                    }`}
                  >
                    <Building2 className="w-4 h-4" /> Principal
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPunto('Sucursal')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      selectedPunto === 'Sucursal' ? 'bg-purple-500/10 border border-purple-500/20 text-purple-500 shadow-inner' : 'text-neutral-500 hover:text-white'
                    }`}
                  >
                    <MapPin className="w-4 h-4" /> Sucursal
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2 text-blue-400">Nombre del Nuevo Valor</label>
                <input
                  type="text"
                  value={newValor}
                  onChange={(e) => setNewValor(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-600 outline-none transition-all placeholder:text-neutral-700"
                  placeholder={activeTab === 'area' ? 'Ej: Caja 3' : activeTab === 'revisor' ? 'Ej: Juan Perez' : 'Ej: Mesa 5'}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-500 text-xs p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                Agregar a {selectedPunto}
              </button>
            </div>
          </form>
        </div>

        {/* Panel Derecho: Lista de Valores Filtrada */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Archive className="w-5 h-5 text-neutral-500" />
              {activeTab === 'area' ? 'Áreas' : activeTab === 'revisor' ? 'Revisores' : 'Mesas'} en {selectedPunto}
            </h3>
            <span className="text-[10px] bg-neutral-800 text-neutral-400 px-3 py-1 rounded-full font-bold uppercase tracking-widest">
              {filteredConfig.length} Registros
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-20 text-neutral-500">
              <Loader2 className="w-10 h-10 animate-spin" />
            </div>
          ) : filteredConfig.length === 0 ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-16 flex flex-col items-center justify-center text-neutral-500 text-center">
              <div className="w-16 h-16 bg-neutral-950 rounded-2xl flex items-center justify-center mb-4 border border-neutral-800">
                <Archive className="w-8 h-8 opacity-20" />
              </div>
              <p className="font-medium text-white">No hay registros</p>
              <p className="text-xs max-w-[200px] mt-1">No hemos encontrado opciones para esta categoría en la {selectedPunto}.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredConfig.map((item) => (
                <div key={item.id} className="group bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 p-4 rounded-2xl flex items-center justify-between transition-all hover:border-neutral-700 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                      item.punto === 'Principal' ? 'bg-amber-500/10 text-amber-500' : 'bg-purple-500/10 text-purple-500'
                    }`}>
                      {item.punto === 'Principal' ? <Building2 className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                    </div>5
                    <div>
                      <p className="text-white font-bold">{item.valor}</p>
                      <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-medium">Asignado a {item.punto}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-neutral-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
