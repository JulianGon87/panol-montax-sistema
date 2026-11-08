// Gestión de usuarios (RF04): Gerencia crea cuentas, edita nombre, teléfono y perfil, y activa o desactiva.
// Crear una cuenta necesita la clave de servicio de Supabase, que no puede ir en el navegador; por eso la
// crea la Edge Function crear-usuario, que primero revisa que quien la llama sea Gerencia. Cambiar el perfil
// o desactivar una cuenta lo protege además el trigger usuario_protegido de la base.
import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { mensajeError } from '../errores.js'
import { Icono } from '../iconos.jsx'
import { Avisos } from '../comun.jsx'

const PERFILES = { bodega: 'Bodega', gerencia: 'Gerencia' }

export default function Usuarios({ usuario: yo }) {
  const [usuarios, setUsuarios] = useState([])
  const [roles, setRoles] = useState([])
  const [edicion, setEdicion] = useState(null) // null: sin formulario; { nuevo: true }: cuenta nueva; una fila: edición
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cargar = () =>
    supabase.from('usuario').select('id, nombre, telefono, activo, rol_id').order('nombre')
      .then(({ data }) => setUsuarios(data ?? []))

  useEffect(() => {
    cargar()
    supabase.from('rol').select('id, nombre').order('id').then(({ data }) => setRoles(data ?? []))
  }, [])

  const nombreRol = (id) => PERFILES[roles.find((r) => r.id === id)?.nombre] ?? ''
  const cambiar = (campo, valor) => setEdicion({ ...edicion, [campo]: valor })

  function avisar(err, ok) {
    setError(err)
    setExito(ok)
  }

  async function guardar(e) {
    e.preventDefault()
    avisar('', '')
    setEnviando(true)
    const datos = { nombre: edicion.nombre.trim(), telefono: edicion.telefono?.trim() || null, rol_id: Number(edicion.rol_id) }
    if (edicion.nuevo) {
      const { error } = await supabase.functions.invoke('crear-usuario', {
        body: { ...datos, correo: edicion.correo.trim(), clave: edicion.clave },
      })
      if (error) {
        const respuesta = await error.context?.json?.().catch(() => null) // mensaje que devolvió la función
        setEnviando(false)
        return avisar(respuesta?.error ?? mensajeError(error), '')
      }
    } else {
      const { error } = await supabase.from('usuario').update(datos).eq('id', edicion.id)
      if (error) {
        setEnviando(false)
        return avisar(mensajeError(error), '')
      }
    }
    setEnviando(false)
    avisar('', edicion.nuevo ? `Cuenta creada para ${datos.nombre}.` : 'Cambios guardados.')
    setEdicion(null)
    cargar()
  }

  async function cambiarEstado(u) {
    avisar('', '')
    const { error } = await supabase.from('usuario').update({ activo: !u.activo }).eq('id', u.id)
    if (error) return avisar(mensajeError(error), '')
    avisar('', `${u.nombre}: cuenta ${u.activo ? 'desactivada' : 'activada'}.`)
    cargar()
  }

  const esYo = edicion && edicion.id === yo.id

  return (
    <>
      <Avisos error={error} exito={exito} />
      {edicion ? (
        <form className="formulario ficha" onSubmit={guardar}>
          <h2>{edicion.nuevo ? 'Nueva cuenta' : 'Editar cuenta'}</h2>
          <div className="campo">
            <label htmlFor="u-nombre">Nombre</label>
            <input id="u-nombre" required maxLength={60} value={edicion.nombre ?? ''} onChange={(e) => cambiar('nombre', e.target.value)} />
          </div>
          {edicion.nuevo && (
            <>
              <div className="campo">
                <label htmlFor="u-correo">Correo</label>
                <input id="u-correo" type="email" required value={edicion.correo ?? ''} onChange={(e) => cambiar('correo', e.target.value)} />
              </div>
              <div className="campo">
                <label htmlFor="u-clave">Contraseña inicial</label>
                <input id="u-clave" type="text" required minLength={8} autoComplete="off" value={edicion.clave ?? ''}
                  onChange={(e) => cambiar('clave', e.target.value)} />
                <p className="ayuda">Al menos 8 caracteres. La persona puede cambiarla en Mi perfil.</p>
              </div>
            </>
          )}
          <div className="campo">
            <label htmlFor="u-telefono">Teléfono (opcional)</label>
            <input id="u-telefono" type="tel" maxLength={20} value={edicion.telefono ?? ''} onChange={(e) => cambiar('telefono', e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor="u-perfil">Perfil</label>
            <select id="u-perfil" required disabled={esYo} value={edicion.rol_id ?? ''} onChange={(e) => cambiar('rol_id', e.target.value)}>
              <option value="">Elige un perfil</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{PERFILES[r.nombre]}</option>)}
            </select>
            {esYo && <p className="ayuda">No puedes cambiar tu propio perfil.</p>}
          </div>
          <div className="fila-botones">
            <button type="button" className="boton secundario" onClick={() => setEdicion(null)}>Cancelar</button>
            <button className="boton principal" disabled={enviando}>Guardar</button>
          </div>
        </form>
      ) : (
        <button type="button" className="boton principal" onClick={() => setEdicion({ nuevo: true })}>
          <Icono nombre="agregar" />Nueva cuenta
        </button>
      )}
      <ul className="lista">
        {usuarios.map((u) => (
          <li key={u.id}>
            <div>
              <p className="nombre">{u.nombre}{u.id === yo.id ? ' (tú)' : ''}</p>
              <p className="detalle">{nombreRol(u.rol_id)}{u.telefono ? ' · ' + u.telefono : ''}</p>
            </div>
            <div className="derecha">
              <span className={'estado ' + (u.activo ? 'ok' : 'neutro')}>{u.activo ? 'Activa' : 'Inactiva'}</span>
              <div className="botones-fila">
                <button type="button" className="boton compacto secundario" onClick={() => setEdicion(u)}>Editar</button>
                {u.id !== yo.id && (
                  <button type="button" className={'boton compacto ' + (u.activo ? 'peligro' : 'secundario')}
                    onClick={() => cambiarEstado(u)}>{u.activo ? 'Desactivar' : 'Activar'}</button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
