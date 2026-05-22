import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Scanner } from '@yudiel/react-qr-scanner'
import { getAttendeeByDocument } from '../attendeesStore'
import { listEstaciones } from '../stacionesStore'
import { listEventos } from '../eventosStore'
import { getVisitasPorVisitante, registrarVisita, resetVisitasDeVisitante } from '../visitasStore'
import { getTriviaDeEstacion, guardarResultado } from '../triviaStore'

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
  const [answers, setAnswers] = useState({})
  const [registrando, setRegistrando] = useState('')
  const [triviaSubmitted, setTriviaSubmitted] = useState(new Set())
  const [scanningId, setScanningId] = useState(null)
  const [scannedSet, setScannedSet] = useState(new Set())
  const [scanError, setScanError] = useState({})
  const [cameraError, setCameraError] = useState({})
  const [qrDataUrl, setQrDataUrl] = useState('')

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
      console.log('[MiEvento] eventoId usado:', realEventoId)
      console.log('[MiEvento] attendee.eventoId:', found.eventoId)

      const [ests, visitas] = await Promise.all([
        listEstaciones(realEventoId),
        getVisitasPorVisitante(realEventoId, documentId),
      ])
      console.log('[MiEvento] estaciones cargadas:', ests.length, ests)
      setEstaciones(ests)
      setVisitadasSet(new Set(visitas.map((v) => v.estacionId)))
    } catch {
      setError('No fue posible cargar tus datos. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (docParam) loadData(docParam, eventoParam)
  }, [])

  useEffect(() => {
    if (!attendee?.qrToken) return
    const payload = JSON.stringify({ token: attendee.qrToken })
    QRCode.toDataURL(payload, {
      width: 200,
      margin: 1,
      color: { dark: '#13212d', light: '#fffaf1' },
    })
      .then(setQrDataUrl)
      .catch(() => {})
  }, [attendee?.qrToken])

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
      const url = new URL(rawValue)
      scannedEstId = url.searchParams.get('id')
    } catch {
      scannedEstId = null
    }
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
    if (openId === estId) { setOpenId(null); return }
    setOpenId(estId)
    if (!trivias[estId] && trivias[estId] !== null) {
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

  const handleAnswer = (estId, pregIdx, optIdx) => {
    setAnswers((prev) => ({
      ...prev,
      [estId]: { ...(prev[estId] || {}), [pregIdx]: optIdx },
    }))
    // al cambiar respuesta, ocultar feedback previo
    setTriviaSubmitted((prev) => {
      const next = new Set(prev)
      next.delete(estId)
      return next
    })
  }

  const handleCompletar = async (est) => {
    const estId = est.id
    const trivia = trivias[estId]
    const preguntas = trivia?.preguntas || []

    if (preguntas.length > 0) {
      const falta = preguntas.some((_, idx) => answers[estId]?.[idx] === undefined)
      if (falta) return
    }

    // validar que todas las respuestas sean correctas
    if (preguntas.length > 0) {
      const hayError = preguntas.some((p, idx) => answers[estId]?.[idx] !== p.correcta)
      if (hayError) {
        setTriviaSubmitted((prev) => new Set([...prev, estId]))
        return
      }
    }

    setRegistrando(estId)
    try {
      await registrarVisita(eventoId, estId, attendee.documentId)

      if (preguntas.length > 0) {
        await guardarResultado(eventoId, estId, attendee.fullName, preguntas.length, 0)
      }

      setVisitadasSet((prev) => new Set([...prev, estId]))
      setOpenId(null)
    } catch {
      // silencioso
    } finally {
      setRegistrando('')
    }
  }

  const handleResetRecorrido = async () => {
    if (!window.confirm('¿Seguro que quieres borrar todo tu progreso? Esto es solo para pruebas.')) return
    await resetVisitasDeVisitante(eventoId, attendee.documentId)
    setVisitadasSet(new Set())
    setScannedSet(new Set())
    setAnswers({})
    setTriviaSubmitted(new Set())
    setOpenId(null)
  }

  const totalEstaciones = estaciones.length
  const totalVisitadas = visitadasSet.size
  const pct = totalEstaciones > 0 ? (totalVisitadas / totalEstaciones) * 100 : 0

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
                ? '¡Completaste todas las estaciones! 🎉'
                : `${totalVisitadas} de ${totalEstaciones} estaciones completadas`}
          </p>
        </div>
        {qrDataUrl ? (
          <div className="mi-evento-qr-wrap">
            <img src={qrDataUrl} alt="Tu QR de ingreso" className="mi-evento-qr" />
            <p className="helper-text" style={{ textAlign: 'center', marginTop: 6, fontSize: '0.75rem' }}>
              Tu QR de ingreso
            </p>
          </div>
        ) : null}
      </header>

      <div className="mi-evento-progress-wrap">
        <div className="mi-evento-progress-bar" style={{ width: `${pct}%` }} />
      </div>

      <section className="panel public-panel">
        <div className="panel-heading" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p className="eyebrow">Estaciones</p>
            <h2>{totalVisitadas}/{totalEstaciones} completadas</h2>
          </div>
          {totalVisitadas > 0 ? (
            <button
              type="button"
              className="ghost-action"
              style={{ fontSize: '0.78rem', opacity: 0.55, marginTop: 4 }}
              onClick={handleResetRecorrido}
            >
              Reiniciar recorrido (pruebas)
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
              const preguntas = trivia?.preguntas || []
              const answersEst = answers[est.id] || {}
              const allAnswered =
                preguntas.length === 0 ||
                preguntas.every((_, idx) => answersEst[idx] !== undefined)
              const wasSubmitted = triviaSubmitted.has(est.id)

              return (
                <div
                  key={est.id}
                  className={`mi-evento-item${visitada ? ' visitada' : ''}${isOpen ? ' open' : ''}`}
                >
                  <button
                    type="button"
                    className="mi-evento-item-header"
                    onClick={() => handleOpenEstacion(est.id)}
                    disabled={visitada}
                  >
                    <span
                      className="mi-evento-dot"
                      style={{ background: visitada ? '#22c55e' : (est.color || '#cbd5e1') }}
                    />
                    <span className="mi-evento-nombre">{est.nombre}</span>
                    {est.descripcion && !visitada ? (
                      <span className="mi-evento-desc-hint">{est.descripcion}</span>
                    ) : null}
                    {visitada ? (
                      <span className="mi-evento-check">✓ Completada</span>
                    ) : (
                      <span className="mi-evento-chevron" aria-hidden="true">
                        {isOpen ? '▲' : '▼'}
                      </span>
                    )}
                  </button>

                  {isOpen && !visitada ? (
                    <div className="mi-evento-item-body">
                      {est.descripcion ? (
                        <p className="helper-text" style={{ marginBottom: 16 }}>{est.descripcion}</p>
                      ) : null}

                      {/* PASO 1: Escanear QR de la estación */}
                      {!scannedSet.has(est.id) ? (
                        <div className="mi-evento-scan-step">
                          <p className="mi-evento-scan-label">
                            Paso 1 — Escanea el código QR de esta estación
                          </p>
                          {scanningId === est.id ? (
                            <div>
                              {cameraError[est.id] ? (
                                <div>
                                  <p className="feedback error">
                                    No se detectó cámara en este dispositivo. Abre esta página desde tu celular para escanear.
                                  </p>
                                  <button
                                    type="button"
                                    className="ghost-action"
                                    style={{ marginTop: 8 }}
                                    onClick={() => {
                                      setScannedSet((prev) => new Set([...prev, est.id]))
                                      setScanningId(null)
                                      setCameraError((p) => ({ ...p, [est.id]: false }))
                                    }}
                                  >
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
                              {scanError[est.id] ? (
                                <p className="feedback error" style={{ marginTop: 8 }}>{scanError[est.id]}</p>
                              ) : null}
                              <button
                                type="button"
                                className="ghost-action"
                                style={{ marginTop: 10 }}
                                onClick={() => {
                                  setScanningId(null)
                                  setScanError((p) => ({ ...p, [est.id]: '' }))
                                  setCameraError((p) => ({ ...p, [est.id]: false }))
                                }}
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="submit-button"
                              onClick={() => { setScanningId(est.id); setScanError((p) => ({ ...p, [est.id]: '' })) }}
                            >
                              Abrir cámara para escanear
                            </button>
                          )}
                        </div>
                      ) : (
                        /* PASO 2: QR validado — mostrar trivia y/o completar */
                        <div>
                          <p className="mi-evento-scan-ok">✓ QR de estación validado</p>

                          {loadingTrivia[est.id] ? (
                            <p className="helper-text">Cargando trivia...</p>
                          ) : preguntas.length > 0 ? (
                            <div className="mi-evento-trivia">
                              <p className="eyebrow" style={{ marginBottom: 16 }}>
                                Paso 2 — Trivia de la estación
                              </p>
                              {preguntas.map((preg, pIdx) => (
                                <div key={pIdx} className="mi-evento-pregunta">
                                  <p className="mi-evento-pregunta-texto">
                                    {pIdx + 1}. {preg.texto}
                                  </p>
                                  <div className="mi-evento-opciones">
                                    {(preg.opciones || []).map((op, oIdx) => {
                                      const isSelected = answersEst[pIdx] === oIdx
                                      const isCorrectOption = oIdx === preg.correcta
                                      let opClass = 'mi-evento-opcion'
                                      if (isSelected) opClass += ' selected'
                                      if (wasSubmitted && isSelected && !isCorrectOption) opClass += ' opcion-incorrecta'
                                      return (
                                        <label key={oIdx} className={opClass}>
                                          <input
                                            type="radio"
                                            name={`est-${est.id}-preg-${pIdx}`}
                                            checked={isSelected}
                                            onChange={() => handleAnswer(est.id, pIdx, oIdx)}
                                          />
                                          {op}
                                        </label>
                                      )
                                    })}
                                  </div>
                                </div>
                              ))}
                              {wasSubmitted ? (
                                <p className="feedback error" style={{ marginTop: 12 }}>
                                  Alguna respuesta es incorrecta. Corrige e intenta de nuevo.
                                </p>
                              ) : !allAnswered ? (
                                <p className="helper-text" style={{ marginTop: 8 }}>
                                  Responde todas las preguntas para continuar.
                                </p>
                              ) : null}
                            </div>
                          ) : null}

                          <button
                            type="button"
                            className="submit-button"
                            style={{ marginTop: 20 }}
                            onClick={() => handleCompletar(est)}
                            disabled={registrando === est.id || !allAnswered}
                          >
                            {registrando === est.id ? 'Registrando...' : 'Completar estación ✓'}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}

        {attendee && totalVisitadas > 0 ? (
          <div style={{ marginTop: 32, textAlign: 'center' }}>
            <button
              type="button"
              className="ghost-action"
              style={{ fontSize: '0.78rem', opacity: 0.5 }}
              onClick={handleResetRecorrido}
            >
              Reiniciar recorrido (solo pruebas)
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}

export default MiEventoPage
