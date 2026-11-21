import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { APP_CONFIG } from '../data/config'
import {
  apiRequest,
  buildWsUrl,
  getAccessToken,
  normalizeMenu,
  normalizeUser,
  refreshAccessToken,
  setAccessToken,
  setAuthLostHandler,
} from '../api/client'

/*
 * Application Store (backed by FastAPI + PostgreSQL + WebSocket).
 *
 * - Access token stays in memory; refresh token stays in an httpOnly cookie.
 * - Theme ('light' | 'dark') and sidebar collapsed state stay in localStorage.
 * - Authenticated WebSocket keeps user lists, menus, and active permissions synced in realtime.
 */

const THEME_KEY = 'adminpanel.theme.v1'
const SIDEBAR_KEY = 'adminpanel.sidebar_collapsed.v1'

const AppContext = createContext(null)

function readTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'dark' || saved === 'light') return saved
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch {
    /* ignore */
  }
  return 'light'
}

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === 'true'
  } catch {
    return false
  }
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [visibleMenus, setVisibleMenus] = useState([])
  const [menus, setMenus] = useState([])
  const [managedMenus, setManagedMenus] = useState([])
  const [users, setUsers] = useState([])
  const [toasts, setToasts] = useState([])
  const [theme, setTheme] = useState(readTheme)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed)

  const wsRef = useRef(null)
  const intentionalCloseRef = useRef(false)

  /* ---------- App Title & Theme Handling ---------- */
  useEffect(() => {
    document.title = APP_CONFIG.title
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  /* ---------- Sidebar Collapsed Handling ---------- */
  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_KEY, String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  /* ---------- Toast ---------- */
  const toast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((list) => [...list, { id, message, type }])
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 4000)
  }, [])
  const dismissToast = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  /* ---------- Permissions ---------- */
  // 'write' includes 'read'. Superadmin always has full access.
  const can = useCallback(
    (code, level = 'read') => {
      if (!user || !user.active) return false
      if (user.isSuperadmin) return true
      const granted = user.permissions?.[code]
      if (!granted) return false
      return level === 'read' ? true : granted === 'write'
    },
    [user],
  )

  const clearSessionState = useCallback(() => {
    intentionalCloseRef.current = true
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setAccessToken(null)
    setUser(null)
    setVisibleMenus([])
    setMenus([])
    setManagedMenus([])
    setUsers([])
  }, [])

  const loadWorkspaceData = useCallback(async (activeUser) => {
    const canManageUsers = activeUser.isSuperadmin || Boolean(activeUser.permissions?.user_management)
    const canManageMenus = activeUser.isSuperadmin || Boolean(activeUser.permissions?.menu_management)

    const [myMenusRes, usersRes, catalogRes, manageRes] = await Promise.all([
      apiRequest('/api/menus'),
      canManageUsers ? apiRequest('/api/users') : Promise.resolve(null),
      canManageUsers ? apiRequest('/api/menus/catalog') : Promise.resolve(null),
      canManageMenus ? apiRequest('/api/menus/manage') : Promise.resolve(null),
    ])

    if (myMenusRes.ok) setVisibleMenus(myMenusRes.data.map(normalizeMenu))
    if (usersRes?.ok) setUsers(usersRes.data.map(normalizeUser))
    else setUsers([])

    if (catalogRes?.ok) setMenus(catalogRes.data.map(normalizeMenu))
    else setMenus([])

    if (manageRes?.ok) setManagedMenus(manageRes.data.map(normalizeMenu))
    else setManagedMenus([])
  }, [])

  const refreshProfile = useCallback(async () => {
    const meRes = await apiRequest('/api/auth/me')
    if (!meRes.ok) return null
    const nextUser = normalizeUser(meRes.data)
    setUser(nextUser)
    await loadWorkspaceData(nextUser)
    return nextUser
  }, [loadWorkspaceData])

  /* ---------- Restore Session on Boot ---------- */
  useEffect(() => {
    setAuthLostHandler(() => {
      clearSessionState()
    })

    let cancelled = false
    ;(async () => {
      const refreshed = await refreshAccessToken()
      if (!cancelled && refreshed.ok && refreshed.data?.user) {
        const loggedUser = normalizeUser(refreshed.data.user)
        setUser(loggedUser)
        await loadWorkspaceData(loggedUser)
      }
      if (!cancelled) setAuthReady(true)
    })()

    return () => {
      cancelled = true
      setAuthLostHandler(null)
    }
  }, [clearSessionState, loadWorkspaceData])

  /* ---------- Realtime WebSocket Connection ---------- */
  const userId = user?.id ?? null
  const canReadUsers = useMemo(() => can('user_management', 'read'), [can])
  const canReadMenus = useMemo(() => can('menu_management', 'read'), [can])
  const canReadUsersRef = useRef(canReadUsers)
  const canReadMenusRef = useRef(canReadMenus)
  useEffect(() => {
    canReadUsersRef.current = canReadUsers
  }, [canReadUsers])
  useEffect(() => {
    canReadMenusRef.current = canReadMenus
  }, [canReadMenus])

  useEffect(() => {
    if (!userId) return undefined

    let retryTimer = null
    let pingTimer = null
    let disposed = false
    intentionalCloseRef.current = false

    const connect = async () => {
      let token = getAccessToken()
      if (!token) {
        const refreshed = await refreshAccessToken()
        if (!refreshed.ok) return
        token = getAccessToken()
      }
      if (disposed || !token) return

      const ws = new WebSocket(buildWsUrl(token))
      wsRef.current = ws

      ws.onopen = () => {
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send('ping')
        }, 25000)
      }

      ws.onmessage = async (event) => {
        let msg
        try {
          msg = JSON.parse(event.data)
        } catch {
          return
        }
        const { type, payload } = msg
        if (!type || type === 'connected' || type === 'pong') return

        if ((type === 'user.deactivated' || type === 'user.deleted') && payload?.user_id === userId) {
          clearSessionState()
          toast('Your session has ended because your account was deactivated or deleted.', 'error')
          return
        }

        if (payload?.user_id === userId && (type === 'permission.changed' || type === 'user.updated')) {
          await refreshProfile()
          if (type === 'permission.changed') {
            toast('Your menu permissions were updated by an administrator.', 'info')
          }
          return
        }

        if (type === 'menu.changed') {
          const [myMenusRes, catalogRes, manageRes] = await Promise.all([
            apiRequest('/api/menus'),
            canReadUsersRef.current ? apiRequest('/api/menus/catalog') : Promise.resolve(null),
            canReadMenusRef.current ? apiRequest('/api/menus/manage') : Promise.resolve(null),
          ])
          if (myMenusRes.ok) setVisibleMenus(myMenusRes.data.map(normalizeMenu))
          if (catalogRes?.ok) setMenus(catalogRes.data.map(normalizeMenu))
          if (manageRes?.ok) setManagedMenus(manageRes.data.map(normalizeMenu))
          return
        }

        if (
          canReadUsersRef.current &&
          ['user.created', 'user.updated', 'user.deleted', 'user.deactivated', 'permission.changed'].includes(type)
        ) {
          const usersRes = await apiRequest('/api/users')
          if (usersRes.ok) setUsers(usersRes.data.map(normalizeUser))
        }
      }

      ws.onclose = async (ev) => {
        if (pingTimer) {
          clearInterval(pingTimer)
          pingTimer = null
        }
        if (disposed || intentionalCloseRef.current) return

        if (ev.code === 4003 || ev.code === 1008) {
          const refreshed = await refreshAccessToken()
          if (!refreshed.ok) {
            clearSessionState()
            toast(ev.reason || 'Your session has ended.', 'error')
            return
          }
        }
        retryTimer = setTimeout(connect, 2500)
      }
    }

    connect()

    return () => {
      disposed = true
      intentionalCloseRef.current = true
      if (retryTimer) clearTimeout(retryTimer)
      if (pingTimer) clearInterval(pingTimer)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [userId, clearSessionState, refreshProfile, toast])

  /* ---------- Auth ---------- */
  const login = useCallback(
    async (username, password) => {
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: { username: username.trim(), password },
      })
      if (!res.ok) return { ok: false, error: res.error }

      setAccessToken(res.data.access_token)
      const loggedUser = normalizeUser(res.data.user)
      setUser(loggedUser)
      await loadWorkspaceData(loggedUser)
      return { ok: true, user: loggedUser }
    },
    [loadWorkspaceData],
  )

  const logout = useCallback(async () => {
    await apiRequest('/api/auth/logout', { method: 'POST', retryOn401: false })
    clearSessionState()
  }, [clearSessionState])

  const changePassword = useCallback(async (oldPassword, newPassword) => {
    const res = await apiRequest('/api/auth/change-password', {
      method: 'POST',
      body: { current_password: oldPassword, new_password: newPassword },
    })
    if (!res.ok) return { ok: false, error: res.error }
    setAccessToken(res.data.access_token)
    setUser(normalizeUser(res.data.user))
    return { ok: true }
  }, [])

  /* ---------- User Management ---------- */
  const addUser = useCallback(async ({ username, fullName, email, password, active }) => {
    const res = await apiRequest('/api/users', {
      method: 'POST',
      body: {
        username: username.trim(),
        full_name: fullName.trim(),
        email: email.trim() || null,
        password,
        is_active: active,
      },
    })
    if (!res.ok) return { ok: false, error: res.error }
    const created = normalizeUser(res.data)
    setUsers((list) => (list.some((u) => u.id === created.id) ? list : [...list, created]))
    return { ok: true, user: created }
  }, [])

  const updateUser = useCallback(async (id, { username, fullName, email, active }) => {
    const res = await apiRequest(`/api/users/${id}`, {
      method: 'PUT',
      body: {
        username: username.trim(),
        full_name: fullName.trim(),
        email: email.trim() || null,
        is_active: active,
      },
    })
    if (!res.ok) return { ok: false, error: res.error }
    const updated = normalizeUser(res.data)
    setUsers((list) => list.map((u) => (u.id === id ? updated : u)))
    return { ok: true, user: updated }
  }, [])

  const toggleActive = useCallback(async (id) => {
    const res = await apiRequest(`/api/users/${id}/toggle-active`, { method: 'PATCH' })
    if (!res.ok) return { ok: false, error: res.error }
    const updated = normalizeUser(res.data)
    setUsers((list) => list.map((u) => (u.id === id ? updated : u)))
    return { ok: true, active: updated.active }
  }, [])

  const deleteUser = useCallback(async (id) => {
    const res = await apiRequest(`/api/users/${id}`, { method: 'DELETE' })
    if (!res.ok) return { ok: false, error: res.error }
    setUsers((list) => list.filter((u) => u.id !== id))
    return { ok: true }
  }, [])

  const resetPassword = useCallback(async (id) => {
    const res = await apiRequest(`/api/users/${id}/reset-password`, { method: 'POST' })
    if (!res.ok) return { ok: false, error: res.error }
    return { ok: true, password: res.data.temporary_password }
  }, [])

  const setPermissions = useCallback(async (id, permissions) => {
    const res = await apiRequest(`/api/users/${id}/permissions`, {
      method: 'PUT',
      body: { permissions },
    })
    if (!res.ok) return { ok: false, error: res.error }
    const updated = normalizeUser(res.data)
    setUsers((list) => list.map((u) => (u.id === id ? updated : u)))
    return { ok: true }
  }, [])

  /* ---------- Menu Management ---------- */
  const syncMenuState = useCallback(async () => {
    const [myMenusRes, catalogRes, manageRes] = await Promise.all([
      apiRequest('/api/menus'),
      canReadUsersRef.current ? apiRequest('/api/menus/catalog') : Promise.resolve(null),
      canReadMenusRef.current ? apiRequest('/api/menus/manage') : Promise.resolve(null),
    ])
    if (myMenusRes.ok) setVisibleMenus(myMenusRes.data.map(normalizeMenu))
    if (catalogRes?.ok) setMenus(catalogRes.data.map(normalizeMenu))
    if (manageRes?.ok) setManagedMenus(manageRes.data.map(normalizeMenu))
  }, [])

  const addMenu = useCallback(
    async ({ code, name, group, icon, path, parentId, sortOrder, isActive }) => {
      const res = await apiRequest('/api/menus', {
        method: 'POST',
        body: {
          code: code.trim().toLowerCase(),
          name: name.trim(),
          group_name: group.trim(),
          icon,
          path: path.trim().toLowerCase(),
          parent_id: parentId ? Number(parentId) : null,
          sort_order: Number(sortOrder) || 0,
          is_active: isActive,
        },
      })
      if (!res.ok) return { ok: false, error: res.error }
      await syncMenuState()
      return { ok: true, menu: normalizeMenu(res.data) }
    },
    [syncMenuState],
  )

  const updateMenu = useCallback(
    async (id, { name, group, icon, path, parentId, sortOrder, isActive }) => {
      const res = await apiRequest(`/api/menus/${id}`, {
        method: 'PUT',
        body: {
          name: name.trim(),
          group_name: group.trim(),
          icon,
          path: path.trim().toLowerCase(),
          parent_id: parentId ? Number(parentId) : null,
          sort_order: Number(sortOrder) || 0,
          is_active: isActive,
        },
      })
      if (!res.ok) return { ok: false, error: res.error }
      await syncMenuState()
      return { ok: true, menu: normalizeMenu(res.data) }
    },
    [syncMenuState],
  )

  const toggleMenuActive = useCallback(
    async (id) => {
      const res = await apiRequest(`/api/menus/${id}/toggle-active`, { method: 'PATCH' })
      if (!res.ok) return { ok: false, error: res.error }
      await syncMenuState()
      return { ok: true, isActive: res.data.is_active }
    },
    [syncMenuState],
  )

  const deleteMenu = useCallback(
    async (id) => {
      const res = await apiRequest(`/api/menus/${id}`, { method: 'DELETE' })
      if (!res.ok) return { ok: false, error: res.error }
      await syncMenuState()
      return { ok: true }
    },
    [syncMenuState],
  )

  const value = {
    users,
    user,
    authReady,
    menus,
    managedMenus,
    visibleMenus,
    can,
    login,
    logout,
    changePassword,
    addUser,
    updateUser,
    toggleActive,
    deleteUser,
    resetPassword,
    setPermissions,
    addMenu,
    updateMenu,
    toggleMenuActive,
    deleteMenu,
    toasts,
    toast,
    dismissToast,
    theme,
    toggleTheme,
    sidebarCollapsed,
    toggleSidebarCollapsed,
    appConfig: APP_CONFIG,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
