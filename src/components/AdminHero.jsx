function AdminHero({
  attendeesCount,
  isFirebaseConfigured,
  metrics,
  currentUser,
  onLogout,
  empresaConfig = null,
  onOpenScanner,
}) {
  const handleScanner = (e) => {
    e.preventDefault()
    if (onOpenScanner) {
      onOpenScanner()
    } else {
      window.location.href = '/scanner'
    }
  }

  return (
    <header className="hero-panel">
      <div className="hero-copy">
        {empresaConfig?.logoUrl ? (
          <img
            src={empresaConfig.logoUrl}
            alt={empresaConfig.nombre || 'Logo'}
            className="empresa-logo-hero"
          />
        ) : null}
        <p className="eyebrow">Panel administrativo del evento</p>
        <h1>Centro de control</h1>

        <div className="hero-actions">
          <a href="/scanner" className="primary-action" onClick={handleScanner}>
            Abrir scanner QR
          </a>
          {onLogout ? (
            <button type="button" className="ghost-action" onClick={onLogout}>
              Cerrar sesion
            </button>
          ) : null}
        </div>
      </div>

      <section className="command-board" aria-label="Resumen operativo">
        <div className="board-header">
          <span className="board-kicker">Control en vivo</span>
          <strong>Consola admin</strong>
        </div>

        <div className="board-grid">
          {metrics.map((item) => (
            <article key={item.label} className="metric-card">
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </article>
          ))}
        </div>

        <div className="status-strip">
          {!isFirebaseConfigured ? (
            <span className="status-pill alert">Firebase no configurado</span>
          ) : null}
          {currentUser?.role === 'superadmin' ? (
            <span className="status-pill standby">{attendeesCount} registros cargados</span>
          ) : null}
          {currentUser ? (
            <span className="status-pill standby" title={currentUser.email}>
              {currentUser.role === 'superadmin'
                ? 'Superadmin'
                : currentUser.role === 'admin_empresa'
                  ? 'Admin empresa'
                  : currentUser.role === 'admin'
                    ? 'Admin'
                    : 'Staff'}
              : {currentUser.displayName}
            </span>
          ) : null}
        </div>
      </section>
    </header>
  )
}

export default AdminHero
