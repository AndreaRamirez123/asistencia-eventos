function PublicRegistrationPage({
  backendStatus,
  errorMessage,
  form,
  handleChange,
  handleSubmit,
  isSubmitting,
  submission,
}) {
  return (
    <div className="public-shell">
      <header className="public-hero">
        <div>
          <p className="eyebrow">Registro publico del evento</p>
          <h1>Inscribete y recibe tu codigo QR de asistencia.</h1>
          <p className="hero-text">
            Esta vista esta pensada para el asistente. Aqui la persona diligencia sus datos y queda
            registrada para el evento.
          </p>
        </div>

        <div className="public-status">
          <span className={`status-pill ${backendStatus === 'online' ? 'online' : 'alert'}`}>
            {backendStatus === 'online'
              ? 'Registro conectado al backend'
              : 'Registro en modo local temporal'}
          </span>
          <a href="/admin" className="secondary-action">
            Ir al panel admin
          </a>
        </div>
      </header>

      <section className="panel public-panel">
        <div className="panel-heading">
          <p className="eyebrow">Formulario del asistente</p>
          <h2>Completa tu informacion</h2>
          <p className="section-copy">
            Al finalizar se genera tu confirmacion con QR para el ingreso al evento.
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
                required
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
                <option value="press">Prensa</option>
              </select>
            </label>

            <label className="checkbox-field">
              <input
                type="checkbox"
                name="hasFaceConsent"
                checked={form.hasFaceConsent}
                onChange={handleChange}
              />
              <span>Autorizo reconocimiento facial opcional como apoyo al ingreso.</span>
            </label>

            {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}

            <button type="submit" className="submit-button" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando registro...' : 'Registrarme'}
            </button>
          </form>

          <aside className="preview-card">
            <p className="eyebrow">Confirmacion</p>
            {submission ? (
              <>
                <h3>Registro completado</h3>
                <p className="preview-copy">
                  {submission.attendee.fullName}, tu registro quedo guardado correctamente.
                </p>
                <img
                  className="qr-preview"
                  src={submission.qrDataUrl}
                  alt={`QR de ${submission.attendee.fullName}`}
                />
                <div className="preview-meta">
                  <span>ID: {submission.recordId}</span>
                  <span>Estado: {submission.attendee.status}</span>
                  <span>Guarda este QR para el ingreso</span>
                </div>
                <div className="preview-actions">
                  <a
                    className="primary-action download-action"
                    href={submission.qrDataUrl}
                    download={`qr-${submission.attendee.documentId || submission.recordId}.png`}
                  >
                    Descargar QR
                  </a>
                </div>
              </>
            ) : (
              <>
                <h3>Tu QR aparecera aqui</h3>
                <p className="preview-copy">
                  Despues de registrarte, este espacio mostrara tu confirmacion con codigo QR.
                </p>
                <div className="qr-placeholder" aria-hidden="true">
                  <span>QR</span>
                </div>
              </>
            )}
          </aside>
        </div>
      </section>
    </div>
  )
}

export default PublicRegistrationPage
