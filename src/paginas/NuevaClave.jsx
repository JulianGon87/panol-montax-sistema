// Nueva contraseña después de abrir el enlace que llegó por correo (RF02).
import { useState } from 'react'
import { supabase } from '../supabase.js'
import { mensajeError } from '../errores.js'
import { Avisos } from '../comun.jsx'

export default function NuevaClave({ alTerminar }) {
  const [clave, setClave] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState('')

  async function guardar(e) {
    e.preventDefault()
    if (clave.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (clave !== repetir) return setError('Las contraseñas no coinciden.')
    const { error } = await supabase.auth.updateUser({ password: clave })
    if (error) setError(mensajeError(error))
    else alTerminar()
  }

  return (
    <div className="acceso">
      <div className="portada"><p>Pañol Montax</p><p>Crear una nueva contraseña</p></div>
      <form className="formulario" onSubmit={guardar}>
        <div className="campo">
          <label htmlFor="nueva">Nueva contraseña</label>
          <input id="nueva" type="password" autoComplete="new-password" required value={clave}
            onChange={(e) => setClave(e.target.value)} />
          <p className="ayuda">Al menos 8 caracteres.</p>
        </div>
        <div className="campo">
          <label htmlFor="repetir">Repite la contraseña</label>
          <input id="repetir" type="password" autoComplete="new-password" required value={repetir}
            onChange={(e) => setRepetir(e.target.value)} />
        </div>
        <Avisos error={error} />
        <button className="boton principal">Guardar contraseña</button>
      </form>
    </div>
  )
}
