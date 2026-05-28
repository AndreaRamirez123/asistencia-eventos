import { useEffect, useState } from 'react'

function loadOpenState(id, defaultOpen) {
  try {
    const saved = localStorage.getItem(`admin-section:${id}`)
    if (saved === '1') return true
    if (saved === '0') return false
  } catch {
    // ignore
  }
  return defaultOpen
}

function AdminSection({ id, title, subtitle, defaultOpen = false, badge, children }) {
  const [open, setOpen] = useState(() => loadOpenState(id, defaultOpen))

  useEffect(() => {
    try {
      localStorage.setItem(`admin-section:${id}`, open ? '1' : '0')
    } catch {
      // ignore
    }
  }, [id, open])

  return (
    <div className={`admin-section ${open ? 'is-open' : 'is-closed'}`}>
      <button
        type="button"
        className="admin-section-header"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={`admin-section-body-${id}`}
      >
        <div className="admin-section-text">
          <span className="admin-section-title">{title}</span>
          {subtitle ? (
            <span className="admin-section-subtitle">{subtitle}</span>
          ) : null}
        </div>
        <div className="admin-section-controls">
          {badge != null ? <span className="admin-section-badge">{badge}</span> : null}
          <span className="admin-section-toggle" aria-hidden="true">
            <span className="admin-section-chevron">
              {open ? '▾' : '▸'}
            </span>
          </span>
        </div>
      </button>
      {open ? (
        <div id={`admin-section-body-${id}`} className="admin-section-body">
          {children}
        </div>
      ) : null}
    </div>
  )
}

export default AdminSection
