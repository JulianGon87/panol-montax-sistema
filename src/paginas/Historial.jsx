// Historial de movimientos (RF12): ambos perfiles lo consultan con filtros de fecha, tipo, producto, área y
// trabajador. Gerencia puede anular un movimiento indicando el motivo: no se borra, queda marcado con el motivo,
// quién lo anuló y cuándo, y deja de contar para el stock. Las políticas RLS y los permisos por columna de la
// base impiden que otro perfil anule o cambie algo más.
import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { mensajeError } from '../errores.js'
import { Avisos, plural } from '../comun.jsx'

const POR_PAGINA = 50
const TIPOS = { entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste de conteo' }
const cuando = (f) => new Date(f).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })

export default function Historial({ usuario }) {
  const esGerencia = usuario.rol.nombre === 'gerencia'
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', tipo: '', producto: '', area: '', trabajador: '' })
  const [areas, setAreas] = useState([])
  const [trabajadores, setTrabajadores] = useState([])
  const [filas, setFilas] = useState(null)
  const [total, setTotal] = useState(0)
  const [anulando, setAnulando] = useState(null) // id del movimiento que se está anulando
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')

  useEffect(() => {
    supabase.from('area').select('id, nombre').order('nombre').then(({ data }) => setAreas(data ?? []))
    supabase.from('trabajador').select('id, nombre').order('nombre').then(({ data }) => setTrabajadores(data ?? []))
  }, [])

  // Una página de movimientos con los filtros elegidos. El rango de fechas se toma en la hora del usuario.
  function pagina(desdeFila) {
    let q = supabase.from('movimiento')
      .select(`id, tipo, cantidad, fecha, motivo_anulacion, fecha_anulacion, anulado_por,
        producto!inner(nombre), area(nombre), trabajador(nombre),
        registro:usuario!movimiento_usuario_id_fkey(nombre)`, { count: 'exact' })
      .order('fecha', { ascending: false }).order('id', { ascending: false })
      .range(desdeFila, desdeFila + POR_PAGINA - 1)
    if (filtros.desde) q = q.gte('fecha', new Date(filtros.desde + 'T00:00:00').toISOString())
    if (filtros.hasta) q = q.lte('fecha', new Date(filtros.hasta + 'T23:59:59.999').toISOString())
    if (filtros.tipo) q = q.eq('tipo', filtros.tipo)
    if (filtros.producto) q = q.ilike('producto.nombre', `%${filtros.producto}%`)
    if (filtros.area) q = q.eq('area_id', Number(filtros.area))
    if (filtros.trabajador) q = q.eq('trabajador_id', Number(filtros.trabajador))
    return q
  }

  async function cargar(sumar = false) {
    const { data, error, count } = await pagina(sumar ? filas.length : 0)
    if (error) return setError(mensajeError(error))
    setFilas(sumar ? [...filas, ...data] : data)
    setTotal(count)
  }

  useEffect(() => { cargar() }, [filtros])

  const cambiar = (campo) => (e) => setFiltros({ ...filtros, [campo]: e.target.value })

  async function anular(e) {
    e.preventDefault()
    setError('')
    setExito('')
    const { data, error } = await supabase.from('movimiento')
      .update({ motivo_anulacion: motivo.trim(), anulado_por: usuario.id, fecha_anulacion: new Date().toISOString() })
      .eq('id', anulando).is('anulado_por', null).select('id')
    if (error) {
      return setError(error.message?.includes('Stock insuficiente')
        ? 'No se puede anular: el stock quedaría en negativo.' : mensajeError(error))
    }
    if (data.length === 0) setError('El movimiento ya estaba anulado. Se actualizó la lista.')
    else setExito('Movimiento anulado. El stock ya no lo cuenta.')
    setAnulando(null)
    setMotivo('')
    cargar()
  }

  return (
    <>
      <div className="dos-campos">
        <div className="campo"><label htmlFor="desde">Desde</label><input id="desde" type="date" value={filtros.desde} onChange={cambiar('desde')} /></div>
        <div className="campo"><label htmlFor="hasta">Hasta</label><input id="hasta" type="date" value={filtros.hasta} onChange={cambiar('hasta')} /></div>
      </div>
      <div className="dos-campos">
        <div className="campo"><label htmlFor="tipo">Tipo</label>
          <select id="tipo" value={filtros.tipo} onChange={cambiar('tipo')}>
            <option value="">Todos</option>
            {Object.entries(TIPOS).map(([clave, texto]) => <option key={clave} value={clave}>{texto}</option>)}
          </select></div>
        <div className="campo"><label htmlFor="producto">Producto</label>
          <input id="producto" placeholder="Escribe para buscar" value={filtros.producto} onChange={cambiar('producto')} /></div>
      </div>
      <div className="dos-campos">
        <div className="campo"><label htmlFor="area">Área</label>
          <select id="area" value={filtros.area} onChange={cambiar('area')}>
            <option value="">Todas</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select></div>
        <div className="campo"><label htmlFor="trabajador">Trabajador</label>
          <select id="trabajador" value={filtros.trabajador} onChange={cambiar('trabajador')}>
            <option value="">Todos</option>
            {trabajadores.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select></div>
      </div>
      <Avisos error={error} exito={exito} />
      {filas && <p className="nota">{plural(total, 'movimiento', 'movimientos')}</p>}
      <ul className="lista historial">
        {(filas ?? []).map((m) => {
          const anulado = m.anulado_por !== null
          const signo = m.tipo === 'salida' ? '−' : m.cantidad > 0 ? '+' : ''
          return (
            <li key={m.id} className={anulado ? 'anulado' : ''}>
              <div>
                <p className="nombre">{m.producto.nombre}</p>
                <p className="detalle">
                  {cuando(m.fecha)} · {TIPOS[m.tipo]}
                  {m.trabajador && ` · ${m.trabajador.nombre} (${m.area.nombre})`}
                  {m.registro && ` · registró ${m.registro.nombre}`}
                </p>
                {anulado && <p className="detalle">Anulado el {cuando(m.fecha_anulacion)}: {m.motivo_anulacion}</p>}
              </div>
              <div className="derecha">
                <p className="cantidad">{signo}{Math.abs(m.cantidad).toLocaleString('es-CL')}</p>
                {esGerencia && !anulado && (
                  <button type="button" className="boton peligro compacto" onClick={() => { setAnulando(m.id); setMotivo('') }}>Anular</button>
                )}
              </div>
              {anulando === m.id && (
                <form className="anular" onSubmit={anular}>
                  <div className="campo">
                    <label htmlFor="motivo">Motivo de la anulación</label>
                    <textarea id="motivo" required value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                  </div>
                  <div className="fila-botones">
                    <button type="button" className="boton secundario" onClick={() => setAnulando(null)}>Cancelar</button>
                    <button className="boton peligro">Anular movimiento</button>
                  </div>
                </form>
              )}
            </li>
          )
        })}
      </ul>
      {filas && filas.length < total && (
        <button type="button" className="boton secundario" onClick={() => cargar(true)}>Ver más movimientos</button>
      )}
    </>
  )
}
