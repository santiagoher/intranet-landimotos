'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getMensajeros, getActiveRoutes, getFinishedRoutes, getLunchHistory } from './actions'
import { getConfiguraciones } from '../admin/configuracion/actions'

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

  const refresh = useCallback(async (background = false) => {
    // Polling/focus never duplicates an in-flight request. An action can start a
    // newer refresh so an older response cannot restore a pre-action status.
    if (background && pending.current) return
    const version = requestVersion.current + 1
    requestVersion.current = version
    pending.current = true
    setRefreshing(true)
    try {
      const [mems, routes, configs, finished, lunch] = await Promise.all([
        getMensajeros(), getActiveRoutes(), getConfiguraciones(),
        getFinishedRoutes(), getLunchHistory(),
      ])
      if (version !== requestVersion.current) return
      setMensajeros(mems)
      setActiveRoutes(routes)
      setFinishedRoutes(finished)
      setLunchHistory(lunch)
      setRevisores(configs.filter(c => c.categoria === 'revisor').map(c => c.valor))
      setLastUpdated(new Date())
      setError(null)
    } catch (error) {
      if (version !== requestVersion.current) return
      console.error('Error fetching messenger availability:', error)
      setError('No se pudieron actualizar los datos de mensajeros. Intenta actualizar de nuevo.')
    } finally {
      if (version === requestVersion.current) {
        pending.current = false
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') void refresh(true)
    }
    const initial = window.setTimeout(() => void refresh(true), 0)
    const interval = window.setInterval(refreshVisible, 30_000)
    window.addEventListener('focus', refreshVisible)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshVisible)
      document.removeEventListener('visibilitychange', refreshVisible)
      // Ignore pending responses after navigation or an access change.
      requestVersion.current += 1
      pending.current = false
    }
  }, [enabled, refresh])

  return { mensajeros, activeRoutes, finishedRoutes, lunchHistory, revisores,
    loading, refreshing, error, lastUpdated, refresh }
}
