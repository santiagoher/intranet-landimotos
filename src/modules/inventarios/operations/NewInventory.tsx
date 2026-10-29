'use client'
import {useRef,useState,useTransition} from 'react'
import {useRouter} from 'next/navigation'
import Link from 'next/link'
import {ArrowLeft,ArrowRight,Check,ClipboardList,FlaskConical,LockKeyhole,Package,Warehouse} from 'lucide-react'
import {inventoryFieldClass as field} from '../components/InventoryPrimitives'
import type {BlindCatalogProduct,OperationData} from './types'
import {getBlindCatalog,createOwnInventory} from './self-start.actions'
import {catalogOptions,filterCatalog} from './catalog-filters'
import './new-inventory.css'

export function NewInventory({data}:{data:OperationData}) {
  const router=useRouter()
  const warehouses=data.context.warehouses.filter(w=>w.role==='operador'&&data.selfStart?.warehouses.includes(w.id))
  const [warehouse,setWarehouse]=useState(warehouses.length===1?warehouses[0].id:'')
  const [category,setCategory]=useState(''),[search,setSearch]=useState(''),[note,setNote]=useState('')
  const [subcategory,setSubcategory]=useState(''),[brand,setBrand]=useState('')
  const [products,setProducts]=useState<BlindCatalogProduct[]>([]),[step,setStep]=useState(0),[error,setError]=useState('')
  const [pending,start]=useTransition(),key=useRef<string|null>(null),busy=useRef(false),request=useRef(0)
  // An ambiguous response must be retried with the exact same payload/key.
  const [attempted,setAttempted]=useState(false)
  const categories=(data.selfStart?.categories??[]).filter(c=>c.bodega_id===warehouse)
  // Operators receive only their own membership; absence here does not mean no leader exists.
  // The creation RPC validates and assigns the responsible leader atomically.
  const leader=data.context.members.find(m=>m.warehouseId===warehouse&&m.role==='lider'&&m.leader)
  const name=[...data.context.people,...data.context.members].find(p=>p.id===data.context.userId)?.name??'Tu usuario autenticado'
  const selectedProducts=filterCatalog(products,subcategory,brand)
  const subcategories=catalogOptions(products,'subcategory')
  const brands=catalogOptions(filterCatalog(products,subcategory,''),'brand')
  const steps=[{title:'Bodega',icon:Warehouse},{title:'Productos',icon:Package},{title:'Confirmar',icon:ClipboardList}]
  function loadCategory(id:string){
    const current=++request.current
    setCategory(id);setSubcategory('');setBrand('');setProducts([]);setError('');key.current=null
    if(!id)return
    start(async()=>{try{const result=await getBlindCatalog({warehouse,category:id});if(current===request.current){setProducts(result.products??[]);setError(result.error??'')}}catch{if(current===request.current)setError('No se pudo consultar el catálogo. Vuelve a seleccionar la categoría.')}})
  }
  function create(){
    if(busy.current)return
    busy.current=true;setAttempted(true);setError('');key.current??=crypto.randomUUID()
    start(async()=>{try{
      const result=await createOwnInventory({key:key.current,warehouse,category,subcategory,brand,note,productIds:selectedProducts.map(p=>p.id)})
      if(result.ticket){router.push(`/inventarios/registros?ticket=${encodeURIComponent(result.ticket)}`);router.refresh()}
      else setError(result.error??'El servidor no confirmó el ticket. Reintenta con los mismos datos.')
    }catch{setError('No se pudo confirmar. Reintenta con los mismos datos.')}finally{busy.current=false}})
  }
  return <section className="inventory-new mx-auto max-w-3xl space-y-5 pb-6">
    <header><span className="new-eyebrow">INVENTARIOS / OPERADOR</span><h1 className="page-title mt-2">Nuevo inventario</h1><p className="mt-2 text-sm text-muted">Elige qué vas a contar y registra las cantidades que encuentres.</p></header>
    <div className="new-demo"><FlaskConical size={20} aria-hidden="true"/><div><strong>DEMO · Inventario de prueba</strong><p>Productos de ejemplo. Sin conexión a G21 ni ajustes de existencias.</p></div></div>
    {!data.selfStart?.enabled?<div role="status" className="new-blocked"><LockKeyhole size={24} aria-hidden="true"/><h2>Creación pendiente de habilitación</h2><p>{data.selfStart?.reason||'Falta configurar y validar una base de pruebas independiente. No se ha creado ningún ticket.'}</p><Link className="btn-secondary" href="/inventarios/registros">Ir a Mis inventarios</Link></div>:!warehouses.length?<p role="status" className="new-blocked">No tienes permiso para crear inventarios en tus bodegas.</p>:<div className="new-card">
      <ol className="new-steps" aria-label="Pasos del inventario">{steps.map(({title,icon:Icon},n)=><li key={title} aria-current={n===step?'step':undefined} data-active={n<=step}><div className="new-step-icon">{n<step?<Check size={18}/>:<Icon size={18}/>}</div><span>{title}</span></li>)}</ol>
      <div className="new-step-body" key={step}>
        <p className="text-xs text-muted">Paso {step+1} de 3</p><h2 className="mt-1 text-lg font-semibold">{['¿En qué bodega vas a contar?','Elige los productos que vas a contar','Revisa tu inventario'][step]}</h2>
        {step===0&&<div className="mt-5 space-y-3"><label className="block space-y-2 text-sm"><span>Bodega autorizada</span><select className={field} value={warehouse} onChange={e=>{++request.current;setWarehouse(e.target.value);setCategory('');setSubcategory('');setBrand('');setSearch('');setProducts([]);key.current=null}}><option value="">Selecciona tu bodega</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label><p className="text-xs text-muted">{warehouses.length===1?'Seleccionamos tu única bodega autorizada.':'Solo aparecen las bodegas en las que puedes crear inventarios.'}</p></div>}
        {step===1&&<div className="mt-5 space-y-4"><input aria-label="Buscar categoría" placeholder="Buscar categoría…" className={field} value={search} onChange={e=>setSearch(e.target.value)}/>
          <p className="text-sm text-muted">Elige una categoría completa o reduce el grupo por subcategoría y marca. Se incluirán únicamente los productos de la vista previa.</p>
          <div className="new-filters">
            <label className="block text-sm">Categoría<select disabled={pending||attempted} className={`${field} mt-2`} value={category} onChange={e=>loadCategory(e.target.value)}><option value="">Selecciona una categoría</option>{categories.filter(c=>c.id===category||c.nombre.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
            <label className="block text-sm">Subcategoría <span className="text-muted">(opcional)</span><select disabled={pending||attempted||!products.length} className={`${field} mt-2`} value={subcategory} onChange={e=>{setSubcategory(e.target.value);setBrand('');key.current=null}}><option value="">Todas las subcategorías</option>{subcategories.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
            <label className="block text-sm">Marca <span className="text-muted">(opcional)</span><select disabled={pending||attempted||!products.length} className={`${field} mt-2`} value={brand} onChange={e=>{setBrand(e.target.value);key.current=null}}><option value="">Todas las marcas</option>{brands.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
          </div>
          {(subcategory||brand)&&<button type="button" disabled={pending||attempted} className="new-reset" onClick={()=>{setSubcategory('');setBrand('');key.current=null}}>Quitar filtros y contar toda la categoría</button>}
          {pending?<p role="status">Consultando productos DEMO…</p>:category&&!error&&!selectedProducts.length?<p role="status" className="text-sm text-muted">No hay productos para esta selección. Ajusta los filtros para continuar.</p>:!!selectedProducts.length&&<><p className="new-sku-count" role="status" aria-live="polite"><Package size={18}/><strong>{selectedProducts.length} {selectedProducts.length===1?'referencia':'referencias'} SKU</strong><span>{subcategory||brand?`Grupo filtrado · ${selectedProducts.length} de ${products.length}`:'Categoría completa'}</span></p><div className="new-products"><table className="data-table"><thead><tr><th>SKU</th><th>Producto</th><th>Subcategoría</th><th>Marca</th><th>Unidad</th></tr></thead><tbody>{selectedProducts.map(p=><tr key={p.id}><td>{p.code}</td><td>{p.name}</td><td>{p.subcategory||'Sin subcategoría'}</td><td>{p.brand||'Sin marca'}</td><td>{p.unit}</td></tr>)}</tbody></table></div></>}
        </div>}
        {step===2&&<div className="mt-5 space-y-5"><dl className="new-summary">{[['Bodega',warehouses.find(w=>w.id===warehouse)?.name],['Categoría',categories.find(c=>c.id===category)?.nombre],['Subcategoría',subcategory||'Todas las subcategorías'],['Marca',brand||'Todas las marcas'],['Operador',name],['Líder responsable',leader?.name??'Se valida al crear el inventario'],['Referencias SKU',String(selectedProducts.length)],['Origen / modalidad','Autoiniciado / DEMO · Prueba'],['Fecha y hora','Se registran en el servidor al crear el ticket']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><label className="block text-sm">Observación inicial <span className="text-muted">(opcional)</span><textarea disabled={pending||attempted} maxLength={2000} rows={3} className={`${field} mt-2`} value={note} onChange={e=>{setNote(e.target.value);key.current=null}}/></label><p className="text-xs text-muted">El líder recibirá una notificación interna al iniciar y al entregar el conteo. Completar el 100 % de las referencias no cierra el inventario: requiere revisión del líder.</p></div>}
      </div>
      {error&&<div role="alert" className="new-error"><p>{error}</p>{attempted&&<p className="mt-2">Puedes reintentar con la misma solicitud o consultar Mis inventarios para comprobar si se creó. <Link href="/inventarios/registros" className="underline">Ver mis inventarios</Link></p>}</div>}
      <footer className="new-footer">{step>0&&<button disabled={pending||attempted} className="btn-secondary" onClick={()=>{setStep(step-1);setError('')}}><ArrowLeft size={16}/>Atrás</button>}<button disabled={pending||!warehouse||(step>=1&&(!category||!selectedProducts.length))} className="btn-primary" onClick={()=>step<2?setStep(step+1):create()}>{pending?'Procesando…':step===2?(attempted?'Reintentar confirmación':'Crear e iniciar inventario'):'Continuar'}<ArrowRight size={16}/></button></footer>
    </div>}
  </section>
}
