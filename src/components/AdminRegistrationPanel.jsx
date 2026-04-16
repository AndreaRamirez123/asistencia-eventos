function AdminRegistrationPanel({
  editingAttendeeId,
  errorMessage,
  form,
  handleChange,
  handleSubmit,
  isSubmitting,
  modeLabel,
  onCancelEdit,
  submission,
}) {
  return (
    <section id="registro-admin" className="panel registration-panel">
      <div className="panel-heading">
        <p className="eyebrow">Alta manual</p>
        <h2>
          {editingAttendeeId
            ? 'Edicion de asistente desde el panel del administrador'
            : 'Registro directo desde el panel del administrador'}
        </h2>
        <p className="section-copy">
          Este modulo sirve para que el admin o la mesa de soporte creen asistentes, corrijan datos
          y generen QR en el momento.
        </p>
      </div>

      <div className="registration-layout">
        <form className="attendee-form" onSubmit={handleSubmit}>
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
              required
            />
          </label>

          <label className="field">
            <span>Empresa o institucion</span>
            <input
              name="organization"
              value={form.organization}
              onChange={handleChange}
              placeholder="Ej. Universidad o empresa"
            />
          </label>

          <label className="field">
            <span>Categoria</span>
            <select name="attendeeType" value={form.attendeeType} onChange={handleChange}>
              <option value="general">General</option>
              <option value="vip">VIP</option>
              <option value="speaker">Speaker</option>
              <option value="staff">Staff</option>
              <option value="press">Prensa</option>
            </select>
          </label>

          <label className="field field-wide">
            <span>Notas internas</span>
            <input
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder="Ej. invitado de gerencia, requiere acreditacion especial"
            />
          </label>

          <label className="checkbox-field">
            <input
              type="checkbox"
              name="hasFaceConsent"
              checked={form.hasFaceConsent}
              onChange={handleChange}
            />
            <span>Marcar si el asistente autorizo reconocimiento facial opcional.</span>
          </label>

          {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}

          {editingAttendeeId ? (
            <div className="form-actions-row">
              <button type="submit" className="submit-button" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando cambios...' : 'Guardar cambios'}
              </button>
              <button
                type="button"
                className="ghost-action form-ghost"
                onClick={onCancelEdit}
                disabled={isSubmitting}
              >
                Cancelar edicion
              </button>
            </div>
          ) : (
            <button type="submit" className="submit-button" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando desde admin...' : 'Crear registro y QR'}
            </button>
          )}

          <p className="helper-text">Estado actual: {modeLabel}</p>
        </form>

        <aside className="preview-card">
          <p className="eyebrow">Resultado operativo</p>
          {submission ? (
            <>
              <h3>Asistente aprobado</h3>
              <p className="preview-copy">
                {submission.attendee.fullName} fue creado desde admin con estado{' '}
                <strong>{submission.attendee.status}</strong>.
              </p>
              <img
                className="qr-preview"
                src={submission.qrDataUrl}
                alt={`QR de ${submission.attendee.fullName}`}
              />
              <div className="preview-meta">
                <span>ID: {submission.recordId}</span>
                <span>
                  Modo:{' '}
                  {submission.mode === 'backend'
                    ? 'Backend API'
                    : submission.mode === 'firestore'
                      ? 'Firestore activo'
                      : 'Preview local'}
                </span>
                <span>Categoria: {submission.attendee.attendeeType}</span>
              </div>
            </>
          ) : (
            <>
              <h3>QR y trazabilidad</h3>
              <p className="preview-copy">
                Cuando el admin cree un asistente, aqui aparecera su QR junto con el estado del
                registro.
              </p>
              <div className="qr-placeholder" aria-hidden="true">
                <span>ADMIN</span>
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  )
}

export default AdminRegistrationPanel
