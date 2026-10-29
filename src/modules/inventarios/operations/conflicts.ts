/** Only our explicit version conflicts; genuine serialization errors stay distinct. */
export function isVersionConflict(error:{code?:string;message?:string;details?:string}|null|undefined) {
  if(!error)return false
  return (error.code==='PT409'&&error.details==='INVENTORY_VERSION_CONFLICT') ||
    (['40001','P0001','PT409'].includes(error.code??'')&&[
      'La tarea cambió. Actualiza antes de continuar',
      'La observación cambió. Recarga antes de guardar',
    ].includes(error.message??''))
}
export interface CountDraft {value:string;version:number;conflict?:boolean}
export function draftNeedsReview(draft:CountDraft|undefined,version:number){
  return !!draft&&(draft.conflict===true||draft.version!==version)
}
