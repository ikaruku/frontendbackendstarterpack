import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import Icon from '../components/Icon'

export default function ChangePassword() {
  const { user, changePassword, toast } = useApp()
  const navigate = useNavigate()
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const forced = user.mustChangePassword

  const onSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    if (newPw.length < 8) return setError('New password must be at least 8 characters long.')
    if (!/[A-Za-z]/.test(newPw) || !/\d/.test(newPw)) {
      return setError('New password must contain both letters and numbers.')
    }
    if (newPw !== confirm) return setError('Password confirmation does not match.')

    setSubmitting(true)
    setError('')
    const result = await changePassword(oldPw, newPw)
    setSubmitting(false)
    if (!result.ok) return setError(result.error)
    toast('Password changed successfully.')
    navigate('/', { replace: true })
  }

  return (
    <div className="auth-solo">
      <form className="card" onSubmit={onSubmit} noValidate>
        <div className="kpi-icon" style={{ marginBottom: 14 }}>
          <Icon name="lock" />
        </div>
        <h1 style={{ fontSize: 22 }}>Change Password</h1>
        <p className="card-sub" style={{ margin: '4px 0 20px' }}>
          Hello, {user.fullName}.
        </p>

        {forced && (
          <div className="notice warn">
            <Icon name="alert" />
            <span>For security reasons, you must change your default password before proceeding.</span>
          </div>
        )}
        {error && (
          <div className="notice error" role="alert">
            <Icon name="alert" /> {error}
          </div>
        )}

        <div className="field">
          <label htmlFor="old">Current password</label>
          <input
            id="old"
            className="input"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            value={oldPw}
            onChange={(e) => setOldPw(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="new">New password</label>
          <input
            id="new"
            className="input"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
          />
          <span className="hint">Minimum 8 characters, combining letters and numbers.</span>
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirm new password</label>
          <input
            id="confirm"
            className="input"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        <label className="switch" style={{ marginBottom: 20 }}>
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          <span className="track" />
          Show password
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          {!forced && (
            <button type="button" className="btn" onClick={() => navigate(-1)} disabled={submitting}>
              Cancel
            </button>
          )}
          <button
            className="btn btn-primary btn-block"
            type="submit"
            disabled={!oldPw || !newPw || !confirm || submitting}
          >
            {submitting ? 'Saving...' : 'Save Password'}
          </button>
        </div>
      </form>
    </div>
  )
}
