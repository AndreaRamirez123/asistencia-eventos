import { useEffect, useState } from 'react'
import {
  countEventoData,
  deleteEvento,
  updateEvento,
} from '../eventosStore'

function CerrarEventoPanel({ evento, onCerrado, onEliminado }) {
  const [step, setStep] = useState('idle') // idle | confirm | running | done
  const [errorMessage, setErrorMessage] = useState('')

  const [deleteStep, setDeleteStep] = useState('idle')
  const [counts, setCounts] = useState({ asistentes: 0, calificaciones: 0 })
  const [confirmText, setConfirmText] = useState('')
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    if (deleteStep === 'confirm' && evento?.id) {
      countEventoData(evento.id).then((data) => setCounts(data))
    }
  }, [deleteStep, evento?.id])

  if (!evento) return null

  const handleEliminar = async () => {
    if (confirmText.trim().toLowerCase() !== 'eliminar') {
      setDeleteError('Escribe "eliminar" para confirmar.')
      return
    }
    setDeleteStep('running')
    setDeleteError('')
    try {
      await deleteEvento(evento.id, { borrarAsistentes: true })
      onEliminado?.(evento.id)
    } catch (error) {
      setDeleteError(error.message || 'No fue posible eliminar el evento.')
      setDeleteStep('confirm')
    }
  }

  if (evento.archivado) {
    return (
      <section className="panel">
        <div className="panel-heading">
          <p className="eyebrow">Cierre del evento</p>
          <h2>Este evento ya está cerrado</h2>
          <p className="section-copy">
            Este evento fue archivado el {evento.fechaCierre
              ? new Date(evento.fechaCierre).toLocaleString('es-CO')
              : '—'}. Los datos quedan disponibles solo para consulta.
          </p>
        </div>

        <div className="eliminar-evento-zone">
          <h3>Zona peligrosa</h3>
          <p className="helper-text">
            Eliminar el evento borra el evento y <strong>todos sus asistentes</strong>. Las
            calificaciones quedan en la base sin enlazar (no se pueden borrar por reglas de
            seguridad). Esta acción es <strong>irreversible</strong>.
          </p>

          {deleteStep === 'idle' ? (
            <button
              type="button"
              className="mini-action danger eliminar-btn"
              onClick={() => setDeleteStep('confirm')}
            >
              Eliminar evento permanentemente
            </button>
          ) : null}

          {deleteStep === 'confirm' || deleteStep === 'running' ? (
            <div className="eliminar-confirm">
              <p>
                Vas a eliminar el evento <strong>{evento.nombre || evento.id}</strong>. Esto
                borrará:
              </p>
              <ul>
                <li><strong>{counts.asistentes}</strong> asistentes asociados</li>
                <li>El documento del evento (configuración, encuestas, empresas)</li>
              </ul>
              <p>
                Las <strong>{counts.calificaciones}</strong> calificaciones del evento se
                quedan en la base pero no aparecerán en ningún lado.
              </p>

              <label className="field">
                <span>Para confirmar, escribe <strong>eliminar</strong>:</span>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  placeholder='eliminar'
                  disabled={deleteStep === 'running'}
                />
              </label>

              {deleteError ? <p className="feedback error">{deleteError}</p> : null}

              <div className="cerrar-evento-actions">
                <button
                  type="button"
                  className="ghost-action"
                  onClick={() => {
                    setDeleteStep('idle')
                    setConfirmText('')
                    setDeleteError('')
                  }}
                  disabled={deleteStep === 'running'}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="mini-action danger"
                  onClick={handleEliminar}
                  disabled={
                    deleteStep === 'running' ||
                    confirmText.trim().toLowerCase() !== 'eliminar'
                  }
                >
                  {deleteStep === 'running'
                    ? 'Eliminando...'
                    : 'Sí, eliminar permanentemente'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    )
  }

  const handleConfirmar = async () => {
    setStep('running')
    setErrorMessage('')
    try {
      await updateEvento(evento.id, {
        archivado: true,
        active: false,
        fechaCierre: new Date().toISOString(),
      })
      onCerrado?.()
      setStep('done')
    } catch (error) {
      setErrorMessage(error.message || 'No fue posible cerrar el evento.')
      setStep('confirm')
    }
  }

  if (step === 'done') {
    return (
      <section className="panel">
        <div className="panel-heading">
          <p className="eyebrow">Evento cerrado</p>
          <h2>✓ Evento archivado correctamente</h2>
          <p className="section-copy">
            El evento quedó archivado. Puedes crear un nuevo evento desde la sección
            "Crear nuevo evento" al inicio del panel.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Cierre del evento</p>
        <h2>Archivar este evento</h2>
        <p className="section-copy">
          Cuando termine el evento actual, ciérralo aquí. El sistema archivará el evento
          (los datos no se borran) y quedará en modo solo lectura. Después puedes crear
          un nuevo evento desde la sección al inicio del panel.
        </p>
      </div>

      {step === 'idle' ? (
        <div className="cerrar-evento-actions">
          <button
            type="button"
            className="ghost-action"
            onClick={() => setStep('confirm')}
          >
            Archivar evento
          </button>
        </div>
      ) : null}

      {step === 'confirm' || step === 'running' ? (
        <div className="cerrar-evento-form">
          <p className="section-copy">
            ¿Estás seguro de que deseas archivar <strong>{evento.nombre || 'este evento'}</strong>?
            Esta acción lo pondrá en modo solo lectura. Los datos no se borran.
          </p>

          {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}

          <div className="cerrar-evento-actions">
            <button
              type="button"
              className="ghost-action"
              onClick={() => setStep('idle')}
              disabled={step === 'running'}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="submit-button"
              onClick={handleConfirmar}
              disabled={step === 'running'}
            >
              {step === 'running' ? 'Archivando...' : 'Sí, archivar evento'}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default CerrarEventoPanel
