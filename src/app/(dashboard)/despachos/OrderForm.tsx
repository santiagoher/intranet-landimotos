import { Modal } from '@/components/Modal'
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
    <Modal onClose={onCancel} titleId="order-form-title" size="large">
      <div>
        <div className="flex items-center justify-between p-6 border-b border-border bg-surface">
          <div>
            <h3 id="order-form-title" className="text-lg font-semibold text-foreground">Nuevo Registro Operativo</h3>
            <p className="text-xs text-muted mt-1">Ingresa los datos del pedido y revisión.</p>
          </div>
          <button aria-label="Cerrar ventana" onClick={onCancel} className="p-2 text-muted hover:text-foreground hover:bg-hover rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 sm:p-8 space-y-5 sm:space-y-6">
          
          {/* Selección de Punto */}
          <div className="grid grid-cols-2 gap-4">
            <label className={`relative flex items-center justify-center gap-3 p-4 focus-within:ring-2 focus-within:ring-accent rounded-2xl border-2 cursor-pointer transition-all ${
              punto === 'Principal' ? 'bg-accent-soft border-accent text-foreground' : 'bg-subtle border-border text-muted hover:border-border-strong'
            }`}>
              <input {...register('punto')} type="radio" value="Principal" className="sr-only" />
              <Building2 className="w-5 h-5" />
              <span className="font-bold uppercase tracking-wider text-xs">Punto Principal</span>
            </label>
            <label className={`relative flex items-center justify-center gap-3 p-4 focus-within:ring-2 focus-within:ring-accent rounded-2xl border-2 cursor-pointer transition-all ${
              punto === 'Sucursal' ? 'bg-accent-soft border-accent text-foreground' : 'bg-subtle border-border text-muted hover:border-border-strong'
            }`}>
              <input {...register('punto')} type="radio" value="Sucursal" className="sr-only" />
              <MapPin className="w-5 h-5" />
              <span className="font-bold uppercase tracking-wider text-xs">Punto Sucursal</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Facturas Dinámicas */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between text-sm font-medium text-muted mb-2">
                Números de Factura
                <button 
                  type="button" 
                  onClick={() => append({ numero: '' })}
                  className="text-xs flex items-center gap-1 text-accent-foreground hover:text-accent-foreground transition-colors"
                >
                  <Plus className="w-3 h-3" /> Agregar otra
                </button>
              </div>
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-2">
                    <input
                      aria-label={`Número de factura ${index + 1}`}
                      {...register(`facturas.${index}.numero` as const)}
                      className="flex-1 px-4 py-2.5 bg-surface border border-border-strong rounded-lg text-foreground focus:ring-2 focus:ring-accent outline-none transition-all"
                      placeholder={`Factura #${index + 1}`}
                    />
                    {fields.length > 1 && (
                      <button 
                        type="button" 
                        aria-label={`Eliminar campo de factura ${index + 1}`}
                        onClick={() => remove(index)}
                        className="p-2.5 text-muted hover:text-danger bg-subtle border border-border rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {errors.facturas && <p className="mt-1 text-xs text-danger">Ingrese al menos una factura válida</p>}
            </div>

            {/* Áreas (Dinámico) */}
            <div>
              <label htmlFor="order-area" className="block text-sm font-medium text-muted mb-2">Área de Revisión</label>
              <select
                id="order-area"
                {...register('area')}
                disabled={loadingOptions}
                className="w-full px-4 py-3 bg-subtle border border-border rounded-xl text-foreground focus:ring-2 focus:ring-accent outline-none transition-all appearance-none cursor-pointer disabled:opacity-50"
              >
                <option value="">{loadingOptions ? 'Cargando...' : 'Seleccionar área...'}</option>
                {!loadingOptions && currentOptions.areas.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {errors.area && <p className="mt-1 text-xs text-danger">{errors.area.message}</p>}
            </div>

            {/* Revisado Por (Dinámico) */}
            <div>
              <label htmlFor="order-revisado_por" className="block text-sm font-medium text-muted mb-2">Revisado por</label>
              <select
                id="order-revisado_por"
                {...register('revisado_por')}
                disabled={loadingOptions}
                className="w-full px-4 py-3 bg-subtle border border-border rounded-xl text-foreground focus:ring-2 focus:ring-accent outline-none transition-all appearance-none cursor-pointer disabled:opacity-50"
              >
                <option value="">{loadingOptions ? 'Cargando...' : 'Seleccionar revisor...'}</option>
                {!loadingOptions && currentOptions.revisadores.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {errors.revisado_por && <p className="mt-1 text-xs text-danger">{errors.revisado_por.message}</p>}
            </div>

            {/* Mesa */}
            <div>
              <label htmlFor="order-mesa" className="block text-sm font-medium text-muted mb-2">Mesa</label>
              <select
                id="order-mesa"
                {...register('mesa')}
                disabled={loadingOptions}
                className="w-full px-4 py-3 bg-subtle border border-border rounded-xl text-foreground focus:ring-2 focus:ring-accent outline-none transition-all appearance-none cursor-pointer disabled:opacity-50"
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
              <label htmlFor="order-detalles" className="block text-sm font-medium text-muted mb-2">Observaciones (Opcional)</label>
              <input
                id="order-detalles"
                {...register('detalles')}
                className="w-full px-4 py-3 bg-subtle border border-border rounded-xl text-foreground focus:ring-2 focus:ring-accent outline-none transition-all"
                placeholder="Cualquier nota adicional..."
              />
            </div>
          </div>

          {serverError && (
            <div className="flex items-center gap-3 p-4 bg-danger-soft border border-danger/20 rounded-2xl text-danger text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{serverError}</p>
            </div>
          )}

          <div className="flex gap-4 mt-8">
            <button 
              type="button" 
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 border border-border bg-surface hover:bg-hover text-foreground rounded-lg text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex-[2]"
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
    </Modal>
  )
}
