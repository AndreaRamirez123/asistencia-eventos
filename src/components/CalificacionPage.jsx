import { useEffect, useState } from 'react'
import { saveRating } from '../ratingsStore'

function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0)
  const display = hover || value || 0
  return (
    <div className="star-rating" role="radiogroup" aria-label="Calificación">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`star ${star <= display ? 'on' : ''}`}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          aria-label={`${star} estrella${star > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function CalificacionPage({ evento, empresasInvitadas = [], eventoLoaded = true }) {
  const [empresaId, setEmpresaId] = useState('')
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const empresaParam = params.get('empresa') || ''
    setEmpresaId(empresaParam)
  }, [])

  const calificacionHabilitada = Boolean(evento?.calificacionHabilitada)
  const titulo =
    evento?.calificacionTitulo || '¿Cómo estuvo el evento?'

  const empresaSeleccionada =
    empresasInvitadas.find((e) => e.id === empresaId) || null

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (stars < 1) {
      setErrorMessage('Selecciona al menos una estrella.')
      return
    }
    setIsSubmitting(true)
    setErrorMessage('')
    try {
      await saveRating({
        stars,
        comment,
        empresaId,
        eventoId: evento?.id || '',
      })
      setSubmitted(true)
    } catch (error) {
      setErrorMessage(error.message || 'No fue posible guardar la calificación.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!eventoLoaded) {
    return (
      <div className="public-shell">
        <div className="public-loading">
          <div className="public-loading-spinner" aria-hidden="true" />
          <p>Cargando...</p>
        </div>
      </div>
    )
  }

  if (!calificacionHabilitada) {
    return (
      <div className="public-shell">
        <div className="kiosk-success">
          <div className="kiosk-success-card">
            <p className="eyebrow">Calificación</p>
            <h1>La calificación aún no está disponible</h1>
            <p className="kiosk-copy">
              El admin del evento todavía no ha activado la calificación. Inténtalo más tarde.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="public-shell">
        <div className="kiosk-success">
          <div className="kiosk-success-card">
            <div className="kiosk-success-check" aria-hidden="true">&#10003;</div>
            <p className="eyebrow">Gracias</p>
            <h1>¡Tu calificación quedó registrada!</h1>
            <p className="kiosk-copy">
              Apreciamos mucho que te tomes el tiempo. Tu opinión ayuda a que los próximos
              eventos sean mejores.
            </p>
            <div className="kiosk-meta-card">
              <div>
                <span className="kiosk-meta-label">Calificación</span>
                <strong>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)} ({stars}/5)</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="public-shell">
      <header className="public-hero">
        <div>
          <p className="eyebrow">Calificación del evento</p>
          <h1>{titulo}</h1>
          {empresaSeleccionada ? (
            <p className="hero-text">{empresaSeleccionada.nombre}</p>
          ) : null}
        </div>
      </header>

      <section className="panel public-panel">
        <form className="rating-form" onSubmit={handleSubmit}>
          <div className="rating-stars-wrap">
            <span className="rating-label">Tu calificación</span>
            <StarRating value={stars} onChange={setStars} />
            <span className="rating-value">
              {stars > 0 ? `${stars} de 5` : 'Selecciona tu calificación'}
            </span>
          </div>

          <label className="field">
            <span>Tu opinión</span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Cuéntanos qué te pareció..."
              rows={5}
              maxLength={600}
            />
            <small className="helper-text">{comment.length}/600 caracteres</small>
          </label>

          {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}

          <button
            type="submit"
            className="submit-button"
            disabled={isSubmitting || stars < 1}
          >
            {isSubmitting ? 'Enviando...' : 'Enviar calificación'}
          </button>
        </form>
      </section>
    </div>
  )
}

export default CalificacionPage
