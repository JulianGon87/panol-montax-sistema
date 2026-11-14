// Pañol Montax: sesión, datos del usuario conectado, menú según su perfil (RF01) y navegación.
// La navegación usa el "hash" de la dirección (#/stock), así funcionan el botón Atrás y los enlaces.
// Que el menú muestre solo las opciones del perfil ordena la interfaz; los permisos reales los aplica
// la base de datos con sus políticas RLS, aunque alguien escriba la ruta a mano.
import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { Icono } from './iconos.jsx'
import Login from './paginas/Login.jsx'
import NuevaClave from './paginas/NuevaClave.jsx'
import Inicio from './paginas/Inicio.jsx'
import Salida from './paginas/Salida.jsx'
import Entrada from './paginas/Entrada.jsx'
import Stock from './paginas/Stock.jsx'
import Solicitudes from './paginas/Solicitudes.jsx'
import Catalogo from './paginas/Catalogo.jsx'
import Usuarios from './paginas/Usuarios.jsx'
import Perfil from './paginas/Perfil.jsx'

// Pantallas de cada perfil: ruta, título, ícono y componente.
const MENU = {
  bodega: [
    ['inicio', 'Inicio', 'inicio', Inicio],
    ['salida', 'Salida', 'salida', Salida],
    ['entrada', 'Entrada', 'entrada', Entrada],
    ['stock', 'Stock', 'stock', Stock],
    ['solicitudes', 'Solicitudes', 'solicitudes', Solicitudes],
    ['perfil', 'Mi perfil', 'perfil', Perfil],
  ],
  gerencia: [
    ['inicio', 'Inicio', 'inicio', Inicio],
    ['stock', 'Stock', 'stock', Stock],
    ['solicitudes', 'Solicitudes', 'solicitudes', Solicitudes],
    ['catalogo', 'Catálogo', 'catalogo', Catalogo],
    ['usuarios', 'Usuarios', 'usuarios', Usuarios],
    ['perfil', 'Mi perfil', 'perfil', Perfil],
  ],
}

const leerRuta = () => (location.hash.startsWith('#/') ? location.hash.slice(2) : 'inicio')

export default function App() {
  const [sesion, setSesion] = useState(undefined)      // undefined: cargando; null: sin sesión
  const [usuario, setUsuario] = useState(undefined)    // fila de la tabla usuario, con su perfil
  const [ruta, setRuta] = useState(leerRuta())
  const [recuperando, setRecuperando] = useState(false) // llegó desde el enlace para recuperar la contraseña (RF02)
  const [version, setVersion] = useState(0)             // sube para volver a leer los datos del usuario

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session))
    const { data } = supabase.auth.onAuthStateChange((evento, nueva) => {
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true)
      setSesion(nueva)
    })
    const alCambiarRuta = () => setRuta(leerRuta())
    window.addEventListener('hashchange', alCambiarRuta)
    return () => {
      data.subscription.unsubscribe()
      window.removeEventListener('hashchange', alCambiarRuta)
    }
  }, [])

  const idUsuario = sesion?.user.id
  useEffect(() => {
    if (!idUsuario) return setUsuario(undefined)
    supabase.from('usuario').select('id, nombre, telefono, activo, rol(nombre)').eq('id', idUsuario).single()
      .then(({ data }) => setUsuario(data ?? null))
  }, [idUsuario, version])

  if (sesion === undefined) return <p className="cargando">Cargando…</p>
  if (!sesion) return <Login />
  if (recuperando) return <NuevaClave alTerminar={() => { setRecuperando(false); location.hash = '#/inicio' }} />
  if (usuario === undefined) return <p className="cargando">Cargando…</p>
  if (!usuario || !usuario.activo) {
    return (
      <div className="acceso">
        <div className="portada"><p>Pañol Montax</p><p>Cuenta sin activar</p></div>
        <div className="formulario">
          <p>Tu cuenta está desactivada o aún no tiene perfil. Pide a la Gerencia que la active.</p>
          <button className="boton secundario" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
        </div>
      </div>
    )
  }

  const menu = MENU[usuario.rol.nombre]
  const actual = menu.find(([r]) => r === ruta) ?? menu[0]
  const [rutaActual, titulo, , Pagina] = actual
  const iniciales = usuario.nombre.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

  return (
    <div className="app">
      <header className="barra">
        <span className="marca">Pañol Montax</span>
        <h1>{titulo}</h1>
        <a className="iniciales" href="#/perfil" aria-label="Mi perfil">{iniciales}</a>
      </header>
      <nav className="nav" aria-label="Navegación principal">
        {menu.map(([r, texto, icono]) => (
          <a key={r} href={'#/' + r} className={r === rutaActual ? 'activo' : ''}>
            <Icono nombre={icono} /><span>{texto}</span>
          </a>
        ))}
      </nav>
      <main className="contenido">
        <Pagina key={rutaActual} usuario={usuario} sesion={sesion} recargarUsuario={() => setVersion((v) => v + 1)} />
      </main>
    </div>
  )
}
