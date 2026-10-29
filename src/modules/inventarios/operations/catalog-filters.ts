import type {BlindCatalogProduct} from './types'

export function filterCatalog(products:BlindCatalogProduct[],subcategory:string,brand:string) {
  return products.filter(p=>(!subcategory||p.subcategory===subcategory)&&(!brand||p.brand===brand))
}

export function catalogOptions(products:BlindCatalogProduct[],field:'subcategory'|'brand') {
  return [...new Set(products.map(p=>p[field]).filter((value):value is string=>!!value))]
    .sort((a,b)=>a.localeCompare(b,'es'))
}
