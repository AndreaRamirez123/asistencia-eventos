function ActivitySection({ liveFeed }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Actividad del evento</p>
        <h2>Bitacora en vivo para el administrador</h2>
      </div>

      <div className="feed-table" role="table" aria-label="Actividad en vivo">
        <div className="feed-row feed-head" role="row">
          <span>Hora</span>
          <span>Registro</span>
          <span>Estado</span>
          <span>Punto</span>
        </div>
        {liveFeed.map((item) => (
          <div key={`${item.time}-${item.person}`} className="feed-row" role="row">
            <span>{item.time}</span>
            <span>{item.person}</span>
            <span>{item.status}</span>
            <span>{item.point}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export default ActivitySection
