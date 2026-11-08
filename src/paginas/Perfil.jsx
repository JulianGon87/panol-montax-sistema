// Mi perfil (RF03): nombre y teléfono, cambio de contraseña indicando la actual, y cierre de sesión (RF01).
import { useState } from 'react'
import { supabase } from '../supabase.js'
import { mensajeError } from '../errores.js'
import { Avisos } from '../comun.jsx'

export default function Perfil({ usuario, sesion, recargarUsuario }) {
  const [nombre, setNombre] = useState(usuario.nombre)
  const [telefono, setTelefono] = useState(usuario.telefono ?? '')
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  function avisar(err, ok) {
    setError(err)
    setExito(ok)
  }

  // La política RLS editar_perfil deja a cada usuario modificar solo su propia fila.
  async function guardarDatos(e) {
    e.preventDefault()
    const { error } = await supabase.from('usuario')
      .update({ nombre: nombre.trim(), telefono: telefono.trim() || null }).eq('id', usuario.id)
    if (error) return avisar(mensajeError(error), '')
    avisar('', 'Datos guardados.')
    recargarUsuario()
  }

  async function cambiarClave(e) {
    e.preventDefault()
    if (nueva.length < 8) return avisar('La nueva contraseña debe tener al menos 8 caracteres.', '')
    if (nueva !== repetir) return avisar('Las contraseñas nuevas no coinciden.', '')
    // La contraseña actual se comprueba iniciando sesión con ella.
    const { error: errorActual } = await supabase.auth.signInWithPassword({ email: sesion.user.email, password: actual })
    if (errorActual) return avisar('La contraseña actual no es correcta.', '')
    const { error } = await supabase.auth.updateUser({ password: nueva })
    if (error) return avisar(mensajeError(error), '')
    avisar('', 'Contraseña cambiada.')
    setActual('')
    setNueva('')
    setRepetir('')
  }

  return (
    <>
      <p className="nota">{sesion.user.email} · Perfil {usuario.rol.nombre === 'bodega' ? 'Bodega' : 'Gerencia'}</p>
      <Avisos error={error} exito={exito} />
      <form className="formulario ficha" onSubmit={guardarDatos}>
        <h2>Mis datos</h2>
        <div className="campo">
          <label htmlFor="nombre">Nombre</label>
          <input id="nombre" required maxLength={60} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="telefono">Teléfono (opcional)</label>
          <input id="telefono" type="tel" maxLength={20} value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </div>
        <button className="boton principal">Guardar datos</button>
      </form>
      <form className="formulario ficha" onSubmit={cambiarClave}>
        <h2>Cambiar contraseña</h2>
        <div className="campo">
          <label htmlFor="actual">Contraseña actual</label>
          <input id="actual" type="password" autoComplete="current-password" required value={actual}
            onChange={(e) => setActual(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="nueva">Nueva contraseña</label>
          <input id="nueva" type="password" autoComplete="new-password" required value={nueva}
            onChange={(e) => setNueva(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="repetir">Repite la nueva contraseña</label>
          <input id="repetir" type="password" autoComplete="new-password" required value={repetir}
            onChange={(e) => setRepetir(e.target.value)} />
        </div>
        <button className="boton secundario">Cambiar contraseña</button>
      </form>
      <button className="boton peligro" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
    </>
  )
}
