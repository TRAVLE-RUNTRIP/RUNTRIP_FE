import type { ErrorCode, RsData } from './types'
import { mockRequest } from './mock/handlers'

export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

export class ApiError extends Error {
  readonly code: ErrorCode
  readonly status: number

  constructor(code: ErrorCode, message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface RequestOptions {
  query?: Record<string, string | number | undefined>
  body?: unknown
  signal?: AbortSignal
}

/** 세션이 끊겼을 때(UNAUTHENTICATED) 화면 쪽에서 로그인으로 보내도록 알려요. */
export const AUTH_EXPIRED_EVENT = 'runtrip:auth-expired'

function buildUrl(path: string, query?: RequestOptions['query']): string {
  if (!query) return path
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

/**
 * 모든 API 호출이 지나는 곳이에요. 응답은 RsData로 받아 `data`만 돌려주고,
 * 실패하면 `error.code`를 담은 ApiError를 던져요.
 * VITE_USE_MOCK이 false가 아니면 mock 응답을 써요.
 */
export async function request<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, options.query)

  let status: number
  let body: RsData<T> | null

  if (USE_MOCK) {
    const res = await mockRequest(method, url, options.body)
    status = res.status
    body = res.body as RsData<T> | null
  } else {
    let res: Response
    try {
      res = await fetch(url, {
        method,
        credentials: 'include', // 세션 쿠키
        headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: options.signal,
      })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e
      throw new ApiError('NETWORK_ERROR', '네트워크 연결을 확인해 주세요.', 0)
    }
    status = res.status
    body = status === 204 ? null : ((await res.json().catch(() => null)) as RsData<T> | null)
  }

  if (status === 204) return undefined as T

  if (!body || !body.success) {
    const code = body?.error?.code ?? 'SERVER_ERROR'
    const message = body?.error?.message ?? '잠시 후 다시 시도해 주세요.'
    if (code === 'UNAUTHENTICATED') window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
    throw new ApiError(code, message, status)
  }

  return body.data as T
}
