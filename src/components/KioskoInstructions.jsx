function KioskoInstructions() {
  return (
    <section className="scanner-instructions kiosko-instructions">
      <div className="panel-heading">
        <p className="eyebrow">Como registrarte</p>
        <h2>Sigue estos 3 pasos</h2>
      </div>

      <div className="instructions-visual" aria-hidden="true">
        <div className="scan-animation">
          <div className="scanner-viewfinder">
            <span className="vf-corner vf-tl" />
            <span className="vf-corner vf-tr" />
            <span className="vf-corner vf-bl" />
            <span className="vf-corner vf-br" />
            <div className="poster-qr">
              <span className="qr-corner qr-corner-tl" />
              <span className="qr-corner qr-corner-tr" />
              <span className="qr-corner qr-corner-bl" />
              <span className="qr-dots" />
            </div>
          </div>
          <div className="user-phone-moving">
            <div className="user-phone-speaker" />
            <div className="user-phone-screen">
              <div className="phone-form-lines">
                <span className="form-line" />
                <span className="form-line" />
                <span className="form-line short" />
              </div>
            </div>
            <div className="user-phone-home" />
          </div>
          <div className="scan-beam" />
          <div className="scan-check">&#10003;</div>
        </div>
      </div>

      <ol className="instructions-steps">
        <li className="instruction-step">
          <span className="step-number">1</span>
          <div>
            <strong>Abre la camara</strong>
            <p>Desde tu celular, abre la camara y apunta al QR grande.</p>
          </div>
        </li>
        <li className="instruction-step">
          <span className="step-number">2</span>
          <div>
            <strong>Llena tus datos</strong>
            <p>Se abre el formulario. Completa nombre, documento y datos de contacto.</p>
          </div>
        </li>
        <li className="instruction-step">
          <span className="step-number">3</span>
          <div>
            <strong>Recibe tu QR</strong>
            <p>Guardalo o muestralo al staff para ingresar al evento.</p>
          </div>
        </li>
      </ol>

      <p className="instructions-hint">
        Si tienes dificultad con el celular, acercate al staff y te ayudamos a registrarte.
      </p>
    </section>
  )
}

export default KioskoInstructions
