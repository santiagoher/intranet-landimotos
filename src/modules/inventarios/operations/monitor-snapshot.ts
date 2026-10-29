import type {OperationData} from './types'
export function mergeMonitorSnapshot(previous:OperationData,next:OperationData):OperationData {
  if(next.catalogComplete!==false||previous.context.userId!==next.context.userId)return next
  const supervised=new Set(next.context.warehouses.filter(w=>w.role!=='operador').map(w=>w.id))
  const categories=new Map(previous.categories.filter(c=>supervised.has(c.bodega_id)).map(c=>[c.id,c]))
  next.categories.forEach(c=>categories.set(c.id,c))
  return {...next,categories:[...categories.values()]}
}
