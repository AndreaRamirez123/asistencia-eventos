import { useEffect, useRef, useState } from 'react'
import { Circle, Image as KonvaImage, Layer, Rect, Stage, Text } from 'react-konva'
import { Scanner } from '@yudiel/react-qr-scanner'
import { getAttendeeByDocument } from '../attendeesStore'
import { listEstaciones } from '../stacionesStore'
import { getEventoById, listEventos } from '../eventosStore'
import { getVisitasPorVisitante, registrarVisita, resetVisitasDeVisitante } from '../visitasStore'
import { getTriviaDeEstacion, guardarResultado } from '../triviaStore'

// ── Trivia inline con timer ────────────────────────────────────────────────
function TriviaInline({ trivia, onComplete }) {
  const [fase, setFase] = useState('inicio')
  const [preguntaIdx, setPreguntaIdx] = useState(0)
  const [seleccion, setSeleccion] = useState(null)
  const [respuestas, setRespuestas] = useState([])
  const [tiempoRestante, setTiempoRestante] = useState(0)
  const intervalRef = useRef(null)

  const preguntaActual = trivia?.preguntas?.[preguntaIdx]

  useEffect(() => {
    if (fase !== 'jugando' || !preguntaActual) return
    setTiempoRestante(preguntaActual.tiempo)
    clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setTiempoRestante((t) => {
        if (t <= 1) { clearInterval(intervalRef.current); avanzar(null); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preguntaIdx, fase])

  const iniciar = () => {
    setRespuestas([])
    setPreguntaIdx(0)
    setSeleccion(null)
    setFase('jugando')
  }

  const avanzar = (opcionIdx) => {
    clearInterval(intervalRef.current)
    const correcta = preguntaActual.correcta
    const tiempoUsado = preguntaActual.tiempo - tiempoRestante
    const nueva = { opcionIdx, correcta, acerto: opcionIdx === correcta, tiempoUsado }
    const nuevasRespuestas = [...respuestas, nueva]
    setRespuestas(nuevasRespuestas)
    setSeleccion(opcionIdx)
    setTimeout(() => {
      const siguiente = preguntaIdx + 1
      if (siguiente < trivia.preguntas.length) {
        setPreguntaIdx(siguiente)
        setSeleccion(null)
      } else {
        const aciertos = nuevasRespuestas.filter((r) => r.acerto).length
        const puntos = Math.round((aciertos / trivia.preguntas.length) * 100)
        const tiempoFinal = nuevasRespuestas.reduce((a, r) => a + r.tiempoUsado, 0)
        setFase('resultado')
        onComplete?.(puntos, tiempoFinal)
      }
    }, 900)
  }

  if (!trivia?.preguntas?.length) return null

  const aciertos = respuestas.filter((r) => r.acerto).length
  const puntos = fase === 'resultado' ? Math.round((aciertos / trivia.preguntas.length) * 100) : 0

  return (
    <div className="trivia-inline-wrap">
      <p className="eyebrow" style={{ marginBottom: 10 }}>Trivia de la estación</p>

      {fase === 'inicio' && (
        <div>
          <p className="helper-text">{trivia.preguntas.length} pregunta(s) con tiempo límite por cada una</p>
          <button className="submit-button" onClick={iniciar} style={{ marginTop: 12 }}>
            Comenzar trivia
          </button>
        </div>
      )}

      {fase === 'jugando' && preguntaActual && (
        <div className="trivia-quiz">
          <div className="trivia-progreso-bar">
            <div className="trivia-progreso-fill" style={{ width: `${(preguntaIdx / trivia.preguntas.length) * 100}%` }} />
          </div>
          <div className="trivia-timer">
            <div
              className="trivia-timer-ring"
              style={{ background: `conic-gradient(${tiempoRestante > 10 ? 'var(--accent-strong)' : '#ff6b6b'} ${(tiempoRestante / preguntaActual.tiempo) * 360}deg, #eee 0deg)` }}
            >
              <span>{tiempoRestante}</span>
            </div>
          </div>
          <p className="helper-text" style={{ marginBottom: 6, textAlign: 'center' }}>
            Pregunta {preguntaIdx + 1} de {trivia.preguntas.length}
          </p>
          <h3 className="trivia-pregunta-texto">{preguntaActual.texto}</h3>
          <div className="trivia-opciones-quiz">
            {preguntaActual.opciones.map((op, idx) => {
              let cls = 'trivia-opcion-btn'
              if (seleccion !== null) {
                if (idx === preguntaActual.correcta) cls += ' trivia-opcion-btn--correcta'
                else if (idx === seleccion) cls += ' trivia-opcion-btn--incorrecta'
              }
              return (
                <button key={idx} type="button" className={cls} onClick={() => { if (seleccion === null) avanzar(idx) }} disabled={seleccion !== null}>
                  <span className="trivia-opcion-letra">{['A', 'B', 'C', 'D'][idx]}</span>
                  {op}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {fase === 'resultado' && (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div className="trivia-resultado-score" style={{ marginBottom: 8 }}>
            <strong>{puntos}</strong>
            <span>puntos</span>
          </div>
          <p className="helper-text">{aciertos} de {trivia.preguntas.length} respuestas correctas</p>
          <p className="feedback success" style={{ marginTop: 10 }}>✓ Trivia completada — ahora califica la estación</p>
          <button type="button" className="ghost-action" onClick={iniciar} style={{ marginTop: 8, fontSize: '0.8rem' }}>
            Reintentar
          </button>
        </div>
      )}
    </div>
  )
}

// ── Página principal ────────────────────────────────────────────────────────
function MiEventoPage() {
  const params = new URLSearchParams(window.location.search)
  const docParam = params.get('doc') || ''
  const eventoParam = params.get('evento') || ''

  const [docInput, setDocInput] = useState(docParam)
  const [attendee, setAttendee] = useState(null)
  const [eventoId, setEventoId] = useState(eventoParam)
  const [estaciones, setEstaciones] = useState([])
  const [visitadasSet, setVisitadasSet] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState(null)
  const [trivias, setTrivias] = useState({})
  const [loadingTrivia, setLoadingTrivia] = useState({})
  const [triviaScores, setTriviaScores] = useState({}) // { [estId]: { puntos, tiempoTotal } }
  const [registrando, setRegistrando] = useState('')
  const [ratings, setRatings] = useState({})
  const [scanningId, setScanningId] = useState(null)
  const [scannedSet, setScannedSet] = useState(new Set())
  const [scanError, setScanError] = useState({})
  const [cameraError, setCameraError] = useState({})

  // Mapa
  const [evento, setEvento] = useState(null)
  const [planoImg, setPlanoImg] = useState(null)
  const [stageSize, setStageSize] = useState({ width: 340, height: 200 })
  const mapaRef = useRef(null)
  const stationRefs = useRef({})

  const loadData = async (documentId, evId) => {
    setLoading(true)
    setError('')
    try {
      const found = await getAttendeeByDocument(documentId, evId)
      if (!found) {
        setError('No encontramos un registro con ese documento. Verifica que te hayas registrado en el evento.')
        setLoading(false)
        return
      }
      setAttendee(found)
      const storedId = found.eventoId === 'evento' ? '' : (found.eventoId || '')
      let realEventoId = evId || storedId || ''
      if (!realEventoId) {
        try {
          const evs = await listEventos()
          const active = evs.find((e) => !e.archivado) || evs[0]
          if (active) realEventoId = active.id
        } catch { /* silencioso */ }
      }
      setEventoId(realEventoId)

      const [ests, visitas] = await Promise.all([
        listEstaciones(realEventoId),
        getVisitasPorVisitante(realEventoId, documentId),
      ])
      setEstaciones(ests)
      setVisitadasSet(new Set(visitas.map((v) => v.estacionId)))

      // Cargar evento para el mapa
      if (realEventoId) {
        getEventoById(realEventoId).then((ev) => { if (ev) setEvento(ev) })
      }
    } catch {
      setError('No fue posible cargar tus datos. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (docParam) loadData(docParam, eventoParam)
  }, [])

  // Plano del evento
  useEffect(() => {
    if (!evento?.planoBase64) { setPlanoImg(null); return }
    const img = new window.Image()
    img.src = evento.planoBase64
    img.onload = () => setPlanoImg(img)
  }, [evento?.planoBase64])

  // Tamaño responsive del mapa — se re-ejecuta cuando las estaciones cargan y el div aparece
  useEffect(() => {
    if (!mapaRef.current) return
    const calc = () => {
      const w = mapaRef.current?.offsetWidth
      if (w > 0) setStageSize({ width: w, height: Math.round(w * 0.55) })
    }
    calc() // medir de inmediato
    const observer = new ResizeObserver(calc)
    observer.observe(mapaRef.current)
    return () => observer.disconnect()
  }, [estaciones.length]) // se re-monta cuando aparece el bloque del mapa

  const handleSubmitDoc = (e) => {
    e.preventDefault()
    const cleaned = docInput.trim()
    if (!cleaned) return
    const url = new URL(window.location.href)
    url.searchParams.set('doc', cleaned)
    window.history.replaceState({}, '', url.toString())
    loadData(cleaned, eventoParam)
  }

  const handleScanQr = (detected, estId) => {
    const rawValue = detected?.[0]?.rawValue || ''
    if (!rawValue) return
    let scannedEstId = null
    try {
      scannedEstId = new URL(rawValue).searchParams.get('id')
    } catch { scannedEstId = null }
    if (scannedEstId === estId) {
      setScannedSet((prev) => new Set([...prev, estId]))
      setScanningId(null)
      setScanError((prev) => ({ ...prev, [estId]: '' }))
    } else {
      setScanError((prev) => ({ ...prev, [estId]: 'QR incorrecto. Escanea el código de esta estación.' }))
    }
  }

  const handleOpenEstacion = async (estId) => {
    if (visitadasSet.has(estId)) return
    const isToggle = openId === estId
    setOpenId(isToggle ? null : estId)
    if (!isToggle) {
      setTimeout(() => {
        stationRefs.current[estId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    }
    if (!isToggle && !trivias[estId] && trivias[estId] !== null) {
      setLoadingTrivia((prev) => ({ ...prev, [estId]: true }))
      try {
        const t = await getTriviaDeEstacion(estId)
        setTrivias((prev) => ({ ...prev, [estId]: t || null }))
      } catch {
        setTrivias((prev) => ({ ...prev, [estId]: null }))
      }
      setLoadingTrivia((prev) => ({ ...prev, [estId]: false }))
    }
  }

  const handleMapClick = (est) => {
    if (visitadasSet.has(est.id)) return
    handleOpenEstacion(est.id)
  }

  const handleTriviaComplete = (estId, puntos, tiempoTotal) => {
    setTriviaScores((prev) => ({ ...prev, [estId]: { puntos, tiempoTotal } }))
  }

  const handleSetRating = (estId, stars) => {
    setRatings((prev) => ({ ...prev, [estId]: { ...(prev[estId] || {}), stars } }))
  }

  const handleSetComentario = (estId, comentario) => {
    setRatings((prev) => ({ ...prev, [estId]: { ...(prev[estId] || {}), comentario } }))
  }

  const handleCompletar = async (est) => {
    const estId = est.id
    const trivia = trivias[estId]
    const triviaRequired = Boolean(trivia?.preguntas?.length)
    const triviaScore = triviaScores[estId]

    // Si tiene trivia, debe haberla jugado al menos una vez
    if (triviaRequired && !triviaScore) return

    const stars = ratings[estId]?.stars || 0
    if (stars === 0) return

    setRegistrando(estId)
    try {
      await registrarVisita(eventoId, estId, attendee.documentId, {
        calificacion: stars,
        comentario: ratings[estId]?.comentario || '',
      })
      if (triviaScore && eventoId) {
        await guardarResultado(eventoId, estId, attendee.fullName, triviaScore.puntos, triviaScore.tiempoTotal)
      }
      setVisitadasSet((prev) => new Set([...prev, estId]))
      setOpenId(null)
    } catch { /* silencioso */ }
    finally { setRegistrando('') }
  }

  const handleResetRecorrido = async () => {
    if (!window.confirm('¿Seguro que quieres borrar todo tu progreso? Esto es solo para pruebas.')) return
    await resetVisitasDeVisitante(eventoId, attendee.documentId)
    setVisitadasSet(new Set())
    setScannedSet(new Set())
    setTriviaScores({})
    setRatings({})
    setOpenId(null)
  }

  const totalEstaciones = estaciones.length
  const totalVisitadas = visitadasSet.size
  const pct = totalEstaciones > 0 ? (totalVisitadas / totalEstaciones) * 100 : 0

  // Mapa: convertir % → px
  const estPx = estaciones.map((e) => ({
    ...e,
    px: (e.x / 100) * stageSize.width,
    py: (e.y / 100) * stageSize.height,
    pw: (e.width / 100) * stageSize.width,
    ph: (e.height / 100) * stageSize.height,
  }))

  if (loading) {
    return (
      <div className="public-shell">
        <div className="public-loading">
          <div className="public-loading-spinner" aria-hidden="true" />
          <p>Cargando tu recorrido...</p>
        </div>
      </div>
    )
  }

  if (!attendee) {
    return (
      <div className="public-shell">
        <header className="public-hero">
          <div>
            <p className="eyebrow">Mi recorrido</p>
            <h1>¿Cuál es tu documento?</h1>
            <p className="hero-text">
              Ingresa tu número de documento para ver las estaciones del evento y registrar tu visita.
            </p>
          </div>
        </header>
        <section className="panel public-panel">
          {error ? <p className="feedback error" style={{ marginBottom: 20 }}>{error}</p> : null}
          <form onSubmit={handleSubmitDoc} className="attendee-form">
            <label className="field">
              <span>Número de documento</span>
              <input
                type="text"
                value={docInput}
                onChange={(e) => setDocInput(e.target.value)}
                placeholder="Ej. 1032456789"
                required
                autoFocus
              />
            </label>
            <button type="submit" className="submit-button">Ver mis estaciones</button>
          </form>
        </section>
      </div>
    )
  }

  return (
    <div className="public-shell">
      <header className="public-hero">
        <div>
          <p className="eyebrow">Hola, {attendee.fullName?.split(' ')[0]}</p>
          <h1>Tu recorrido por el evento</h1>
          <p className="hero-text">
            {totalVisitadas === 0
              ? 'Aún no has visitado ninguna estación. ¡Empieza!'
              : totalVisitadas === totalEstaciones
                ? '¡Completaste todas las estaciones!'
                : `${totalVisitadas} de ${totalEstaciones} estaciones completadas`}
          </p>
        </div>
      </header>

      <div className="mi-evento-progress-wrap">
        <div className="mi-evento-progress-bar" style={{ width: `${pct}%` }} />
      </div>

      {/* ── Mapa interactivo ── */}
      {estaciones.length > 0 && (
        <section className="panel public-panel" style={{ marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
          <div className="panel-heading">
            <p className="eyebrow">Mapa del evento</p>
            <h2>Estaciones — toca una para empezar</h2>
          </div>
          <div ref={mapaRef} className="mapa-stage-container">
            <Stage width={stageSize.width} height={stageSize.height}>
              <Layer>
                {planoImg && (
                  <KonvaImage image={planoImg} x={0} y={0} width={stageSize.width} height={stageSize.height} opacity={0.85} />
                )}
                {estPx.map((est) => {
                  const visitada = visitadasSet.has(est.id)
                  const isOpen = openId === est.id
                  const fill = visitada ? '#22c55ecc' : isOpen ? 'var(--accent, #ffd166)cc' : est.color + '99'
                  const stroke = visitada ? '#16a34a' : isOpen ? 'var(--accent-strong, #b45309)' : est.color
                  const commonProps = {
                    key: est.id,
                    x: est.px, y: est.py,
                    fill, stroke,
                    strokeWidth: isOpen ? 3 : visitada ? 2 : 1.5,
                    onClick: () => handleMapClick(est),
                    onTap: () => handleMapClick(est),
                  }
                  return est.forma === 'circle'
                    ? <Circle {...commonProps} radius={Math.min(est.pw, est.ph) / 2} />
                    : <Rect {...commonProps} width={est.pw} height={est.ph} cornerRadius={4} />
                })}
                {estPx.map((est) => (
                  <Text
                    key={`lbl-${est.id}`}
                    x={est.px + 3} y={est.py + 3}
                    text={`${visitadasSet.has(est.id) ? '✓ ' : ''}${est.nombre}`}
                    fontSize={Math.max(9, Math.min(12, est.pw / 8))}
                    fill={visitadasSet.has(est.id) ? '#fff' : '#13212d'}
                    fontStyle="bold"
                    shadowColor="rgba(0,0,0,0.4)"
                    shadowBlur={2}
                    shadowOffsetX={0}
                    shadowOffsetY={1}
                    listening={false}
                    width={est.pw - 6}
                    wrap="word"
                    ellipsis
                  />
                ))}
              </Layer>
            </Stage>
          </div>
          <p className="helper-text" style={{ marginTop: 8, fontSize: '0.8rem', opacity: 0.65 }}>
            Verde = completada · Toca una estación sin completar para abrirla abajo
          </p>
        </section>
      )}

      {/* ── Lista de estaciones ── */}
      <section className="panel public-panel" style={estaciones.length > 0 ? { borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none' } : {}}>
        <div className="panel-heading" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p className="eyebrow">Estaciones</p>
            <h2>{totalVisitadas}/{totalEstaciones} completadas</h2>
          </div>
          {totalVisitadas > 0 ? (
            <button type="button" className="ghost-action" style={{ fontSize: '0.78rem', opacity: 0.55, marginTop: 4 }} onClick={handleResetRecorrido}>
              Reiniciar (pruebas)
            </button>
          ) : null}
        </div>

        {estaciones.length === 0 ? (
          <p className="helper-text">Este evento aún no tiene estaciones configuradas.</p>
        ) : (
          <div className="mi-evento-accordion">
            {estaciones.map((est) => {
              const visitada = visitadasSet.has(est.id)
              const isOpen = openId === est.id
              const trivia = trivias[est.id]
              const triviaRequired = Boolean(trivia?.preguntas?.length)
              const triviaScore = triviaScores[est.id]
              const estRating = ratings[est.id] || {}
              const hasRating = (estRating.stars || 0) > 0
              const canComplete = scannedSet.has(est.id) && hasRating && (!triviaRequired || Boolean(triviaScore))

              return (
                <div
                  key={est.id}
                  id={`est-${est.id}`}
                  ref={(el) => { stationRefs.current[est.id] = el }}
                  className={`mi-evento-item${visitada ? ' visitada' : ''}${isOpen ? ' open' : ''}`}
                >
                  <button
                    type="button"
                    className="mi-evento-item-header"
                    onClick={() => handleOpenEstacion(est.id)}
                    disabled={visitada}
                  >
                    <span className="mi-evento-dot" style={{ background: visitada ? '#22c55e' : (est.color || '#cbd5e1') }} />
                    <span className="mi-evento-nombre">{est.nombre}</span>
                    {est.descripcion && !visitada ? (
                      <span className="mi-evento-desc-hint">{est.descripcion}</span>
                    ) : null}
                    {visitada ? (
                      <span className="mi-evento-check">✓ Completada</span>
                    ) : (
                      <span className="mi-evento-chevron" aria-hidden="true">{isOpen ? '▲' : '▼'}</span>
                    )}
                  </button>

                  {isOpen && !visitada ? (
                    <div className="mi-evento-item-body">
                      {est.descripcion ? (
                        <p className="helper-text" style={{ marginBottom: 16 }}>{est.descripcion}</p>
                      ) : null}

                      {/* PASO 1: Escanear QR */}
                      {!scannedSet.has(est.id) ? (
                        <div className="mi-evento-scan-step">
                          <p className="mi-evento-scan-label">Paso 1 — Escanea el código QR de esta estación</p>
                          {scanningId === est.id ? (
                            <div>
                              {cameraError[est.id] ? (
                                <div>
                                  <p className="feedback error">No se detectó cámara. Abre esta página desde tu celular para escanear.</p>
                                  <button type="button" className="ghost-action" style={{ marginTop: 8 }}
                                    onClick={() => { setScannedSet((prev) => new Set([...prev, est.id])); setScanningId(null); setCameraError((p) => ({ ...p, [est.id]: false })) }}>
                                    Continuar sin escanear (solo pruebas)
                                  </button>
                                </div>
                              ) : (
                                <div className="mi-evento-scanner-wrap">
                                  <Scanner
                                    onScan={(d) => handleScanQr(d, est.id)}
                                    onError={() => setCameraError((p) => ({ ...p, [est.id]: true }))}
                                    constraints={{ facingMode: 'environment' }}
                                    styles={{ container: { width: '100%', borderRadius: '14px', overflow: 'hidden' } }}
                                  />
                                </div>
                              )}
                              {scanError[est.id] ? <p className="feedback error" style={{ marginTop: 8 }}>{scanError[est.id]}</p> : null}
                              <button type="button" className="ghost-action" style={{ marginTop: 10 }}
                                onClick={() => { setScanningId(null); setScanError((p) => ({ ...p, [est.id]: '' })); setCameraError((p) => ({ ...p, [est.id]: false })) }}>
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button type="button" className="submit-button"
                              onClick={() => { setScanningId(est.id); setScanError((p) => ({ ...p, [est.id]: '' })) }}>
                              Abrir cámara para escanear
                            </button>
                          )}
                        </div>
                      ) : (
                        /* PASOS 2 y 3 */
                        <div>
                          <p className="mi-evento-scan-ok">✓ QR de estación validado</p>

                          {/* PASO 2: Trivia (si la tiene) */}
                          {loadingTrivia[est.id] ? (
                            <p className="helper-text">Cargando trivia...</p>
                          ) : triviaRequired ? (
                            <TriviaInline
                              trivia={trivia}
                              onComplete={(puntos, tiempoTotal) => handleTriviaComplete(est.id, puntos, tiempoTotal)}
                            />
                          ) : null}

                          {/* PASO 3: Calificación */}
                          {(!triviaRequired || Boolean(triviaScore)) && (
                            <div className="mi-evento-rating-section">
                              <p className="eyebrow" style={{ marginBottom: 10 }}>
                                {triviaRequired ? 'Paso 3 — ' : 'Paso 2 — '}Califica esta estación
                              </p>
                              <div className="mi-evento-stars">
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <button key={n} type="button"
                                    className={`mi-evento-star${(estRating.stars || 0) >= n ? ' filled' : ''}`}
                                    onClick={() => handleSetRating(est.id, n)}
                                    aria-label={`${n} estrella${n > 1 ? 's' : ''}`}>
                                    ★
                                  </button>
                                ))}
                              </div>
                              <textarea
                                className="mi-evento-comentario"
                                placeholder="Comentario opcional"
                                value={estRating.comentario || ''}
                                onChange={(e) => handleSetComentario(est.id, e.target.value)}
                                rows={2}
                                maxLength={300}
                              />
                            </div>
                          )}

                          <button type="button" className="submit-button" style={{ marginTop: 16 }}
                            onClick={() => handleCompletar(est)}
                            disabled={registrando === est.id || !canComplete}>
                            {registrando === est.id ? 'Registrando...' : 'Completar estación ✓'}
                          </button>
                          {!canComplete && (
                            <p className="helper-text" style={{ marginTop: 6, fontSize: '0.8rem', opacity: 0.65 }}>
                              {!scannedSet.has(est.id) ? 'Escanea el QR primero.' : triviaRequired && !triviaScore ? 'Completa la trivia primero.' : 'Califica con estrellas para finalizar.'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

export default MiEventoPage
