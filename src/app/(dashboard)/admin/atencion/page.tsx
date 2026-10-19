'use client'

import { useState, useEffect } from 'react'
import { 
  MessageSquare, 
  Calendar, 
  History, 
  BarChart3, 
  Settings, 
  Plus, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  User,
  Tags,
  Check,
  AlertCircle
} from 'lucide-react'
import { 
  getAsesores, 
  addAsesor, 
  deleteAsesor, 
  getEtiquetas, 
  addEtiqueta, 
  deleteEtiqueta,
  getAtencionDiaria, 
  saveAtencionDiaria, 
  deleteAtencionDiaria,
  getEstadosWhatsapp,
  saveEstadoWhatsapp,
  deleteEstadoWhatsapp
} from './actions'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts'

export default function AtencionClientePage() {
  const [activeTab, setActiveTab] = useState<'registro' | 'whatsapp' | 'historial' | 'graficos' | 'config'>('registro')
  
  // Data states
  const [asesores, setAsesores] = useState<any[]>([])
  const [etiquetas, setEtiquetas] = useState<any[]>([])
  const [atenciones, setAtenciones] = useState<any[]>([])
  const [estadosWhatsapp, setEstadosWhatsapp] = useState<any[]>([])
  
  const [loading, setLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)

  // Form states - Registro Diario
  const [registroFecha, setRegistroFecha] = useState(new Date().toISOString().split('T')[0])
  const [registroAsesor, setRegistroAsesor] = useState('')
  const [registroValores, setRegistroValores] = useState<Record<string, number>>({})
  const [registroObs, setRegistroObs] = useState('')
  const [editingAtencionId, setEditingAtencionId] = useState<string | null>(null)
  
  // WhatsApp States
  const [currentDate, setCurrentDate] = useState(new Date())
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any | null>(null)
  const [wpFecha, setWpFecha] = useState(new Date().toISOString().split('T')[0])
  const [wpAsesor, setWpAsesor] = useState('')
  const [wpTematica, setWpTematica] = useState('')
  const [wpCantidad, setWpCantidad] = useState(1)
  const [wpEstado, setWpEstado] = useState<'pendiente' | 'cumplido' | 'incumplido'>('pendiente')
  const [wpObservacion, setWpObservacion] = useState('')

  // Config States
  const [newAsesorName, setNewAsesorName] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3b82f6')

  // Notification states
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    loadAllData()
  }, [])

  const loadAllData = async () => {
    setLoading(true)
    try {
      const [asesoresData, etiquetasData, atencionData, whatsappData] = await Promise.all([
        getAsesores(),
        getEtiquetas(),
        getAtencionDiaria(),
        getEstadosWhatsapp()
      ])
      setAsesores(asesoresData)
      setEtiquetas(etiquetasData)
      setAtenciones(atencionData)
      setEstadosWhatsapp(whatsappData)
      
      // Select default advisor if available
      if (asesoresData.length > 0 && !registroAsesor) {
        setRegistroAsesor(asesoresData[0].id)
      }
    } catch (err) {
      console.error('Error al cargar datos:', err)
      showError('Ocurrió un error al cargar la información del servidor.')
    } finally {
      setLoading(false)
    }
  }

  const showError = (msg: string) => {
    setErrorMsg(msg)
    setTimeout(() => setErrorMsg(null), 5000)
  }

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(null), 5000)
  }

  // =========================================================================
  // ACTIONS - REGISTRO DIARIO
  // =========================================================================
  const handleValoresChange = (tagId: string, val: string) => {
    const num = val === '' ? 0 : parseInt(val, 10)
    setRegistroValores(prev => ({
      ...prev,
      [tagId]: isNaN(num) ? 0 : num
    }))
  }

  const handleSaveAtencion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!registroAsesor) {
      showError('Debe seleccionar un asesor.')
      return
    }

    setSubmitting(true)
    
    // Mapear etiquetas de forma que conserve solo las que tienen cantidad > 0
    const etiquetasPayload: Record<string, number> = {}
    etiquetas.forEach(t => {
      etiquetasPayload[t.nombre] = registroValores[t.id] || 0
    })

    // Resolver total_clientes desde el tag "Clientes atendidos" o fallar a sumatorio
    let total = 0
    const clientTag = etiquetas.find(
      t => t.nombre.trim().toLowerCase() === 'clientes atendidos' || t.nombre.trim().toLowerCase() === 'cliente atendido'
    )
    if (clientTag) {
      total = registroValores[clientTag.id] || 0
    } else {
      total = Object.values(registroValores).reduce((acc, curr) => acc + curr, 0)
    }

    const payload = {
      id: editingAtencionId || undefined,
      fecha: registroFecha,
      asesor_id: registroAsesor,
      etiquetas: etiquetasPayload,
      total_clientes: total,
      observaciones: registroObs
    }

    const result = await saveAtencionDiaria(payload)
    setSubmitting(false)

    if (result.error) {
      showError(result.error)
    } else {
      showSuccess(editingAtencionId ? 'Reporte actualizado correctamente.' : 'Reporte diario guardado correctamente.')
      // Reset form
      setEditingAtencionId(null)
      setRegistroObs('')
      const emptyVals: Record<string, number> = {}
      etiquetas.forEach(t => { emptyVals[t.id] = 0 })
      setRegistroValores(emptyVals)
      loadAllData()
    }
  }

  const handleEditAtencion = (atn: any) => {
    setEditingAtencionId(atn.id)
    setRegistroFecha(atn.fecha)
    setRegistroAsesor(atn.asesor_id)
    setRegistroObs(atn.observaciones || '')
    
    // Rellenar valores
    const vals: Record<string, number> = {}
    etiquetas.forEach(tag => {
      vals[tag.id] = atn.etiquetas[tag.nombre] || 0
    })
    setRegistroValores(vals)
    setActiveTab('registro')
  }

  const handleDeleteAtencion = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este registro de atención diaria?')) return
    const res = await deleteAtencionDiaria(id)
    if (res.error) {
      showError(res.error)
    } else {
      showSuccess('Registro eliminado correctamente.')
      loadAllData()
    }
  }

  // =========================================================================
  // ACTIONS - ESTADOS DE WHATSAPP
  // =========================================================================
  const openWpCreateModal = (dateStr: string) => {
    setSelectedTask(null)
    setWpFecha(dateStr)
    if (asesores.length > 0) setWpAsesor(asesores[0].id)
    setWpTematica('')
    setWpCantidad(1)
    setWpEstado('pendiente')
    setWpObservacion('')
    setWhatsappModalOpen(true)
  }

  const openWpEditModal = (task: any) => {
    setSelectedTask(task)
    setWpFecha(task.fecha)
    setWpAsesor(task.asesor_id)
    setWpTematica(task.tematica)
    setWpCantidad(task.cantidad_requerida)
    setWpEstado(task.estado)
    setWpObservacion(task.observaciones || '')
    setWhatsappModalOpen(true)
  }

  const handleSaveWpTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!wpAsesor) {
      showError('Seleccione un asesor.')
      return
    }
    if (!wpTematica.trim()) {
      showError('Escriba la temática del estado.')
      return
    }
    if (wpEstado === 'incumplido' && !wpObservacion.trim()) {
      showError('Debe agregar una observación explicando el motivo del incumplimiento.')
      return
    }

    setSubmitting(true)
    const payload = {
      id: selectedTask?.id || undefined,
      fecha: wpFecha,
      asesor_id: wpAsesor,
      tematica: wpTematica,
      cantidad_requerida: wpCantidad,
      estado: wpEstado,
      observaciones: wpObservacion
    }

    const res = await saveEstadoWhatsapp(payload)
    setSubmitting(false)

    if (res.error) {
      showError(res.error)
    } else {
      showSuccess(selectedTask ? 'Programación de estado actualizada.' : 'Estado programado correctamente.')
      setWhatsappModalOpen(false)
      loadAllData()
    }
  }

  const handleDeleteWpTask = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta tarea de estados de WhatsApp?')) return
    const res = await deleteEstadoWhatsapp(id)
    if (res.error) {
      showError(res.error)
    } else {
      showSuccess('Programación eliminada.')
      setWhatsappModalOpen(false)
      loadAllData()
    }
  }

  // =========================================================================
  // ACTIONS - CONFIGURACIÓN
  // =========================================================================
  const handleAddAsesor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAsesorName.trim()) return
    setSubmitting(true)
    const res = await addAsesor(newAsesorName)
    setSubmitting(false)
    if (res.error) showError(res.error)
    else {
      showSuccess(`Asesor "${newAsesorName}" agregado.`)
      setNewAsesorName('')
      loadAllData()
    }
  }

  const handleDeleteAsesor = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este asesor? Se borrarán sus datos asociados.')) return
    const res = await deleteAsesor(id)
    if (res.error) showError(res.error)
    else {
      showSuccess('Asesor eliminado.')
      loadAllData()
    }
  }

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTagName.trim()) return
    setSubmitting(true)
    const res = await addEtiqueta(newTagName, newTagColor)
    setSubmitting(false)
    if (res.error) showError(res.error)
    else {
      showSuccess(`Etiqueta "${newTagName}" agregada.`)
      setNewTagName('')
      loadAllData()
    }
  }

  const handleDeleteTag = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta etiqueta?')) return
    const res = await deleteEtiqueta(id)
    if (res.error) showError(res.error)
    else {
      showSuccess('Etiqueta eliminada.')
      loadAllData()
    }
  }

  // =========================================================================
  // HELPERS - CALENDARIO WHATSAPP
  // =========================================================================
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const days = []
    
    // Primer día del mes
    const firstDay = new Date(year, month, 1)
    // Día de la semana del primer día (0: Domingo, 1: Lunes, etc.)
    let startDayOfWeek = firstDay.getDay()
    // Convertir a 0: Lunes, 6: Domingo
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1

    // Días del mes anterior para rellenar
    const prevMonthEnd = new Date(year, month, 0).getDate()
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        dateStr: `${month === 0 ? year - 1 : year}-${String(month === 0 ? 12 : month).padStart(2, '0')}-${String(prevMonthEnd - i).padStart(2, '0')}`,
        dayNum: prevMonthEnd - i,
        isCurrentMonth: false
      })
    }

    // Días del mes actual
    const lastDay = new Date(year, month + 1, 0).getDate()
    for (let i = 1; i <= lastDay; i++) {
      days.push({
        dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        dayNum: i,
        isCurrentMonth: true
      })
    }

    // Días del mes siguiente para completar la cuadrícula (hasta múltiplos de 7)
    const remainingCells = 42 - days.length
    for (let i = 1; i <= remainingCells; i++) {
      days.push({
        dateStr: `${month === 11 ? year + 1 : year}-${String(month === 11 ? 1 : month + 2).padStart(2, '0')}-${String(i).padStart(2, '0')}`,
        dayNum: i,
        isCurrentMonth: false
      })
    }

    return days
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1)
    } else {
      newDate.setMonth(newDate.getMonth() + 1)
    }
    setCurrentDate(newDate)
  }

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]

  const calendarDays = getDaysInMonth(currentDate)

  // =========================================================================
  // ANALYTICS CALCULATIONS
  // =========================================================================
  const getAnalyticsData = () => {
    if (atenciones.length === 0) return { totalClientes: 0, promDiario: 0, topAsesor: 'N/A', topEtiqueta: 'N/A', chartLine: [], chartBar: [], chartPie: [] }

    // 1. Clientes totales
    const totalClientes = atenciones.reduce((acc, curr) => acc + curr.total_clientes, 0)
    
    // 2. Promedio diario
    const uniqueDates = Array.from(new Set(atenciones.map(a => a.fecha)))
    const promDiario = Math.round(totalClientes / (uniqueDates.length || 1))

    // 3. Reparto por asesor
    const asesorCounts: Record<string, number> = {}
    atenciones.forEach(a => {
      const name = a.asesor?.nombre || 'Desconocido'
      asesorCounts[name] = (asesorCounts[name] || 0) + a.total_clientes
    })
    
    let topAsesor = 'N/A'
    let maxAsesorVal = 0
    const chartBar = Object.keys(asesorCounts).map(name => {
      const val = asesorCounts[name]
      if (val > maxAsesorVal) {
        maxAsesorVal = val
        topAsesor = name
      }
      return { name, clientes: val }
    })

    // 4. Reparto por etiqueta
    const etiquetaCounts: Record<string, number> = {}
    atenciones.forEach(a => {
      Object.keys(a.etiquetas).forEach(key => {
        etiquetaCounts[key] = (etiquetaCounts[key] || 0) + (a.etiquetas[key] || 0)
      })
    })

    let topEtiqueta = 'N/A'
    let maxTagVal = 0
    const chartPie = Object.keys(etiquetaCounts).map(name => {
      const val = etiquetaCounts[name]
      if (val > maxTagVal) {
        maxTagVal = val
        topEtiqueta = name
      }
      const tagObj = etiquetas.find(t => t.nombre === name)
      return { name, value: val, color: tagObj?.color || '#3b82f6' }
    })

    // 5. Historial diario (últimos 15 días con registros)
    const datesWithClients: Record<string, number> = {}
    atenciones.forEach(a => {
      datesWithClients[a.fecha] = (datesWithClients[a.fecha] || 0) + a.total_clientes
    })

    const chartLine = Object.keys(datesWithClients)
      .sort()
      .slice(-15)
      .map(fecha => {
        const [y, m, d] = fecha.split('-')
        return {
          fechaLabel: `${d}/${m}`,
          Clientes: datesWithClients[fecha]
        }
      })

    return { totalClientes, promDiario, topAsesor, topEtiqueta, chartLine, chartBar, chartPie }
  }

  const analytics = getAnalyticsData()

  // Cumplimiento Whatsapp mensual
  const getWhatsappCompliance = () => {
    const curYear = currentDate.getFullYear()
    const curMonth = currentDate.getMonth()
    const startStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-01`
    const endStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-31` // Aceptable para Supabase filter

    const thisMonthTasks = estadosWhatsapp.filter(t => t.fecha.startsWith(`${curYear}-${String(curMonth + 1).padStart(2, '0')}`))
    
    const complianceByAsesor: Record<string, { total: number, cumplido: number, incumplido: number }> = {}
    
    // Inicializar con todos los asesores activos
    asesores.forEach(a => {
      complianceByAsesor[a.nombre] = { total: 0, cumplido: 0, incumplido: 0 }
    })

    thisMonthTasks.forEach(task => {
      const name = task.asesor?.nombre || 'Desconocido'
      if (!complianceByAsesor[name]) {
        complianceByAsesor[name] = { total: 0, cumplido: 0, incumplido: 0 }
      }
      complianceByAsesor[name].total += 1
      if (task.estado === 'cumplido') {
        complianceByAsesor[name].cumplido += 1
      } else if (task.estado === 'incumplido') {
        complianceByAsesor[name].incumplido += 1
      }
    })

    return Object.keys(complianceByAsesor).map(name => {
      const stats = complianceByAsesor[name]
      const rate = stats.total === 0 ? 100 : Math.round((stats.cumplido / stats.total) * 100)
      return {
        name,
        total: stats.total,
        cumplido: stats.cumplido,
        incumplido: stats.incumplido,
        rate,
        hasWarning: stats.total > 0 && rate < 80
      }
    })
  }

  const wpCompliance = getWhatsappCompliance()

  return (
    <div className="space-y-6 pb-20">
      {/* HEADER DE MÓDULO */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            Atención al Cliente
          </h2>
          <p className="text-muted text-sm mt-1">Control diario de respuestas, etiquetas y planificación de estados de WhatsApp.</p>
        </div>
      </div>

      {/* NOTIFICACIONES */}
      {errorMsg && (
        <div className="flex items-center gap-2 p-4 bg-danger-soft border border-danger/20 rounded-2xl text-danger text-sm animate-in fade-in duration-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 p-4 bg-success-soft border border-success/20 rounded-2xl text-success text-sm animate-in fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p>{successMsg}</p>
        </div>
      )}

      {/* TABS DE SECCIÓN */}
      <div className="flex p-1 bg-surface border border-border rounded-2xl w-full md:w-fit overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveTab('registro')}
          className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer ${
            activeTab === 'registro' ? 'bg-accent text-on-accent shadow-none' : 'text-muted hover:text-foreground'
          }`}
        >
          <Plus className="w-4 h-4" /> Registro Diario
        </button>
        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer ${
            activeTab === 'whatsapp' ? 'bg-accent text-on-accent shadow-none' : 'text-muted hover:text-foreground'
          }`}
        >
          <Calendar className="w-4 h-4" /> Estados de WhatsApp
        </button>
        <button
          onClick={() => setActiveTab('historial')}
          className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer ${
            activeTab === 'historial' ? 'bg-accent text-on-accent shadow-none' : 'text-muted hover:text-foreground'
          }`}
        >
          <History className="w-4 h-4" /> Historial de Registros
        </button>
        <button
          onClick={() => setActiveTab('graficos')}
          className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer ${
            activeTab === 'graficos' ? 'bg-accent text-on-accent shadow-none' : 'text-muted hover:text-foreground'
          }`}
        >
          <BarChart3 className="w-4 h-4" /> Informes y Gráficos
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer ${
            activeTab === 'config' ? 'bg-accent text-on-accent shadow-none' : 'text-muted hover:text-foreground'
          }`}
        >
          <Settings className="w-4 h-4" /> Configuración
        </button>
      </div>

      {loading ? (
        <div className="bg-surface border border-border rounded-xl p-20 flex flex-col items-center justify-center text-muted gap-3">
          <Loader2 className="w-8 h-8 text-accent-foreground animate-spin" />
          <span>Cargando datos del módulo de atención...</span>
        </div>
      ) : (
        <>
          {/* TAB 1: REGISTRO DIARIO */}
          {activeTab === 'registro' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Formulario de registro */}
              <form onSubmit={handleSaveAtencion} className="lg:col-span-2 bg-surface border border-border rounded-xl p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-1 flex items-center gap-2">
                    {editingAtencionId ? 'Modificar Registro de Atención' : 'Nuevo Reporte de Atención'}
                  </h3>
                  <p className="text-xs text-muted">Ingresa la cantidad de clientes respondidos por cada etiqueta.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-1.5">Fecha del Reporte</label>
                    <input
                      type="date"
                      value={registroFecha}
                      onChange={(e) => setRegistroFecha(e.target.value)}
                      className="w-full bg-subtle border border-border rounded-xl px-4 py-2.5 text-foreground focus:ring-2 focus:ring-accent outline-none transition-all text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-1.5">Asesor de Redes</label>
                    <select
                      value={registroAsesor}
                      onChange={(e) => setRegistroAsesor(e.target.value)}
                      className="w-full bg-subtle border border-border rounded-xl px-4 py-2.5 text-foreground focus:ring-2 focus:ring-accent outline-none transition-all text-sm appearance-none cursor-pointer"
                      required
                    >
                      <option value="">-- Seleccionar Asesor --</option>
                      {asesores.filter(a => a.activo).map(a => (
                        <option key={a.id} value={a.id}>{a.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Campos dinámicos de Etiquetas */}
                <div>
                  <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-4">Etiquetas y Volúmenes de Clientes</label>
                  
                  {etiquetas.length === 0 ? (
                    <div className="p-4 bg-subtle border border-border rounded-xl text-center text-xs text-muted">
                      No hay etiquetas configuradas. Ve a la pestaña de "Configuración" para crear etiquetas.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {etiquetas.filter(t => t.activo).map((tag) => (
                        <div key={tag.id} className="bg-subtle border border-border rounded-2xl p-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2.5">
                            <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: tag.color || '#3b82f6' }} />
                            <span className="text-sm font-semibold text-foreground">{tag.nombre}</span>
                          </div>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={registroValores[tag.id] ?? ''}
                            onChange={(e) => handleValoresChange(tag.id, e.target.value)}
                            className="w-20 text-right bg-surface border border-border rounded-xl px-2.5 py-1.5 text-foreground focus:ring-2 focus:ring-accent outline-none font-mono text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Campo Observaciones */}
                <div>
                  <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-1.5">Observaciones / Detalles del día</label>
                  <textarea
                    value={registroObs}
                    onChange={(e) => setRegistroObs(e.target.value)}
                    placeholder="Ej. WhatsApp lento por la tarde o temáticas de campañas publicitarias especiales."
                    rows={3}
                    className="w-full bg-subtle border border-border rounded-xl px-4 py-2.5 text-foreground focus:ring-2 focus:ring-accent outline-none transition-all text-sm resize-none"
                  />
                </div>

                {/* Indicador de Total de Clientes */}
                <div className="bg-accent-soft border border-accent/25 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Resumen de Clientes</h4>
                    <p className="text-[10px] text-muted mt-0.5">Volumen total de atención registrado.</p>
                  </div>
                  <div className="text-2xl font-extrabold text-accent-foreground font-mono">
                    {(() => {
                      const clientTag = etiquetas.find(
                        t => t.nombre.trim().toLowerCase() === 'clientes atendidos' || t.nombre.trim().toLowerCase() === 'cliente atendido'
                      )
                      if (clientTag) {
                        return registroValores[clientTag.id] || 0
                      }
                      return Object.values(registroValores).reduce((acc, curr) => acc + curr, 0)
                    })()} <span className="text-xs text-muted font-normal">clientes</span>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex gap-3 pt-2">
                  {editingAtencionId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAtencionId(null)
                        setRegistroObs('')
                        const emptyVals: Record<string, number> = {}
                        etiquetas.forEach(t => { emptyVals[t.id] = 0 })
                        setRegistroValores(emptyVals)
                      }}
                      className="px-5 py-2.5 bg-subtle hover:bg-hover text-foreground rounded-xl font-semibold transition-all text-sm"
                    >
                      Cancelar Edición
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-accent hover:bg-accent-hover disabled:opacity-50 text-on-accent font-bold py-2.5 rounded-xl transition-all shadow-none flex items-center justify-center gap-2 text-sm"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {editingAtencionId ? 'Guardar Cambios' : 'Registrar Reporte del Día'}
                  </button>
                </div>
              </form>

              {/* Panel lateral: Mini-estadísticas y Guía */}
              <div className="space-y-6">
                <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
                  <h3 className="text-md font-bold text-foreground flex items-center gap-2">
                    Atendidos Hoy
                  </h3>
                  <div className="divide-y divide-border">
                    {asesores.map(as => {
                      const todayRecord = atenciones.find(
                        atn => atn.fecha === new Date().toISOString().split('T')[0] && atn.asesor_id === as.id
                      )
                      return (
                        <div key={as.id} className="py-3 flex justify-between items-center first:pt-0 last:pb-0">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{as.nombre}</p>
                            <p className="text-[10px] text-muted">{as.activo ? 'Activo' : 'Inactivo'}</p>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                            todayRecord 
                              ? 'bg-accent-soft border border-accent/20 text-accent-foreground'
                              : 'bg-subtle text-muted'
                          }`}>
                            {todayRecord ? `${todayRecord.total_clientes} clientes` : 'Pendiente'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="bg-surface border border-border rounded-xl p-6 text-sm text-muted space-y-3">
                  <h4 className="font-bold text-foreground">Instrucciones del Módulo</h4>
                  <p>1. Selecciona el **Asesor** y la **Fecha** del reporte.</p>
                  <p>2. Ingresa la cantidad de chats/etiquetas catalogadas.</p>
                  <p>3. El sistema almacena la sumatoria y genera métricas diarias de flujo de atención.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CALENDARIO ESTADOS WHATSAPP */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-6">
              {/* Controles de Calendario */}
              <div className="bg-surface border border-border rounded-xl p-6 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent-soft text-accent-foreground rounded-xl">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Programación de Estados</h3>
                    <p className="text-xs text-muted">Asigna temáticas y lleva el control mensual de estados obligatorios.</p>
                  </div>
                </div>

                {/* Navegador de meses */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigateMonth('prev')}
                    className="p-2.5 bg-subtle border border-border hover:bg-hover rounded-xl text-muted hover:text-foreground transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-bold text-foreground min-w-[120px] text-center">
                    {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </span>
                  <button
                    onClick={() => navigateMonth('next')}
                    className="p-2.5 bg-subtle border border-border hover:bg-hover rounded-xl text-muted hover:text-foreground transition-all cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Grid Principal del Calendario */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 bg-surface border border-border rounded-xl p-6 shadow-sm overflow-hidden">
                  {/* Días de la semana */}
                  <div className="grid grid-cols-7 gap-2 text-center mb-3">
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                      <span key={d} className="text-[10px] font-bold text-muted uppercase tracking-widest">{d}</span>
                    ))}
                  </div>

                  {/* Cuadrícula de celdas */}
                  <div className="grid grid-cols-7 gap-2 min-h-[450px]">
                    {calendarDays.map((day, idx) => {
                      // Buscar tareas asignadas a este día
                      const dayTasks = estadosWhatsapp.filter(t => t.fecha === day.dateStr)

                      return (
                        <div
                          key={idx}
                          className={`min-h-[75px] border rounded-2xl p-2 flex flex-col justify-between transition-all group relative ${
                            day.isCurrentMonth
                              ? 'bg-subtle border-border hover:border-border-strong'
                              : 'bg-subtle border-border text-muted'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <span className={`text-[10px] font-bold ${day.isCurrentMonth ? 'text-muted' : 'text-muted'}`}>
                              {day.dayNum}
                            </span>
                            
                            {/* Botón rápido para agregar tarea */}
                            {day.isCurrentMonth && (
                              <button
                                onClick={() => openWpCreateModal(day.dateStr)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 bg-accent-soft hover:bg-accent-hover text-accent-foreground hover:text-on-accent rounded-md transition-all cursor-pointer scale-75"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Listado de tareas del día */}
                          <div className="mt-1 flex-1 space-y-1 overflow-y-auto max-h-[70px] scrollbar-thin">
                            {dayTasks.map(task => {
                              const borderClass = 
                                task.estado === 'cumplido' ? 'border-success/25 bg-success-soft text-success' :
                                task.estado === 'incumplido' ? 'border-danger/25 bg-danger-soft text-danger' :
                                'border-warning/20 bg-warning-soft text-warning'

                              return (
                                <button
                                  key={task.id}
                                  onClick={() => openWpEditModal(task)}
                                  className={`w-full text-left p-1 rounded-lg border text-[8px] font-bold leading-tight truncate flex flex-col cursor-pointer transition-all hover:scale-[1.02] ${borderClass}`}
                                  title={`${task.asesor?.nombre}: ${task.tematica}`}
                                >
                                  <span className="truncate">{task.asesor?.nombre.split(' ')[0]}</span>
                                  <span className="opacity-85 font-normal truncate">{task.tematica}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Panel Lateral: Tasa de Cumplimiento Mensual */}
                <div className="space-y-6">
                  <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
                    <h3 className="text-md font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                      Cumplimiento de WhatsApp
                    </h3>
                    
                    {wpCompliance.length === 0 ? (
                      <p className="text-xs text-muted italic text-center py-4">No hay tareas programadas este mes.</p>
                    ) : (
                      <div className="space-y-4">
                        {wpCompliance.map((item, idx) => (
                          <div key={idx} className="space-y-2">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-foreground">{item.name}</span>
                              <span className={`font-bold font-mono ${item.rate >= 80 ? 'text-success' : 'text-danger animate-pulse'}`}>
                                {item.rate}%
                              </span>
                            </div>
                            
                            {/* Barra de progreso */}
                            <div className="h-2 bg-subtle border border-border rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  item.rate >= 80 ? 'bg-success-solid' : 'bg-danger-solid'
                                }`} 
                                style={{ width: `${item.rate}%` }}
                              />
                            </div>

                            <div className="flex justify-between text-[9px] text-muted font-mono">
                              <span>Total: {item.total}</span>
                              <span>OK: {item.cumplido} | Fails: {item.incumplido}</span>
                            </div>

                            {/* Alerta de Warning */}
                            {item.hasWarning && (
                              <div className="flex items-center gap-1.5 p-2 bg-danger-soft border border-danger/20 rounded-xl text-[9px] text-danger font-medium">
                                <AlertTriangle className="w-3.5 h-3.5 text-danger flex-shrink-0 animate-bounce" />
                                <span>Alerta: Cumplimiento bajo el 80%</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-surface border border-border rounded-xl p-6 text-xs text-muted space-y-3">
                    <h4 className="font-bold text-foreground">Reglas del Calendario</h4>
                    <p>1. Haz clic en el icono **(+)** de una fecha para programar un estado obligatorio.</p>
                    <p>2. Al finalizar el día, haz clic en la tarea para marcar como **Cumplido** o **Incumplido**.</p>
                    <p>3. En caso de no subirse, añade el motivo. Los fallos restan a la tasa de cumplimiento del mes.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: HISTORIAL DE REGISTROS */}
          {activeTab === 'historial' && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-border bg-surface flex justify-between items-center">
                <h3 className="text-lg font-bold text-foreground">Registros de Atención y Estados</h3>
                <span className="text-[10px] bg-subtle text-muted px-3 py-1 rounded-full font-bold uppercase tracking-widest font-mono">
                  {atenciones.length} Registros de Clientes
                </span>
              </div>

              {/* Tabla de atenciones diarias */}
              {atenciones.length === 0 ? (
                <div className="p-20 text-center text-muted italic">No hay registros de atención creados.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-subtle">
                        <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest">Fecha</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest">Asesor</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest">Desglose de Etiquetas</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest">Clientes Atendidos</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest">Observación</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-widest text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {atenciones.map(atn => (
                        <tr key={atn.id} className="hover:bg-hover transition-colors group">
                          <td className="px-6 py-4 text-sm font-semibold text-foreground font-mono">{atn.fecha}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-muted">{atn.asesor?.nombre || 'Desconocido'}</td>
                          <td className="px-6 py-4 text-xs max-w-xs md:max-w-md">
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(atn.etiquetas).map(([name, qty]) => {
                                if ((qty as number) <= 0) return null
                                const tagObj = etiquetas.find(t => t.nombre === name)
                                return (
                                  <span 
                                    key={name} 
                                    className="px-2 py-0.5 rounded text-[9px] font-bold font-mono border"
                                    style={{ 
                                      color: tagObj?.color || '#3b82f6', 
                                      backgroundColor: `${tagObj?.color || '#3b82f6'}10`,
                                      borderColor: `${tagObj?.color || '#3b82f6'}30`
                                    }}
                                  >
                                    {name}: {qty as number}
                                  </span>
                                )
                              })}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-accent-foreground font-mono">{atn.total_clientes}</td>
                          <td className="px-6 py-4 text-xs text-muted truncate max-w-[150px]" title={atn.observaciones}>
                            {atn.observaciones || '---'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleEditAtencion(atn)}
                                className="p-2 text-muted hover:text-accent-foreground hover:bg-accent-soft rounded-lg transition-all"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteAtencion(atn.id)}
                                className="p-2 text-muted hover:text-danger hover:bg-danger-soft rounded-lg transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: INFORMES Y GRÁFICOS */}
          {activeTab === 'graficos' && (
            <div className="space-y-6">
              {/* Tarjetas de Métricas */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-surface border border-border rounded-xl p-6 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest block">Total Clientes Atendidos</span>
                    <span className="text-3xl font-extrabold text-foreground block mt-1.5 font-mono">{analytics.totalClientes}</span>
                  </div>
                  <div className="p-3 bg-accent-soft text-accent-foreground rounded-2xl">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-surface border border-border rounded-xl p-6 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest block">Promedio Diario</span>
                    <span className="text-3xl font-extrabold text-foreground block mt-1.5 font-mono">{analytics.promDiario}</span>
                  </div>
                  <div className="p-3 bg-success-soft text-success rounded-2xl">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-surface border border-border rounded-xl p-6 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest block">Top Asesor</span>
                    <span className="text-lg font-bold text-foreground block mt-2 truncate max-w-[150px]">{analytics.topAsesor}</span>
                  </div>
                  <div className="p-3 bg-warning-soft text-warning rounded-2xl">
                    <User className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-surface border border-border rounded-xl p-6 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest block">Canal / Etiqueta Top</span>
                    <span className="text-lg font-bold text-foreground block mt-2 truncate max-w-[150px]">{analytics.topEtiqueta}</span>
                  </div>
                  <div className="p-3 bg-info-soft text-info rounded-2xl">
                    <Tags className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Renderizado de gráficos con control SSR */}
              {isMounted ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Historial de Flujo Diario */}
                  <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
                    <h3 className="text-sm font-bold text-foreground tracking-wide uppercase text-muted">Tendencia de Flujo Diario (Últimos 15 días)</h3>
                    <div className="h-72 w-full text-xs font-mono">
                      {analytics.chartLine.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-muted italic">No hay suficientes datos.</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={analytics.chartLine} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="fechaLabel" stroke="var(--muted-foreground)" />
                            <YAxis stroke="var(--muted-foreground)" />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--foreground)' }} />
                            <Line type="monotone" dataKey="Clientes" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Comparativa por Asesores */}
                  <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
                    <h3 className="text-sm font-bold text-foreground tracking-wide uppercase text-muted">Volumen de Clientes por Asesor</h3>
                    <div className="h-72 w-full text-xs font-mono">
                      {analytics.chartBar.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-muted italic">No hay suficientes datos.</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.chartBar} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="name" stroke="var(--muted-foreground)" />
                            <YAxis stroke="var(--muted-foreground)" />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--foreground)' }} />
                            <Bar dataKey="clientes" radius={[8, 8, 0, 0]}>
                              {analytics.chartBar.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][index % 4]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Distribución por Etiquetas (Pie Chart) */}
                  <div className="bg-surface border border-border rounded-xl p-6 space-y-4 lg:col-span-2">
                    <h3 className="text-sm font-bold text-foreground tracking-wide uppercase text-muted">Composición por Categorías de Chat (Etiquetas)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                      <div className="md:col-span-2 h-72 w-full text-xs font-mono">
                        {analytics.chartPie.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-muted italic">No hay suficientes datos.</div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={analytics.chartPie}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={90}
                                paddingAngle={4}
                                dataKey="value"
                              >
                                {analytics.chartPie.map((entry: any, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--foreground)' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                      
                      {/* Leyenda personalizada */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-muted uppercase tracking-widest mb-3">Distribución Porcentual</h4>
                        <div className="space-y-2">
                          {analytics.chartPie.map((item: any, idx) => {
                            const pct = Math.round((item.value / analytics.totalClientes) * 100)
                            return (
                              <div key={idx} className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                  <span className="text-secondary font-semibold">{item.name}</span>
                                </div>
                                <span className="text-muted font-bold font-mono">{item.value} ({pct}%)</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 5: CONFIGURACIÓN */}
          {activeTab === 'config' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Administrar Asesores */}
              <div className="bg-surface border border-border rounded-xl p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-1">Personal Asesor</h3>
                  <p className="text-xs text-muted">Agrega o retira asesores que operan en los canales de redes.</p>
                </div>

                <form onSubmit={handleAddAsesor} className="flex gap-2">
                  <input
                    type="text"
                    value={newAsesorName}
                    onChange={(e) => setNewAsesorName(e.target.value)}
                    placeholder="Nombre del nuevo asesor..."
                    className="flex-1 bg-subtle border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-accent outline-none"
                    required
                  />
                  <button
                    type="submit"
                    className="bg-accent hover:bg-accent-hover text-on-accent rounded-xl px-4 font-bold text-xs flex items-center gap-1.5 shadow-md hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Agregar
                  </button>
                </form>

                <div className="divide-y divide-border border-t border-border pt-4">
                  {asesores.map(as => (
                    <div key={as.id} className="py-3 flex justify-between items-center">
                      <span className="text-sm font-semibold text-foreground">{as.nombre}</span>
                      <button
                        onClick={() => handleDeleteAsesor(as.id)}
                        className="p-2 text-muted hover:text-danger hover:bg-danger-soft rounded-lg transition-all"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Administrar Etiquetas */}
              <div className="bg-surface border border-border rounded-xl p-6 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-1">Etiquetas del Flujo</h3>
                  <p className="text-xs text-muted">Gestiona las etiquetas o motivos de contacto utilizados.</p>
                </div>

                <form onSubmit={handleAddTag} className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="Nombre de etiqueta (ej: Facturación)..."
                      className="flex-1 bg-subtle border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-accent outline-none"
                      required
                    />
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="w-12 h-10 bg-subtle border border-border rounded-xl p-1.5 cursor-pointer"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-accent hover:bg-accent-hover text-on-accent rounded-xl py-2.5 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Crear Etiqueta
                  </button>
                </form>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-border pt-4">
                  {etiquetas.map(tag => (
                    <div key={tag.id} className="bg-subtle border border-border p-3 rounded-2xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color || '#3b82f6' }} />
                        <span className="text-xs font-semibold text-foreground truncate">{tag.nombre}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteTag(tag.id)}
                        className="p-1.5 text-muted hover:text-danger hover:bg-danger-soft rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL PLANIFICADOR DE ESTADOS WHATSAPP */}
      {whatsappModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <form 
            onSubmit={handleSaveWpTask}
            className="w-full max-w-md bg-surface border border-border rounded-xl shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-bold text-foreground">
                {selectedTask ? 'Actualizar Cumplimiento de Estado' : 'Programar Estado de WhatsApp'}
              </h3>
              <p className="text-xs text-muted mt-1">Define la fecha, asesor y temática que el asesor debe subir.</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Fecha */}
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-1">Fecha</label>
                <input
                  type="date"
                  value={wpFecha}
                  onChange={(e) => setWpFecha(e.target.value)}
                  className="w-full bg-subtle border border-border rounded-xl px-4 py-2.5 text-foreground focus:ring-2 focus:ring-accent outline-none text-sm"
                  required
                  disabled={!!selectedTask}
                />
              </div>

              {/* Asesor */}
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-1">Asesor Responsable</label>
                <select
                  value={wpAsesor}
                  onChange={(e) => setWpAsesor(e.target.value)}
                  className="w-full bg-subtle border border-border rounded-xl px-4 py-2.5 text-foreground focus:ring-2 focus:ring-accent outline-none text-sm cursor-pointer"
                  required
                  disabled={!!selectedTask}
                >
                  <option value="">-- Seleccionar Asesor --</option>
                  {asesores.filter(a => a.activo).map(a => (
                    <option key={a.id} value={a.id}>{a.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Temática */}
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-1">Temática del Estado</label>
                <input
                  type="text"
                  value={wpTematica}
                  onChange={(e) => setWpTematica(e.target.value)}
                  placeholder="Ej. Promoción repuestos Boxer o Horarios de Semana Santa"
                  className="w-full bg-subtle border border-border rounded-xl px-4 py-2.5 text-foreground focus:ring-2 focus:ring-accent outline-none text-sm"
                  required
                  disabled={!!selectedTask}
                />
              </div>

              {/* Cantidad y Estado */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-1">Cant. Estados</label>
                  <input
                    type="number"
                    min="1"
                    value={wpCantidad}
                    onChange={(e) => setWpCantidad(parseInt(e.target.value, 10))}
                    className="w-full bg-subtle border border-border rounded-xl px-4 py-2.5 text-foreground focus:ring-2 focus:ring-accent outline-none text-sm font-mono"
                    required
                    disabled={!!selectedTask}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-1">Estado</label>
                  <select
                    value={wpEstado}
                    onChange={(e) => setWpEstado(e.target.value as any)}
                    className="w-full bg-subtle border border-border rounded-xl px-4 py-2.5 text-foreground focus:ring-2 focus:ring-accent outline-none text-sm cursor-pointer"
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="cumplido">Cumplido</option>
                    <option value="incumplido">Incumplido</option>
                  </select>
                </div>
              </div>

              {/* Observación / Warning */}
              <div>
                <label className="block text-xs font-bold text-muted uppercase tracking-widest mb-1">
                  Observaciones {wpEstado === 'incumplido' && <span className="text-danger">*</span>}
                </label>
                <textarea
                  value={wpObservacion}
                  onChange={(e) => setWpObservacion(e.target.value)}
                  placeholder={wpEstado === 'incumplido' ? 'Especifica por qué NO se subió el estado (Obligatorio)...' : 'Opcional...'}
                  rows={2}
                  className="w-full bg-subtle border border-border rounded-xl px-4 py-2.5 text-foreground focus:ring-2 focus:ring-accent outline-none text-sm resize-none"
                  required={wpEstado === 'incumplido'}
                />
              </div>
            </div>

            <div className="p-6 border-t border-border bg-surface flex gap-3">
              {selectedTask && (
                <button
                  type="button"
                  onClick={() => handleDeleteWpTask(selectedTask.id)}
                  className="px-4 py-2 bg-danger-soft hover:bg-danger-solid hover:text-on-accent text-danger rounded-xl font-bold text-xs transition-all cursor-pointer"
                >
                  Eliminar
                </button>
              )}
              <button
                type="button"
                onClick={() => setWhatsappModalOpen(false)}
                className="flex-1 px-4 py-2 bg-subtle hover:bg-hover text-foreground rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-accent hover:bg-accent-hover disabled:opacity-50 text-on-accent font-bold py-2 rounded-xl transition-all shadow-md shadow-none flex items-center justify-center gap-1.5 text-xs cursor-pointer"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
