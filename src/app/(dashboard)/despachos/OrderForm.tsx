import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, X, CheckCircle2, AlertCircle, Plus, Trash2, Building2, MapPin } from 'lucide-react'
import { createPedido } from './actions'
import { getConfiguraciones } from '../admin/configuracion/actions'

const orderSchema = z.object({
  punto: z.enum(['Principal', 'Sucursal']),
  facturas: z.array(z.object({
    numero: z.string().min(1, 'Número requerido')
  })).min(1, 'Ingrese al menos una factura'),
  area: z.string().min(1, 'Seleccione un área'),
  revisado_por: z.string().min(1, 'Seleccione quién revisó'),
  mesa: z.string().min(1, 'Seleccione una mesa'),
  detalles: z.string().optional(),
})

type OrderFormData = z.infer<typeof orderSchema>

interface OrderFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export function OrderForm({ onSuccess, onCancel }: OrderFormProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [dynamicOptions, setDynamicOptions] = useState<{
    Principal: { areas: string[], revisadores: string[], mesas: string[] },
    Sucursal: { areas: string[], revisadores: string[], mesas: string[] }
  }>({
    Principal: { areas: [], revisadores: [], mesas: [] },
    Sucursal: { areas: [], revisadores: [], mesas: [] }
  })
  const [loadingOptions, setLoadingOptions] = useState(true)

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      punto: 'Principal',
      facturas: [{ numero: '' }],
      area: '',
      revisado_por: '',
      mesa: 'No aplica',
      detalles: '',
    },
  })

  useEffect(() => {
    async function loadOptions() {
      try {
        const data = await getConfiguraciones()
        
        const newOptions = {
          Principal: { areas: [] as string[], revisadores: [] as string[], mesas: [] as string[] },
          Sucursal: { areas: [] as string[], revisadores: [] as string[], mesas: [] as string[] }
        }

        data.forEach((item: any) => {
          if (item.categoria === 'area') {
            if (item.punto === 'Principal') newOptions.Principal.areas.push(item.valor)
            if (item.punto === 'Sucursal') newOptions.Sucursal.areas.push(item.valor)
          } else if (item.categoria === 'revisor') {
            if (item.punto === 'Principal') newOptions.Principal.revisadores.push(item.valor)
            if (item.punto === 'Sucursal') newOptions.Sucursal.revisadores.push(item.valor)
          } else if (item.categoria === 'mesa') {
            if (item.punto === 'Principal') newOptions.Principal.mesas.push(item.valor)
            if (item.punto === 'Sucursal') newOptions.Sucursal.mesas.push(item.valor)
          }
        })

        setDynamicOptions(newOptions)
      } catch (err) {
        console.error("Error cargando opciones:", err)
      } finally {
        setLoadingOptions(false)
      }
    }
    loadOptions()
  }, [])

  const { fields, append, remove } = useFieldArray({
    control,
    name: "facturas"
  })

  const punto = watch('punto')

  // Reset dependent fields when punto changes
  useEffect(() => {
    setValue('area', '')
    setValue('revisado_por', '')
  }, [punto, setValue])

  const onSubmit = async (data: OrderFormData) => {
    setServerError(null)
    
    // Transformamos para que coincida exactamente con lo que espera el servidor
    const payload = {
      punto: data.punto,
      numero_factura: data.facturas.map(f => f.numero).filter(n => n.trim() !== '').join(', '),
      area: data.area,
      revisado_por: data.revisado_por,
      mesa: data.mesa,
      detalles: data.detalles,
    }

    const result = await createPedido(payload)

    if (result.error) {
      setServerError(typeof result.error === 'string' ? result.error : 'Error en el formulario')
    } else {
      onSuccess()
    }
  }

  const currentOptions = punto === 'Sucursal' ? dynamicOptions.Sucursal : dynamicOptions.Principal

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 my-8">
        <div className="flex items-center justify-between p-6 border-b border-neutral-800 bg-neutral-900/50">
          <div>
            <h3 className="text-xl font-bold text-white">Nuevo Registro Operativo</h3>
            <p className="text-xs text-neutral-400 mt-1">Ingresa los datos del pedido y revisión.</p>
          </div>
          <button onClick={onCancel} className="p-2 text-neutral-500 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 sm:p-8 space-y-5 sm:space-y-6">
          
          {/* Selección de Punto */}
          <div className="grid grid-cols-2 gap-4">
            <label className={`relative flex items-center justify-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
              punto === 'Principal' ? 'bg-blue-600/10 border-blue-500 text-white' : 'bg-neutral-950 border-neutral-800 text-neutral-500 hover:border-neutral-700'
            }`}>
              <input {...register('punto')} type="radio" value="Principal" className="sr-only" />
              <Building2 className="w-5 h-5" />
              <span className="font-bold uppercase tracking-wider text-xs">Punto Principal</span>
            </label>
            <label className={`relative flex items-center justify-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
              punto === 'Sucursal' ? 'bg-blue-600/10 border-blue-500 text-white' : 'bg-neutral-950 border-neutral-800 text-neutral-500 hover:border-neutral-700'
            }`}>
              <input {...register('punto')} type="radio" value="Sucursal" className="sr-only" />
              <MapPin className="w-5 h-5" />
              <span className="font-bold uppercase tracking-wider text-xs">Punto Sucursal</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Facturas Dinámicas */}
            <div className="md:col-span-2">
              <label className="flex items-center justify-between text-sm font-medium text-neutral-400 mb-2">
                Números de Factura
                <button 
                  type="button" 
                  onClick={() => append({ numero: '' })}
                  className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Agregar otra
                </button>
              </label>
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-2">
                    <input
                      {...register(`facturas.${index}.numero` as const)}
                      className="flex-1 px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder={`Factura #${index + 1}`}
                    />
                    {fields.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => remove(index)}
                        className="p-2.5 text-neutral-500 hover:text-red-500 bg-neutral-950 border border-neutral-800 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {errors.facturas && <p className="mt-1 text-xs text-red-500">Ingrese al menos una factura válida</p>}
            </div>

            {/* Áreas (Dinámico) */}
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">Área de Revisión</label>
              <select
                {...register('area')}
                disabled={loadingOptions}
                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none cursor-pointer disabled:opacity-50"
              >
                <option value="">{loadingOptions ? 'Cargando...' : 'Seleccionar área...'}</option>
                {!loadingOptions && currentOptions.areas.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {errors.area && <p className="mt-1 text-xs text-red-500">{errors.area.message}</p>}
            </div>

            {/* Revisado Por (Dinámico) */}
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">Revisado por</label>
              <select
                {...register('revisado_por')}
                disabled={loadingOptions}
                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none cursor-pointer disabled:opacity-50"
              >
                <option value="">{loadingOptions ? 'Cargando...' : 'Seleccionar revisor...'}</option>
                {!loadingOptions && currentOptions.revisadores.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {errors.revisado_por && <p className="mt-1 text-xs text-red-500">{errors.revisado_por.message}</p>}
            </div>

            {/* Mesa */}
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">Mesa</label>
              <select
                {...register('mesa')}
                disabled={loadingOptions}
                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none cursor-pointer disabled:opacity-50"
              >
                {loadingOptions ? (
                  <option>Cargando...</option>
                ) : (
                  <>
                    <option value="">Seleccionar mesa...</option>
                    {currentOptions.mesas.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Detalles Extra */}
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">Observaciones (Opcional)</label>
              <input
                {...register('detalles')}
                className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="Cualquier nota adicional..."
              />
            </div>
          </div>

          {serverError && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{serverError}</p>
            </div>
          )}

          <div className="flex gap-4 mt-8">
            <button 
              type="button" 
              onClick={onCancel}
              className="flex-1 px-6 py-3.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-2xl font-bold transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-[2] flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-600/20 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              Registrar Factura
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
