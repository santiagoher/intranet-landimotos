export interface Evidence {id:string;usuario_id:string;nombre_original:string;estado:'pendiente'|'vigente'|'eliminando';created_at:string;uploaded_at:string|null;url:string|null}
export interface CountNote {texto:string;version:number;usuario_id:string;updated_at:string}
export interface EvidenceResult {items?:Evidence[];note?:CountNote|null;enabled?:boolean;uploadsEnabled?:boolean;error?:string}
