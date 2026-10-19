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
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Configuración de Campos</h1>
        <p className="text-muted">Gestiona las opciones que aparecen en el formulario de facturación.</p>
      </header>

      {/* Tabs Principales de Categoría - Scrolleables en móvil si es necesario */}
      <div className="flex p-1 bg-surface border border-border rounded-2xl w-full sm:w-fit overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveTab('area')}
          className={`px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'area' ? 'bg-accent text-on-accent shadow-none' : 'text-muted hover:text-foreground'
          }`}
        >
          <Layout className="w-4 h-4" /> Áreas
        </button>
        <button
          onClick={() => setActiveTab('revisor')}
          className={`px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'revisor' ? 'bg-accent text-on-accent shadow-none' : 'text-muted hover:text-foreground'
          }`}
        >
          <User className="w-4 h-4" /> Revisores
        </button>
        <button
          onClick={() => setActiveTab('mesa')}
          className={`px-4 sm:px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 flex-shrink-0 ${
            activeTab === 'mesa' ? 'bg-accent text-on-accent shadow-none' : 'text-muted hover:text-foreground'
          }`}
        >
          <Hash className="w-4 h-4" /> Mesas
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Panel Izquierdo: Configuración y Acción */}
        <div className="lg:col-span-1 space-y-6">
          <form onSubmit={handleAdd} className="bg-surface border border-border rounded-xl p-6 h-fit sticky top-6">
            <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
              Configurar Contexto
            </h3>
            
            <div className="space-y-6">
              {/* Selector Unificado de Punto */}
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-3">Punto de Venta (Filtro y Destino)</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-subtle border border-border rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setSelectedPunto('Principal')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      selectedPunto === 'Principal' ? 'bg-warning-soft border border-warning/20 text-warning shadow-inner' : 'text-muted hover:text-foreground'
                    }`}
                  >
                    <Building2 className="w-4 h-4" /> Principal
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPunto('Sucursal')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                      selectedPunto === 'Sucursal' ? 'bg-info-soft border border-info/20 text-info shadow-inner' : 'text-muted hover:text-foreground'
                    }`}
                  >
                    <MapPin className="w-4 h-4" /> Sucursal
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-2 text-accent-foreground">Nombre del Nuevo Valor</label>
                <input
                  type="text"
                  value={newValor}
                  onChange={(e) => setNewValor(e.target.value)}
                  className="w-full bg-subtle border border-border rounded-xl px-4 py-3 text-foreground focus:ring-2 focus:ring-accent outline-none transition-all placeholder:text-muted"
                  placeholder={activeTab === 'area' ? 'Ej: Caja 3' : activeTab === 'revisor' ? 'Ej: Juan Perez' : 'Ej: Mesa 5'}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-danger text-xs p-3 bg-danger-soft rounded-xl border border-danger/20">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-on-accent font-bold py-3.5 rounded-xl transition-all shadow-none flex items-center justify-center gap-2"
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
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              {activeTab === 'area' ? 'Áreas' : activeTab === 'revisor' ? 'Revisores' : 'Mesas'} en {selectedPunto}
            </h3>
            <span className="text-[10px] bg-subtle text-muted px-3 py-1 rounded-full font-bold uppercase tracking-widest">
              {filteredConfig.length} Registros
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-20 text-muted">
              <Loader2 className="w-10 h-10 animate-spin" />
            </div>
          ) : filteredConfig.length === 0 ? (
            <div className="bg-surface border border-border rounded-xl p-16 flex flex-col items-center justify-center text-muted text-center">
              <div className="w-16 h-16 bg-subtle rounded-2xl flex items-center justify-center mb-4 border border-border">
                <Archive className="w-8 h-8 opacity-20" />
              </div>
              <p className="font-medium text-foreground">No hay registros</p>
              <p className="text-xs max-w-[200px] mt-1">No hemos encontrado opciones para esta categoría en la {selectedPunto}.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredConfig.map((item) => (
                <div key={item.id} className="group bg-surface hover:bg-hover border border-border p-4 rounded-2xl flex items-center justify-between transition-all hover:border-border-strong shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                      item.punto === 'Principal' ? 'bg-warning-soft text-warning' : 'bg-info-soft text-info'
                    }`}>
                      {item.punto === 'Principal' ? <Building2 className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-foreground font-bold">{item.valor}</p>
                      <p className="text-[10px] text-muted uppercase tracking-widest font-medium">Asignado a {item.punto}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-muted hover:text-danger hover:bg-danger-soft rounded-lg transition-all opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
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
