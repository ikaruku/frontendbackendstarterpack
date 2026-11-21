import { useMemo, useState } from 'react'
import { useApp } from '../store/AppContext'
import { orderMenusHierarchically } from '../api/client'
import { ACCESS_LEVELS } from '../data/mock'
import Avatar from '../components/Avatar'
import ConfirmDialog from '../components/ConfirmDialog'
import Icon from '../components/Icon'
import Modal from '../components/Modal'

const dateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const formatDate = (iso) => (iso ? dateFmt.format(new Date(iso)) : 'Never')

export default function Users() {
  const { users, user: me, can, toggleActive, deleteUser, resetPassword, toast } = useApp()
  const canWrite = can('user_management', 'write')

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [dialog, setDialog] = useState(null) // { type: 'form' | 'perm' | 'confirm', ... }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return users.filter((u) => {
      if (status === 'active' && !u.active) return false
      if (status === 'inactive' && u.active) return false
      if (!q) return true
      return [u.username, u.fullName, u.email].some((v) => v.toLowerCase().includes(q))
    })
  }, [users, query, status])

  const close = () => setDialog(null)

  const run = async (promise, successMessage) => {
    const result = await promise
    if (!result.ok) {
      toast(result.error, 'error')
      return false
    }
    if (successMessage) toast(successMessage)
    return true
  }

  const askToggle = (u) =>
    u.active
      ? setDialog({
          type: 'confirm',
          title: 'Deactivate user?',
          message: `${u.fullName} will not be able to log in, and active sessions will end immediately.`,
          confirmLabel: 'Deactivate',
          danger: true,
          onConfirm: () => run(toggleActive(u.id), `${u.fullName} has been deactivated.`),
        })
      : run(toggleActive(u.id), `${u.fullName} has been reactivated.`)

  const askDelete = (u) =>
    setDialog({
      type: 'confirm',
      title: 'Delete user?',
      message: `Account ${u.fullName} (@${u.username}) will be permanently deleted. This action cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => run(deleteUser(u.id), `${u.fullName} has been deleted.`),
    })

  const askReset = (u) =>
    setDialog({
      type: 'confirm',
      title: 'Reset password?',
      message: `The password for ${u.fullName} will be replaced with a new temporary password and the user must change it upon their next login.`,
      confirmLabel: 'Reset Password',
      onConfirm: async () => {
        const r = await resetPassword(u.id)
        if (!r.ok) {
          toast(r.error, 'error')
          return false
        }
        toast(`Temporary password: ${r.password}`, 'info')
        return true
      },
    })

  return (
    <>
      <div className="page-head">
        <div>
          <h1>User Management</h1>
          <p>Manage accounts and configure permissions per menu (Read or Write).</p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-primary"
            disabled={!canWrite}
            onClick={() => setDialog({ type: 'form' })}
            title={canWrite ? '' : 'You have Read-only access to this module'}
          >
            <Icon name="plus" /> Add User
          </button>
        </div>
      </div>

      {!canWrite && (
        <div className="notice warn">
          <Icon name="info" />
          <span>Your access level for this module is Read, so data is view-only.</span>
        </div>
      )}

      <section className="card" style={{ overflow: 'hidden' }}>
        <div className="toolbar">
          <div className="input-icon">
            <Icon name="search" />
            <input
              className="input"
              placeholder="Search name, username, or email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search users"
            />
          </div>
          <select
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <span className="count">
            {filtered.length} of {users.length} users
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty">
            <Icon name="users" />
            <p>No users match your search criteria.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Permissions</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <UserRow
                    key={u.id}
                    u={u}
                    isMe={u.id === me.id}
                    canWrite={canWrite}
                    onPerm={() => setDialog({ type: 'perm', user: u })}
                    onEdit={() => setDialog({ type: 'form', user: u })}
                    onReset={() => askReset(u)}
                    onToggle={() => askToggle(u)}
                    onDelete={() => askDelete(u)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dialog?.type === 'form' && <UserForm editing={dialog.user} onClose={close} />}
      {dialog?.type === 'perm' && <PermissionDialog target={dialog.user} readOnly={!canWrite} onClose={close} />}
      {dialog?.type === 'confirm' && <ConfirmDialog {...dialog} onClose={close} />}
    </>
  )
}

/* ---------------------------------------------------------- */

function permissionSummary(u) {
  if (u.isSuperadmin) return <span className="badge badge-teal">Full access</span>
  const entries = Object.values(u.permissions || {})
  if (entries.length === 0) return <span className="badge badge-gray">None</span>
  const writes = entries.filter((l) => l === 'write').length
  const reads = entries.length - writes
  return (
    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
      {writes > 0 && <span className="badge badge-teal">{writes} Write</span>}
      {reads > 0 && <span className="badge badge-blue">{reads} Read</span>}
    </span>
  )
}

function UserRow({ u, isMe, canWrite, onPerm, onEdit, onReset, onToggle, onDelete }) {
  return (
    <tr>
      <td className="cell-main" data-label="User">
        <div className="cell-user">
          <Avatar name={u.fullName} />
          <div style={{ minWidth: 0 }}>
            <strong>
              {u.fullName} {isMe && <span className="badge badge-gray">You</span>}
            </strong>
            <small>
              @{u.username} · {u.email || 'no email'}
            </small>
          </div>
        </div>
      </td>
      <td data-label="Permissions">{permissionSummary(u)}</td>
      <td data-label="Status">
        {u.active ? (
          <span className="badge badge-green">
            <i className="dot" /> Active
          </span>
        ) : (
          <span className="badge badge-gray">
            <i className="dot" /> Inactive
          </span>
        )}
      </td>
      <td data-label="Last Login">{formatDate(u.lastLoginAt)}</td>
      <td className="cell-actions" data-label="Actions">
        <div className="row-actions">
          <button
            className="btn-icon"
            onClick={onPerm}
            title={canWrite ? 'Configure permissions' : 'View permissions'}
            aria-label="Permissions"
          >
            <Icon name={canWrite ? 'shield' : 'eye'} />
          </button>
          {canWrite && (
            <>
              <button className="btn-icon" onClick={onEdit} title="Edit user" aria-label="Edit user">
                <Icon name="edit" />
              </button>
              <button className="btn-icon" onClick={onReset} title="Reset password" aria-label="Reset password">
                <Icon name="key" />
              </button>
              <button
                className="btn-icon"
                onClick={onToggle}
                disabled={isMe && u.active}
                title={u.active ? 'Deactivate' : 'Activate'}
                aria-label={u.active ? 'Deactivate' : 'Activate'}
              >
                <Icon name={u.active ? 'lock' : 'check'} />
              </button>
              <button
                className="btn-icon danger"
                onClick={onDelete}
                disabled={isMe}
                title="Delete"
                aria-label="Delete"
              >
                <Icon name="trash" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

/* ---------- User Create / Edit Form ---------- */
function UserForm({ editing, onClose }) {
  const { addUser, updateUser, toast } = useApp()
  const isEdit = Boolean(editing)
  const [form, setForm] = useState({
    username: editing?.username ?? '',
    fullName: editing?.fullName ?? '',
    email: editing?.email ?? '',
    password: '',
    active: editing?.active ?? true,
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const validate = () => {
    const e = {}
    if (!/^[a-z0-9._-]{3,}$/i.test(form.username.trim())) {
      e.username = 'Minimum 3 characters: letters, numbers, dot, dash, or underscore.'
    }
    if (!form.fullName.trim()) e.fullName = 'Full name is required.'
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Invalid email address format.'
    if (!isEdit && form.password.length < 8) e.password = 'Initial password must be at least 8 characters long.'
    return e
  }

  const onSubmit = async (ev) => {
    ev.preventDefault()
    if (saving) return
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return

    setSaving(true)
    const result = isEdit ? await updateUser(editing.id, form) : await addUser(form)
    setSaving(false)
    if (!result.ok) return setErrors({ form: result.error })
    toast(
      isEdit
        ? 'User updated successfully.'
        : `User ${form.fullName} added. Configure menu permissions using the shield icon.`,
    )
    onClose()
  }

  return (
    <Modal
      title={isEdit ? 'Edit User' : 'Add User'}
      subtitle={isEdit ? `@${editing.username}` : 'New users must change their password on first login.'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" form="user-form" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={onSubmit} noValidate>
        {errors.form && (
          <div className="notice error" role="alert">
            <Icon name="alert" /> {errors.form}
          </div>
        )}
        <div className="field">
          <label htmlFor="f-username">Username</label>
          <input
            id="f-username"
            className={`input ${errors.username ? 'invalid' : ''}`}
            value={form.username}
            onChange={set('username')}
            autoFocus
            autoComplete="off"
          />
          {errors.username && <span className="error-text">{errors.username}</span>}
        </div>
        <div className="field">
          <label htmlFor="f-name">Full name</label>
          <input
            id="f-name"
            className={`input ${errors.fullName ? 'invalid' : ''}`}
            value={form.fullName}
            onChange={set('fullName')}
          />
          {errors.fullName && <span className="error-text">{errors.fullName}</span>}
        </div>
        <div className="field">
          <label htmlFor="f-email">Email (optional)</label>
          <input
            id="f-email"
            type="email"
            className={`input ${errors.email ? 'invalid' : ''}`}
            value={form.email}
            onChange={set('email')}
          />
          {errors.email && <span className="error-text">{errors.email}</span>}
        </div>
        {!isEdit && (
          <div className="field">
            <label htmlFor="f-pass">Initial password</label>
            <input
              id="f-pass"
              type="text"
              className={`input ${errors.password ? 'invalid' : ''}`}
              value={form.password}
              onChange={set('password')}
              autoComplete="off"
            />
            {errors.password ? (
              <span className="error-text">{errors.password}</span>
            ) : (
              <span className="hint">Share with the user; they will be required to change it.</span>
            )}
          </div>
        )}
        <label className="switch" style={{ marginBottom: 8 }}>
          <input type="checkbox" checked={form.active} onChange={set('active')} />
          <span className="track" />
          Active account
        </label>
      </form>
    </Modal>
  )
}

/* ---------- Menu Permissions Dialog ---------- */
function PermissionDialog({ target, readOnly, onClose }) {
  const { menus, setPermissions, toast } = useApp()
  const [perms, setPerms] = useState({ ...target.permissions })
  const [saving, setSaving] = useState(false)

  const levelOf = (code) => perms[code] ?? 'none'
  const setLevel = (code, level) =>
    setPerms((p) => {
      const next = { ...p }
      if (level === 'none') delete next[code]
      else next[code] = level
      return next
    })
  const setAll = (level) => setPerms(level === 'none' ? {} : Object.fromEntries(menus.map((m) => [m.code, level])))

  const locked = readOnly || target.isSuperadmin

  const save = async () => {
    if (saving) return
    setSaving(true)
    const result = await setPermissions(target.id, perms)
    setSaving(false)
    if (!result.ok) {
      toast(result.error, 'error')
      return
    }
    toast(`Permissions for ${target.fullName} saved. Changes apply immediately.`)
    onClose()
  }

  return (
    <Modal
      wide
      title="Menu Permissions"
      subtitle={`${target.fullName} (@${target.username})`}
      onClose={onClose}
      footer={
        locked ? (
          <button className="btn" onClick={onClose}>
            Close
          </button>
        ) : (
          <>
            <button className="btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving...' : 'Save Permissions'}
            </button>
          </>
        )
      }
    >
      {target.isSuperadmin && (
        <div className="notice">
          <Icon name="shield" />
          <span>Administrators have full access (Write) to all modules and cannot be restricted.</span>
        </div>
      )}

      {!locked && (
        <div className="perm-tools">
          <button className="btn btn-sm" onClick={() => setAll('read')}>
            All Read
          </button>
          <button className="btn btn-sm" onClick={() => setAll('write')}>
            All Write
          </button>
          <button className="btn btn-sm" onClick={() => setAll('none')}>
            Clear All
          </button>
        </div>
      )}

      <div className="perm-list">
        {orderMenusHierarchically(menus).map((m) => {
          const level = target.isSuperadmin ? 'write' : levelOf(m.code)
          return (
            <div className={`perm-row ${m.parentName ? 'is-child' : ''}`} key={m.code}>
              <div className="name">
                <Icon name={m.icon} />
                <span>
                  {m.name}
                  <small>{m.parentName ? `Sub-menu of ${m.parentName}` : m.group}</small>
                </span>
              </div>
              <div className="seg level" role="group" aria-label={`Permissions for ${m.name}`}>
                {ACCESS_LEVELS.map((opt) => (
                  <button
                    key={opt.value}
                    data-level={opt.value}
                    aria-pressed={level === opt.value}
                    disabled={locked}
                    onClick={() => setLevel(m.code, opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <p className="card-sub" style={{ marginBottom: 8 }}>
        Read: view only. Write: view, create, edit, and delete. None: module is hidden for this user.
      </p>
    </Modal>
  )
}
