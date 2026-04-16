function RoadmapSection({ incidents, roadmap }) {
  return (
    <section className="panel split-panel">
      <div id="roadmap">
        <div className="panel-heading">
          <p className="eyebrow">Ruta recomendada</p>
          <h2>Prioridades del panel administrativo</h2>
        </div>

        <ol className="roadmap-list">
          {roadmap.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </div>

      <div className="priority-card">
        <h3>Incidencias actuales</h3>
        {incidents.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </section>
  )
}

export default RoadmapSection
