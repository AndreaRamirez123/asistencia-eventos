import { useState } from 'react'
import { closeEventAndCreateNew } from '../eventosStore'

function CerrarEventoPanel({ evento, onCerrado }) {
  const [step, setStep] = useState('idle') // idle | confirm | running | done
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [heredarEmpresas, setHeredarEmpresas] = useState(true)
  const [heredarCategorias, setHeredarCategorias] = useState(true)
  const [heredarEncuestas, setHeredarEncuestas] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  if (!evento) return null

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
      </section>
    )
  }

  const handleConfirmar = async () => {
    setStep('running')
    setErrorMessage('')
    try {
      const nuevoEvento = await closeEventAndCreateNew(evento, {
        nombreNuevo: nombreNuevo.trim(),
        heredarEmpresas,
        heredarCategorias,
        heredarEncuestas,
      })
      onCerrado?.(nuevoEvento)
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
          <h2>✓ Listo, evento archivado y nuevo creado</h2>
          <p className="section-copy">
            Ya estás trabajando sobre el nuevo evento. El anterior queda guardado para consulta
            histórica.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Cierre del evento</p>
        <h2>Cerrar este evento y empezar uno nuevo</h2>
        <p className="section-copy">
          Cuando termine el evento actual, ciérralo aquí. El sistema:
          <br />• Archiva el evento actual (los datos no se borran).
          <br />• Crea un nuevo evento que será el activo.
          <br />• Tú decides si el nuevo evento hereda empresas, categorías y encuestas, o
          arranca desde cero.
        </p>
      </div>

      {step === 'idle' ? (
        <div className="cerrar-evento-actions">
          <button
            type="button"
            className="ghost-action"
            onClick={() => setStep('confirm')}
          >
            Cerrar evento y crear nuevo
          </button>
        </div>
      ) : null}

      {step === 'confirm' || step === 'running' ? (
        <div className="cerrar-evento-form">
          <label className="field">
            <span>Nombre del nuevo evento (opcional)</span>
            <input
              type="text"
              value={nombreNuevo}
              onChange={(event) => setNombreNuevo(event.target.value)}
              placeholder="Ej. Feria Espinal 2027"
              maxLength={80}
              disabled={step === 'running'}
            />
          </label>

          <div className="cerrar-evento-options">
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={heredarEmpresas}
                onChange={(event) => setHeredarEmpresas(event.target.checked)}
                disabled={step === 'running'}
              />
              <span>Heredar empresas invitadas</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={heredarCategorias}
                onChange={(event) => setHeredarCategorias(event.target.checked)}
                disabled={step === 'running'}
              />
              <span>Heredar categorías de asistentes</span>
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={heredarEncuestas}
                onChange={(event) => setHeredarEncuestas(event.target.checked)}
                disabled={step === 'running' || !heredarEmpresas}
              />
              <span>Heredar encuestas configuradas por empresa</span>
            </label>
          </div>

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
              {step === 'running' ? 'Cerrando...' : 'Confirmar y cerrar evento'}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default CerrarEventoPanel
