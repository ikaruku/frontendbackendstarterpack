import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useApp } from './store/AppContext'
import Layout from './components/Layout'
import ToastHost from './components/ToastHost'
import Login from './pages/Login'
import ChangePassword from './pages/ChangePassword'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import Menus from './pages/Menus'
import ModulePage from './pages/ModulePage'
import Forbidden from './pages/Forbidden'

function SessionLoading() {
  return (
    <div className="auth-clean">
      <div className="card auth-box" style={{ textAlign: 'center' }}>
        <p className="card-sub">Restoring session...</p>
      </div>
    </div>
  )
}

// Require authentication. Force password change if `mustChangePassword` is true.
function RequireAuth() {
  const { user, authReady } = useApp()
  const location = useLocation()
  if (!authReady) return <SessionLoading />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  return <Outlet />
}

// Per-menu UI guard. Backend enforces the actual security check.
function Guard({ menu, level = 'read', children }) {
  const { can } = useApp()
  return can(menu, level) ? children : <Forbidden />
}

// Redirect "/" to the first accessible menu for the current user.
function Home() {
  const { visibleMenus } = useApp()
  if (visibleMenus.length === 0) return <Forbidden />
  return <Navigate to={visibleMenus[0].path} replace />
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route path="/change-password" element={<ChangePassword />} />
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route
              path="/dashboard"
              element={
                <Guard menu="dashboard">
                  <Dashboard />
                </Guard>
              }
            />
            <Route
              path="/users"
              element={
                <Guard menu="user_management">
                  <Users />
                </Guard>
              }
            />
            <Route
              path="/menus"
              element={
                <Guard menu="menu_management">
                  <Menus />
                </Guard>
              }
            />
            <Route path="/*" element={<ModulePage />} />
          </Route>
        </Route>
      </Routes>
      <ToastHost />
    </>
  )
}
