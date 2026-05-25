import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { updateEvento } from '../eventosStore'

function buildRatingUrl(slug) {
  if (typeof window === 'undefined') return ''
  const base = slug
    ? `${window.location.origin}/e/${slug}`
    : window.location.origin
  return `${base}/calificar`
}

function CalificacionPanel({ evento, onEventoChange, ratings = [], empresaSlug = '' }) {
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [copyState, setCopyState] = useState('')

  const url = buildRatingUrl(empresaSlug)
  const habilitada = Boolean(evento?.calificacionHabilitada)

  useEffect(() => {
    if (!url) return
    let cancelled = false
    QRCode.toDataURL(url, {
      width: 480,
      margin: 2,
      color: { dark: '#13212d', light: '#fffaf1' },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('')
      })
    return () => {
      cancelled = true
    }
  }, [url])

  const persist = async (changes) => {
    if (!evento) return
    setIsSaving(true)
    setErrorMessage('')
    try {
      await updateEvento(evento.id, changes)
      onEventoChange?.({ ...evento, ...changes })
    } catch (error) {
      setErrorMessage(error.message || 'No fue posible guardar.')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleHabilitada = (event) => {
    persist({ calificacionHabilitada: event.target.checked })
  }

  const total = ratings.length
  const sum = ratings.reduce((acc, r) => acc + (r.stars || 0), 0)
  const avg = total > 0 ? (sum / total).toFixed(1) : '0.0'
  const distribucion = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: ratings.filter((r) => r.stars === star).length,
  }))

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopyState('copiado')
      setTimeout(() => setCopyState(''), 2000)
    } catch {
      setCopyState('error')
      setTimeout(() => setCopyState(''), 2000)
    }
  }

  const handlePrint = () => {
    if (!qrDataUrl) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>Califica el evento</title>
          <style>
            body { font-family: system-ui, sans-serif; text-align: center; padding: 40px; }
            h1 { margin: 0 0 8px; font-size: 32px; }
            p { color: #555; margin: 0 0 24px; }
            img { width: 80%; max-width: 520px; }
            .url { margin-top: 18px; font-size: 12px; color: #888; word-break: break-all; }
          </style>
        </head>
        <body>
          <h1>Califica el evento</h1>
          <p>Escanea con la cámara de tu celular.</p>
          <img src="${qrDataUrl}" alt="QR calificación" />
          <div class="url">${url}</div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Calificación del evento</p>
        <h2>Configurar calificación post-evento</h2>
      </div>

      <div className="kiosko-mode">
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={habilitada}
            onChange={toggleHabilitada}
            disabled={isSaving}
          />
          <span>
            <strong>Habilitar calificación del evento</strong>
            <small className="helper-text">
              Activa esta opción <strong>cuando termine el evento</strong>Mientras esté
              desactivada, la página de calificación muestra "no disponible".
            </small>
          </span>
        </label>
      </div>

      <div className="kiosko-layout">
        <div className="kiosko-controls">
          <p className="helper-text">
            Muestra este QR al final del evento para que los asistentes califiquen su experiencia.
          </p>
          <label className="field">
            <span>URL pública</span>
            <input type="text" value={url} readOnly onFocus={(e) => e.target.select()} />
          </label>

          <div className="kiosko-actions">
            <button type="button" className="ghost-action" onClick={handleCopy}>
              {copyState === 'copiado'
                ? 'Copiado'
                : copyState === 'error'
                  ? 'No se pudo copiar'
                  : 'Copiar URL'}
            </button>
            {qrDataUrl ? (
              <a
                className="ghost-action"
                href={qrDataUrl}
                download="qr-calificacion-evento.png"
              >
                Descargar PNG
              </a>
            ) : null}
            <button
              type="button"
              className="submit-button"
              onClick={handlePrint}
              disabled={!qrDataUrl}
            >
              Imprimir
            </button>
          </div>

          {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}
        </div>

        <div className="kiosko-preview">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR de calificación" className="kiosko-qr-image" />
          ) : (
            <div className="qr-placeholder">
              <span>QR</span>
            </div>
          )}
          <p className="helper-text kiosko-label">Calificación del evento</p>
        </div>
      </div>

      <div className="rating-stats">
        <h3>Resultados (todas las empresas)</h3>
        <div className="rating-stats-grid">
          <div className="rating-stat-card">
            <strong className="rating-stat-value">{avg}</strong>
            <span>promedio (de 5)</span>
          </div>
          <div className="rating-stat-card">
            <strong className="rating-stat-value">{total}</strong>
            <span>personas calificaron</span>
          </div>
        </div>

        {total > 0 ? (
          <ul className="rating-distribution">
            {distribucion.map(({ star, count }) => {
              const percent = total > 0 ? (count / total) * 100 : 0
              return (
                <li key={star} className="rating-dist-row">
                  <span className="rating-dist-star">{star} ★</span>
                  <div className="rating-dist-bar">
                    <div
                      className="rating-dist-fill"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="rating-dist-count">{count}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="helper-text">Aún no hay calificaciones.</p>
        )}

        {ratings.some((r) => r.comment) ? (
          <div className="rating-comments">
            <h4>Comentarios</h4>
            <ul className="rating-comments-list">
              {ratings
                .filter((r) => r.comment)
                .map((r) => (
                  <li key={r.id} className="rating-comment-item">
                    <span className="rating-comment-stars">
                      {'★'.repeat(r.stars)}
                      {'☆'.repeat(5 - r.stars)}
                    </span>
                    <p>{r.comment}</p>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default CalificacionPanel
