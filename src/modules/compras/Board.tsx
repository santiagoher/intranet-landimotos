import Link from 'next/link'
import { Warehouse, ArrowRight, Download } from 'lucide-react'
import { catalogosCompras, consultarCompras, requireCompras } from './service.server'
import { filtersSchema } from './validation'
import { ComprasMessage, Distribucion, FiltrosCompras, Indicadores, TablaCompras } from './components'
import { NuevaRevision } from './Forms'
import { ComprasPagination } from './Pagination'

export async function ComprasBoard({params,reports=false}:{params:Record<string,string|string[]|undefined>;reports?:boolean}) {
  const access=await requireCompras(reports)
  const raw=Object.fromEntries(Object.entries(params).filter((e):e is [string,string]=>typeof e[1]==='string'))
  if(raw.responsable){
    if(raw.responsable.startsWith('p:'))raw.encargado_persona_id=raw.responsable.slice(2)
    else if(raw.responsable.startsWith('u:'))raw.encargado_id=raw.responsable.slice(2)
    else return <ComprasMessage message="Encargado no válido."/>
  }
  const parsed=filtersSchema.safeParse(raw)
  if(!parsed.success)return <ComprasMessage message="Revisa los filtros: la fecha inicial debe ser anterior o igual a la final y los valores deben ser válidos."/>
  const filtros=parsed.data;const base=reports?'/compras/reportes':'/compras/registros'
  if(!access.admin&&!filtros.mesa_id)return <section className="rounded-2xl border border-border bg-surface p-6 sm:p-10"><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-accent-foreground">Tu espacio de trabajo</p><h2 className="text-2xl font-semibold">¿A qué mesa perteneces?</h2><p className="mt-3 max-w-xl text-sm text-muted">Selecciona una mesa para ver tus revisiones. Solo aparecerán las facturas que te hayan asignado.</p><div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[1,2,3,4,5].map(n=><Link href={`/compras/registros?mesa_id=${n}`} key={n} className="group rounded-xl border border-border bg-subtle p-5 transition hover:border-accent hover:bg-accent-soft"><Warehouse className="mb-6 size-7 text-accent-foreground"/><span className="flex items-center justify-between font-semibold">Mesa {n}<ArrowRight className="size-4 text-muted"/></span></Link>)}</div></section>
  const requested=Math.max(1,Number.parseInt(raw.pagina??'1',10)||1)
  const [initial,catalogos]=await Promise.all([consultarCompras(filtros,requested),catalogosCompras()])
  const page=Math.min(requested,Math.max(1,Math.ceil(initial.total/25)))
  const data=page===requested?initial:await consultarCompras(filtros,page)
  // Historical operators remain filterable even after their module is revoked.
  const reportCatalog={...catalogos,operadores:[...catalogos.operadores]}
  if(access.admin)for(const op of data.por_operador)if(!reportCatalog.operadores.some(p=>(p.persona_id??p.id)===(op.encargado_persona_id??op.encargado_id)))reportCatalog.operadores.push({id:op.encargado_id,persona_id:op.encargado_persona_id,nombre:op.nombre,email:''})
  const query=new URLSearchParams(Object.entries(filtros).filter((e):e is [string,string]=>!!e[1])).toString()
  return <div className="space-y-5">
    {reports ? (
      <div className="flex justify-end">
        <a className="btn-secondary" href={`/compras/reportes/exportar?${query}`}><Download className="size-4"/>Exportar Excel</a>
      </div>
    ) : !access.admin && (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium">Mis revisiones · Mesa {filtros.mesa_id}</p>
        <Link className="btn-secondary" href="/compras/registros">Cambiar mesa</Link>
      </div>
    )}
    <Indicadores data={data} reports={reports}/>
    {reports&&<section className="rounded-xl border border-border bg-surface p-5" aria-label="Artículos de las facturas filtradas"><p className="text-sm text-muted">Total de artículos</p><p className="mt-2 text-2xl font-semibold tabular-nums">{data.total_articulos.toLocaleString('es-CO')}</p><p className="mt-2 text-xs text-muted">Suma de los artículos registrados en las facturas que coinciden con los filtros.{data.sin_numero_articulos>0&&` Hay ${data.sin_numero_articulos} factura(s) anterior(es) sin este dato; no se incluyen en la suma.`}</p></section>}
    {access.admin&&!reports&&<NuevaRevision catalogos={catalogos}/>}
    <FiltrosCompras key={query} filtros={filtros} catalogos={reportCatalog} admin={access.admin} base={base}/>
    {reports&&<Distribucion data={data}/>}
    <TablaCompras registros={data.registros}/><ComprasPagination page={page} total={data.total} base={base} query={query}/>
  </div>
}
