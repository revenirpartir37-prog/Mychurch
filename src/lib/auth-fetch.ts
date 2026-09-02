import { useAppStore } from '@/store/app-store'

let pendingRefresh: Promise<boolean> | null = null

async function tryRefreshOnce(): Promise<boolean> {
  if (!pendingRefresh) {
    pendingRefresh = useAppStore.getState().refreshAccessToken().finally(() => {
      pendingRefresh = null
    })
  }
  return pendingRefresh
}

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit & { _retry?: boolean }
): Promise<Response> {
  const token = useAppStore.getState().auth.token
  const headers = new Headers(init?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(input, { ...init, headers })

  if (res.status === 401 && !init?._retry) {
    const refreshed = await tryRefreshOnce()
    if (refreshed) {
      const newToken = useAppStore.getState().auth.token
      if (newToken) {
        const retryHeaders = new Headers(init?.headers)
        retryHeaders.set('Authorization', `Bearer ${newToken}`)
        return fetch(input, { ...init, headers: retryHeaders, _retry: true } as any)
      }
    }
    const { toast } = await import('sonner')
    toast.error('Session expirée, veuillez vous reconnecter')
    useAppStore.getState().logout()
  }

  return res
}
