'use client'
import { useEffect, useRef, useState } from 'react'
import { startPolling } from '../../../utils/polling'
import type { OperationData } from './types'
import {mergeMonitorSnapshot} from './monitor-snapshot'

export function useInventoryMonitor(initial:OperationData,reports=false) {
  const [snapshot,setSnapshot]=useState<OperationData|null>(null)
  const [error,setError]=useState(''),[blocked,setBlocked]=useState(false)
  const polling=useRef<ReturnType<typeof startPolling>|null>(null)
  const data=snapshot&&snapshot.context.userId===initial.context.userId&&snapshot.fetchedAt>initial.fetchedAt?snapshot:initial
  useEffect(()=>{
    let refreshCount=0
    const poll=startPolling({canRun:()=>document.visibilityState==='visible'&&navigator.onLine,
      onPause:()=>setError('Actualización pausada tras varios fallos. Se conserva la última consulta; reintenta cuando vuelva la conexión.'),
      run:async(signal)=>{
        const timeout=new AbortController(),timer=setTimeout(()=>timeout.abort(),20000)
        try {
          const response=await fetch(`/api/inventarios/monitor?reports=${reports}&compact=${refreshCount%10!==9}`,{cache:'no-store',credentials:'same-origin',redirect:'error',signal:AbortSignal.any([signal,timeout.signal])})
          if(signal.aborted)return false
          if([401,403].includes(response.status)){setBlocked(true);setError('El acceso ya no es válido. Vuelve a cargar la página para verificar tu sesión.');return 'stop'}
          if(!response.ok)throw new Error('refresh_failed')
          const next:OperationData=await response.json()
          if(signal.aborted)return false
          // A different signed-in account must get a fresh page, not mixed state.
          if(next.context.userId!==initial.context.userId){setBlocked(true);setError('La cuenta cambió en otra pestaña. Vuelve a cargar la página.');return 'stop'}
          refreshCount++;setSnapshot(previous=>mergeMonitorSnapshot(previous&&previous.fetchedAt>initial.fetchedAt?previous:initial,next));setError('');return true
        }catch{if(!signal.aborted)setError('No se pudo actualizar. Mostramos la última consulta y volveremos a intentarlo.');return false}
        finally{clearTimeout(timer)}
      },
    })
    polling.current=poll
    window.addEventListener('online',poll.wake);window.addEventListener('focus',poll.wake);document.addEventListener('visibilitychange',poll.wake)
    return()=>{poll.stop();window.removeEventListener('online',poll.wake);window.removeEventListener('focus',poll.wake);document.removeEventListener('visibilitychange',poll.wake)}
  },[reports,initial])
  return {data,error,blocked,retry:()=>polling.current?.retry()}
}
