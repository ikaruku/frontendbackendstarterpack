import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../store/AppContext'
import { APP_CONFIG } from '../data/config'
import Avatar from './Avatar'
import Icon from './Icon'

export default function Layout() {
  const { user, visibleMenus, can, logout, sidebarCollapsed, toggleSidebarCollapsed } = useApp()
  const [open, setOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [flyout, setFlyout] = useState(null) // { menu, top } for collapsed desktop mode
  const accountRef = useRef(null)
  const flyoutRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()

  // Close mobile drawer, account popover, and flyout on route change
  useEffect(() => {
    setOpen(false)
    setAccountOpen(false)
    setFlyout(null)
  }, [location.pathname])

  useEffect(() => {
    setFlyout(null)
  }, [sidebarCollapsed])

  // Expand only the parent menu matching the current route; auto-collapse when navigating away
  useEffect(() => {
    const activeChild = visibleMenus.find((m) => m.parentId && m.path === location.pathname)
    if (activeChild?.parentId) {
      setExpandedId(activeChild.parentId)
      return
    }
    const activeParent = visibleMenus.find(
      (m) =>
        !m.parentId &&
        m.path === location.pathname &&
        visibleMenus.some((c) => c.parentId === m.id),
    )
    setExpandedId(activeParent ? activeParent.id : null)
  }, [location.pathname, visibleMenus])

  // Close account popover & collapsed flyout on outside click or Escape
  useEffect(() => {
    if (!accountOpen && !flyout) return
    const onDoc = (e) => {
      if (accountOpen && accountRef.current && !accountRef.current.contains(e.target)) {
        setAccountOpen(false)
      }
      if (flyout && flyoutRef.current && !flyoutRef.current.contains(e.target)) {
        setFlyout(null)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setAccountOpen(false)
        setFlyout(null)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [accountOpen, flyout])

  // Build hierarchical groups: top-level menus grouped by `group`, with nested `children`
  const groups = useMemo(() => {
    const byId = new Map(visibleMenus.map((m) => [m.id, m]))
    const childrenByParent = new Map()
    const roots = []

    for (const menu of visibleMenus) {
      if (menu.parentId && byId.has(menu.parentId)) {
        const list = childrenByParent.get(menu.parentId) || []
        list.push(menu)
        childrenByParent.set(menu.parentId, list)
      } else {
        roots.push(menu)
      }
    }

    return roots.reduce((acc, root) => {
      const node = { ...root, children: childrenByParent.get(root.id) || [] }
      const found = acc.find((g) => g.name === root.group)
      if (found) found.items.push(node)
      else acc.push({ name: root.group, items: [node] })
      return acc
    }, [])
  }, [visibleMenus])

  const isDesktopCollapsed = () => sidebarCollapsed && window.innerWidth > 1024

  const toggleExpand = (menuId) => {
    setExpandedId((cur) => (cur === menuId ? null : menuId))
  }

  const handleParentClick = (e, menu) => {
    if (isDesktopCollapsed()) {
      e.preventDefault()
      const rect = e.currentTarget.getBoundingClientRect()
      setFlyout((cur) => (cur?.menu.id === menu.id ? null : { menu, top: Math.max(12, rect.top) }))
      return
    }
    if (can(menu.code, 'read')) {
      setExpandedId(menu.id)
    } else {
      e.preventDefault()
      toggleExpand(menu.id)
    }
  }

  return (
    <div className={`app ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <aside
        className={`sidebar ${open ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}
        aria-label="Main navigation"
      >
        {/* Single circular sidebar toggle button on the right border */}
        <button
          className="sidebar-toggle-btn"
          onClick={toggleSidebarCollapsed}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon name={sidebarCollapsed ? 'chevronRight' : 'chevronLeft'} />
        </button>

        <div className="brand">
          <div className="brand-main">
            <span className="brand-logo" title={APP_CONFIG.title}>
              {APP_CONFIG.shortName}
            </span>
            <span className="brand-text">{APP_CONFIG.title}</span>
          </div>
          <button
            className="btn-icon drawer-close-btn"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <Icon name="x" />
          </button>
        </div>

        <nav className="sidebar-scroll">
          {groups.map((group) => (
            <div key={group.name} className="nav-group">
              <div className="nav-group-label" title={group.name}>
                <span>{group.name}</span>
                <hr className="group-divider" />
              </div>
              {group.items.map((menu) => {
                if (menu.children.length === 0) {
                  return (
                    <NavLink
                      key={menu.code}
                      to={menu.path}
                      title={menu.name}
                      className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                      <Icon name={menu.icon} />
                      <span className="nav-text">{menu.name}</span>
                      {!user.isSuperadmin && !can(menu.code, 'write') && (
                        <span className="badge" title="Read-only access">
                          Read
                        </span>
                      )}
                    </NavLink>
                  )
                }

                const hasParentAccess = can(menu.code, 'read')
                const childActive = menu.children.some((c) => c.path === location.pathname)
                const isExpanded = expandedId === menu.id

                return (
                  <div key={menu.code} className={`nav-parent ${isExpanded ? 'expanded' : ''}`}>
                    <div className="nav-parent-row">
                      {hasParentAccess ? (
                        <NavLink
                          to={menu.path}
                          title={menu.name}
                          onClick={(e) => handleParentClick(e, menu)}
                          className={({ isActive }) =>
                            `nav-link nav-parent-link ${isActive || (!hasParentAccess && childActive) ? 'active' : ''}`
                          }
                        >
                          <Icon name={menu.icon} />
                          <span className="nav-text">{menu.name}</span>
                          {!user.isSuperadmin && !can(menu.code, 'write') && (
                            <span className="badge" title="Read-only access">
                              Read
                            </span>
                          )}
                        </NavLink>
                      ) : (
                        <button
                          type="button"
                          title={menu.name}
                          onClick={(e) => handleParentClick(e, menu)}
                          className={`nav-link nav-parent-link nav-parent-btn ${childActive ? 'active' : ''}`}
                        >
                          <Icon name={menu.icon} />
                          <span className="nav-text">{menu.name}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="nav-caret-btn"
                        onClick={() => toggleExpand(menu.id)}
                        aria-label={isExpanded ? `Collapse ${menu.name}` : `Expand ${menu.name}`}
                        aria-expanded={isExpanded}
                      >
                        <Icon name="chevronDown" className="nav-caret" />
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="nav-submenu">
                        {menu.children.map((sub) => (
                          <NavLink
                            key={sub.code}
                            to={sub.path}
                            title={sub.name}
                            className={({ isActive }) => `nav-link nav-sublink ${isActive ? 'active' : ''}`}
                          >
                            <Icon name={sub.icon} />
                            <span className="nav-text">{sub.name}</span>
                            {!user.isSuperadmin && !can(sub.code, 'write') && (
                              <span className="badge" title="Read-only access">
                                Read
                              </span>
                            )}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          {groups.length === 0 && (
            <p className="card-sub" style={{ padding: 12 }}>
              No accessible menus found.
            </p>
          )}
        </nav>

        {flyout && (
          <div
            ref={flyoutRef}
            className="dropdown-menu nav-flyout"
            style={{ top: flyout.top }}
            role="menu"
          >
            <div className="nav-flyout-title">{flyout.menu.name}</div>
            {can(flyout.menu.code, 'read') && (
              <NavLink
                to={flyout.menu.path}
                className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}
              >
                <Icon name={flyout.menu.icon} /> Overview
              </NavLink>
            )}
            {flyout.menu.children.map((sub) => (
              <NavLink
                key={sub.code}
                to={sub.path}
                className={({ isActive }) => `dropdown-item ${isActive ? 'active' : ''}`}
              >
                <Icon name={sub.icon} /> {sub.name}
              </NavLink>
            ))}
          </div>
        )}

        <div className="sidebar-foot">
          <div className="sidebar-account" ref={accountRef}>
            {accountOpen && (
              <div className="dropdown-menu sidebar-account-menu" role="menu">
                <div className="who">
                  <Avatar name={user.fullName} size="sm" />
                  <div className="who-meta">
                    <strong>{user.fullName}</strong>
                    <span>{user.isSuperadmin ? 'Administrator' : `@${user.username}`}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    setAccountOpen(false)
                    navigate('/change-password')
                  }}
                >
                  <Icon name="key" /> Change Password
                </button>
                <div className="dropdown-divider" />
                <button
                  type="button"
                  className="dropdown-item danger"
                  role="menuitem"
                  onClick={() => {
                    setAccountOpen(false)
                    logout()
                  }}
                >
                  <Icon name="logout" /> Logout
                </button>
              </div>
            )}

            <button
              type="button"
              className="user-chip user-chip-btn"
              onClick={() => setAccountOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              title={`Account: ${user.fullName}`}
            >
              <Avatar name={user.fullName} />
              <div className="meta">
                <strong>{user.fullName}</strong>
                <span>{user.isSuperadmin ? 'Administrator' : `@${user.username}`}</span>
              </div>
              <Icon name="chevronDown" className="chev" />
            </button>
          </div>
        </div>
      </aside>

      <div className={`scrim ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />

      <div className="main">
        <Topbar onMenu={() => setOpen(true)} />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Topbar({ onMenu }) {
  const { theme, toggleTheme } = useApp()

  return (
    <header className="topbar">
      {/* Mobile drawer open button */}
      <button className="btn-icon menu-btn" onClick={onMenu} aria-label="Open navigation menu">
        <Icon name="menu" />
      </button>

      <div className="topbar-right">
        {/* Theme mode toggle: Light / Dark */}
        <button
          className="btn-icon theme-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
        </button>
      </div>
    </header>
  )
}
