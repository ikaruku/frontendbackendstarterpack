import { useLocation } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import Icon from '../components/Icon'
import Forbidden from './Forbidden'

// Placeholder page for database-defined modules that do not yet have a custom page component.
export default function ModulePage() {
  const { pathname } = useLocation()
  const { menus, visibleMenus, can, toast } = useApp()
  const menu = (menus.length ? menus : visibleMenus).find((m) => m.path === pathname)

  if (!menu) {
    return (
      <div className="card empty">
        <Icon name="search" />
        <p>Page not found.</p>
      </div>
    )
  }
  if (!can(menu.code, 'read')) return <Forbidden />

  const canWrite = can(menu.code, 'write')

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{menu.name}</h1>
          <p>
            Your access level:{' '}
            <span className={`badge ${canWrite ? 'badge-teal' : 'badge-blue'}`}>
              {canWrite ? 'Write' : 'Read'}
            </span>
          </p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-primary"
            disabled={!canWrite}
            title={canWrite ? '' : 'You only have Read access to this module'}
            onClick={() => toast(`New record added to ${menu.name} (simulated).`)}
          >
            <Icon name="plus" /> Add Record
          </button>
        </div>
      </div>

      <div className="card module-card">
        <span className="kpi-icon">
          <Icon name={menu.icon} />
        </span>
        <h3 className="card-title">{menu.name} Module</h3>
        <p>
          This is a simulated placeholder page.{' '}
          {canWrite
            ? 'You have Write access: you can create, modify, and delete data here.'
            : 'Because your access level is Read, action buttons are disabled.'}
        </p>
      </div>
    </>
  )
}
