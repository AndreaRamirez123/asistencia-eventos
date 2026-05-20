import { useEffect, useRef, useState } from 'react'
import { Circle, Image as KonvaImage, Layer, Rect, Stage, Text } from 'react-konva'
import { listEventos } from '../eventosStore'
import { subscribeToEstaciones } from '../stacionesStore'
import { getVisitasPorVisitante, registrarVisita } from '../visitasStore'

function MapaPublicoPage() {
  const [eventos, setEventos] = useState([])
  const [evento, setEvento] = useState(null)
  const [estaciones, setEstaciones] = useState([])
  const [planoImg, setPlanoImg] = useState(null)
  const [stageSize, setStageSize] = useState({ width: 340, height: 200 })
  const [selectedEst, setSelectedEst] = useState(null)
  const [visitanteId, setVisitanteId] = useState('')
  const [visitas, setVisitas] = useState([])
  const [visitandoId, setVisitandoId] = useState(null)
  const [msg, setMsg] = useState('')
  const containerRef = useRef(null)

  // Cargar eventos al montar
  useEffect(() => {
    listEventos().then((evs) => {
      const activos = evs.filter((e) => !e.archivado)
      setEventos(activos)
      if (activos.length === 1) setEvento(activos[0])
    })
    const id = localStorage.getItem('mapa_visitante_id') || ''
    setVisitanteId(id)
  }, [])

  // Suscribir estaciones cuando cambia el evento
  useEffect(() => {
    if (!evento) return
    const unsub = subscribeToEstaciones(evento.id, setEstaciones)
    return unsub
  }, [evento?.id])

  // Cargar visitas cuando cambia el visitante/evento
  useEffect(() => {
    if (!evento || !visitanteId) return
    getVisitasPorVisitante(evento.id, visitanteId).then(setVisitas)
  }, [evento?.id, visitanteId])

  // Cargar plano
  useEffect(() => {
    if (!evento?.planoBase64) { setPlanoImg(null); return }
    const img = new window.Image()
    img.src = evento.planoBase64
    img.onload = () => setPlanoImg(img)
  }, [evento?.planoBase64])

  // Responsive
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth
        setStageSize({ width: w, height: Math.round(w * 0.6) })
      }
    })
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const yaVisito = (estId) => visitas.some((v) => v.estacionId === estId)

  const handleRegistrarVisita = async () => {
    if (!selectedEst || !visitanteId || !evento) return
    setVisitandoId(selectedEst.id)
    setMsg('')
    try {
      await registrarVisita(evento.id, selectedEst.id, visitanteId)
      const nuevasVisitas = await getVisitasPorVisitante(evento.id, visitanteId)
      setVisitas(nuevasVisitas)
      setMsg('¡Visita registrada!')
      setTimeout(() => setMsg(''), 2500)
    } catch {
      setMsg('No se pudo registrar la visita.')
    } finally {
      setVisitandoId(null)
    }
  }

  const guardarNombre = (nombre) => {
    if (!nombre.trim()) return
    localStorage.setItem('mapa_visitante_id', nombre.trim())
    setVisitanteId(nombre.trim())
    setVisitas([])
  }

  // Convertir estaciones % → px
  const estPx = estaciones.map((e) => ({
    ...e,
    px: (e.x / 100) * stageSize.width,
    py: (e.y / 100) * stageSize.height,
    pw: (e.width / 100) * stageSize.width,
    ph: (e.height / 100) * stageSize.height,
  }))

  const visitadas = estaciones.filter((e) => yaVisito(e.id)).length
  const total = estaciones.length

  return (
    <div className="public-shell">
      <header className="public-hero">
        <div>
          <p className="eyebrow">Mapa interactivo</p>
          <h1>Explora el evento</h1>
          <p className="hero-text">
            Recorre las estaciones, registra tu visita y participa en las trivias.
          </p>
        </div>
      </header>

      <section className="panel public-panel">
        {/* Selector de evento */}
        {eventos.length > 1 && (
          <label className="field" style={{ marginBottom: '16px' }}>
            <span>Evento</span>
            <select
              value={evento?.id || ''}
              onChange={(e) => setEvento(eventos.find((ev) => ev.id === e.target.value) || null)}
            >
              <option value="">Selecciona un evento</option>
              {eventos.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.nombre}</option>
              ))}
            </select>
          </label>
        )}

        {/* Identificación */}
        {!visitanteId ? (
          <div className="mapa-identificacion">
            <p className="helper-text">Para registrar tus visitas ingresa tu nombre o documento:</p>
            <form
              className="mapa-id-form"
              onSubmit={(e) => {
                e.preventDefault()
                guardarNombre(e.target.elements.nombre.value)
              }}
            >
              <input type="text" name="nombre" placeholder="Tu nombre o número de documento" required />
              <button type="submit" className="submit-button" style={{ minHeight: '42px' }}>
                Continuar
              </button>
            </form>
          </div>
        ) : (
          <div className="mapa-visitante-bar">
            <span>Hola, <strong>{visitanteId}</strong></span>
            {total > 0 && (
              <span className="mapa-progreso">
                {visitadas}/{total} estaciones visitadas
              </span>
            )}
            <button
              type="button"
              className="ghost-action"
              style={{ fontSize: '0.8rem', minHeight: '30px', padding: '0 10px' }}
              onClick={() => { localStorage.removeItem('mapa_visitante_id'); setVisitanteId(''); setVisitas([]) }}
            >
              Cambiar
            </button>
          </div>
        )}

        {/* Mapa */}
        {evento && (
          <>
            {!evento.planoBase64 && estaciones.length === 0 && (
              <p className="helper-text" style={{ marginTop: '16px' }}>
                El mapa del evento aún no está disponible.
              </p>
            )}

            <div ref={containerRef} className="mapa-stage-container">
              <Stage
                width={stageSize.width}
                height={stageSize.height}
                onMouseDown={() => setSelectedEst(null)}
              >
                <Layer>
                  {planoImg && (
                    <KonvaImage
                      image={planoImg}
                      x={0} y={0}
                      width={stageSize.width}
                      height={stageSize.height}
                      opacity={0.85}
                    />
                  )}
                  {estPx.map((est) => {
                    const visitada = yaVisito(est.id)
                    const isSelected = selectedEst?.id === est.id
                    const fill = visitada ? '#1dd1a1aa' : est.color + 'aa'
                    const stroke = isSelected ? '#13212d' : (visitada ? '#1dd1a1' : est.color)
                    const commonProps = {
                      key: est.id,
                      x: est.px, y: est.py,
                      fill, stroke,
                      strokeWidth: isSelected ? 2.5 : 1.5,
                      onClick: () => setSelectedEst(est),
                      onTap: () => setSelectedEst(est),
                    }
                    return est.forma === 'circle' ? (
                      <Circle {...commonProps} radius={Math.min(est.pw, est.ph) / 2} />
                    ) : (
                      <Rect {...commonProps} width={est.pw} height={est.ph} cornerRadius={4} />
                    )
                  })}
                  {estPx.map((est) => (
                    <Text
                      key={`lbl-${est.id}`}
                      x={est.px + 4} y={est.py + 4}
                      text={`${yaVisito(est.id) ? '✓ ' : ''}${est.nombre}`}
                      fontSize={10}
                      fill="#13212d"
                      fontStyle="bold"
                      listening={false}
                      width={est.pw - 8}
                      wrap="word"
                      ellipsis
                    />
                  ))}
                </Layer>
              </Stage>
            </div>

            {/* Detalle de estación seleccionada */}
            {selectedEst && (
              <div className="mapa-estacion-detail">
                <div className="mapa-estacion-header">
                  <span
                    className="mapa-estacion-dot"
                    style={{ background: selectedEst.color }}
                  />
                  <h3>{selectedEst.nombre}</h3>
                  {yaVisito(selectedEst.id) && (
                    <span className="mapa-badge-visitada">Visitada ✓</span>
                  )}
                </div>

                {selectedEst.descripcion && (
                  <p className="helper-text">{selectedEst.descripcion}</p>
                )}

                {msg && <p className="feedback success" style={{ margin: '8px 0' }}>{msg}</p>}

                <div className="mapa-estacion-actions">
                  {visitanteId && !yaVisito(selectedEst.id) && (
                    <button
                      type="button"
                      className="submit-button"
                      style={{ minHeight: '40px', fontSize: '0.9rem' }}
                      onClick={handleRegistrarVisita}
                      disabled={visitandoId === selectedEst.id}
                    >
                      {visitandoId === selectedEst.id ? 'Registrando...' : 'Registrar visita'}
                    </button>
                  )}

                  {selectedEst.tieneTivia && (
                    <a
                      className="ghost-action"
                      href={`/trivia?estacion=${selectedEst.id}&evento=${evento.id}&visitante=${encodeURIComponent(visitanteId)}`}
                      style={{ textAlign: 'center' }}
                    >
                      Hacer trivia →
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Leyenda */}
            {estaciones.length > 0 && (
              <div className="mapa-leyenda">
                <h3>Estaciones</h3>
                <ul className="mapa-leyenda-list">
                  {estaciones.map((e) => (
                    <li
                      key={e.id}
                      className={`mapa-leyenda-item ${selectedEst?.id === e.id ? 'mapa-leyenda-item--selected' : ''}`}
                      onClick={() => setSelectedEst(e)}
                    >
                      <span
                        className="mapa-leyenda-dot"
                        style={{ background: yaVisito(e.id) ? '#1dd1a1' : e.color }}
                      />
                      <span>{e.nombre}</span>
                      {yaVisito(e.id) && <span className="mapa-badge-visitada-sm">✓</span>}
                      {e.tieneTivia && <span className="mapa-badge-trivia">Trivia</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

export default MapaPublicoPage
