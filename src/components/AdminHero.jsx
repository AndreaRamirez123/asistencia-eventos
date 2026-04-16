function AdminHero({ attendeesCount, backendStatus, isFirebaseConfigured, metrics }) {
  return (
    <header className="hero-panel">
      <div className="hero-copy">
        <p className="eyebrow">Panel administrativo del evento</p>
        <h1>Centro de control para registro, accesos, soporte e incidencias.</h1>
        <p className="hero-text">
          Esta vista queda orientada al admin para operar el evento, registrar personas
          manualmente, supervisar entradas y resolver casos especiales en tiempo real.
        </p>

        <div className="hero-actions">
          <a href="#registro-admin" className="primary-action">
            Registrar desde admin
          </a>
          <a href="#asistentes" className="secondary-action">
            Ver asistentes
          </a>
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
          <span className={`status-pill ${backendStatus === 'online' ? 'online' : 'alert'}`}>
            {backendStatus === 'checking'
              ? 'Verificando backend...'
              : backendStatus === 'online'
                ? 'Backend admin conectado'
                : 'Backend no disponible'}
          </span>
          <span className="status-pill standby">
            {isFirebaseConfigured ? 'Firebase listo' : 'Firebase en preview'}
          </span>
          <span className="status-pill alert">{attendeesCount} registros cargados</span>
        </div>
      </section>
    </header>
  )
}

export default AdminHero
