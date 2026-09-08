import { useEffect, useRef, useState } from 'react'
import { Circle, Image as KonvaImage, Layer, Rect, Stage, Text } from 'react-konva'
import { Scanner } from '@yudiel/react-qr-scanner'
import { getAttendeeByDocument } from '../attendeesStore'
import { listEstaciones } from '../stacionesStore'
import { getEventoById, listEventos } from '../eventosStore'
import { getVisitasPorVisitante, registrarVisita, resetVisitasDeVisitante } from '../visitasStore'
import { getTriviaDeEstacion, guardarResultado } from '../triviaStore'

// ── Trivia inline ──────────────────────────────────────────────────────────
function TriviaInline({ trivia, onComplete }) {
  const [fase, setFase] = useState('inicio')
  const [preguntaIdx, setPreguntaIdx] = useState(0)
  const [seleccion, setSeleccion] = useState(null)
  const [respuestas, setRespuestas] = useState([])
  const [tiempoRestante, setTiempoRestante] = useState(0)
  const [textoAbierto, setTextoAbierto] = useState('')
  const textoAbiertoRef = useRef('')
  const intervalRef = useRef(null)
  const preguntaActual = trivia?.preguntas?.[preguntaIdx]

  useEffect(() => {
    if (fase !== 'jugando' || !preguntaActual || !preguntaActual.tiempo) return
    setTiempoRestante(preguntaActual.tiempo)
    clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setTiempoRestante((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current)
          if (preguntaActual.tipo === 'abierta') {
            avanzarAbierta(textoAbiertoRef.current)
          } else {
            avanzar(null)
          }
          return 0
        }
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
    setTextoAbierto('')
    textoAbiertoRef.current = ''
    setFase('jugando')
  }

  const avanzar = (opcionIdx) => {
    clearInterval(intervalRef.current)
    const correcta = preguntaActual.correcta
    const tiempoUsado = preguntaActual.tiempo ? preguntaActual.tiempo - tiempoRestante : 0
    const nueva = { opcionIdx, correcta, acerto: opcionIdx === correcta, tiempoUsado }
    const nuevasRespuestas = [...respuestas, nueva]
    setRespuestas(nuevasRespuestas)
    setSeleccion(opcionIdx)
    setTimeout(() => {
      const siguiente = preguntaIdx + 1
      if (siguiente < trivia.preguntas.length) { setPreguntaIdx(siguiente); setSeleccion(null) }
      else {
        const aciertos = nuevasRespuestas.filter((r) => r.acerto).length
        const puntos = Math.round((aciertos / trivia.preguntas.length) * 100)
        const tiempoFinal = nuevasRespuestas.reduce((a, r) => a + (r.tiempoUsado || 0), 0)
        setFase('resultado')
        onComplete?.(puntos, tiempoFinal)
      }
    }, 900)
  }

  const avanzarAbierta = (texto) => {
    clearInterval(intervalRef.current)
    const tiempoUsado = preguntaActual.tiempo ? preguntaActual.tiempo - tiempoRestante : 0
    const nueva = { texto, acerto: true, tiempoUsado }
    const nuevasRespuestas = [...respuestas, nueva]
    setRespuestas(nuevasRespuestas)
    setSeleccion('enviado')
    setTextoAbierto('')
    textoAbiertoRef.current = ''
    setTimeout(() => {
      const siguiente = preguntaIdx + 1
      if (siguiente < trivia.preguntas.length) { setPreguntaIdx(siguiente); setSeleccion(null) }
      else {
        const puntos = 100
        const tiempoFinal = nuevasRespuestas.reduce((a, r) => a + (r.tiempoUsado || 0), 0)
        setFase('resultado')
        onComplete?.(puntos, tiempoFinal)
      }
    }, 900)
  }

  if (!trivia?.preguntas?.length) return null
  const esAbiertaTodas = trivia.preguntas.every((q) => q.tipo === 'abierta')
  const aciertos = respuestas.filter((r) => r.acerto).length
  const puntos = fase === 'resultado'
    ? (esAbiertaTodas ? 100 : Math.round((aciertos / trivia.preguntas.length) * 100))
    : 0

  return (
    <div className="trivia-inline-wrap">
      <p className="eyebrow" style={{ marginBottom: 10 }}>Trivia de la estación</p>
      {fase === 'inicio' && (
        <div>
          <p className="helper-text">{trivia.preguntas.length} pregunta(s)</p>
          <button className="mie-btn-primary" onClick={iniciar} style={{ marginTop: 12 }}>Comenzar trivia</button>
        </div>
      )}
      {fase === 'jugando' && preguntaActual && (
        <div className="trivia-quiz">
          <div className="trivia-progreso-bar">
            <div className="trivia-progreso-fill" style={{ width: `${(preguntaIdx / trivia.preguntas.length) * 100}%` }} />
          </div>
          {preguntaActual.tiempo > 0 && (
            <div className="trivia-timer">
              <div className="trivia-timer-ring" style={{ background: `conic-gradient(${tiempoRestante > 10 ? '#3b82f6' : '#ef4444'} ${(tiempoRestante / preguntaActual.tiempo) * 360}deg, rgba(255,255,255,0.1) 0deg)` }}>
                <span>{tiempoRestante}</span>
              </div>
            </div>
          )}
          <p className="helper-text" style={{ marginBottom: 6, textAlign: 'center' }}>Pregunta {preguntaIdx + 1} de {trivia.preguntas.length}</p>
          <h3 className="trivia-pregunta-texto">{preguntaActual.texto}</h3>
          {preguntaActual.tipo === 'abierta' ? (
            <div className="trivia-abierta">
              <textarea
                className="trivia-abierta-input"
                value={textoAbierto}
                onChange={(e) => { setTextoAbierto(e.target.value); textoAbiertoRef.current = e.target.value }}
                placeholder="Escribe tu respuesta..."
                rows={3}
                disabled={seleccion !== null}
              />
              <button
                type="button"
                className="trivia-opcion-btn"
                style={{ marginTop: 10 }}
                onClick={() => avanzarAbierta(textoAbierto)}
                disabled={seleccion !== null}
              >
                Enviar respuesta
              </button>
            </div>
          ) : (
            <div className="trivia-opciones-quiz">
              {(preguntaActual.opciones || []).map((op, idx) => {
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
          )}
        </div>
      )}
      {fase === 'resultado' && (
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          {!esAbiertaTodas && (
            <div className="trivia-resultado-score" style={{ marginBottom: 8 }}>
              <strong>{puntos}</strong><span>puntos</span>
            </div>
          )}
          <p className="helper-text">
            {esAbiertaTodas
              ? `${trivia.preguntas.length} respuesta(s) enviada(s)`
              : `${aciertos} de ${trivia.preguntas.length} respuestas correctas`}
          </p>
          <p className="feedback success" style={{ marginTop: 10 }}>✓ Trivia completada — ahora califica la estación</p>
          <button type="button" className="mie-btn-ghost" onClick={iniciar} style={{ marginTop: 8, fontSize: '0.8rem' }}>Reintentar</button>
        </div>
      )}
    </div>
  )
}

// ── Iconos SVG ─────────────────────────────────────────────────────────────
const IconMap = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
    <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
  </svg>
)
const IconPerson = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
)
const IconQr = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="3" y="14" width="7" height="7"/>
    <path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3"/>
  </svg>
)
const IconPin = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
)
const IconCamera = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)

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
  const [triviaScores, setTriviaScores] = useState({})
  const [registrando, setRegistrando] = useState('')
  const [ratings, setRatings] = useState({})
  const [scannedSet, setScannedSet] = useState(new Set())
  const [scanError, setScanError] = useState('')
  const [cameraError, setCameraError] = useState(false)

  // App shell
  const [activeTab, setActiveTab] = useState('piso')
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [selectedEstId, setSelectedEstId] = useState(null)

  // Map
  const [evento, setEvento] = useState(null)
  const [planoImg, setPlanoImg] = useState(null)
  const calcMapSize = () => {
    const vw = window.innerWidth
    if (vw >= 900) return { width: 480, height: 298 }
    const w = Math.max(vw - 48, 280)
    return { width: w, height: Math.round(w * 0.62) }
  }
  const [stageSize, setStageSize] = useState(calcMapSize)
  const mapaRef = useRef(null)
  const stationRefs = useRef({})

  const loadData = async (documentId, evId) => {
    setLoading(true)
    setError('')
    try {
      const found = await getAttendeeByDocument(documentId, evId)
      if (!found) {
        setError('No encontramos un registro con ese documento. Verifica que te hayas registrado.')
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
        getVisitasPorVisitante(realEventoId, documentId).catch(() => []),
      ])
      setEstaciones(ests)
      setVisitadasSet(new Set(visitas.map((v) => v.estacionId)))
      if (realEventoId) getEventoById(realEventoId).then((ev) => { if (ev) setEvento(ev) })
    } catch {
      setError('No fue posible cargar tus datos. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (docParam) loadData(docParam, eventoParam) }, [])

  useEffect(() => {
    if (!evento?.planoBase64) { setPlanoImg(null); return }
    const img = new window.Image()
    img.src = evento.planoBase64
    img.onload = () => setPlanoImg(img)
  }, [evento?.planoBase64])

  useEffect(() => {
    const handleResize = () => setStageSize(calcMapSize())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleSubmitDoc = (e) => {
    e.preventDefault()
    const cleaned = docInput.trim()
    if (!cleaned) return
    const url = new URL(window.location.href)
    url.searchParams.set('doc', cleaned)
    window.history.replaceState({}, '', url.toString())
    loadData(cleaned, eventoParam)
  }

  const loadTriviaIfNeeded = (estId) => {
    if (!trivias[estId] && trivias[estId] !== null) {
      setLoadingTrivia((prev) => ({ ...prev, [estId]: true }))
      getTriviaDeEstacion(estId)
        .then((t) => setTrivias((prev) => ({ ...prev, [estId]: t || null })))
        .catch(() => setTrivias((prev) => ({ ...prev, [estId]: null })))
        .finally(() => setLoadingTrivia((prev) => ({ ...prev, [estId]: false })))
    }
  }

  // Escaneo global desde la pestaña QR
  const handleGlobalScan = (detected) => {
    const rawValue = detected?.[0]?.rawValue || ''
    if (!rawValue) return
    let estId = null
    try { estId = new URL(rawValue).searchParams.get('id') } catch { estId = null }
    if (!estId) { setScanError('QR no reconocido. Escanea el código de una estación.'); return }
    const est = estaciones.find((e) => e.id === estId)
    if (!est) { setScanError('Esta estación no pertenece al evento.'); return }
    if (visitadasSet.has(estId)) { setScanError(`Ya completaste "${est.nombre}".`); return }
    setScannedSet((prev) => new Set([...prev, estId]))
    setScanError('')
    setCameraEnabled(false)
    setCameraError(false)
    setOpenId(estId)
    loadTriviaIfNeeded(estId)
    setActiveTab('estaciones')
    setTimeout(() => {
      stationRefs.current[estId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 200)
  }

  const handleToggleStation = (estId) => {
    const isToggle = openId === estId
    setOpenId(isToggle ? null : estId)
    if (!isToggle) {
      loadTriviaIfNeeded(estId)
      setTimeout(() => {
        stationRefs.current[estId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    }
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
    } catch { /* silencioso */ } finally { setRegistrando('') }
  }

  const handleResetRecorrido = async () => {
    if (!window.confirm('¿Borrar todo tu progreso? Solo para pruebas.')) return
    await resetVisitasDeVisitante(eventoId, attendee.documentId)
    setVisitadasSet(new Set())
    setScannedSet(new Set())
    setTriviaScores({})
    setRatings({})
    setOpenId(null)
  }

  const totalEstaciones = estaciones.length
  const totalVisitadas = visitadasSet.size
  const pct = totalEstaciones > 0 ? Math.round((totalVisitadas / totalEstaciones) * 100) : 0

  // Mapa: % → px
  const estPx = estaciones.map((e) => ({
    ...e,
    px: (e.x / 100) * stageSize.width,
    py: (e.y / 100) * stageSize.height,
    pw: (e.width / 100) * stageSize.width,
    ph: (e.height / 100) * stageSize.height,
  }))

  // ── Loading ──
  if (loading) {
    return (
      <div className="mie-app" style={{ justifyContent: 'center', alignItems: 'center', display: 'flex' }}>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
          <div className="public-loading-spinner" aria-hidden="true" />
          <p style={{ marginTop: 12 }}>Cargando tu recorrido...</p>
        </div>
      </div>
    )
  }

  // ── Input documento ──
  if (!attendee) {
    return (
      <div className="public-shell">
        <header className="public-hero">
          <div>
            <p className="eyebrow">Mi recorrido</p>
            <h1>¿Cuál es tu documento?</h1>
            <p className="hero-text">Ingresa tu número de documento para ver las estaciones del evento.</p>
          </div>
        </header>
        <section className="panel public-panel">
          {error ? <p className="feedback error" style={{ marginBottom: 20 }}>{error}</p> : null}
          <form onSubmit={handleSubmitDoc} className="attendee-form">
            <label className="field">
              <span>Número de documento</span>
              <input type="text" value={docInput} onChange={(e) => setDocInput(e.target.value)} placeholder="Ej. 1032456789" required autoFocus />
            </label>
            <button type="submit" className="submit-button">Ver mis estaciones</button>
          </form>
        </section>
      </div>
    )
  }

  // ── App shell ──
  return (
    <div className="mie-app">
      {/* Top bar */}
      <header className="mie-topbar">
        <div className="mie-topbar-brand">
          <div className="mie-topbar-avatar">{attendee.fullName?.[0]?.toUpperCase() || '?'}</div>
          <span className="mie-topbar-name">{attendee.fullName?.split(' ')[0]}</span>
        </div>
        <div className="mie-topbar-right">
          {!evento?.soloMapa && (
            <div className="mie-trophy-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
              <span>{totalVisitadas}/{totalEstaciones}</span>
            </div>
          )}
        </div>
      </header>

      {/* Tab content */}
      <div className="mie-content">

        {/* ── PISO ── */}
        {activeTab === 'piso' && (
          <div className="mie-piso">
            <div className="mie-piso-header">
              <h2 className="mie-piso-title">Piso Interactivo</h2>
              <p className="mie-piso-sub">Toca el recuadro de la estación para ver el detalle</p>
            </div>
            <div ref={mapaRef} className="mie-mapa-wrap">
              <Stage width={stageSize.width} height={stageSize.height}>
                <Layer>
                  {planoImg && (
                    <KonvaImage image={planoImg} x={0} y={0} width={stageSize.width} height={stageSize.height} opacity={0.75} />
                  )}
                  {estPx.map((est) => {
                    const visitada = visitadasSet.has(est.id)
                    const scanned = scannedSet.has(est.id)
                    const fill = visitada ? '#22c55ecc'
                      : scanned ? 'rgba(59,130,246,0.7)'
                      : est.color + 'bb'
                    const stroke = visitada ? '#16a34a' : scanned ? '#3b82f6' : est.color
                    const isSelected = selectedEstId === est.id
                    const commonProps = {
                      key: est.id, x: est.px, y: est.py, fill, stroke,
                      strokeWidth: isSelected ? 3 : visitada || scanned ? 2.5 : 1.5,
                      onClick: () => setSelectedEstId(est.id === selectedEstId ? null : est.id),
                      onTap: () => setSelectedEstId(est.id === selectedEstId ? null : est.id),
                    }
                    return est.forma === 'circle'
                      ? <Circle {...commonProps} radius={Math.min(est.pw, est.ph) / 2} />
                      : <Rect {...commonProps} width={est.pw} height={est.ph} cornerRadius={5} />
                  })}
                  {estPx.map((est) => (
                    <Text
                      key={`lbl-${est.id}`}
                      x={est.px} y={est.py}
                      text={`${visitadasSet.has(est.id) ? '✓ ' : ''}${est.nombre}`}
                      fontSize={Math.max(10, Math.min(14, est.pw / 6))}
                      fill="#ffffff"
                      fontStyle="bold"
                      shadowColor="rgba(0,0,0,0.7)"
                      shadowBlur={3}
                      shadowOffsetX={0} shadowOffsetY={1}
                      listening={false}
                      width={est.pw} height={est.ph}
                      align="center" verticalAlign="middle"
                      wrap="word" ellipsis
                    />
                  ))}
                </Layer>
              </Stage>
            </div>
            {(() => {
              const selEst = estaciones.find((e) => e.id === selectedEstId)
              if (!selEst) {
                return (
                  <div className="mie-piso-detail mie-piso-detail--empty">
                    <IconPin />
                    <p>Selecciona una estación en el mapa para ver más detalles</p>
                  </div>
                )
              }
              const visitada = visitadasSet.has(selEst.id)
              const scanned = scannedSet.has(selEst.id)
              return (
                <div className="mie-piso-detail">
                  <div className="mie-piso-detail-header">
                    <div className="mie-piso-detail-dot" style={{ background: visitada ? '#22c55e' : selEst.color || '#94a3b8' }} />
                    <div className="mie-piso-detail-info">
                      <span className="mie-piso-detail-name">{selEst.nombre}</span>
                      <span className="mie-piso-detail-tipo">{selEst.tipo || 'ESTACIÓN'}</span>
                    </div>
                    {visitada && <span className="mie-piso-detail-badge done">✓ Completada</span>}
                    {scanned && !visitada && <span className="mie-piso-detail-badge scanned">QR ✓</span>}
                  </div>
                  {selEst.descripcion ? (
                    <p className="mie-piso-detail-desc">{selEst.descripcion}</p>
                  ) : null}
                  <button
                    type="button"
                    className="mie-piso-cerrar-btn"
                    onClick={() => setSelectedEstId(null)}
                  >
                    Cerrar detalles
                  </button>
                </div>
              )
            })()}
          </div>
        )}

        {/* ── QR ── */}
        {activeTab === 'qr' && (
          <div className="mie-qr-view">
            <div className="mie-qr-card">
              <div className="mie-qr-icon"><IconCamera /></div>
              <h2 className="mie-qr-title">Escanear Estación</h2>
              <p className="mie-qr-sub">Apunta la cámara al código QR de la estación para registrar tu visita</p>
            </div>

            {cameraEnabled ? (
              <div className="mie-qr-scanner-card">
                {cameraError ? (
                  <div style={{ textAlign: 'center' }}>
                    <p className="feedback error" style={{ marginBottom: 16 }}>
                      No se detectó cámara. Usa tu celular para escanear, o selecciona una estación manualmente (pruebas).
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {estaciones.filter((e) => !visitadasSet.has(e.id)).map((est) => (
                        <button
                          key={est.id}
                          type="button"
                          className="mie-btn-ghost"
                          style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10 }}
                          onClick={() => {
                            setScannedSet((prev) => new Set([...prev, est.id]))
                            setScanError('')
                            setCameraEnabled(false)
                            setCameraError(false)
                            setOpenId(est.id)
                            loadTriviaIfNeeded(est.id)
                            setActiveTab('estaciones')
                            setTimeout(() => stationRefs.current[est.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200)
                          }}
                        >
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: est.color || '#94a3b8', flexShrink: 0 }} />
                          {est.nombre}
                        </button>
                      ))}
                      {estaciones.filter((e) => !visitadasSet.has(e.id)).length === 0 && (
                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Ya completaste todas las estaciones.</p>
                      )}
                      <button className="mie-btn-ghost" style={{ marginTop: 4 }} onClick={() => { setCameraError(false); setCameraEnabled(false) }}>
                        Cerrar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ borderRadius: '12px', overflow: 'hidden' }}>
                      <Scanner
                        onScan={handleGlobalScan}
                        onError={() => setCameraError(true)}
                        constraints={{ facingMode: 'environment' }}
                        styles={{ container: { width: '100%' } }}
                      />
                    </div>
                    <button className="mie-btn-ghost" style={{ marginTop: 12, width: '100%' }} onClick={() => { setCameraEnabled(false); setScanError('') }}>
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="mie-qr-scanner-card">
                <p style={{ color: 'rgba(255,255,255,0.65)', marginBottom: 16, textAlign: 'center' }}>
                  Para iniciar el escaneo, habilita la cámara trasera.
                </p>
                <button className="mie-btn-primary" style={{ width: '100%' }} onClick={() => { setCameraEnabled(true); setScanError(''); setCameraError(false) }}>
                  Habilitar cámara
                </button>
              </div>
            )}

            {scanError ? (
              <p className="feedback error" style={{ margin: '12px 16px 0' }}>{scanError}</p>
            ) : null}
          </div>
        )}

        {/* ── ESTACIONES ── */}
        {activeTab === 'estaciones' && (
          <div className="mie-est-view">
            {/* Progreso */}
            <div className="mie-est-progress-card">
              <div className="mie-est-avatar">
                <IconPerson />
              </div>
              <h2 className="mie-est-progress-title">Tu Progreso</h2>
              <p className="mie-est-progress-sub">Completa todas las estaciones para ganar premios exclusivos.</p>
              <div className="mie-est-progress-bar-wrap">
                <div className="mie-est-progress-bar-label">
                  <span>{totalVisitadas} de {totalEstaciones} estaciones</span>
                  <span className="mie-est-pct">{pct}%</span>
                </div>
                <div className="mie-est-progress-track">
                  <div className="mie-est-progress-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>

            {/* Lista */}
            <div className="mie-est-historial">
              <div className="mie-est-historial-header">
                <span className="mie-est-historial-title">Historial</span>
                <span className="mie-est-recientes">RECIENTES</span>
              </div>

              {[...estaciones].sort((a, b) => {
                const av = visitadasSet.has(a.id) ? 0 : 1
                const bv = visitadasSet.has(b.id) ? 0 : 1
                return av - bv
              }).map((est) => {
                const visitada = visitadasSet.has(est.id)
                const scanned = scannedSet.has(est.id)
                const isOpen = openId === est.id
                const trivia = trivias[est.id]
                const triviaRequired = Boolean(trivia?.preguntas?.length)
                const triviaScore = triviaScores[est.id]
                const estRating = ratings[est.id] || {}
                const hasRating = (estRating.stars || 0) > 0
                const canComplete = scanned && hasRating && (!triviaRequired || Boolean(triviaScore))

                return (
                  <div
                    key={est.id}
                    ref={(el) => { stationRefs.current[est.id] = el }}
                    className={`mie-est-item${isOpen && !visitada ? ' open' : ''}`}
                  >
                    <button
                      type="button"
                      className="mie-est-item-row"
                      onClick={() => !visitada && handleToggleStation(est.id)}
                      disabled={visitada}
                    >
                      <div className={`mie-est-item-icon ${visitada ? 'done' : ''}`}>
                        {visitada ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        ) : (
                          <div style={{ color: est.color || '#94a3b8' }}><IconPin /></div>
                        )}
                      </div>
                      <div className="mie-est-item-info">
                        <span className="mie-est-item-name">{est.nombre}</span>
                        <span className="mie-est-item-tipo">ESTACIÓN</span>
                      </div>
                      {!visitada && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      )}
                    </button>

                    {isOpen && !visitada && (
                      <div className="mie-est-item-body">
                        {est.descripcion ? (
                          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.88rem', marginBottom: 16 }}>{est.descripcion}</p>
                        ) : null}

                        {!scanned ? (
                          <div className="mie-scan-prompt">
                            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', marginBottom: 12 }}>
                              Ve a la estación físicamente y escanea su código QR para registrar tu visita.
                            </p>
                            <button
                              type="button"
                              className="mie-btn-primary"
                              onClick={() => { setActiveTab('qr'); setCameraEnabled(true); setScanError(''); setCameraError(false) }}
                            >
                              Abrir escáner QR
                            </button>
                          </div>
                        ) : (
                          <div>
                            <p className="mie-scan-ok">✓ QR de estación validado</p>

                            {loadingTrivia[est.id] ? (
                              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Cargando trivia...</p>
                            ) : triviaRequired ? (
                              <TriviaInline
                                trivia={trivia}
                                onComplete={(puntos, tiempoTotal) => handleTriviaComplete(est.id, puntos, tiempoTotal)}
                              />
                            ) : null}

                            {(!triviaRequired || Boolean(triviaScore)) && (
                              <div className="mie-rating-section">
                                <p className="eyebrow" style={{ marginBottom: 10 }}>
                                  {triviaRequired ? 'Paso 3 — ' : 'Paso 2 — '}Califica esta estación
                                </p>
                                <div className="mi-evento-stars">
                                  {[1, 2, 3, 4, 5].map((n) => (
                                    <button key={n} type="button"
                                      className={`mi-evento-star${(estRating.stars || 0) >= n ? ' filled' : ''}`}
                                      onClick={() => handleSetRating(est.id, n)}
                                      aria-label={`${n} estrella${n > 1 ? 's' : ''}`}>★</button>
                                  ))}
                                </div>
                                <textarea
                                  className="mi-evento-comentario"
                                  placeholder="Comentario opcional"
                                  value={estRating.comentario || ''}
                                  onChange={(e) => handleSetComentario(est.id, e.target.value)}
                                  rows={2} maxLength={300}
                                />
                              </div>
                            )}

                            <button
                              type="button"
                              className="mie-btn-primary"
                              style={{ marginTop: 16, width: '100%' }}
                              onClick={() => handleCompletar(est)}
                              disabled={registrando === est.id || !canComplete}
                            >
                              {registrando === est.id ? 'Registrando...' : 'Completar estación ✓'}
                            </button>
                            {!canComplete && (
                              <p style={{ marginTop: 6, fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)' }}>
                                {triviaRequired && !triviaScore ? 'Completa la trivia primero.' : 'Califica con estrellas para finalizar.'}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              <div style={{ height: 8 }} />
            </div>

            {/* ── Banner de completado ── */}
            {totalEstaciones > 0 && totalVisitadas === totalEstaciones && (
              <div className="mie-completado-banner">
                <div className="mie-completado-icon">🏆</div>
                <h2 className="mie-completado-titulo">¡Recorrido completo!</h2>
                <p className="mie-completado-sub">
                  ¡Completaste todas las {totalEstaciones} estaciones del evento!
                  Gracias por participar.
                </p>
                <div className="mie-completado-badge">
                  {totalEstaciones}/{totalEstaciones} estaciones ✓
                </div>
              </div>
            )}
          </div>
        )}

        <footer className="mie-footer">
          <span>Powered by <strong>Divergency AI</strong></span>
          <span>© 2026 Todos los derechos reservados.</span>
        </footer>
      </div>

      {/* Bottom nav */}
      {!evento?.soloMapa && (
        <nav className="mie-nav">
          <button
            type="button"
            className={`mie-nav-btn ${activeTab === 'piso' ? 'active' : ''}`}
            onClick={() => setActiveTab('piso')}
          >
            <IconMap />
            <span>PISO</span>
          </button>

          <button
            type="button"
            className="mie-nav-qr-btn"
            onClick={() => { setActiveTab('qr'); setScanError('') }}
          >
            <IconQr />
          </button>

          <button
            type="button"
            className={`mie-nav-btn ${activeTab === 'estaciones' ? 'active' : ''}`}
            onClick={() => setActiveTab('estaciones')}
          >
            <IconPerson />
            <span>ESTACIONES</span>
          </button>

        </nav>
      )}
    </div>
  )
}

export default MiEventoPage
