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
      <div className="admin-section-header">
        <div className="admin-section-text">
          <span className="admin-section-title">{title}</span>
          {subtitle ? (
            <span className="admin-section-subtitle">{subtitle}</span>
          ) : null}
        </div>
        <div className="admin-section-controls">
          {badge != null ? <span className="admin-section-badge">{badge}</span> : null}
          <button
            type="button"
            className="admin-section-toggle"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-controls={`admin-section-body-${id}`}
            aria-label={open ? 'Contraer' : 'Expandir'}
          >
            <span className="admin-section-chevron" aria-hidden="true">
              {open ? '▾' : '▸'}
            </span>
          </button>
        </div>
      </div>
      {open ? (
        <div id={`admin-section-body-${id}`} className="admin-section-body">
          {children}
        </div>
      ) : null}
    </div>
  )
}

export default AdminSection
