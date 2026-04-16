function OperationsSection({ adminLanes }) {
  return (
    <section className="panel split-panel">
      <div>
        <div className="panel-heading">
          <p className="eyebrow">Roles de operacion</p>
          <h2>Quien usa este panel y para que</h2>
        </div>

        <div className="lane-list">
          {adminLanes.map((lane) => (
            <article key={lane.name} className="lane-card">
              <strong>{lane.name}</strong>
              <p>{lane.action}</p>
            </article>
          ))}
        </div>
      </div>

      <aside className="sidebar-card">
        <p className="eyebrow">Colecciones sugeridas</p>
        <ul className="tag-list">
          <li>events</li>
          <li>attendees</li>
          <li>checkins</li>
          <li>users</li>
          <li>devices</li>
          <li>incidents</li>
        </ul>
        <p className="sidebar-note">
          El admin deberia trabajar con roles y permisos para distinguir mesa de soporte, scanner,
          supervisor y administrador principal.
        </p>
      </aside>
    </section>
  )
}

export default OperationsSection
