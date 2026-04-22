import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

function QrViewerModal({ attendee, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!attendee) {
      setQrDataUrl('')
      return
    }

    let active = true

    const qrContent =
      attendee.qrValue ||
      JSON.stringify({
        event: attendee.eventoId || 'evento-principal',
        attendee: attendee.email || attendee.documentId,
        token: attendee.qrToken || '',
        source: attendee.source || 'admin-panel',
      })

    QRCode.toDataURL(qrContent, {
      width: 320,
      margin: 2,
      color: { dark: '#13212d', light: '#fffaf1' },
    })
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl)
      })
      .catch((error) => {
        if (active) setErrorMessage(error.message || 'No fue posible generar el QR.')
      })

    return () => {
      active = false
    }
  }, [attendee])

  if (!attendee) return null

  const fileName = `qr-${attendee.documentId || attendee.id}.png`

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card qr-viewer-modal">
        <header className="modal-header">
          <h3>QR del asistente</h3>
          <button type="button" className="mini-action" onClick={onClose}>
            Cerrar
          </button>
        </header>

        <div className="qr-viewer-body">
          <p className="section-copy">
            <strong>{attendee.fullName || 'Sin nombre'}</strong>
          </p>
          <p className="helper-text">
            Documento: {attendee.documentId || '—'} · Estado: {attendee.status || '—'}
          </p>

          {errorMessage ? (
            <p className="feedback error">{errorMessage}</p>
          ) : qrDataUrl ? (
            <>
              <img className="qr-preview" src={qrDataUrl} alt={`QR de ${attendee.fullName}`} />
              <div className="cedula-buttons">
                <a
                  className="submit-button download-action"
                  href={qrDataUrl}
                  download={fileName}
                >
                  Descargar QR
                </a>
                <button
                  type="button"
                  className="ghost-action"
                  onClick={() => {
                    const w = window.open('', '_blank', 'width=500,height=600')
                    if (!w) return
                    w.document.write(
                      `<html><head><title>QR ${attendee.fullName}</title></head>` +
                        `<body style="margin:0;display:grid;place-items:center;min-height:100vh;font-family:sans-serif;">` +
                        `<div style="text-align:center;padding:30px;">` +
                        `<h2>${attendee.fullName || ''}</h2>` +
                        `<p>${attendee.documentId || ''}</p>` +
                        `<img src="${qrDataUrl}" style="max-width:320px"/>` +
                        `</div></body></html>`,
                    )
                    w.document.close()
                    setTimeout(() => w.print(), 300)
                  }}
                >
                  Imprimir
                </button>
              </div>
            </>
          ) : (
            <p>Generando QR...</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default QrViewerModal
