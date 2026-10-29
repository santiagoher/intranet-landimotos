'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getMensajeros, getActiveRoutes, getFinishedRoutes, getLunchHistory } from './actions'
import { getConfiguraciones } from '../admin/configuracion/actions'
import { startPolling } from '@/utils/polling'

// The original operational loader, shared by availability and history.
export function useMensajerosData(enabled: boolean) {
  const [mensajeros, setMensajeros] = useState<Awaited<ReturnType<typeof getMensajeros>>>([])
  const [activeRoutes, setActiveRoutes] = useState<Awaited<ReturnType<typeof getActiveRoutes>>>([])
  const [finishedRoutes, setFinishedRoutes] = useState<Awaited<ReturnType<typeof getFinishedRoutes>>>([])
  const [lunchHistory, setLunchHistory] = useState<Awaited<ReturnType<typeof getLunchHistory>>>([])
  const [revisores, setRevisores] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const requestVersion = useRef(0)
  const pending = useRef(false)
  const refreshRequested = useRef(false)
  const polling = useRef<ReturnType<typeof startPolling>|null>(null)

  const refresh = useCallback(async function refreshData(background = false): Promise<boolean> {
    // Background reads and manual refreshes share a single in-flight request.
    if (!enabled) return false
    if (pending.current) {
      if (!background) refreshRequested.current = true
      return background
    }
    const version = requestVersion.current + 1
    requestVersion.current = version
    pending.current = true
    setRefreshing(true)
    try {
      const [mems, routes, configs, finished, lunch] = await Promise.all([
        getMensajeros(), getActiveRoutes(), getConfiguraciones(),
        getFinishedRoutes(), getLunchHistory(),
      ])
      if (version !== requestVersion.current) return false
      setMensajeros(mems)
      setActiveRoutes(routes)
      setFinishedRoutes(finished)
      setLunchHistory(lunch)
      setRevisores(configs.filter(c => c.categoria === 'revisor').map(c => c.valor))
      setLastUpdated(new Date())
      setError(null)
      if(!background)polling.current?.resume()
      return true
    } catch (error) {
      if (version !== requestVersion.current) return false
      console.error('Error fetching messenger availability:', error)
      setError('No se pudieron actualizar los datos de mensajeros. Intenta actualizar de nuevo.')
      return false
    } finally {
      if (version === requestVersion.current) {
        pending.current = false
        setLoading(false)
        setRefreshing(false)
        // A mutation completed during a background read: fetch its new state
        // once that read finishes, without overlapping requests.
        if (refreshRequested.current) {
          refreshRequested.current = false
          void refreshData(false)
        }
      }
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    const poll=startPolling({initial:true,canRun:()=>document.visibilityState==='visible'&&navigator.onLine,run:()=>refresh(true),onPause:()=>setError('Actualización pausada tras varios fallos. Usa Actualizar para volver a consultar.')})
    polling.current=poll
    window.addEventListener('focus', poll.wake)
    window.addEventListener('online', poll.wake)
    document.addEventListener('visibilitychange', poll.wake)
    return () => {
      poll.stop()
      window.removeEventListener('focus', poll.wake)
      window.removeEventListener('online', poll.wake)
      document.removeEventListener('visibilitychange', poll.wake)
      // Ignore pending responses after navigation or an access change.
      requestVersion.current += 1
      pending.current = false
      refreshRequested.current = false
    }
  }, [enabled, refresh])

  return { mensajeros, activeRoutes, finishedRoutes, lunchHistory, revisores,
    loading, refreshing, error, lastUpdated, refresh }
}
