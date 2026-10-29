import 'server-only'
import type { AssignmentProduct, ReportProduct } from './report'

// Temporary provider. Only this server-side boundary should change when the API is connected.
// Never import these reference balances into a client component.
const products: AssignmentProduct[] = [
  {code:'PRUEBA-001',name:'Manigueta de freno (prueba)',family:'ACCESORIOS',group:'MANDOS',subgroup:'MANIGUETAS',brand:'MARCA DE PRUEBA',expectedQuantity:'20'},
  {code:'PRUEBA-002',name:'Manigueta de embrague (prueba)',family:'ACCESORIOS',group:'MANDOS',subgroup:'MANIGUETAS',brand:'MARCA DE PRUEBA',expectedQuantity:'12'},
  {code:'PRUEBA-003',name:'Espejo derecho (prueba)',family:'ACCESORIOS',group:'ESPEJOS',subgroup:'RETROVISORES',brand:'MARCA DE PRUEBA',expectedQuantity:'8'},
  {code:'PRUEBA-004',name:'Espejo izquierdo (prueba)',family:'ACCESORIOS',group:'ESPEJOS',subgroup:'RETROVISORES',brand:'MARCA DE PRUEBA',expectedQuantity:'0'},
  {code:'PRUEBA-005',name:'Aceite de motor (prueba)',family:'LUBRICANTES',group:'ACEITES',subgroup:'MOTOR',brand:'MARCA DE PRUEBA',expectedQuantity:'30'},
  {code:'PRUEBA-006',name:'Lubricante de cadena (prueba)',family:'LUBRICANTES',group:'ACEITES',subgroup:'CADENA',brand:'MARCA DE PRUEBA',expectedQuantity:'15'},
  {code:'PRUEBA-007',name:'Pastillas delanteras (prueba)',family:'REPUESTOS',group:'FRENOS',subgroup:'PASTILLAS',brand:'MARCA DE PRUEBA',expectedQuantity:'25'},
  {code:'PRUEBA-008',name:'Filtro de aire (prueba)',family:'REPUESTOS',group:'FILTROS',subgroup:'AIRE',brand:'MARCA DE PRUEBA',expectedQuantity:'10'},
]

export function getTrialCatalog(): AssignmentProduct[] { return products.map(p=>({...p})) }
export function withoutReference(p: AssignmentProduct): ReportProduct {
  return {code:p.code,name:p.name,family:p.family,group:p.group,subgroup:p.subgroup,brand:p.brand}
}
