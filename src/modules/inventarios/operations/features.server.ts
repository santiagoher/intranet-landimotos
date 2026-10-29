import 'server-only'
import {demoEnvironment} from './demo-environment'
// Off until the optional migration and its grants are verified in that environment.
let selfStartMissing=false
export const selfStartEnabled=()=>demoEnvironment(process.env).enabled&&!selfStartMissing
export const selfStartStatus=()=>({...demoEnvironment(process.env),...(selfStartMissing?{enabled:false,reason:'La base de pruebas todavía no tiene instalado el módulo DEMO.'}:{})})
export function markSelfStartMissing(){selfStartMissing=true}
// Never serialize this value in OperationData or expose it with NEXT_PUBLIC_.
export const demoServerKey=()=>demoEnvironment(process.env).enabled?(process.env.INVENTORY_DEMO_SERVER_KEY??''):''
