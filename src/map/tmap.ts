// T map 웹 SDK v2 로더와 이 앱에서 쓰는 만큼의 타입 (#2)
// 공식 로더(jsv2)는 본체 스크립트를 document.write로 붙여요. 페이지가 다 그려진 뒤에 넣으면
// document.write가 무시되므로, 로딩하는 동안만 가로채서 같은 스크립트를 <script>로 넣어요.

export interface TmapLatLng {
  lat(): number
  lng(): number
}

export interface TmapOverlay {
  setMap(map: TmapMap | null): void
}

export interface TmapMarker extends TmapOverlay {
  setPosition(position: TmapLatLng): void
}

export interface TmapLatLngBounds {
  extend(latLng: TmapLatLng): void
}

export interface TmapMap {
  setCenter(latLng: TmapLatLng): void
  setZoom(zoom: number): void
  fitBounds(bounds: TmapLatLngBounds): void
  resize(width: string | number, height: string | number): void
  destroy(): void
}

export interface TmapNamespace {
  LatLng: new (lat: number, lng: number) => TmapLatLng
  LatLngBounds: new () => TmapLatLngBounds
  Map: new (
    divId: string,
    options: { center: TmapLatLng; width: string; height: string; zoom: number; zoomControl?: boolean },
  ) => TmapMap
  Polyline: new (options: {
    path: TmapLatLng[]
    strokeColor?: string
    strokeWeight?: number
    strokeOpacity?: number
    map: TmapMap
  }) => TmapOverlay
  Marker: new (options: {
    position: TmapLatLng
    map: TmapMap
    title?: string
    label?: string
    icon?: string
    iconSize?: unknown
  }) => TmapMarker
  Circle: new (options: {
    center: TmapLatLng
    radius: number
    strokeColor?: string
    strokeWeight?: number
    strokeOpacity?: number
    fillColor?: string
    fillOpacity?: number
    map: TmapMap
  }) => TmapOverlay
}

declare global {
  interface Window {
    Tmapv2?: Partial<TmapNamespace>
  }
}

const LOADER_URL = 'https://apis.openapi.sk.com/tmap/jsv2?version=1&appKey='
const LOAD_TIMEOUT_MS = 15_000

let loading: Promise<TmapNamespace> | null = null

export class TmapLoadError extends Error {}

function isReady(ns: Window['Tmapv2']): ns is TmapNamespace {
  return typeof ns?.Map === 'function' && typeof ns.LatLng === 'function'
}

function addScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = false
    script.onload = () => resolve()
    script.onerror = () => reject(new TmapLoadError(`스크립트를 불러오지 못했어요: ${src}`))
    document.head.appendChild(script)
  })
}

/** T map SDK를 한 번만 불러와요. 앱 키가 없거나 도메인이 등록되지 않으면 실패해요. */
export function loadTmap(): Promise<TmapNamespace> {
  if (isReady(window.Tmapv2)) return Promise.resolve(window.Tmapv2)
  if (loading) return loading

  const appKey = import.meta.env.VITE_TMAP_APP_KEY
  if (!appKey) return Promise.reject(new TmapLoadError('VITE_TMAP_APP_KEY가 비어 있어요'))

  loading = new Promise<TmapNamespace>((resolve, reject) => {
    const originalWrite = document.write
    const pending: Promise<void>[] = []
    document.write = (...html: string[]) => {
      for (const match of html.join('').matchAll(/<script[^>]*src=["']([^"']+)["']/gi)) {
        pending.push(addScript(match[1]))
      }
    }
    const restore = () => {
      document.write = originalWrite
    }

    const timer = window.setTimeout(() => {
      restore()
      reject(new TmapLoadError('T map SDK 로딩 시간이 초과됐어요 (앱 키·도메인 등록을 확인해 주세요)'))
    }, LOAD_TIMEOUT_MS)

    addScript(LOADER_URL + encodeURIComponent(appKey))
      .then(() => {
        restore()
        return Promise.all(pending)
      })
      .then(() => {
        // 본체가 전역을 채울 때까지 잠깐 기다려요.
        const started = Date.now()
        const check = () => {
          if (isReady(window.Tmapv2)) {
            window.clearTimeout(timer)
            resolve(window.Tmapv2)
          } else if (Date.now() - started > 5_000) {
            window.clearTimeout(timer)
            reject(new TmapLoadError('T map SDK를 불러왔지만 Tmapv2.Map이 없어요'))
          } else {
            window.setTimeout(check, 50)
          }
        }
        check()
      })
      .catch((error: unknown) => {
        restore()
        window.clearTimeout(timer)
        reject(error instanceof Error ? error : new TmapLoadError(String(error)))
      })
  }).catch((error: unknown) => {
    loading = null // 다음 시도에서 다시 불러올 수 있게
    throw error
  })

  return loading
}
