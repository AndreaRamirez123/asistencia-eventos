import { useEffect, useState } from 'react'
import { getVisitasPorEstacion } from '../visitasStore'

function StarDisplay({ value, max = 5, size = '1rem' }) {
  const rounded = Math.round(value || 0)
  return (
    <span className="cal-est-stars-display" style={{ fontSize: size, letterSpacing: '1px' }}>
      {'★'.repeat(rounded)}
      {'☆'.repeat(max - rounded)}
    </span>
  )
}

function CalificacionEstacionesPanel({ evento, estaciones = [] }) {
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!evento?.id || estaciones.length === 0) { setStats([]); return }
    setLoading(true)
    Promise.all(
      estaciones.map(async (est) => {
        const visitas = await getVisitasPorEstacion(evento.id, est.id)
        const calificadas = visitas.filter((v) => (v.calificacion || 0) > 0)
        const promedio =
          calificadas.length > 0
            ? calificadas.reduce((a, v) => a + (v.calificacion || 0), 0) / calificadas.length
            : null
        const comentarios = visitas
          .filter((v) => v.comentario?.trim())
          .slice(-3)
          .reverse()
        return { ...est, promedio, total: calificadas.length, comentarios }
      }),
    ).then((result) => {
      setStats(result.sort((a, b) => (b.promedio || 0) - (a.promedio || 0)))
      setLoading(false)
    })
  }, [evento?.id, estaciones.length])

  const conCalificacion = stats.filter((s) => s.promedio !== null)
  const promedioGlobal =
    conCalificacion.length > 0
      ? conCalificacion.reduce((a, s) => a + s.promedio, 0) / conCalificacion.length
      : null

  if (!evento) {
    return (
      <section className="panel">
        <p className="helper-text">Selecciona un evento para ver las calificaciones.</p>
      </section>
    )
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Calificaciones de estaciones</p>
        <h2>Opiniones de los visitantes</h2>
      </div>

      {loading && <p className="helper-text">Cargando calificaciones...</p>}

      {!loading && (
        <>
          {/* Resumen global */}
          <div className="cal-est-resumen">
            <div className="cal-est-global">
              <span className="cal-est-global-num">
                {promedioGlobal !== null ? promedioGlobal.toFixed(1) : '—'}
              </span>
              <div>
                {promedioGlobal !== null ? (
                  <StarDisplay value={promedioGlobal} size="1.3rem" />
                ) : (
                  <span style={{ fontSize: '1.3rem', color: '#d1d5db' }}>☆☆☆☆☆</span>
                )}
                <p className="helper-text" style={{ margin: '2px 0 0' }}>
                  Promedio global — {conCalificacion.length} estación(es) calificada(s)
                </p>
              </div>
            </div>
          </div>

          {/* Cards por estación */}
          {estaciones.length === 0 ? (
            <p className="helper-text">No hay estaciones configuradas.</p>
          ) : (
            <div className="cal-est-grid">
              {stats.map((s) => (
                <div key={s.id} className="cal-est-card">
                  <div className="cal-est-card-header">
                    <span className="cal-est-dot" style={{ background: s.color || '#cbd5e1' }} />
                    <strong className="cal-est-nombre">{s.nombre}</strong>
                  </div>

                  <div className="cal-est-stars-row">
                    {s.promedio !== null ? (
                      <>
                        <StarDisplay value={s.promedio} size="1.4rem" />
                        <span className="cal-est-avg">{s.promedio.toFixed(1)}</span>
                        <span className="cal-est-count">({s.total})</span>
                      </>
                    ) : (
                      <span style={{ fontSize: '1.1rem', color: '#9ca3af' }}>Sin calificaciones aún</span>
                    )}
                  </div>

                  {s.comentarios?.length > 0 && (
                    <ul className="cal-est-comentarios">
                      {s.comentarios.map((v, i) => (
                        <li key={i} className="cal-est-comentario">
                          <StarDisplay value={v.calificacion} size="0.75rem" />
                          <span>{v.comentario}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default CalificacionEstacionesPanel
