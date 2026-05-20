import { useEffect, useState } from 'react'
import { getVisitasPorEstacion } from '../visitasStore'
import { getRankingDeEstacion } from '../triviaStore'

function EstacionesDashboard({ evento, estaciones = [] }) {
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!evento?.id || estaciones.length === 0) {
      setStats([])
      return
    }
    setLoading(true)

    Promise.all(
      estaciones.map(async (est) => {
        const [visitas, ranking] = await Promise.all([
          getVisitasPorEstacion(evento.id, est.id),
          est.tieneTivia ? getRankingDeEstacion(est.id) : Promise.resolve([]),
        ])
        const visitantesUnicos = new Set(visitas.map((v) => v.visitanteId)).size
        return {
          ...est,
          totalVisitas: visitas.length,
          visitantesUnicos,
          ranking,
          promedioPuntos:
            ranking.length > 0
              ? Math.round(ranking.reduce((a, r) => a + r.puntos, 0) / ranking.length)
              : null,
        }
      }),
    ).then((result) => {
      setStats(result.sort((a, b) => b.totalVisitas - a.totalVisitas))
      setLoading(false)
    })
  }, [evento?.id, estaciones.length])

  const maxVisitas = Math.max(...stats.map((s) => s.totalVisitas), 1)
  const totalVisitas = stats.reduce((a, s) => a + s.totalVisitas, 0)
  const totalUnicosSet = new Set()
  // No podemos hacer union de sets sin las visitas brutas, usamos aproximación suma única

  if (!evento) {
    return (
      <section className="panel">
        <div className="panel-heading">
          <p className="eyebrow">Estadísticas</p>
          <h2>Selecciona un evento para ver estadísticas.</h2>
        </div>
      </section>
    )
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Estadísticas del evento</p>
        <h2>Dashboard de estaciones y trivia</h2>
      </div>

      {loading && <p className="helper-text">Cargando estadísticas...</p>}

      {!loading && estaciones.length === 0 && (
        <p className="helper-text">
          No hay estaciones configuradas. Ve al panel "Mapa del evento" para crearlas.
        </p>
      )}

      {!loading && estaciones.length > 0 && (
        <>
          {/* Resumen global */}
          <div className="dash-summary">
            <div className="dash-stat-card">
              <strong>{totalVisitas}</strong>
              <span>Visitas totales</span>
            </div>
            <div className="dash-stat-card">
              <strong>{stats.length}</strong>
              <span>Estaciones activas</span>
            </div>
            <div className="dash-stat-card">
              <strong>{stats.filter((s) => s.tieneTivia).length}</strong>
              <span>Con trivia</span>
            </div>
            <div className="dash-stat-card">
              <strong>
                {stats.length > 0
                  ? stats.reduce((a, s) => a + s.ranking.length, 0)
                  : 0}
              </strong>
              <span>Partidas de trivia</span>
            </div>
          </div>

          {/* Estación más visitada */}
          {stats[0]?.totalVisitas > 0 && (
            <div className="dash-top-banner">
              <span
                className="dash-top-dot"
                style={{ background: stats[0].color }}
              />
              <div>
                <p className="eyebrow" style={{ marginBottom: 2 }}>Estación más visitada</p>
                <strong>{stats[0].nombre}</strong> — {stats[0].totalVisitas} visita(s)
              </div>
            </div>
          )}

          {/* Barras por estación */}
          <div className="dash-bar-list">
            <h3 style={{ marginBottom: '12px' }}>Visitas por estación</h3>
            {stats.map((s) => (
              <div key={s.id} className="dash-bar-row">
                <div className="dash-bar-label">
                  <span
                    className="dash-bar-dot"
                    style={{ background: s.color }}
                  />
                  <span>{s.nombre}</span>
                  {s.tieneTivia && <span className="mapa-badge-trivia">Trivia</span>}
                </div>
                <div className="dash-bar-track">
                  <div
                    className="dash-bar-fill"
                    style={{
                      width: `${(s.totalVisitas / maxVisitas) * 100}%`,
                      background: s.color,
                    }}
                  />
                </div>
                <span className="dash-bar-count">{s.totalVisitas}</span>
              </div>
            ))}
          </div>

          {/* Ranking de trivia por estación */}
          {stats.filter((s) => s.tieneTivia && s.ranking.length > 0).length > 0 && (
            <div className="dash-trivia-section">
              <h3>Top trivia por estación</h3>
              <div className="dash-trivia-grid">
                {stats
                  .filter((s) => s.tieneTivia && s.ranking.length > 0)
                  .map((s) => (
                    <div key={s.id} className="dash-trivia-card">
                      <div className="dash-trivia-card-header" style={{ borderColor: s.color }}>
                        <span
                          className="dash-bar-dot"
                          style={{ background: s.color }}
                        />
                        <strong>{s.nombre}</strong>
                        <span className="dash-trivia-avg">
                          Promedio: {s.promedioPuntos} pts
                        </span>
                      </div>
                      <ol className="dash-trivia-ranking">
                        {s.ranking.slice(0, 5).map((r, i) => (
                          <li key={r.id} className="dash-trivia-ranking-item">
                            <span className="dash-trivia-pos">#{i + 1}</span>
                            <span className="dash-trivia-nombre">{r.nombre}</span>
                            <span className="dash-trivia-puntos">{r.puntos} pts</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default EstacionesDashboard
