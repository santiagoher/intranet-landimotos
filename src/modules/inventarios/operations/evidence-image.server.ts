import 'server-only'
import sharp from 'sharp'
import {createHash} from 'node:crypto'

export const IMAGE_LIMIT=5*1024*1024
export async function validateEvidenceImage(bytes:Buffer) {
  if(!bytes.length||bytes.length>IMAGE_LIMIT)throw new Error('Cada fotografía debe pesar como máximo 5 MB.')
  const image=sharp(bytes,{failOn:'warning',limitInputPixels:24_000_000,animated:false})
  const metadata=await image.metadata()
  if(!['jpeg','png','webp'].includes(metadata.format??'')||(metadata.pages??1)!==1)throw new Error('Utiliza una fotografía JPEG, PNG o WebP sin animación.')
  // Decode and re-encode, removing EXIF/GPS and appended payloads. Keep resolution.
  const body=await image.rotate().webp({quality:90,effort:4}).toBuffer()
  if(body.length>IMAGE_LIMIT)throw new Error('La imagen procesada supera 5 MB. Selecciona una fotografía más pequeña.')
  return {body,hash:createHash('sha256').update(body).digest('hex'),mime:'image/webp' as const}
}
export function safeImageName(name:string):string {
  return name.split(/[\\/]/).pop()?.replace(/[^\p{L}\p{N} ._-]/gu,'').trim().slice(0,150)||'fotografia'
}
