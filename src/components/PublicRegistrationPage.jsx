import { useState } from 'react'
import CedulaScanner from './CedulaScanner'

function PublicRegistrationPage({
  errorMessage,
  form,
  handleChange,
  handleSubmit,
  isSubmitting,
  submission,
  onCedulaFill,
  empresasInvitadas = [],
}) {
  const [showScanner, setShowScanner] = useState(false)

  const handleExtract = (data) => {
    onCedulaFill?.(data)
    setShowScanner(false)
  }
  return (
    <div className="public-shell">
      <header className="public-hero">
        <div>
          <p className="eyebrow">Registro publico del evento</p>
          <h1>Inscribete y recibe tu codigo QR de asistencia.</h1>
          <p className="hero-text">
             Diligencia tus datos y quedarás
            registrado para el evento.
          </p>
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

            {empresasInvitadas.length > 0 ? (
              <>
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

                {form.empresaInvitadaId === '__otra__' ? (
                  <label className="field">
                    <span>Nombre de la otra empresa</span>
                    <input
                      name="organization"
                      value={form.organization}
                      onChange={handleChange}
                      placeholder="Escribe la empresa"
                    />
                  </label>
                ) : null}
              </>
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
                <option value="general">General</option>
                <option value="vip">VIP</option>
                <option value="speaker">Speaker</option>
                <option value="press">Prensa</option>
              </select>
            </label>

            <fieldset className="consent-section">
              <legend>Apoyos opcionales al registro</legend>
              <p className="helper-text">
                Estas opciones son voluntarias. Los datos se tratan conforme a la Ley 1581 de 2012
                (habeas data) y solo se usan para fines del registro al evento.
              </p>

              <div className="consent-item">
                <div>
                  <strong>Escanear cedula para autocompletar</strong>
                  <p className="helper-text">
                    Se lee el codigo de barras del reverso y se rellenan nombre y documento. La
                    imagen no se almacena.
                  </p>
                </div>
                <button
                  type="button"
                  className="ghost-action cedula-trigger"
                  onClick={() => setShowScanner(true)}
                >
                  Escanear cedula
                </button>
              </div>

              <label className="checkbox-field consent-checkbox">
                <input
                  type="checkbox"
                  name="hasFaceConsent"
                  checked={form.hasFaceConsent}
                  onChange={handleChange}
                />
                <span>Autorizo reconocimiento facial opcional como apoyo al ingreso.</span>
              </label>
            </fieldset>

            {errorMessage ? <p className="feedback error">{errorMessage}</p> : null}

            <button type="submit" className="submit-button" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando registro...' : 'Registrarme'}
            </button>
          </form>

          <aside className="preview-card">
            <p className="eyebrow">Confirmacion</p>
            {submission ? (
              <>
                <h3>Registro completado &#10003;</h3>
                <p className="preview-copy">
                  {submission.attendee.fullName}, tu registro quedo guardado. El dia del evento
                  muestra este QR al staff para ingresar, o simplemente di tu numero de documento.
                </p>
                <img
                  className="qr-preview"
                  src={submission.qrDataUrl}
                  alt={`QR de ${submission.attendee.fullName}`}
                />
                <div className="preview-meta">
                  <span>Documento: {submission.attendee.documentId}</span>
                  <span>Estado: {submission.attendee.status}</span>
                  <span>&#128274; Guarda este QR, lo necesitas para ingresar.</span>
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

      {showScanner ? (
        <CedulaScanner onExtract={handleExtract} onClose={() => setShowScanner(false)} />
      ) : null}
    </div>
  )
}

export default PublicRegistrationPage
