import { useState } from 'react'
import CedulaScanner from './CedulaScanner'

function PublicRegistrationPage({
  errorMessage,
  form,
  handleChange,
  handleSurveyChange,
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

  const selectedEmpresa = empresasInvitadas.find(
    (e) => e.id === form.empresaInvitadaId,
  )
  const encuestaActiva = Boolean(selectedEmpresa?.encuestaHabilitada)
  const encuestaObligatoria = Boolean(selectedEmpresa?.encuestaObligatoria)
  const preguntas =
    encuestaActiva && Array.isArray(selectedEmpresa?.encuestaPreguntas)
      ? selectedEmpresa.encuestaPreguntas
      : []
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
            <div className="cedula-shortcut">
              <div>
                <strong>
                  ¿Tienes tu cedula a la mano?{' '}
                  <span className="cedula-optional">(opcional)</span>
                </strong>
                <p className="helper-text">
                  Escanea el codigo de barras del reverso y se llenan automaticamente{' '}
                  <strong>nombres, apellidos y numero de documento</strong>. La imagen no se
                  almacena. Si prefieres, puedes omitir este paso y llenar los datos manualmente.
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

            {preguntas.length > 0 ? (
              <fieldset className="encuesta-section">
                <legend>
                  {encuestaObligatoria
                    ? 'Encuesta (obligatoria)'
                    : 'Encuesta (opcional)'}
                </legend>
                <p className="helper-text">
                  {encuestaObligatoria
                    ? 'Responde estas preguntas para poder continuar con el registro.'
                    : 'Ayudanos respondiendo estas preguntas. Puedes omitirlas si prefieres.'}
                </p>

                {preguntas.map((pregunta) => {
                  const value = form.surveyAnswers?.[pregunta.id] || ''
                  const required = encuestaObligatoria

                  if (pregunta.tipo === 'opcion') {
                    return (
                      <label key={pregunta.id} className="field">
                        <span>{pregunta.label}</span>
                        <select
                          value={value}
                          onChange={(event) =>
                            handleSurveyChange?.(pregunta.id, event.target.value)
                          }
                          required={required}
                        >
                          <option value="">Selecciona...</option>
                          {(pregunta.opciones || []).map((op) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>
                      </label>
                    )
                  }

                  if (pregunta.tipo === 'si-no') {
                    return (
                      <label key={pregunta.id} className="field">
                        <span>{pregunta.label}</span>
                        <select
                          value={value}
                          onChange={(event) =>
                            handleSurveyChange?.(pregunta.id, event.target.value)
                          }
                          required={required}
                        >
                          <option value="">Selecciona...</option>
                          <option value="si">Si</option>
                          <option value="no">No</option>
                        </select>
                      </label>
                    )
                  }

                  return (
                    <label key={pregunta.id} className="field">
                      <span>{pregunta.label}</span>
                      <input
                        type="text"
                        value={value}
                        onChange={(event) =>
                          handleSurveyChange?.(pregunta.id, event.target.value)
                        }
                        required={required}
                      />
                    </label>
                  )
                })}
              </fieldset>
            ) : null}

            <label className="checkbox-field consent-inline">
              <input
                type="checkbox"
                name="hasFaceConsent"
                checked={form.hasFaceConsent}
                onChange={handleChange}
              />
              <span>
                Autorizo reconocimiento facial opcional como apoyo al ingreso.
                <small className="helper-text">
                  Voluntario. Datos tratados conforme a la Ley 1581 de 2012 (habeas data).
                </small>
              </span>
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
