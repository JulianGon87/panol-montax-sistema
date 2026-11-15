// Solicitudes de compra (RF09 y RF10). Bodega crea la solicitud con los productos sin stock o por reponer;
// Gerencia la aprueba o la rechaza con un comentario y la marca como comprada. Ambos perfiles ven el estado.
// La solicitud y su detalle se guardan con la función crear_solicitud de la base, en una sola transacción:
// la cantidad sugerida la calcula la base y quién puede crear o resolver lo deciden las políticas RLS.
import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { mensajeError } from '../errores.js'
import { Icono } from '../iconos.jsx'
import { Avisos, Estado, plural } from '../comun.jsx'

const fechaHora = (f) => new Date(f).toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short' })

export default function Solicitudes({ usuario }) {
  const [vista, setVista] = useState({ pantalla: 'lista' }) // lista, nueva o detalle (con el id de la solicitud)
  const volver = () => setVista({ pantalla: 'lista' })
  const esGerencia = usuario.rol.nombre === 'gerencia'

  if (vista.pantalla === 'nueva') {
    return <Nueva volver={volver} alCrear={(id) => setVista({ pantalla: 'detalle', id })} />
  }
  if (vista.pantalla === 'detalle') {
    return <Detalle id={vista.id} usuario={usuario} esGerencia={esGerencia} volver={volver} />
  }
  return <Lista esGerencia={esGerencia} abrir={(id) => setVista({ pantalla: 'detalle', id })}
    nueva={() => setVista({ pantalla: 'nueva' })} />
}

function Lista({ esGerencia, abrir, nueva }) {
  const [solicitudes, setSolicitudes] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('solicitud_compra').select('id, fecha_creacion, estado, detalle_solicitud(count)')
      .order('id', { ascending: false })
      .then(({ data, error }) => (error ? setError(mensajeError(error)) : setSolicitudes(data)))
  }, [])

  return (
    <>
      {!esGerencia && (
        <button type="button" className="boton principal" onClick={nueva}><Icono nombre="agregar" />Nueva solicitud</button>
      )}
      <Avisos error={error} />
      {solicitudes?.length === 0 && <p className="nota">Todavía no hay solicitudes de compra.</p>}
      {solicitudes?.length > 0 && (
        <ul className="lista">
          {solicitudes.map((s) => (
            <li key={s.id}>
              <div>
                <p className="nombre">Solicitud N.º {s.id}</p>
                <p className="detalle">{fechaHora(s.fecha_creacion)}, {plural(s.detalle_solicitud[0].count, 'producto', 'productos')}</p>
              </div>
              <div className="derecha">
                <Estado valor={s.estado} />
                <button type="button" className="boton secundario compacto" onClick={() => abrir(s.id)}>Ver</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

// RF09: los productos sin stock o por reponer vienen con la cantidad que sugiere la base (stock mínimo y
// consumo de 30 días). Bodega puede cambiarla o dejar un producto fuera antes de enviar.
function Nueva({ volver, alCrear }) {
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    supabase.from('stock_actual')
      .select('producto_id, nombre, unidad, stock, stock_minimo, consumo_30d, sugerido_compra')
      .in('estado', ['SIN STOCK', 'REPONER']).order('nombre')
      .then(({ data, error }) => {
        if (error) return setError(mensajeError(error))
        // Un producto con sugerido 0 (sin stock mínimo definido) empieza sin marcar.
        setFilas(data.map((p) => ({ ...p, incluir: p.sugerido_compra > 0, cantidad: Math.max(p.sugerido_compra, 1) })))
      })
  }, [])

  const cambiar = (id, campos) => setFilas(filas.map((f) => (f.producto_id === id ? { ...f, ...campos } : f)))
  const elegidas = (filas ?? []).filter((f) => f.incluir)

  async function enviar(e) {
    e.preventDefault()
    setError('')
    setEnviando(true)
    const { data, error } = await supabase.rpc('crear_solicitud', {
      p_productos: elegidas.map((f) => ({ producto_id: f.producto_id, cantidad: f.cantidad })),
    })
    setEnviando(false)
    if (error) return setError(mensajeError(error))
    alCrear(data)
  }

  return (
    <form className="formulario" onSubmit={enviar}>
      <button type="button" className="boton secundario compacto" onClick={volver}>Volver a solicitudes</button>
      <p className="nota">Las cantidades se sugieren según el stock mínimo y el consumo de los últimos 30 días.
        Puedes cambiarlas o dejar fuera un producto antes de enviar.</p>
      {filas?.length === 0 && <p className="nota">No hay productos sin stock ni por reponer.</p>}
      {filas?.length > 0 && (
        <ul className="lista pedido">
          {filas.map((f) => (
            <li key={f.producto_id}>
              <div>
                <label className="nombre">
                  <input type="checkbox" checked={f.incluir} onChange={(e) => cambiar(f.producto_id, { incluir: e.target.checked })} />
                  {' '}{f.nombre}
                </label>
                <p className="detalle">Quedan {f.stock}, mínimo {f.stock_minimo}, consumo 30 días: {f.consumo_30d}</p>
              </div>
              <input type="number" inputMode="numeric" min="1" required disabled={!f.incluir} value={f.cantidad}
                aria-label={`Cantidad a pedir de ${f.nombre}`}
                onChange={(e) => cambiar(f.producto_id, { cantidad: Number(e.target.value) })} />
            </li>
          ))}
        </ul>
      )}
      <Avisos error={error} />
      <button className="boton principal" disabled={enviando || elegidas.length === 0}>Enviar a Gerencia</button>
    </form>
  )
}

const ETIQUETAS = { pendiente: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada', comprada: 'Comprada' }

// RF10: Gerencia resuelve una solicitud pendiente y marca como comprada la aprobada. El update lleva el estado
// esperado en el filtro: si otra persona ya la resolvió, no cambia nada y se avisa.
function Detalle({ id, usuario, esGerencia, volver }) {
  const [s, setS] = useState(undefined)
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  const cargar = () =>
    supabase.from('solicitud_compra')
      .select(`id, fecha_creacion, estado, comentario,
        creada:usuario!solicitud_compra_creada_por_fkey(nombre),
        resuelve:usuario!solicitud_compra_resuelta_por_fkey(nombre),
        detalle_solicitud(cantidad_sugerida, cantidad_solicitada, producto(nombre, unidad))`)
      .eq('id', id).single()
      .then(({ data, error }) => (error ? setError(mensajeError(error)) : setS(data)))

  useEffect(() => { cargar() }, [id])

  async function cambiar(desde, cambios) {
    setError('')
    setTrabajando(true)
    const { data, error } = await supabase.from('solicitud_compra').update(cambios)
      .eq('id', id).eq('estado', desde).select('id')
    setTrabajando(false)
    if (error) return setError(mensajeError(error))
    if (data.length === 0) setError('La solicitud ya cambió de estado. Se actualizó la pantalla.')
    setComentario('')
    cargar()
  }

  function resolver(estado) {
    if (estado === 'rechazada' && !comentario.trim()) return setError('Escribe el motivo del rechazo.')
    cambiar('pendiente', { estado, comentario: comentario.trim() || null, resuelta_por: usuario.id })
  }

  if (!s) {
    return <><button type="button" className="boton secundario compacto" onClick={volver}>Volver a solicitudes</button><Avisos error={error} /></>
  }
  const pasos = s.estado === 'rechazada' ? ['pendiente', 'rechazada'] : ['pendiente', 'aprobada', 'comprada']
  const actual = pasos.indexOf(s.estado)

  return (
    <>
      <button type="button" className="boton secundario compacto" onClick={volver}>Volver a solicitudes</button>
      <h2>Solicitud N.º {s.id}</h2>
      <ul className="flujo" aria-label="Estado de la solicitud">
        {pasos.map((p, i) => <li key={p} className={i < actual ? 'hecho' : i === actual ? 'actual' : ''}>{ETIQUETAS[p]}</li>)}
      </ul>
      <div className="ficha">
        <p><strong>Creada por</strong> {s.creada?.nombre ?? 'Bodega'}</p>
        <p className="detalle">{fechaHora(s.fecha_creacion)}</p>
        {s.estado !== 'pendiente' && (
          <p><strong>{s.estado === 'rechazada' ? 'Rechazada por' : 'Aprobada por'}</strong> {s.resuelve?.nombre ?? 'Gerencia'}</p>
        )}
        {s.comentario && <p className="detalle">Comentario: {s.comentario}</p>}
      </div>
      <section className="seccion">
        <h2>Productos ({s.detalle_solicitud.length})</h2>
        <ul className="lista">
          {s.detalle_solicitud.map((d) => (
            <li key={d.producto.nombre}>
              <div>
                <p className="nombre">{d.producto.nombre}</p>
                <p className="detalle">Sugerido {d.cantidad_sugerida}{d.cantidad_solicitada !== d.cantidad_sugerida ? ', Bodega pidió otra cantidad' : ''}</p>
              </div>
              <p className="cantidad">{d.cantidad_solicitada} <small>{d.producto.unidad}</small></p>
            </li>
          ))}
        </ul>
      </section>
      <Avisos error={error} />
      {esGerencia && s.estado === 'pendiente' && (
        <>
          <div className="campo">
            <label htmlFor="comentario">Comentario para Bodega</label>
            <textarea id="comentario" value={comentario} onChange={(e) => setComentario(e.target.value)}
              placeholder="Opcional al aprobar, obligatorio si rechazas" />
          </div>
          <div className="fila-botones">
            <button type="button" className="boton peligro" disabled={trabajando} onClick={() => resolver('rechazada')}>Rechazar</button>
            <button type="button" className="boton principal" disabled={trabajando} onClick={() => resolver('aprobada')}>Aprobar</button>
          </div>
        </>
      )}
      {esGerencia && s.estado === 'aprobada' && (
        <button type="button" className="boton principal" disabled={trabajando}
          onClick={() => cambiar('aprobada', { estado: 'comprada' })}>Marcar como comprada</button>
      )}
      {!esGerencia && (s.estado === 'aprobada' || s.estado === 'comprada') && (
        <p className="nota">Cuando llegue la compra, registra la recepción en <a href="#/entrada">Entrada</a> y asóciala a esta solicitud.</p>
      )}
    </>
  )
}
