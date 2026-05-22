import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

function buildEstacionUrl(estacionId, eventoId) {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/estacion?id=${estacionId}&evento=${eventoId}`
}

function EstacionQRItem({ estacion, eventoId }) {
  const [qrDataUrl, setQrDataUrl] = useState('')
  const url = buildEstacionUrl(estacion.id, eventoId)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      color: { dark: '#13212d', light: '#fffaf1' },
    })
      .then((d) => { if (!cancelled) setQrDataUrl(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [url])

  const handlePrint = () => {
    if (!qrDataUrl) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>${estacion.nombre}</title>
          <style>
            body { font-family: system-ui, sans-serif; text-align: center; padding: 40px; }
            h1 { margin: 0 0 6px; font-size: 22px; }
            p { color: #555; margin: 0 0 16px; font-size: 14px; }
            img { width: 260px; }
            .url { margin-top: 12px; font-size: 10px; color: #aaa; word-break: break-all; }
          </style>
        </head>
        <body>
          <h1>${estacion.nombre}</h1>
          ${estacion.descripcion ? `<p>${estacion.descripcion}</p>` : ''}
          <p>Escanea con tu celular para registrar tu visita.</p>
          <img src="${qrDataUrl}" alt="QR ${estacion.nombre}" />
          <div class="url">${url}</div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <div className="estacion-qr-card">
      <div className="estacion-qr-header">
        <span className="dash-bar-dot" style={{ background: estacion.color }} />
        <strong>{estacion.nombre}</strong>
        {estacion.tieneTivia && <span className="mapa-badge-trivia">Trivia</span>}
      </div>
      {qrDataUrl ? (
        <img src={qrDataUrl} alt={`QR ${estacion.nombre}`} className="estacion-qr-img" />
      ) : (
        <div className="qr-placeholder"><span>QR</span></div>
      )}
      <div className="estacion-qr-actions">
        {qrDataUrl && (
          <a
            className="ghost-action"
            href={qrDataUrl}
            download={`qr-estacion-${estacion.nombre.replace(/\s+/g, '-')}.png`}
          >
            Descargar
          </a>
        )}
        <button type="button" className="ghost-action" onClick={handlePrint} disabled={!qrDataUrl}>
          Imprimir
        </button>
      </div>
    </div>
  )
}

function EstacionQRPanel({ evento, estaciones = [] }) {
  if (!evento) {
    return (
      <section className="panel">
        <div className="panel-heading">
          <p className="eyebrow">QR por estación</p>
          <h2>Selecciona un evento para ver los QR.</h2>
        </div>
      </section>
    )
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">QR por estación</p>
        <h2>Códigos QR para cada estación</h2>
      </div>

      {estaciones.length === 0 ? (
        <p className="helper-text">
          No hay estaciones. Créalas primero en el panel "Mapa del evento".
        </p>
      ) : (
        <>
          <p className="helper-text">
            Imprime el QR de cada estación y colócalo en el punto físico del evento.
            Los asistentes lo escanean para registrar su visita y hacer la trivia.
          </p>
          <div className="estacion-qr-grid">
            {estaciones.map((est) => (
              <EstacionQRItem key={est.id} estacion={est} eventoId={evento.id} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

export default EstacionQRPanel
