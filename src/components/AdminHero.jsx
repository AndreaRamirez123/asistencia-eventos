function AdminHero({
  attendeesCount,
  isFirebaseConfigured,
  metrics,
  currentUser,
  onLogout,
}) {
  return (
    <header className="hero-panel">
      <div className="hero-copy">
        <p className="eyebrow">Panel administrativo del evento</p>
        <h1>Centro de control</h1>

        <div className="hero-actions">
          <a href="/scanner" className="primary-action">
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
          <span className={`status-pill ${isFirebaseConfigured ? 'online' : 'alert'}`}>
            {isFirebaseConfigured ? 'Firestore conectado' : 'Firebase no configurado'}
          </span>
          <span className="status-pill standby">{attendeesCount} registros cargados</span>
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
