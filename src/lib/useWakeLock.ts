import { useCallback, useEffect, useRef, useState } from 'react'

export type WakeLockStatus = 'unsupported' | 'off' | 'on' | 'released' | 'error'

export interface WakeLockEvent {
  at: number
  message: string
}

/**
 * 켜 둔 동안 화면이 꺼지지 않게 해요. 다른 앱으로 갔다 오면 브라우저가 잠금을 풀기 때문에
 * 화면이 다시 보일 때 다시 요청해요 (기능명세서 F-12).
 */
export function useWakeLock(enabled: boolean) {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [status, setStatus] = useState<WakeLockStatus>(supported ? 'off' : 'unsupported')
  const [events, setEvents] = useState<WakeLockEvent[]>([])
  const sentinel = useRef<WakeLockSentinel | null>(null)

  const log = useCallback((message: string) => {
    setEvents((prev) => [{ at: Date.now(), message }, ...prev].slice(0, 50))
  }, [])

  const request = useCallback(async () => {
    if (!supported || sentinel.current) return
    try {
      const lock = await navigator.wakeLock.request('screen')
      sentinel.current = lock
      setStatus('on')
      log('Wake Lock 획득')
      lock.addEventListener('release', () => {
        sentinel.current = null
        setStatus('released')
        log('Wake Lock 해제됨')
      })
    } catch (error) {
      setStatus('error')
      log(`Wake Lock 요청 실패: ${error instanceof Error ? error.message : String(error)}`)
    }
  }, [supported, log])

  useEffect(() => {
    if (!enabled) {
      void sentinel.current?.release()
      sentinel.current = null
      return
    }
    void request()

    const onVisibility = () => {
      log(`화면 ${document.visibilityState === 'visible' ? '복귀' : '숨김'}`)
      if (document.visibilityState === 'visible') void request()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      void sentinel.current?.release()
      sentinel.current = null
    }
  }, [enabled, request, log])

  return { supported, status, events }
}
