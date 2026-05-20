/**
 * Genera un carnet/pase de asistente como PNG usando Canvas.
 * Retorna un data URL PNG listo para descargar.
 */
export async function generarPase({ attendee, qrDataUrl, eventoNombre, colorPrimario, logoUrl }) {
  const W = 800
  const H = 480
  const ACCENT = colorPrimario || '#ffd166'
  const DARK = '#13212d'
  const MUTED = '#5f6d79'
  const BG = '#fffaf1'

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Fondo
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, BG)
  grad.addColorStop(1, '#f1eadb')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // Banda lateral izquierda
  ctx.fillStyle = ACCENT
  ctx.fillRect(0, 0, 18, H)

  // Banda superior
  ctx.fillStyle = DARK
  ctx.fillRect(18, 0, W - 18, 72)

  // Nombre del evento (header)
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 22px Bahnschrift, Arial Narrow, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(truncate(eventoNombre || 'Evento', 50), 42, 36)

  // PASE texto pequeño derecha
  ctx.font = '14px Bahnschrift, Arial Narrow, sans-serif'
  ctx.fillStyle = ACCENT
  ctx.textAlign = 'right'
  ctx.fillText('PASE DE ASISTENTE', W - 24, 36)
  ctx.textAlign = 'left'

  // --- Sección izquierda (datos) ---
  const leftX = 42
  let y = 110

  // Nombre completo
  ctx.fillStyle = DARK
  ctx.font = 'bold 36px Bahnschrift, Arial Narrow, sans-serif'
  const nameParts = splitText(ctx, attendee.fullName || 'Asistente', W * 0.55 - leftX)
  for (const line of nameParts) {
    ctx.fillText(line, leftX, y)
    y += 42
  }

  y += 8

  // Documento
  ctx.font = '16px Aptos, Segoe UI, sans-serif'
  ctx.fillStyle = MUTED
  ctx.fillText('Documento', leftX, y)
  y += 22
  ctx.fillStyle = DARK
  ctx.font = 'bold 20px Aptos, Segoe UI, sans-serif'
  ctx.fillText(`${attendee.documentType || 'CC'} ${attendee.documentId || '—'}`, leftX, y)
  y += 36

  // Empresa / organización
  if (attendee.organization) {
    ctx.font = '16px Aptos, Segoe UI, sans-serif'
    ctx.fillStyle = MUTED
    ctx.fillText('Organización', leftX, y)
    y += 22
    ctx.fillStyle = DARK
    ctx.font = 'bold 18px Aptos, Segoe UI, sans-serif'
    ctx.fillText(truncate(attendee.organization, 36), leftX, y)
    y += 36
  }

  // Categoría
  if (attendee.attendeeType && attendee.attendeeType !== 'general') {
    ctx.font = '16px Aptos, Segoe UI, sans-serif'
    ctx.fillStyle = MUTED
    ctx.fillText('Categoría', leftX, y)
    y += 22
    ctx.fillStyle = DARK
    ctx.font = 'bold 18px Aptos, Segoe UI, sans-serif'
    ctx.fillText(attendee.attendeeType, leftX, y)
  }

  // --- Sección derecha (QR) ---
  const qrSize = 220
  const qrX = W - qrSize - 40
  const qrY = 90

  // Fondo blanco del QR
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  roundRect(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 16)
  ctx.fill()

  // Cargar y dibujar QR
  if (qrDataUrl) {
    await new Promise((resolve) => {
      const img = new window.Image()
      img.onload = () => {
        ctx.drawImage(img, qrX, qrY, qrSize, qrSize)
        resolve()
      }
      img.onerror = resolve
      img.src = qrDataUrl
    })
  }

  // Label bajo el QR
  ctx.fillStyle = MUTED
  ctx.font = '13px Aptos, Segoe UI, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Muestra este QR al ingresar', qrX + qrSize / 2, qrY + qrSize + 28)
  ctx.textAlign = 'left'

  // Logo (si existe)
  if (logoUrl) {
    await new Promise((resolve) => {
      const img = new window.Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const logoH = 40
        const logoW = (img.width / img.height) * logoH
        ctx.drawImage(img, leftX, H - 60, logoW, logoH)
        resolve()
      }
      img.onerror = resolve
      img.src = logoUrl
    })
  }

  // Footer
  ctx.fillStyle = ACCENT
  ctx.fillRect(18, H - 36, W - 18, 36)
  ctx.fillStyle = DARK
  ctx.font = 'bold 14px Aptos, Segoe UI, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText('Presenta este pase a la entrada del evento · No transferible', 42, H - 18)

  return canvas.toDataURL('image/png')
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

function splitText(ctx, text, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, 2)
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
