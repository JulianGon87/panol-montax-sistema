// Inicio de sesión con correo y contraseña (RF01) y pedido del enlace para recuperar la contraseña (RF02).
import { useState } from 'react'
import { supabase } from '../supabase.js'
import { mensajeError } from '../errores.js'
import { Avisos } from '../comun.jsx'

export default function Login() {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [recuperar, setRecuperar] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function ingresar(e) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave })
    setEnviando(false)
    if (error) setError(mensajeError(error))
  }

  // Supabase envía un correo con un enlace que vuelve a esta aplicación para crear la nueva contraseña.
  async function pedirEnlace(e) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(correo.trim(), { redirectTo: location.origin })
    setEnviando(false)
    if (error) setError(mensajeError(error))
    else setExito('Si el correo está registrado, te llegará un enlace para crear una nueva contraseña.')
  }

  function cambiarModo() {
    setRecuperar(!recuperar)
    setError('')
    setExito('')
  }

  return (
    <div className="acceso">
      <div className="portada">
        <p>Pañol Montax</p>
        <p>{recuperar ? 'Recuperar contraseña' : 'Control de inventario y reposición'}</p>
      </div>
      <form className="formulario" onSubmit={recuperar ? pedirEnlace : ingresar}>
        <div className="campo">
          <label htmlFor="correo">Correo</label>
          <input id="correo" type="email" autoComplete="email" required value={correo}
            onChange={(e) => setCorreo(e.target.value)} />
        </div>
        {!recuperar && (
          <div className="campo">
            <label htmlFor="clave">Contraseña</label>
            <input id="clave" type="password" autoComplete="current-password" required value={clave}
              onChange={(e) => setClave(e.target.value)} />
          </div>
        )}
        <Avisos error={error} exito={exito} />
        <button className="boton principal" disabled={enviando}>{recuperar ? 'Enviar enlace' : 'Ingresar'}</button>
        <button type="button" className="enlace" onClick={cambiarModo}>
          {recuperar ? 'Volver a iniciar sesión' : '¿Olvidaste tu contraseña?'}
        </button>
      </form>
      <p className="pie">Montax · Arriendo y venta de andamios y encofrados</p>
    </div>
  )
}
