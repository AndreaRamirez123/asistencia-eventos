import { useState } from 'react'
import { addEmpresaInvitada, removeEmpresaInvitada } from '../eventosStore'

function EmpresasInvitadasPanel({ evento, onChange }) {
  const [newName, setNewName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [removingId, setRemovingId] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const empresas = Array.isArray(evento?.empresasInvitadas) ? evento.empresasInvitadas : []

  const handleAdd = async (event) => {
    event.preventDefault()
    if (!newName.trim() || !evento) return

    setIsAdding(true)
    setErrorMessage('')
    try {
      const next = await addEmpresaInvitada(evento, newName)
      onChange?.(next)
      setNewName('')
    } catch (error) {
      setErrorMessage(error.message || 'No fue posible agregar la empresa.')
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemove = async (id) => {
    if (!evento) return
    setRemovingId(id)
    setErrorMessage('')
    try {
      const next = await removeEmpresaInvitada(evento, id)
      onChange?.(next)
    } catch (error) {
      setErrorMessage(error.message || 'No fue posible quitar la empresa.')
    } finally {
      setRemovingId('')
    }
  }

  if (!evento) {
    return null
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <p className="eyebrow">Empresas invitadas</p>
        <h2>Lista de empresas invitadas al evento</h2>
        <p className="section-copy">
          Los asistentes podran seleccionar su empresa de esta lista cuando se registren. Si no
          esta, pueden escoger "Otra" y escribirla manualmente.
        </p>
      </div>

      <form onSubmit={handleAdd} className="empresas-invitadas-form">
        <label className="field field-wide">
          <span>Agregar nueva empresa</span>
          <div className="empresas-inline-row">
            <input
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Ej. Microsoft"
              maxLength={60}
            />
            <button
              type="submit"
              className="submit-button"
              disabled={isAdding || !newName.trim()}
            >
              {isAdding ? 'Agregando...' : 'Agregar'}
            </button>
          </div>
        </label>
        {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}
      </form>

      {empresas.length === 0 ? (
        <div className="empty-state">
          <h3>Aun no hay empresas invitadas</h3>
          <p>
            Agrega la primera empresa arriba. Si prefieres no usar lista predefinida, puedes dejar
            esto vacio y los asistentes escribiran su empresa libremente.
          </p>
        </div>
      ) : (
        <ul className="empresas-invitadas-list">
          {empresas.map((empresa) => (
            <li key={empresa.id} className="empresa-invitada-item">
              <span>{empresa.nombre}</span>
              <button
                type="button"
                className="mini-action danger"
                onClick={() => handleRemove(empresa.id)}
                disabled={removingId === empresa.id}
              >
                {removingId === empresa.id ? 'Quitando...' : 'Quitar'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default EmpresasInvitadasPanel
