import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { APP_CONFIG } from '../data/config'
import Icon from '../components/Icon'

export default function Login() {
  const { user, authReady, login, theme, toggleTheme } = useApp()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!authReady) {
    return (
      <div className="auth-clean">
        <div className="card auth-box" style={{ textAlign: 'center' }}>
          <p className="card-sub">Checking session...</p>
        </div>
      </div>
    )
  }

  if (user) return <Navigate to={user.mustChangePassword ? '/change-password' : '/'} replace />

  const onSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    const result = await login(username, password)
    setSubmitting(false)
    if (!result.ok) return setError(result.error)
    navigate(result.user.mustChangePassword ? '/change-password' : '/', { replace: true })
  }

  return (
    <div className="auth-clean">
      <button
        type="button"
        className="btn-icon auth-theme-btn"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
      </button>

      <form className="card auth-box" onSubmit={onSubmit} noValidate>
        <div className="auth-head">
          <span className="brand-logo auth-logo">{APP_CONFIG.shortName}</span>
          <h1>{APP_CONFIG.title}</h1>
          <p>Sign in to continue to your dashboard</p>
        </div>

        {error && (
          <div className="notice error" role="alert">
            <Icon name="alert" /> {error}
          </div>
        )}

        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            className="input"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              setError('')
            }}
            placeholder="Enter your username"
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="input-wrap">
            <input
              id="password"
              className="input"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              placeholder="Enter your password"
            />
            <button
              type="button"
              className="btn-icon"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              <Icon name={show ? 'eyeOff' : 'eye'} />
            </button>
          </div>
        </div>

        <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={!username || !password || submitting}>
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
