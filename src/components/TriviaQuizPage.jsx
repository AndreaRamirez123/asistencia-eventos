import { useEffect, useRef, useState } from 'react'
import { getTriviaDeEstacion } from '../triviaStore'
import { guardarResultado, subscribeToRankingDeEstacion } from '../triviaStore'

function TriviaQuizPage() {
  const params = new URLSearchParams(window.location.search)
  const estacionId = params.get('estacion') || ''
  const eventoId = params.get('evento') || ''
  const visitante = decodeURIComponent(params.get('visitante') || '')

  const [trivia, setTrivia] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fase, setFase] = useState('inicio') // inicio | jugando | resultado
  const [preguntaIdx, setPreguntaIdx] = useState(0)
  const [seleccion, setSeleccion] = useState(null)
  const [respuestas, setRespuestas] = useState([])
  const [tiempoRestante, setTiempoRestante] = useState(0)
  const [tiempoTotal, setTiempoTotal] = useState(0)
  const [ranking, setRanking] = useState([])
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!estacionId) { setLoading(false); return }
    getTriviaDeEstacion(estacionId).then((t) => {
      setTrivia(t)
      setLoading(false)
    })
  }, [estacionId])

  useEffect(() => {
    if (!estacionId) return
    const unsub = subscribeToRankingDeEstacion(estacionId, setRanking)
    return unsub
  }, [estacionId])

  const preguntaActual = trivia?.preguntas?.[preguntaIdx]

  // Temporizador
  useEffect(() => {
    if (fase !== 'jugando' || !preguntaActual) return
    setTiempoRestante(preguntaActual.tiempo)
    clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setTiempoRestante((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current)
          avanzar(null)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [preguntaIdx, fase])

  const iniciar = () => {
    setRespuestas([])
    setPreguntaIdx(0)
    setSeleccion(null)
    setTiempoTotal(0)
    setFase('jugando')
  }

  const avanzar = (opcionIdx) => {
    clearInterval(intervalRef.current)
    const correcta = preguntaActual.correcta
    const tiempoUsado = preguntaActual.tiempo - tiempoRestante
    const nueva = { opcionIdx, correcta, acerto: opcionIdx === correcta, tiempoUsado }
    const nuevasRespuestas = [...respuestas, nueva]
    setRespuestas(nuevasRespuestas)
    setTiempoTotal((t) => t + tiempoUsado)
    setSeleccion(opcionIdx)

    setTimeout(() => {
      const siguiente = preguntaIdx + 1
      if (siguiente < trivia.preguntas.length) {
        setPreguntaIdx(siguiente)
        setSeleccion(null)
      } else {
        // Calcular puntos
        const aciertos = nuevasRespuestas.filter((r) => r.acerto).length
        const puntos = Math.round((aciertos / trivia.preguntas.length) * 100)
        const tiempoFinal = nuevasRespuestas.reduce((a, r) => a + r.tiempoUsado, 0)
        if (visitante && eventoId && estacionId) {
          guardarResultado(eventoId, estacionId, visitante, puntos, tiempoFinal).catch(() => {})
        }
        setFase('resultado')
      }
    }, 900)
  }

  const handleOpcion = (idx) => {
    if (seleccion !== null) return
    avanzar(idx)
  }

  if (loading) {
    return (
      <div className="public-shell">
        <div className="public-hero"><div><p className="helper-text">Cargando...</p></div></div>
      </div>
    )
  }

  if (!trivia || !trivia.preguntas?.length) {
    return (
      <div className="public-shell">
        <header className="public-hero">
          <div>
            <p className="eyebrow">Trivia</p>
            <h1>Esta estación no tiene trivia disponible.</h1>
          </div>
        </header>
      </div>
    )
  }

  const aciertos = respuestas.filter((r) => r.acerto).length
  const puntos = fase === 'resultado' ? Math.round((aciertos / trivia.preguntas.length) * 100) : 0

  return (
    <div className="public-shell">
      <header className="public-hero">
        <div>
          <p className="eyebrow">Trivia</p>
          <h1>{fase === 'inicio' ? '¡Pon a prueba tu conocimiento!' : fase === 'jugando' ? `Pregunta ${preguntaIdx + 1} de ${trivia.preguntas.length}` : '¡Resultados!'}</h1>
          {visitante && <p className="hero-text">Jugando como <strong>{visitante}</strong></p>}
        </div>
      </header>

      <section className="panel public-panel">
        {/* INICIO */}
        {fase === 'inicio' && (
          <div className="trivia-inicio">
            <p className="section-copy">
              {trivia.preguntas.length} pregunta(s) · Cada una tiene tiempo límite
            </p>
            <button className="submit-button" onClick={iniciar} style={{ marginTop: '16px' }}>
              Comenzar trivia
            </button>

            {ranking.length > 0 && (
              <div className="trivia-ranking">
                <h3>Ranking de esta estación</h3>
                <ol className="trivia-ranking-list">
                  {ranking.slice(0, 10).map((r, i) => (
                    <li key={r.id} className="trivia-ranking-item">
                      <span className="trivia-ranking-pos">#{i + 1}</span>
                      <span className="trivia-ranking-nombre">{r.nombre}</span>
                      <span className="trivia-ranking-puntos">{r.puntos} pts</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        {/* JUGANDO */}
        {fase === 'jugando' && preguntaActual && (
          <div className="trivia-quiz">
            {/* Barra de progreso */}
            <div className="trivia-progreso-bar">
              <div
                className="trivia-progreso-fill"
                style={{ width: `${((preguntaIdx) / trivia.preguntas.length) * 100}%` }}
              />
            </div>

            {/* Temporizador */}
            <div className="trivia-timer">
              <div
                className="trivia-timer-ring"
                style={{
                  background: `conic-gradient(${tiempoRestante > 10 ? 'var(--accent-strong)' : '#ff6b6b'} ${(tiempoRestante / preguntaActual.tiempo) * 360}deg, #eee 0deg)`,
                }}
              >
                <span>{tiempoRestante}</span>
              </div>
            </div>

            <h2 className="trivia-pregunta-texto">{preguntaActual.texto}</h2>

            <div className="trivia-opciones-quiz">
              {preguntaActual.opciones.map((op, idx) => {
                let cls = 'trivia-opcion-btn'
                if (seleccion !== null) {
                  if (idx === preguntaActual.correcta) cls += ' trivia-opcion-btn--correcta'
                  else if (idx === seleccion) cls += ' trivia-opcion-btn--incorrecta'
                }
                return (
                  <button
                    key={idx}
                    type="button"
                    className={cls}
                    onClick={() => handleOpcion(idx)}
                    disabled={seleccion !== null}
                  >
                    <span className="trivia-opcion-letra">{['A', 'B', 'C', 'D'][idx]}</span>
                    {op}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* RESULTADO */}
        {fase === 'resultado' && (
          <div className="trivia-resultado">
            <div className="trivia-resultado-score">
              <strong>{puntos}</strong>
              <span>puntos</span>
            </div>
            <p className="section-copy">
              {aciertos} de {trivia.preguntas.length} respuestas correctas
            </p>

            <div className="trivia-resultado-resumen">
              {respuestas.map((r, i) => (
                <div key={i} className={`trivia-resultado-item ${r.acerto ? 'correcto' : 'incorrecto'}`}>
                  <span>{r.acerto ? '✓' : '✗'}</span>
                  <span>Pregunta {i + 1}: {trivia.preguntas[i].texto}</span>
                </div>
              ))}
            </div>

            <div className="trivia-resultado-actions">
              <button type="button" className="ghost-action" onClick={iniciar}>
                Volver a intentar
              </button>
              <a href="/mapa" className="submit-button" style={{ textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '44px', textDecoration: 'none' }}>
                Volver al mapa
              </a>
            </div>

            {ranking.length > 0 && (
              <div className="trivia-ranking">
                <h3>Ranking actualizado</h3>
                <ol className="trivia-ranking-list">
                  {ranking.slice(0, 10).map((r, i) => (
                    <li key={r.id} className={`trivia-ranking-item ${r.nombre === visitante ? 'trivia-ranking-item--yo' : ''}`}>
                      <span className="trivia-ranking-pos">#{i + 1}</span>
                      <span className="trivia-ranking-nombre">{r.nombre}{r.nombre === visitante ? ' (tú)' : ''}</span>
                      <span className="trivia-ranking-puntos">{r.puntos} pts</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

export default TriviaQuizPage
