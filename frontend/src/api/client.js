// Lightweight fetch client with in-memory JWT access token and httpOnly refresh rotation.

let accessToken = null
let refreshPromise = null
let authLostHandler = null

export function getAccessToken() {
  return accessToken
}

export function setAccessToken(token) {
  accessToken = token || null
}

export function setAuthLostHandler(handler) {
  authLostHandler = handler
}

export function normalizeUser(u) {
  if (!u) return null
  return {
    id: u.id,
    username: u.username,
    fullName: u.full_name,
    email: u.email ?? '',
    active: u.is_active,
    isSuperadmin: u.is_superadmin,
    mustChangePassword: u.must_change_password,
    permissions: u.permissions ?? {},
    lastLoginAt: u.last_login_at,
    createdAt: u.created_at,
  }
}

export function normalizeMenu(m) {
  return {
    id: m.id,
    code: m.code,
    name: m.name,
    group: m.group_name,
    icon: m.icon,
    path: m.path,
    parentId: m.parent_id ?? null,
    sortOrder: m.sort_order,
    isActive: m.is_active ?? true,
  }
}

export function orderMenusHierarchically(menus) {
  const byId = new Map(menus.map((m) => [m.id, m]))
  const childrenByParent = new Map()
  const roots = []

  for (const menu of menus) {
    if (menu.parentId && byId.has(menu.parentId)) {
      const list = childrenByParent.get(menu.parentId) || []
      list.push(menu)
      childrenByParent.set(menu.parentId, list)
    } else {
      roots.push(menu)
    }
  }

  const ordered = []
  for (const root of roots) {
    const children = childrenByParent.get(root.id) || []
    ordered.push({ ...root, hasChildren: children.length > 0, parentName: null })
    for (const child of children) {
      ordered.push({ ...child, hasChildren: false, parentName: root.name })
    }
  }
  return ordered
}

export function buildWsUrl(token) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws?token=${encodeURIComponent(token)}`
}

function extractError(body, fallback) {
  if (!body) return fallback
  if (typeof body.detail === 'string') return body.detail
  if (Array.isArray(body.detail) && body.detail.length > 0) {
    return body.detail[0]?.msg || fallback
  }
  return fallback
}

export async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        setAccessToken(null)
        return { ok: false, data: null }
      }
      const data = await res.json()
      setAccessToken(data.access_token)
      return { ok: true, data }
    } catch {
      return { ok: false, data: null }
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

export async function apiRequest(path, { method = 'GET', body, retryOn401 = true } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  let res
  try {
    res = await fetch(path, {
      method,
      headers,
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    return { ok: false, status: 0, error: 'Cannot reach backend server. Ensure the API server is running.' }
  }

  // Silently refresh expired access token once via httpOnly cookie
  if (res.status === 401 && retryOn401 && !path.startsWith('/api/auth/login') && !path.startsWith('/api/auth/refresh')) {
    const refreshed = await refreshAccessToken()
    if (refreshed.ok) {
      return apiRequest(path, { method, body, retryOn401: false })
    }
    if (authLostHandler) authLostHandler()
    return { ok: false, status: 401, error: 'Your session has expired. Please sign in again.' }
  }

  let data = null
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      data = await res.json()
    } catch {
      data = null
    }
  }

  if (!res.ok) {
    return { ok: false, status: res.status, error: extractError(data, `Request failed (${res.status}).`) }
  }

  return { ok: true, status: res.status, data }
}
