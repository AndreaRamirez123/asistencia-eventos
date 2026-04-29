import { useEffect, useState } from 'react'
import { updateEvento } from '../eventosStore'

function toLocalInputValue(isoOrLocal) {
  if (!isoOrLocal) return ''
  try {
    const d = new Date(isoOrLocal)
    if (Number.isNaN(d.getTime())) return ''
    // datetime-local requiere YYYY-MM-DDTHH:mm en hora local
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}

function fromLocalInputValue(value) {
  if (!value) return ''
  try {
    return new Date(value).toISOString()
  } catch {
    return ''
  }
}

function formatHumano(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(d)
  } catch {
    return '—'
  }
}

function getEstadoEvento(evento, now = new Date()) {
  const inicio = evento?.fechaInicio ? new Date(evento.fechaInicio) : null
  const fin = evento?.fechaFin ? new Date(evento.fechaFin) : null
  if (!inicio || !fin) return { codigo: 'sin-config', label: 'Sin horario configurado' }
  if (now < inicio) {
    const diffMs = inicio - now
    const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const horas = Math.floor((diffMs / (1000 * 60 * 60)) % 24)
    return {
      codigo: 'proximo',
      label:
        dias > 0
          ? `Empieza en ${dias} día${dias === 1 ? '' : 's'} y ${horas} hora${horas === 1 ? '' : 's'}`
          : `Empieza en ${horas} hora${horas === 1 ? '' : 's'}`,
    }
  }
  if (now > fin) {
    const diffMs = now - fin
    const horas = Math.floor(diffMs / (1000 * 60 * 60))
    const dias = Math.floor(horas / 24)
    return {
      codigo: 'terminado',
      label:
        dias > 0
          ? `Terminó hace ${dias} día${dias === 1 ? '' : 's'}`
          : `Terminó hace ${horas} hora${horas === 1 ? '' : 's'}`,
    }
  }
  // En curso
  const finMs = fin - now
  const horas = Math.floor(finMs / (1000 * 60 * 60))
  return {
    codigo: 'en-curso',
    label: horas > 0 ? `En curso (termina en ${horas}h)` : 'En curso (termina en menos de 1 hora)',
  }
}

function HorarioEventoPanel({ evento, onEventoChange }) {
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    setFechaInicio(toLocalInputValue(evento?.fechaInicio))
    setFechaFin(toLocalInputValue(evento?.fechaFin))
  }, [evento?.id, evento?.fechaInicio, evento?.fechaFin])

  // Refrescar el "estado" del evento cada minuto
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  if (!evento) return null

  const estado = getEstadoEvento(evento, now)

  const handleSave = async () => {
    if (!fechaInicio || !fechaFin) {
      setErrorMessage('Debes definir fecha de inicio y fin.')
      return
    }
    const inicioIso = fromLocalInputValue(fechaInicio)
    const finIso = fromLocalInputValue(fechaFin)
    if (new Date(finIso) <= new Date(inicioIso)) {
      setErrorMessage('La fecha de fin debe ser posterior a la de inicio.')
      return
    }
    setIsSaving(true)
    setErrorMessage('')
    try {
      await updateEvento(evento.id, {
        fechaInicio: inicioIso,
        fechaFin: finIso,
      })
      onEventoChange?.({ ...evento, fechaInicio: inicioIso, fechaFin: finIso })
    } catch (error) {
      setErrorMessage(error.message || 'No fue posible guardar el horario.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Horario del evento</p>
        <h2>Cuándo empieza y cuándo termina</h2>
        <p className="section-copy">
          Define las fechas y horas exactas. El sistema usa esto para saber cuándo el evento
          terminó y avisarte que es momento de activar la calificación y enviar notificaciones.
        </p>
      </div>

      <div className={`horario-estado horario-estado-${estado.codigo}`}>
        <span className="horario-estado-label">Estado</span>
        <strong>{estado.label}</strong>
      </div>

      <div className="horario-form">
        <label className="field">
          <span>Inicio del evento</span>
          <input
            type="datetime-local"
            value={fechaInicio}
            onChange={(event) => setFechaInicio(event.target.value)}
            disabled={isSaving}
          />
          <small className="helper-text">
            Guardado: {formatHumano(evento.fechaInicio)}
          </small>
        </label>

        <label className="field">
          <span>Fin del evento</span>
          <input
            type="datetime-local"
            value={fechaFin}
            onChange={(event) => setFechaFin(event.target.value)}
            disabled={isSaving}
          />
          <small className="helper-text">
            Guardado: {formatHumano(evento.fechaFin)}
          </small>
        </label>
      </div>

      {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}

      <div className="horario-actions">
        <button
          type="button"
          className="submit-button"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Guardando...' : 'Guardar horario'}
        </button>
      </div>

      {estado.codigo === 'terminado' ? (
        <div className="horario-tip">
          <strong>El evento terminó.</strong> Es buen momento para:
          <ul>
            <li>Activar la calificación en la sección "Calificación del evento".</li>
            <li>Compartir el QR de calificación por WhatsApp/correo.</li>
            <li>Cuando recolectes suficiente data, cerrar el evento desde "Cierre del evento" para empezar el siguiente.</li>
          </ul>
        </div>
      ) : null}
    </section>
  )
}

export default HorarioEventoPanel
export { getEstadoEvento }
