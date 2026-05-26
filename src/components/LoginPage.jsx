import { useState } from 'react'
import { loginWithEmail, loginWithGoogle, resetPassword } from '../auth'

const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const user = await loginWithEmail(email, password)
      const target = user.role === 'staff' ? '/scanner' : '/admin'
      window.location.href = target
    } catch (error) {
      const code = error.code || ''
      let message = error.message || 'No fue posible iniciar sesion.'

      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        message = 'Credenciales invalidas. Verifica el correo y la contrasena.'
      } else if (code === 'auth/user-not-found') {
        message = 'No existe una cuenta con ese correo.'
      } else if (code === 'auth/too-many-requests') {
        message = 'Demasiados intentos fallidos. Intenta de nuevo en unos minutos.'
      } else if (code === 'auth/invalid-email') {
        message = 'El correo electronico no tiene un formato valido.'
      }

      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)
    setErrorMessage('')
    try {
      const user = await loginWithGoogle()
      if (!user) return // iOS: redirect en progreso, el navegador navega a Google
      const target = user.role === 'staff' ? '/scanner' : '/admin'
      window.location.href = target
    } catch (error) {
      const code = error.code || ''
      let message = error.message || 'No fue posible iniciar sesion con Google.'
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        message = 'Se cerro la ventana de Google antes de completar el inicio de sesion.'
      } else if (code === 'auth/popup-blocked') {
        message = 'El navegador bloqueo el popup de Google. En el celular ve a Configuracion del navegador y permite ventanas emergentes para este sitio. O inicia sesion con correo y contrasena.'
      }
      setErrorMessage(message)
      setIsGoogleLoading(false)
    }
  }

  const handleReset = async () => {
    if (!email) {
      setErrorMessage('Escribe tu correo arriba y luego haz clic en "Recuperar contraseña".')
      return
    }
    setIsResetting(true)
    setErrorMessage('')
    try {
      await resetPassword(email)
      setResetSent(true)
    } catch (error) {
      const code = error.code || ''
      if (code === 'auth/user-not-found') {
        setErrorMessage('No existe una cuenta con ese correo.')
      } else if (code === 'auth/invalid-email') {
        setErrorMessage('El correo no tiene un formato valido.')
      } else {
        setErrorMessage('No fue posible enviar el correo. Intenta de nuevo.')
      }
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="public-shell">
      <header className="public-hero">
        <div>
          <p className="eyebrow">Acceso restringido</p>
          <h1>Inicia sesion para operar el evento</h1>
          <p className="hero-text">
            Esta vista es solo para el equipo administrativo y staff de ingreso. Los asistentes no
            necesitan iniciar sesion aqui.
          </p>
        </div>
      </header>

      <section className="panel public-panel">
        <div className="panel-heading">
          <p className="eyebrow">Credenciales</p>
          <h2>Ingreso al panel</h2>
          <p className="section-copy">
            Usa el correo y contrasena asignados por el administrador del evento.
          </p>
        </div>

        <form className="attendee-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Correo electronico</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="correo@cun.edu.co"
              autoComplete="username"
              required
            />
          </label>

          <label className="field">
            <span>Contrasena</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="********"
              autoComplete="current-password"
              required
            />
          </label>

          <button type="submit" className="submit-button" disabled={isSubmitting}>
            {isSubmitting ? 'Validando...' : 'Iniciar sesion'}
          </button>
        </form>

        {errorMessage ? <p className="feedback error" style={{ marginTop: '8px' }}>{errorMessage}</p> : null}
        {resetSent ? (
          <p className="feedback success" style={{ marginTop: '8px' }}>
            Correo enviado a <strong>{email}</strong>. Revisa tu bandeja de entrada (y spam).
          </p>
        ) : null}

        <div className="login-divider"><span>o</span></div>

        <button
          type="button"
          className="google-login-btn"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading}
        >
          {isGoogleLoading ? (
            isIOS ? 'Redirigiendo a Google...' : 'Abriendo Google...'
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continuar con Google
            </>
          )}
        </button>

        <button
          type="button"
          className="ghost-action"
          style={{ marginTop: '8px', width: '100%' }}
          onClick={handleReset}
          disabled={isResetting}
        >
          {isResetting ? 'Enviando...' : '¿Olvidaste tu contraseña? Recuperar por correo'}
        </button>
      </section>
    </div>
  )
}

export default LoginPage
