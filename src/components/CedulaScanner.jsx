import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library'
import Tesseract from 'tesseract.js'

const hints = new Map()
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.PDF_417,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.AZTEC,
  BarcodeFormat.CODE_128,
])
hints.set(DecodeHintType.TRY_HARDER, true)

function titleCase(str = '') {
  return str
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function tryParseJson(raw) {
  // Cedula digital nueva: a veces el QR trae JSON con campos identificados
  try {
    const obj = JSON.parse(raw)
    if (typeof obj !== 'object' || obj === null) return null

    const pickString = (keys) => {
      for (const key of keys) {
        const value = obj[key]
        if (typeof value === 'string' && value.trim()) return value.trim()
      }
      return ''
    }

    const documentId = pickString([
      'documento', 'numeroDocumento', 'identificacion', 'cedula',
      'nuip', 'numero', 'document', 'id',
    ])
    const firstNames = pickString(['nombres', 'primerNombre', 'firstName', 'givenName'])
    const lastName1 = pickString(['primerApellido', 'apellido1', 'lastName', 'surname'])
    const lastName2 = pickString(['segundoApellido', 'apellido2'])

    if (!documentId && !firstNames && !lastName1) return null

    return { documentId, firstNames, lastName1, lastName2 }
  } catch {
    return null
  }
}

function tryParsePipeDelimited(raw) {
  const parts = raw.split(/[|\t\n]/).map((p) => p.trim()).filter(Boolean)
  const textParts = parts.filter((p) => /^[A-ZÁÉÍÓÚÑÜ\s]{2,}$/.test(p))

  if (textParts.length === 0) return null

  let lastName1 = ''
  let lastName2 = ''
  let firstNames = ''

  if (textParts.length >= 3) {
    lastName1 = textParts[0]
    lastName2 = textParts[1]
    firstNames = textParts[2]
  } else if (textParts.length === 2) {
    lastName1 = textParts[0]
    firstNames = textParts[1]
  } else {
    firstNames = textParts[0]
  }

  return { firstNames, lastName1, lastName2 }
}

function isValidWord(word) {
  // Palabra debe: tener minimo 3 letras, contener al menos una vocal,
  // no ser solo consonantes o letras sueltas
  if (!word || word.length < 3) return false
  if (!/[AEIOUÁÉÍÓÚ]/i.test(word)) return false
  // Rechazar palabras con patrones de ruido OCR tipicos
  const noise = /^(NA|NO|PE|ME|EL|LA|DE|EN|SI|DEL|LOS|LAS|CON|POR|QUE)$/i
  if (noise.test(word)) return false
  return true
}

function cleanNameLine(line) {
  // Separa en palabras y conserva solo las validas
  const words = line.split(/\s+/).filter(isValidWord)
  return words.join(' ').trim()
}

function isValidDocumentId(value) {
  if (!value) return false
  // Cedulas colombianas: 6-10 digitos, no empiezan con 0
  if (!/^\d{6,10}$/.test(value)) return false
  if (value.startsWith('0')) return false
  return true
}

function parseCedulaOCR(rawText) {
  if (!rawText || typeof rawText !== 'string') return null

  const text = rawText
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  // Buscar numero de documento
  let documentId = ''

  // Paso 1: buscar despues de palabras clave
  for (const line of text) {
    const normalized = line.replace(/[.\s,]/g, '')
    const keywordMatch = normalized.match(
      /(?:NUMERO|NUMBER|NO|NUIP|CEDULA|CC|IDENTIFICACION)(\d{6,10})/i,
    )
    if (keywordMatch && isValidDocumentId(keywordMatch[1])) {
      documentId = keywordMatch[1]
      break
    }
  }

  // Paso 2: fallback - cualquier numero valido
  if (!documentId) {
    const allText = text.join(' ').replace(/[.,]/g, '')
    const matches = allText.match(/\b\d{6,10}\b/g) || []
    const validMatches = matches.filter(isValidDocumentId)
    if (validMatches.length > 0) {
      // Preferir el numero de 8-10 digitos (cedulas modernas)
      const preferred = validMatches.find((m) => m.length >= 8) || validMatches[0]
      documentId = preferred
    }
  }

  // Buscar apellidos y nombres con palabras clave explicitas
  let lastNames = ''
  let firstNames = ''

  for (let i = 0; i < text.length; i++) {
    const line = text[i]
    if (/^APELLIDOS?/i.test(line) && !lastNames) {
      const afterColon = line.split(/[:]/).slice(1).join(':').trim()
      const candidate = afterColon || text[i + 1] || ''
      lastNames = cleanNameLine(candidate)
    }
    if (/^NOMBRES?/i.test(line) && !firstNames) {
      const afterColon = line.split(/[:]/).slice(1).join(':').trim()
      const candidate = afterColon || text[i + 1] || ''
      firstNames = cleanNameLine(candidate)
    }
  }

  // Fallback: lineas en MAYUSCULAS con al menos 2 palabras validas
  if (!firstNames && !lastNames) {
    const candidateLines = text
      .filter((l) => /^[A-ZÁÉÍÓÚÑÜ\s]{8,}$/.test(l))
      .map(cleanNameLine)
      .filter((l) => l.split(/\s+/).filter(isValidWord).length >= 2)

    if (candidateLines.length >= 2) {
      lastNames = candidateLines[0]
      firstNames = candidateLines[1]
    } else if (candidateLines.length === 1) {
      firstNames = candidateLines[0]
    }
  }

  const lastNameParts = lastNames.trim().split(/\s+/).filter(Boolean)
  const lastName1 = lastNameParts[0] || ''
  const lastName2 = lastNameParts[1] || ''

  // Confidence: considera exito si tiene documento Y al menos un nombre
  const hasData = documentId && (firstNames || lastName1)

  if (!hasData) return null

  return {
    documentId,
    firstNames,
    lastName1,
    lastName2,
  }
}

function parseCedulaColombiana(raw) {
  if (!raw || typeof raw !== 'string') {
    return null
  }

  const cleaned = raw.replace(/\r/g, '').trim()

  // Documento: secuencia de 7-12 digitos (aplica a cualquier formato)
  const docMatch = cleaned.match(/\b(\d{7,12})\b/)
  const documentIdFromRegex = docMatch ? docMatch[1] : ''

  // Estrategia 1: JSON (cedula digital nueva con QR que trae JSON)
  const jsonParsed = tryParseJson(cleaned)

  // Estrategia 2: pipe-delimited o tab/newline (PDF417 tradicional)
  const pipeParsed = tryParsePipeDelimited(cleaned)

  const best = jsonParsed || pipeParsed || {}
  const documentId = best.documentId || documentIdFromRegex

  const firstNames = best.firstNames || ''
  const lastName1 = best.lastName1 || ''
  const lastName2 = best.lastName2 || ''

  const fullName = titleCase(
    [firstNames, lastName1, lastName2].filter(Boolean).join(' ').replace(/\s+/g, ' '),
  )

  return {
    documentId,
    firstNames: titleCase(firstNames),
    lastName1: titleCase(lastName1),
    lastName2: titleCase(lastName2),
    fullName,
    raw: cleaned,
  }
}

function CedulaScanner({ onExtract, onClose }) {
  const [step, setStep] = useState('choose') 
  const [errorMessage, setErrorMessage] = useState('')
  const [extracted, setExtracted] = useState(null)
  const videoRef = useRef(null)
  const readerRef = useRef(null)
  const controlsRef = useRef(null)

  useEffect(() => {
    readerRef.current = new BrowserMultiFormatReader(hints)
    return () => {
      if (controlsRef.current?.stop) {
        controlsRef.current.stop()
      }
    }
  }, [])

  const stopCamera = () => {
    if (controlsRef.current?.stop) {
      try {
        controlsRef.current.stop()
      } catch {}
      controlsRef.current = null
    }
    const video = videoRef.current
    if (video?.srcObject) {
      try {
        video.srcObject.getTracks().forEach((t) => t.stop())
      } catch {}
      video.srcObject = null
    }
  }

  const handleResult = (rawText) => {
    stopCamera()
    const parsed = parseCedulaColombiana(rawText)
    if (!parsed || !parsed.documentId) {
      setErrorMessage(
        'Se leyo el codigo de barras pero no se pudo identificar el numero de documento. Escribelo manualmente.',
      )
      setStep('error')
      return
    }
    setExtracted(parsed)
    setStep('confirm')
  }

  const startCamera = async () => {
    setErrorMessage('')

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setErrorMessage(
        'Este navegador no permite acceso a la camara en esta URL. Esto pasa cuando el sitio usa HTTPS con certificado no confiable (o HTTP en IP local). Usa la opcion "Subir foto" o abre el sitio en HTTPS confiable (ej. ngrok o cloudflared).',
      )
      setStep('error')
      return
    }

    setStep('camera')

    try {
      const devices = await BrowserMultiFormatReader.listVideoInputDevices()
      const backCamera =
        devices.find((d) => /back|rear|trasera|environment/i.test(d.label)) || devices[0]

      if (!backCamera) {
        setErrorMessage('No se detecto camara en este dispositivo. Prueba subiendo una foto.')
        setStep('error')
        return
      }

      controlsRef.current = await readerRef.current.decodeFromVideoDevice(
        backCamera.deviceId,
        videoRef.current,
        (result, err) => {
          if (result) {
            handleResult(result.getText())
          } else if (err && !(err instanceof NotFoundException)) {
            console.debug('Scanner intento:', err.message)
          }
        },
      )
    } catch (err) {
      console.error(err)
      setErrorMessage(
        'No se pudo acceder a la camara. Verifica permisos o prueba subiendo una foto.',
      )
      setStep('error')
    }
  }

  const tryOcr = async (file) => {
    setStep('ocr')
    try {
      const { data } = await Tesseract.recognize(file, 'spa', {
        logger: () => {},
      })
      const parsed = parseCedulaOCR(data.text)
      if (!parsed || (!parsed.documentId && !parsed.firstNames && !parsed.lastName1)) {
        setErrorMessage(
          'No se pudieron extraer datos de la cedula. Verifica que la foto este bien enfocada, con buena luz, y que se vea claramente el nombre y el numero.',
        )
        setStep('error')
        return
      }

      const fullName = titleCase(
        [parsed.firstNames, parsed.lastName1, parsed.lastName2]
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' '),
      )

      setExtracted({
        documentId: parsed.documentId,
        firstNames: titleCase(parsed.firstNames),
        lastName1: titleCase(parsed.lastName1),
        lastName2: titleCase(parsed.lastName2),
        fullName,
        raw: data.text,
        method: 'OCR',
      })
      setStep('confirm')
    } catch (err) {
      console.error(err)
      setErrorMessage(
        'Fallo el analisis por OCR. Verifica la conexion a internet (la primera vez descarga el modelo) o llena los datos manualmente.',
      )
      setStep('error')
    }
  }

  const captureFrameForOcr = async () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) {
      setErrorMessage('La camara aun no esta lista. Espera un segundo e intenta de nuevo.')
      setStep('error')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    stopCamera()

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    )
    if (!blob) {
      setErrorMessage('No se pudo capturar la foto. Intenta subir una imagen manualmente.')
      setStep('error')
      return
    }
    await tryOcr(blob)
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setErrorMessage('')
    setStep('processing')

    // Intento 1: lectura de codigo (PDF417 / QR / etc)
    try {
      const imageUrl = URL.createObjectURL(file)
      const result = await readerRef.current.decodeFromImageUrl(imageUrl)
      URL.revokeObjectURL(imageUrl)
      handleResult(result.getText())
      return
    } catch (err) {
      console.debug('Barcode no detectado, intentando OCR:', err?.message)
    }

    // Intento 2: OCR (lee texto impreso)
    await tryOcr(file)
  }

  const confirmExtracted = () => {
    if (!extracted) return
    onExtract({
      fullName: extracted.fullName,
      documentId: extracted.documentId,
    })
  }

  const retry = () => {
    stopCamera()
    setExtracted(null)
    setErrorMessage('')
    setStep('choose')
  }

  const close = () => {
    stopCamera()
    onClose()
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card cedula-modal">
        <header className="modal-header">
          <h3>Escanear cedula</h3>
          <button type="button" className="mini-action" onClick={close}>
            Cerrar
          </button>
        </header>

        {step === 'choose' ? (
          <div className="cedula-choice">
            <p className="section-copy">
              Primero intentamos leer el <strong>codigo</strong> (barras o QR). Si no se detecta,
              leemos el <strong>texto con OCR</strong>. No guardamos la imagen.
            </p>
            <div className="cedula-buttons">
              <button type="button" className="submit-button" onClick={startCamera}>
                Usar camara
              </button>
              <label className="ghost-action cedula-file" htmlFor="cedula-file-input">
                Subir foto
                <input
                  id="cedula-file-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="cedula-file-input"
                />
              </label>
            </div>
            <p className="helper-text">
              Tip: ilumina bien el codigo y evita reflejos. Una foto mas nitida lee mejor.
            </p>
          </div>
        ) : null}

        {step === 'camera' ? (
          <div className="cedula-camera">
            <video
              ref={videoRef}
              className="cedula-video"
              autoPlay
              muted
              playsInline
            />
            <p className="helper-text">
              Apunta al <strong>codigo de barras o QR</strong> del reverso. Si no se detecta,
              toca "Capturar foto" y usamos OCR sobre el frente.
            </p>
            <div className="cedula-buttons">
              <button
                type="button"
                className="submit-button"
                onClick={captureFrameForOcr}
              >
                Capturar foto
              </button>
              <button type="button" className="ghost-action" onClick={retry}>
                Cancelar escaneo
              </button>
            </div>
          </div>
        ) : null}

        {step === 'processing' ? (
          <div className="cedula-processing">
            <p>Buscando codigo en la imagen...</p>
            <div className="cedula-buttons">
              <button type="button" className="ghost-action" onClick={close}>
                Cancelar
              </button>
            </div>
          </div>
        ) : null}

        {step === 'ocr' ? (
          <div className="cedula-processing">
            <p>
              <strong>Leyendo texto con OCR...</strong>
            </p>
            <p className="helper-text">
              La primera vez toma hasta 30 segundos porque descarga el modelo de reconocimiento
              (~20 MB). Si tu conexion es lenta o el modelo no se descarga, puedes cancelar y
              llenar los datos manualmente.
            </p>
            <div className="cedula-buttons">
              <button type="button" className="ghost-action" onClick={close}>
                Cancelar y llenar manual
              </button>
            </div>
          </div>
        ) : null}

        {step === 'confirm' && extracted ? (
          <div className="cedula-confirm">
            <p className="section-copy">Confirma que los datos esten correctos:</p>
            <div className="preview-meta">
              <span>
                <strong>Documento:</strong> {extracted.documentId || '(no detectado)'}
              </span>
              <span>
                <strong>Nombres:</strong> {extracted.firstNames || '(no detectado)'}
              </span>
              <span>
                <strong>Apellidos:</strong>{' '}
                {[extracted.lastName1, extracted.lastName2].filter(Boolean).join(' ') ||
                  '(no detectado)'}
              </span>
              <span>
                <strong>Nombre completo:</strong> {extracted.fullName}
              </span>
            </div>
            <p className="helper-text">
              Si algo no coincide, puedes corregirlo directamente en el formulario despues.
            </p>
            <div className="cedula-buttons">
              <button type="button" className="submit-button" onClick={confirmExtracted}>
                Usar estos datos
              </button>
              <button type="button" className="ghost-action" onClick={retry}>
                Escanear de nuevo
              </button>
            </div>
          </div>
        ) : null}

        {step === 'error' ? (
          <div className="cedula-error">
            <p className="feedback error">{errorMessage}</p>
            <div className="cedula-buttons">
              <button type="button" className="submit-button" onClick={retry}>
                Intentar de nuevo
              </button>
              <button type="button" className="ghost-action" onClick={close}>
                Llenar manual
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default CedulaScanner
