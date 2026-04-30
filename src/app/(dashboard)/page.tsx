import { Package, Truck, Users, ArrowUpRight, Clock, CheckCircle2, BarChart2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { GlobalAdminStats } from './GlobalAdminStats'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol, nombre')
    .eq('id', user?.id)
    .single()

  const isAdmin = perfil?.rol === 'Admin'

  // Calcular el inicio del mes actual
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // Obtener conteos reales de la base de datos y toda la data del mes para las gráficas
  const [
    { count: totalPedidosMes },
    { count: totalPendientesMes },
    { count: totalMensajeros },
    { count: totalUsuarios },
    { data: pedidosDelMes },
    { data: enviosRecientes }
  ] = await Promise.all([
    supabase.from('pedidos').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth),
    supabase.from('pedidos').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth).eq('estado', 'pendiente'),
    supabase.from('mensajeros').select('*', { count: 'exact', head: true }).neq('estado', 'inactivo'),
    supabase.from('perfiles').select('*', { count: 'exact', head: true }),
    supabase.from('pedidos').select('created_at, estado, numero_pedidos').gte('created_at', startOfMonth),
    supabase.from('envios')
      .select('id, created_at, estado, mensajero:mensajeros(nombre_conductor), pedido:pedidos(numero_factura)')
      .gte('created_at', startOfMonth)
      .order('created_at', { ascending: false })
      .limit(6)
  ])

  const stats = [
    { name: 'Pedidos del Mes', value: (totalPedidosMes || 0).toString(), change: 'Actualizado', icon: Package, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { name: 'Mensajeros Activos', value: (totalMensajeros || 0).toString(), change: 'Sistema', icon: Truck, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { name: 'Pendientes por Enviar', value: (totalPendientesMes || 0).toString(), change: 'Urgente', icon: Package, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { name: 'Usuarios del Sistema', value: (totalUsuarios || 0).toString(), change: 'Estable', icon: Users, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ]
  
  if (!isAdmin) {
    return (
      <div className="space-y-8">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-8 text-white shadow-xl shadow-blue-900/20">
          <h2 className="text-3xl font-bold">¡Bienvenid@, {perfil?.nombre || 'Operador'}!</h2>
          <p className="mt-2 text-blue-100 opacity-90 max-w-lg">
            Panel operativo filtrado por el mes de <span className="font-bold underline">{new Date().toLocaleDateString('es-ES', { month: 'long' })}</span>.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link href="/despachos" className="group bg-neutral-900 border border-neutral-800 p-6 rounded-2xl hover:border-blue-500/50 transition-all shadow-sm">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 mb-4 group-hover:scale-110 transition-transform">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Gestionar Despachos</h3>
            <p className="text-sm text-neutral-500 mt-1">Registra pedidos y asigna rutas a los mensajeros.</p>
          </Link>

          <Link href="/mensajeros" className="group bg-neutral-900 border border-neutral-800 p-6 rounded-2xl hover:border-emerald-500/50 transition-all shadow-sm">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 mb-4 group-hover:scale-110 transition-transform">
              <Truck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Mensajeros</h3>
            <p className="text-sm text-neutral-500 mt-1">Consulta la disponibilidad de los domiciliarios.</p>
          </Link>


        </div>

        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4 text-emerald-400 font-medium">
            <CheckCircle2 className="w-5 h-5" />
            <span>Resumen del Estado Operativo Mensual</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800">
               <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Pedidos registradas</p>
               <p className="text-xl font-bold text-white mt-1">{totalPedidosMes || 0}</p>
             </div>
             <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800">
               <p className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Por enviar</p>
               <p className="text-xl font-bold text-white mt-1">{totalPendientesMes || 0}</p>
             </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Panel de Administración</h2>
          <p className="text-neutral-400 text-sm mt-1">Métricas de <span className="text-blue-500 font-bold">{new Date().toLocaleDateString('es-ES', { month: 'long' })}</span>.</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]">
          <Package className="w-4 h-4" />
          <span>Generar Reporte Mensual</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.name} className="bg-neutral-900/50 backdrop-blur-sm border border-neutral-800 rounded-2xl p-5 hover:bg-neutral-800/80 transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.bg}`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
                  <ArrowUpRight className="w-3 h-3" />
                  {stat.change}
                </div>
              </div>
              <h3 className="text-neutral-400 text-sm font-medium">{stat.name}</h3>
              <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
            </div>
          )
        })}
      </div>

      <GlobalAdminStats pedidos={pedidosDelMes || []} />

      {/* Actividad Reciente */}
      <div className="bg-neutral-900/50 backdrop-blur-sm border border-neutral-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <BarChart2 className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-bold text-white">Actividad Reciente de Envíos</h3>
          <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold ml-2">Este mes</span>
        </div>
        {!enviosRecientes || enviosRecientes.length === 0 ? (
          <p className="text-neutral-500 italic text-sm text-center py-8">No hay envíos registrados este mes.</p>
        ) : (
          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-neutral-800"></div>
            <div className="space-y-5 pl-6">
              {enviosRecientes.map((envio: any) => {
                const isFinalizado = envio.estado === 'entregado'
                return (
                  <div key={envio.id} className="relative flex items-start gap-4">
                    <div className={`absolute -left-6 w-3.5 h-3.5 rounded-full border-2 mt-1 ${
                      isFinalizado
                        ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                        : 'bg-blue-500 border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
                    }`}></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white truncate">
                          {(envio.mensajero as any)?.nombre_conductor || 'Mensajero'}
                        </p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${
                          isFinalizado
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                        }`}>
                          {isFinalizado ? 'Entregado' : 'En camino'}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5 truncate">
                        Fact: {(envio.pedido as any)?.numero_factura || 'N/A'}
                      </p>
                      <p className="text-[10px] text-neutral-600 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(envio.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} — {new Date(envio.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
