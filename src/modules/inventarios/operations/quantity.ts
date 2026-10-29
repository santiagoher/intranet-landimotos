// String formatting keeps all meaningful decimals; never convert to Number.
export function displayQuantity(value:string|null|undefined):string {
  if(value==null)return 'Sin contar'
  return value.includes('.')?value.replace(/0+$/,'').replace(/\.$/,''):value
}
