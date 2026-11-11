import { useEffect, useState } from 'react'

export interface GeoSample {
  lat: number
  lng: number
  accuracy: number
  speed: number | null
  /** 위치가 측정된 시각 (GeolocationPosition.timestamp) */
  timestamp: number
}

export type GeoError = 'unsupported' | 'denied' | 'unavailable' | 'timeout'

const OPTIONS: PositionOptions = { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 }

const toError = (code: number): GeoError =>
  code === 1 ? 'denied' : code === 2 ? 'unavailable' : 'timeout'

/** 켜 둔 동안 watchPosition으로 위치를 계속 받아요. 받은 그대로 모두 넘기고 거르는 건 쓰는 쪽에서 해요. */
export function useGeoWatch(enabled: boolean, onSample: (sample: GeoSample) => void) {
  const [error, setError] = useState<GeoError | null>(null)

  useEffect(() => {
    if (!enabled) return
    if (!('geolocation' in navigator)) {
      setError('unsupported')
      return
    }
    const id = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) => {
        setError(null)
        onSample({
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
          speed: coords.speed,
          timestamp,
        })
      },
      (err) => setError(toError(err.code)),
      OPTIONS,
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [enabled, onSample])

  return { error }
}
