import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { registrarVisita, yaVisito } from '../visitasStore'
import { getTriviaDeEstacion } from '../triviaStore'

function EstacionPublicaPage() {
  const params = new URLSearchParams(window.location.search)
  const estacionId = params.get('id')
  const eventoId = params.get('evento')

  const [estacion, setEstacion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tieneTrivia, setTieneTrivia] = useState(false)

  const [visitante, setVisitante] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mapa_visitante') || 'null') } catch { return null }
  })
  const [formNombre, setFormNombre] = useState('')
  const [formDoc, setFormDoc] = useState('')

  const [yaVisitada, setYaVisitada] = useState(false)
  const [registrando, setRegistrando] = useState(false)
  const [visitRegistrada, setVisitRegistrada] = useState(false)

  useEffect(() => {
    if (!estacionId) {
      setError('No se especificó la estación.')
      setLoading(false)
      return
    }
    getDoc(doc(db, 'eventoEstaciones', estacionId))
      .then((snap) => {
        if (!snap.exists()) { setError('Estación no encontrada.'); return }
        setEstacion({ id: snap.id, ...snap.data() })
      })
      .catch(() => setError('Error al cargar la estación.'))
      .finally(() => setLoading(false))
  }, [estacionId])

  useEffect(() => {
    if (!estacionId) return
    getTriviaDeEstacion(estacionId)
      .then((preguntas) => setTieneTrivia(Array.isArray(preguntas) && preguntas.length > 0))
      .catch(() => {})
  }, [estacionId])

  useEffect(() => {
    if (visitante?.id && estacionId && eventoId) {
      yaVisito(eventoId, estacionId, visitante.id).then(setYaVisitada).catch(() => {})
    }
  }, [visitante, estacionId, eventoId])

  const handleIdentificar = (e) => {
    e.preventDefault()
    if (!formNombre.trim() || !formDoc.trim()) return
    const v = { id: formDoc.trim(), nombre: formNombre.trim() }
    localStorage.setItem('mapa_visitante', JSON.stringify(v))
    setVisitante(v)
  }

  const handleRegistrar = async () => {
    if (!visitante || !estacionId || !eventoId) return
    setRegistrando(true)
    try {
      await registrarVisita(eventoId, estacionId, visitante.id)
      setYaVisitada(true)
      setVisitRegistrada(true)
    } catch { /* silencioso */ }
    finally { setRegistrando(false) }
  }

  const triviaUrl = `/trivia?estacion=${estacionId}&evento=${eventoId}&visitante=${visitante?.id || ''}`

  if (loading) {
    return (
      <div className="public-shell">
        <div className="public-loading">
          <div className="public-loading-spinner" aria-hidden="true" />
          <p>Cargando estación...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="public-shell">
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <p className="feedback error">{error}</p>
        </div>
      </div>
    )
  }

  const accentColor = estacion.color || '#ffd166'

  return (
    <div className="public-shell" style={{ '--accent': accentColor, '--accent-strong': accentColor }}>
      <header className="public-hero" style={{ background: accentColor + '22' }}>
        <div>
          <p className="eyebrow">Estación del evento</p>
          <h1>{estacion.nombre}</h1>
          {estacion.descripcion && (
            <p className="hero-text">{estacion.descripcion}</p>
          )}
        </div>
      </header>

      <section className="panel public-panel">
        {!visitante ? (
          <>
            <div className="panel-heading">
              <p className="eyebrow">Paso 1</p>
              <h2>¿Quién eres?</h2>
              <p className="section-copy">Identifícate para registrar tu visita a esta estación.</p>
            </div>
            <form className="attendee-form" onSubmit={handleIdentificar}>
              <label className="field">
                <span>Nombre completo</span>
                <input
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  placeholder="Ej. Laura Martínez"
                  required
                />
              </label>
              <label className="field">
                <span>Número de documento</span>
                <input
                  value={formDoc}
                  onChange={(e) => setFormDoc(e.target.value)}
                  placeholder="Ej. 1032456789"
                  required
                />
              </label>
              <button type="submit" className="submit-button">Continuar</button>
            </form>
          </>
        ) : (
          <>
            <div className="panel-heading">
              <p className="eyebrow">Hola, {visitante.nombre.split(' ')[0]}</p>
              <h2>
                {yaVisitada && !visitRegistrada
                  ? 'Ya visitaste esta estación'
                  : visitRegistrada
                  ? '¡Visita registrada!'
                  : 'Registra tu visita'}
              </h2>
            </div>

            {!yaVisitada && (
              <button
                type="button"
                className="submit-button"
                onClick={handleRegistrar}
                disabled={registrando}
              >
                {registrando ? 'Registrando...' : '✓ Registrar mi visita'}
              </button>
            )}

            {(yaVisitada || visitRegistrada) && (
              <p className="feedback success" style={{ marginBottom: 0 }}>
                ✓ Visita registrada correctamente.
              </p>
            )}

            {tieneTrivia && (yaVisitada || visitRegistrada) && (
              <div className="estacion-trivia-cta">
                <p className="helper-text">Esta estación tiene trivia. ¿Quieres jugar?</p>
                <a
                  href={triviaUrl}
                  className="submit-button"
                  style={{ display: 'inline-block', textDecoration: 'none' }}
                >
                  Jugar trivia →
                </a>
              </div>
            )}

            <p className="helper-text" style={{ marginTop: 32 }}>
              ¿No eres {visitante.nombre}?{' '}
              <button
                type="button"
                className="ghost-action"
                style={{ display: 'inline' }}
                onClick={() => {
                  localStorage.removeItem('mapa_visitante')
                  setVisitante(null)
                  setYaVisitada(false)
                  setVisitRegistrada(false)
                }}
              >
                Cambiar usuario
              </button>
            </p>
          </>
        )}
      </section>
    </div>
  )
}

export default EstacionPublicaPage
