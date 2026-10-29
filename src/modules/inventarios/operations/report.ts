/** Exact allowlist: expected quantities never enter an assigned product DTO. */
export interface ReportProduct { code: string; name: string; family: string; group: string; subgroup: string; brand: string }
/** Assignment input is for supervisors only. Operator DTOs never use this type. */
export interface AssignmentProduct extends ReportProduct { expectedQuantity?: string }
export type ReportFilters = Pick<ReportProduct, 'family' | 'group' | 'subgroup' | 'brand'>
const normalize = (s: string) => s.replace(/^\uFEFF/, '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[\s_-]/g,'')
const columns: Record<keyof ReportProduct, string[]> = {
  code: ['codigo','codigoproducto','sku','referencia'],
  name: ['nombre','nombreproducto','descripcion','producto'],
  family: ['familia'], group: ['grupo'], subgroup: ['subgrupo'], brand: ['marca','marcas'],
}
function csvRows(text: string, delimiter: string): string[][] {
  const result: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i=0;i<text.length;i++) {
    const ch = text[i]
    if (ch === '"') {
      if (quoted && text[i+1] === '"') { cell += '"'; i++ }
      else quoted = !quoted
    } else if (ch === delimiter && !quoted) { row.push(cell); cell='' }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i+1] === '\n') i++
      row.push(cell); if (row.some(v=>v.trim())) result.push(row); row=[]; cell=''
    } else cell += ch
  }
  if (quoted) throw new Error('El CSV contiene comillas sin cerrar.')
  row.push(cell); if (row.some(v=>v.trim())) result.push(row)
  return result
}
export function parseProductReport(text: string): ReportProduct[] {
  if (text.length>2_000_000) throw new Error('El reporte supera el límite de 2 MB.')
  const candidates = [';',',','\t'].map(d=>csvRows(text,d))
  const rows = candidates.find(r=>r[0]?.some(h=>columns.code.includes(normalize(h))) && r[0]?.some(h=>columns.name.includes(normalize(h))))
  if (!rows) throw new Error('El CSV debe incluir Código y Nombre (o Descripción). Exporta el reporte como CSV UTF-8.')
  const header = rows[0].map(normalize)
  const indices = {} as Record<keyof ReportProduct,number>
  for (const field of Object.keys(columns) as (keyof ReportProduct)[]) {
    const matches = header.flatMap((h,i)=>columns[field].includes(h)?[i]:[])
    if (matches.length>1) throw new Error(`Hay columnas ambiguas para ${field}. Conserva una sola.`)
    indices[field]=matches[0] ?? -1
  }
  if (rows.length<2 || rows.length>2001) throw new Error('El reporte debe contener entre 1 y 2000 productos.')
  const codes = new Set<string>()
  return rows.slice(1).map((row,i)=>{
    if(row.length!==header.length) throw new Error(`La fila ${i+2} no coincide con las columnas del encabezado.`)
    const product = Object.fromEntries(Object.entries(indices).map(([field,index])=>[field,index<0?'':(row[index]??'').trim()])) as unknown as ReportProduct
    if(!product.code || !product.name) throw new Error(`Falta código o nombre en la fila ${i+2}.`)
    if(Object.values(product).some(v=>v.length>300)) throw new Error(`La fila ${i+2} contiene un campo demasiado largo.`)
    if(codes.has(product.code)) throw new Error(`Código duplicado: ${product.code}. Exporta una fila por producto.`)
    codes.add(product.code)
    return product
  })
}
export function parseAssignmentReport(text: string): AssignmentProduct[] {
  const products=parseProductReport(text)
  const rows=[';',',','\t'].map(d=>csvRows(text,d)).find(r=>r[0]?.some(h=>columns.code.includes(normalize(h))) && r[0]?.some(h=>columns.name.includes(normalize(h))))!
  const matches=rows[0].flatMap((h,i)=>['cantidad','existencias','saldo','cantidadesperada','cantidadsistema'].includes(normalize(h))?[i]:[])
  if(matches.length>1)throw new Error('Conserva una sola columna de cantidad de referencia.')
  if(!matches.length)return products
  return products.map((p,i)=>{
    const value=rows[i+1][matches[0]].trim().replace(',','.')
    if(!/^\d{1,14}(\.\d{1,6})?$/.test(value))throw new Error(`Cantidad de referencia inválida en la fila ${i+2}. Usa números sin separadores de miles; vacío no equivale a cero.`)
    return {...p,expectedQuantity:value}
  })
}
export function filterProducts<T extends ReportProduct>(products: T[], filters: ReportFilters): T[] {
  return products.filter(p=>(Object.keys(filters) as (keyof ReportFilters)[]).every(k=>!filters[k] || p[k]===filters[k]))
}
