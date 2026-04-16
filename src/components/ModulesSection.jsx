function ModulesSection({ modules }) {
  return (
    <section id="operacion" className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Modulos admin</p>
        <h2>Bloques que necesita el administrador para operar el evento</h2>
      </div>

      <div className="modules-grid">
        {modules.map((module) => (
          <article key={module.title} className="module-card">
            <h3>{module.title}</h3>
            <p>{module.description}</p>
            <small>{module.detail}</small>
          </article>
        ))}
      </div>
    </section>
  )
}

export default ModulesSection
