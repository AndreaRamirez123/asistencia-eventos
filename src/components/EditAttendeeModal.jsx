function EditAttendeeModal({
  attendee,
  form,
  handleChange,
  handleSubmit,
  isSubmitting,
  errorMessage,
  onCancel,
  empresasInvitadas = [],
  categorias = [],
}) {
  if (!attendee) return null

  return (
    <div className="edit-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="edit-modal" role="dialog" aria-modal="true" aria-label="Editar asistente">
        <div className="edit-modal-header">
          <h2>Editar asistente</h2>
          <button type="button" className="edit-modal-close" onClick={onCancel} aria-label="Cerrar">&#10005;</button>
        </div>

        <form className="edit-modal-form" onSubmit={handleSubmit}>
          <div className="edit-modal-grid">
            <label className="field">
              <span>Nombre completo</span>
              <input
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                placeholder="Ej. Laura Martinez"
                required
              />
            </label>

            <label className="field">
              <span>Documento</span>
              <input
                name="documentId"
                value={form.documentId}
                onChange={handleChange}
                placeholder="Ej. 1032456789"
                required
              />
            </label>

            <label className="field">
              <span>Correo electronico</span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="correo@evento.com"
              />
            </label>

            <label className="field">
              <span>Telefono</span>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="Ej. 3001234567"
              />
            </label>

            {empresasInvitadas.length > 0 ? (
              <label className="field">
                <span>Empresa o institucion</span>
                <select
                  name="empresaInvitadaId"
                  value={form.empresaInvitadaId || ''}
                  onChange={handleChange}
                >
                  <option value="">Selecciona...</option>
                  {empresasInvitadas.map((empresa) => (
                    <option key={empresa.id} value={empresa.id}>
                      {empresa.nombre}
                    </option>
                  ))}
                  <option value="__otra__">Otra (especificar)</option>
                </select>
              </label>
            ) : (
              <label className="field">
                <span>Empresa o institucion</span>
                <input
                  name="organization"
                  value={form.organization}
                  onChange={handleChange}
                  placeholder="Ej. Universidad o empresa"
                />
              </label>
            )}

            <label className="field">
              <span>Categoria</span>
              <select name="attendeeType" value={form.attendeeType} onChange={handleChange}>
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Estado</span>
              <select name="status" value={form.status || 'approved'} onChange={handleChange}>
                <option value="approved">Aprobado</option>
                <option value="pre-registered">Pre-registro</option>
                <option value="checked-in">Check-in</option>
                <option value="pending">Pendiente</option>
              </select>
            </label>

            <label className="field edit-modal-notes">
              <span>Notas internas</span>
              <input
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="Ej. invitado de gerencia, requiere acreditacion especial"
              />
            </label>
          </div>

          {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}

          <div className="edit-modal-actions">
            <button type="submit" className="submit-button" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button type="button" className="ghost-action" onClick={onCancel} disabled={isSubmitting}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditAttendeeModal
