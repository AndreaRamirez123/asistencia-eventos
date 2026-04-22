function ScannerInstructions() {
  return (
    <section className="scanner-instructions">
      <div className="panel-heading">
        <p className="eyebrow">Como escanear</p>
        <h2>Sigue estos 3 pasos</h2>
      </div>

      <div className="instructions-visual" aria-hidden="true">
        <div className="scan-animation">
          <div className="scanner-viewfinder">
            <span className="vf-corner vf-tl" />
            <span className="vf-corner vf-tr" />
            <span className="vf-corner vf-bl" />
            <span className="vf-corner vf-br" />
          </div>
          <div className="user-phone-moving">
            <div className="user-phone-speaker" />
            <div className="user-phone-screen">
              <div className="qr-on-screen">
                <span className="qr-corner qr-corner-tl" />
                <span className="qr-corner qr-corner-tr" />
                <span className="qr-corner qr-corner-bl" />
                <span className="qr-dots" />
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
            <strong>Muestra tu QR</strong>
            <p>Abre tu codigo QR en el celular o entrega el impreso.</p>
          </div>
        </li>
        <li className="instruction-step">
          <span className="step-number">2</span>
          <div>
            <strong>Apunta a la camara</strong>
            <p>Mantenlo quieto un segundo dentro del marco rojo hasta que se detecte.</p>
          </div>
        </li>
        <li className="instruction-step">
          <span className="step-number">3</span>
          <div>
            <strong>Espera la confirmacion</strong>
            <p>Si sale verde &#10003; ya ingresaste. Si no, habla con el staff.</p>
          </div>
        </li>
      </ol>

      <p className="instructions-hint">
        Si no tienes QR, el staff puede validarte con tu numero de documento.
      </p>
    </section>
  )
}

export default ScannerInstructions
