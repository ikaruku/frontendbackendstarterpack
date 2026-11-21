import { useMemo, useState } from 'react'
import { useApp } from '../store/AppContext'
import { orderMenusHierarchically } from '../api/client'
import ConfirmDialog from '../components/ConfirmDialog'
import Icon, { MENU_ICON_OPTIONS } from '../components/Icon'
import Modal from '../components/Modal'

const CORE_MENU_CODES = new Set(['user_management', 'menu_management'])

function slugCode(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function slugSegment(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function Menus() {
  const { managedMenus, can, toggleMenuActive, deleteMenu, toast } = useApp()
  const canWrite = can('menu_management', 'write')

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [dialog, setDialog] = useState(null) // { type: 'form' | 'confirm', ... }

  const orderedMenus = useMemo(() => orderMenusHierarchically(managedMenus), [managedMenus])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return orderedMenus.filter((m) => {
      if (status === 'active' && !m.isActive) return false
      if (status === 'inactive' && m.isActive) return false
      if (!q) return true
      return [m.name, m.code, m.group, m.path, m.parentName || ''].some((v) => v.toLowerCase().includes(q))
    })
  }, [orderedMenus, query, status])

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

  const askToggle = (m) =>
    m.isActive
      ? setDialog({
          type: 'confirm',
          title: 'Deactivate menu?',
          message: `Menu "${m.name}" will be hidden from the sidebar and permission settings until reactivated.`,
          confirmLabel: 'Deactivate',
          danger: true,
          onConfirm: () => run(toggleMenuActive(m.id), `Menu "${m.name}" has been deactivated.`),
        })
      : run(toggleMenuActive(m.id), `Menu "${m.name}" has been reactivated.`)

  const askDelete = (m) =>
    setDialog({
      type: 'confirm',
      title: 'Delete menu?',
      message: `Menu "${m.name}" (${m.code}) and all user permissions tied to it will be permanently deleted.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => run(deleteMenu(m.id), `Menu "${m.name}" has been deleted.`),
    })

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Menu Management</h1>
          <p>Manage sidebar menus, sub-menus, groups, icons, and routes stored in PostgreSQL.</p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-primary"
            disabled={!canWrite}
            onClick={() => setDialog({ type: 'form' })}
            title={canWrite ? '' : 'You have Read-only access to this module'}
          >
            <Icon name="plus" /> Add Menu
          </button>
        </div>
      </div>

      {!canWrite && (
        <div className="notice warn">
          <Icon name="info" />
          <span>Your access level for this module is Read, so menus are view-only.</span>
        </div>
      )}

      <section className="card" style={{ overflow: 'hidden' }}>
        <div className="toolbar">
          <div className="input-icon">
            <Icon name="search" />
            <input
              className="input"
              placeholder="Search name, code, group, or path..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search menus"
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
            {filtered.length} of {managedMenus.length} menus
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty">
            <Icon name="layers" />
            <p>No menus match your search criteria.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Menu</th>
                  <th>Code</th>
                  <th>Group</th>
                  <th>Order</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const isCore = CORE_MENU_CODES.has(m.code)
                  const deleteDisabled = isCore || m.hasChildren
                  const deleteTitle = isCore
                    ? 'Core administration menu cannot be deleted'
                    : m.hasChildren
                      ? 'Delete or move its sub-menus first'
                      : 'Delete'

                  return (
                    <tr key={m.id} className={m.parentName ? 'menu-sub-row' : ''}>
                      <td className="cell-main" data-label="Menu">
                        <div className="cell-user">
                          {m.parentName && <span className="menu-branch" aria-hidden="true">↳</span>}
                          <span className="kpi-icon" style={{ width: 36, height: 36, borderRadius: 10 }}>
                            <Icon name={m.icon} />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <strong>{m.name}</strong>
                            <small>
                              {m.path}
                              {m.parentName ? ` · Sub-menu of ${m.parentName}` : ''}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td data-label="Code">
                        <span className="code-pill">{m.code}</span>
                      </td>
                      <td data-label="Group">{m.group}</td>
                      <td data-label="Order">{m.sortOrder}</td>
                      <td data-label="Status">
                        {m.isActive ? (
                          <span className="badge badge-green">
                            <i className="dot" /> Active
                          </span>
                        ) : (
                          <span className="badge badge-gray">
                            <i className="dot" /> Inactive
                          </span>
                        )}
                      </td>
                      <td className="cell-actions" data-label="Actions">
                        <div className="row-actions">
                          {canWrite ? (
                            <>
                              <button
                                className="btn-icon"
                                onClick={() => setDialog({ type: 'form', menu: m })}
                                title="Edit menu"
                                aria-label="Edit menu"
                              >
                                <Icon name="edit" />
                              </button>
                              <button
                                className="btn-icon"
                                onClick={() => askToggle(m)}
                                disabled={isCore && m.isActive}
                                title={
                                  isCore && m.isActive
                                    ? 'Core administration menu cannot be deactivated'
                                    : m.isActive
                                      ? 'Deactivate'
                                      : 'Activate'
                                }
                                aria-label={m.isActive ? 'Deactivate' : 'Activate'}
                              >
                                <Icon name={m.isActive ? 'lock' : 'check'} />
                              </button>
                              <button
                                className="btn-icon danger"
                                onClick={() => askDelete(m)}
                                disabled={deleteDisabled}
                                title={deleteTitle}
                                aria-label="Delete"
                              >
                                <Icon name="trash" />
                              </button>
                            </>
                          ) : (
                            <span className="badge badge-gray">Read only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dialog?.type === 'form' && (
        <MenuForm editing={dialog.menu} allMenus={orderedMenus} onClose={close} />
      )}
      {dialog?.type === 'confirm' && <ConfirmDialog {...dialog} onClose={close} />}
    </>
  )
}

/* ---------- Menu Create / Edit Form ---------- */
function MenuForm({ editing, allMenus, onClose }) {
  const { addMenu, updateMenu, toast } = useApp()
  const isEdit = Boolean(editing)
  const isCore = isEdit && CORE_MENU_CODES.has(editing.code)
  const hasChildren = isEdit && Boolean(editing.hasChildren)

  const parentCandidates = useMemo(
    () => allMenus.filter((m) => !m.parentId && m.id !== editing?.id),
    [allMenus, editing],
  )

  const [form, setForm] = useState({
    name: editing?.name ?? '',
    code: editing?.code ?? '',
    parentId: editing?.parentId ? String(editing.parentId) : '',
    group: editing?.group ?? 'Main Menu',
    path: editing?.path ?? '',
    icon: editing?.icon ?? 'grid',
    sortOrder: editing?.sortOrder ?? allMenus.length + 1,
    isActive: editing?.isActive ?? true,
  })
  const [touchedSlug, setTouchedSlug] = useState(isEdit)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const selectedParent = parentCandidates.find((p) => String(p.id) === String(form.parentId)) || null

  const buildSuggestedFields = (name, parent) => {
    const seg = slugSegment(name)
    const codeSeg = slugCode(name)
    if (!parent) {
      return {
        code: codeSeg,
        path: seg ? `/${seg}` : '',
      }
    }
    const parentPrefix = parent.code.replace(/_+$/, '')
    return {
      code: codeSeg ? `${parentPrefix}_${codeSeg}` : '',
      path: seg ? `${parent.path.replace(/\/$/, '')}/${seg}` : '',
    }
  }

  const onNameChange = (e) => {
    const name = e.target.value
    setForm((f) => ({
      ...f,
      name,
      ...(isEdit || touchedSlug ? {} : buildSuggestedFields(name, selectedParent)),
    }))
  }

  const onParentChange = (e) => {
    const nextParentId = e.target.value
    const nextParent = parentCandidates.find((p) => String(p.id) === nextParentId) || null
    setForm((f) => ({
      ...f,
      parentId: nextParentId,
      group: nextParent ? nextParent.group : f.group,
      ...(isEdit || touchedSlug ? {} : buildSuggestedFields(f.name, nextParent)),
    }))
  }

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Menu name is required.'
    if (!isEdit && !/^[a-z][a-z0-9_]{1,49}$/.test(form.code.trim().toLowerCase())) {
      e.code = 'Code must start with a letter and use 2-50 lowercase letters, numbers, or "_".'
    }
    if (!form.group.trim()) e.group = 'Group name is required.'
    if (!/^\/[a-z0-9/_-]{1,119}$/i.test(form.path.trim())) {
      e.path = 'Path must start with "/" (e.g. /reports/sales).'
    }
    if (Number.isNaN(Number(form.sortOrder)) || Number(form.sortOrder) < 0) {
      e.sortOrder = 'Order must be 0 or greater.'
    }
    return e
  }

  const onSubmit = async (ev) => {
    ev.preventDefault()
    if (saving) return
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return

    setSaving(true)
    const result = isEdit ? await updateMenu(editing.id, form) : await addMenu(form)
    setSaving(false)
    if (!result.ok) return setErrors({ form: result.error })

    toast(isEdit ? `Menu "${form.name}" updated.` : `Menu "${form.name}" added to database.`)
    onClose()
  }

  return (
    <Modal
      wide
      title={isEdit ? 'Edit Menu' : 'Add Menu'}
      subtitle={isEdit ? `Code: ${editing.code}` : 'Create a top-level menu or a sub-menu under an existing menu.'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" form="menu-form" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <form id="menu-form" onSubmit={onSubmit} noValidate>
        {errors.form && (
          <div className="notice error" role="alert">
            <Icon name="alert" /> {errors.form}
          </div>
        )}

        <div className="field">
          <label htmlFor="m-parent">Parent Menu (Optional)</label>
          <select
            id="m-parent"
            className="select"
            value={form.parentId}
            disabled={isCore || hasChildren}
            onChange={onParentChange}
          >
            <option value="">None (Top-level Menu)</option>
            {parentCandidates.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name} ({p.group})
              </option>
            ))}
          </select>
          {hasChildren ? (
            <span className="hint">Menus that have sub-menus must remain top-level.</span>
          ) : isCore ? (
            <span className="hint">Core administration menus must remain top-level.</span>
          ) : (
            <span className="hint">Select a parent (e.g. Reports) to make this a sub-menu.</span>
          )}
        </div>

        <div className="field">
          <label htmlFor="m-name">Menu Name</label>
          <input
            id="m-name"
            className={`input ${errors.name ? 'invalid' : ''}`}
            value={form.name}
            onChange={onNameChange}
            placeholder={selectedParent ? 'e.g. Sales Report' : 'e.g. Analytics'}
            autoFocus
          />
          {errors.name && <span className="error-text">{errors.name}</span>}
        </div>

        <div className="field">
          <label htmlFor="m-code">Permission Code</label>
          <input
            id="m-code"
            className={`input ${errors.code ? 'invalid' : ''}`}
            value={form.code}
            disabled={isEdit}
            onChange={(e) => {
              setTouchedSlug(true)
              setForm((f) => ({ ...f, code: e.target.value }))
            }}
            placeholder={selectedParent ? `e.g. ${selectedParent.code}_sales` : 'e.g. analytics'}
          />
          {errors.code ? (
            <span className="error-text">{errors.code}</span>
          ) : (
            <span className="hint">
              {isEdit ? 'Permission key cannot be changed after creation.' : 'Unique key used by user permissions.'}
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label htmlFor="m-group">Sidebar Group</label>
            <input
              id="m-group"
              list="menu-group-suggestions"
              className={`input ${errors.group ? 'invalid' : ''}`}
              value={form.group}
              disabled={Boolean(selectedParent)}
              onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
            />
            <datalist id="menu-group-suggestions">
              <option value="Main Menu" />
              <option value="Administration" />
            </datalist>
            {errors.group ? (
              <span className="error-text">{errors.group}</span>
            ) : (
              selectedParent && <span className="hint">Inherited from {selectedParent.name}.</span>
            )}
          </div>

          <div className="field">
            <label htmlFor="m-order">Sort Order</label>
            <input
              id="m-order"
              type="number"
              min="0"
              className={`input ${errors.sortOrder ? 'invalid' : ''}`}
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
            />
            {errors.sortOrder && <span className="error-text">{errors.sortOrder}</span>}
          </div>
        </div>

        <div className="field">
          <label htmlFor="m-path">Route Path</label>
          <input
            id="m-path"
            className={`input ${errors.path ? 'invalid' : ''}`}
            value={form.path}
            onChange={(e) => {
              setTouchedSlug(true)
              setForm((f) => ({ ...f, path: e.target.value }))
            }}
            placeholder={selectedParent ? `e.g. ${selectedParent.path}/sales` : 'e.g. /analytics'}
          />
          {errors.path && <span className="error-text">{errors.path}</span>}
        </div>

        <div className="field">
          <label>Icon</label>
          <div className="icon-picker" role="radiogroup" aria-label="Menu icon">
            {MENU_ICON_OPTIONS.map((name) => (
              <button
                key={name}
                type="button"
                className={`icon-choice ${form.icon === name ? 'selected' : ''}`}
                onClick={() => setForm((f) => ({ ...f, icon: name }))}
                title={name}
                aria-label={name}
                aria-checked={form.icon === name}
                role="radio"
              >
                <Icon name={name} />
              </button>
            ))}
          </div>
        </div>

        <label className="switch" style={{ marginBottom: 8 }}>
          <input
            type="checkbox"
            checked={form.isActive}
            disabled={isCore}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          <span className="track" />
          Active menu {isCore ? '(core menu always active)' : ''}
        </label>
      </form>
    </Modal>
  )
}
