// Conteo físico (RF11). Bodega ingresa lo contado de los productos que quiera, ve la diferencia con el stock
// del sistema y confirma. Los productos que se dejan en blanco no se ajustan, así el conteo se puede hacer
// por partes. Al confirmar, la función confirmar_conteo de la base guarda el conteo, su detalle y los ajustes
// de stock en una sola transacción. Lo contado se guarda en el teléfono mientras tanto, porque el conteo
// dura horas y no debe perderse si el navegador recarga la página.
import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { mensajeError } from '../errores.js'
import { Icono } from '../iconos.jsx'
import { Avisos, normalizar, plural } from '../comun.jsx'

const formato = (n) => n.toLocaleString('es-CL')
const diferencia = (d) => (d > 0 ? '+' + formato(d) : d < 0 ? '−' + formato(-d) : '0')
const claseDif = (d) => (d > 0 ? 'positiva' : d < 0 ? 'negativa' : 'cero')

export default function Conteo({ sesion }) {
  const clave = 'conteo_borrador_' + sesion.user.id
  const [productos, setProductos] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState(0) // 0: todas
  const [contados, setContados] = useState(() => JSON.parse(localStorage.getItem(clave) ?? '{}')) // producto_id: cantidad
  const [revisando, setRevisando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cargar = () =>
    supabase.from('stock_actual').select('producto_id, nombre, unidad, stock, categoria_id').order('nombre')
      .then(({ data, error }) => (error ? setError(mensajeError(error)) : setProductos(data)))

  useEffect(() => {
    cargar()
    supabase.from('categoria').select('id, nombre').eq('activo', true).order('nombre')
      .then(({ data }) => setCategorias(data ?? []))
  }, [])

  useEffect(() => { localStorage.setItem(clave, JSON.stringify(contados)) }, [contados])

  function contar(id, valor) {
    const nuevos = { ...contados }
    if (valor === '') delete nuevos[id]
    else nuevos[id] = valor
    setContados(nuevos)
  }

  const lista = (productos ?? []).filter((p) => contados[p.producto_id] !== undefined)
  const conDiferencia = lista.filter((p) => Number(contados[p.producto_id]) !== p.stock)
  const visibles = (productos ?? []).filter((p) =>
    (!categoria || p.categoria_id === categoria) && normalizar(p.nombre).includes(normalizar(texto)))

  function revisar(e) {
    e.preventDefault()
    setError('')
    setExito('')
    setRevisando(true)
  }

  async function confirmar() {
    setError('')
    setEnviando(true)
    const { data, error } = await supabase.rpc('confirmar_conteo', {
      p_conteo: lista.map((p) => ({ producto_id: p.producto_id, cantidad_contada: Number(contados[p.producto_id]) })),
    })
    setEnviando(false)
    if (error) return setError(mensajeError(error))
    setContados({})
    setRevisando(false)
    setExito(`Conteo guardado: ${plural(data.contados, 'producto contado', 'productos contados')} y ${plural(data.ajustes, 'ajuste', 'ajustes')} de stock.`)
    cargar()
  }

  if (revisando) {
    return (
      <>
        <div className="ficha">
          <p><strong>Revisar el conteo</strong></p>
          <p className="detalle">{plural(lista.length, 'producto contado', 'productos contados')}, {conDiferencia.length} con diferencia</p>
        </div>
        {conDiferencia.length === 0
          ? <p className="nota">Lo contado coincide con el stock del sistema: no se hará ningún ajuste.</p>
          : (
            <ul className="lista conteo">
              <li className="cabecera"><span>Producto</span><span>Contado</span><span style={{ textAlign: 'right' }}>Dif.</span></li>
              {conDiferencia.map((p) => {
                const d = Number(contados[p.producto_id]) - p.stock
                return (
                  <li key={p.producto_id}>
                    <div><p className="nombre">{p.nombre}</p><p className="detalle">Sistema: {formato(p.stock)}</p></div>
                    <p className="cantidad">{formato(Number(contados[p.producto_id]))}</p>
                    <p className={'dif ' + claseDif(d)}>{diferencia(d)}</p>
                  </li>
                )
              })}
            </ul>
          )}
        <Avisos error={error} />
        <div className="fila-botones">
          <button type="button" className="boton secundario" disabled={enviando} onClick={() => setRevisando(false)}>Seguir contando</button>
          <button type="button" className="boton principal" disabled={enviando} onClick={confirmar}>Confirmar conteo</button>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="ficha">
        <p><strong>Conteo físico</strong></p>
        <p className="detalle">{lista.length} de {productos?.length ?? '…'} productos contados</p>
        <div className="progreso"><span style={{ width: productos ? (100 * lista.length) / productos.length + '%' : 0 }} /></div>
      </div>
      <div className="campo buscador">
        <Icono nombre="buscar" />
        <input aria-label="Buscar producto" placeholder="Buscar producto" value={texto}
          onChange={(e) => setTexto(e.target.value)} />
      </div>
      <div className="filtros" role="group" aria-label="Filtrar por categoría">
        {[{ id: 0, nombre: 'Todas' }, ...categorias].map((c) => (
          <button key={c.id} type="button" className={c.id === categoria ? 'activo' : ''}
            onClick={() => setCategoria(c.id)}>{c.nombre}</button>
        ))}
      </div>
      <Avisos error={error} exito={exito} />
      <form onSubmit={revisar}>
        <ul className="lista conteo">
          <li className="cabecera"><span>Producto</span><span>Contado</span><span style={{ textAlign: 'right' }}>Dif.</span></li>
          {visibles.map((p) => {
            const valor = contados[p.producto_id] ?? ''
            const d = valor === '' ? null : Number(valor) - p.stock
            return (
              <li key={p.producto_id}>
                <div><p className="nombre">{p.nombre}</p><p className="detalle">Sistema: {formato(p.stock)} {p.unidad}</p></div>
                <input type="number" inputMode="numeric" min="0" step="1" value={valor}
                  aria-label={`Cantidad contada de ${p.nombre}`} onChange={(e) => contar(p.producto_id, e.target.value)} />
                <p className={'dif ' + (d === null ? '' : claseDif(d))}>{d === null ? '' : diferencia(d)}</p>
              </li>
            )
          })}
        </ul>
        <button className="boton principal" disabled={lista.length === 0}>Revisar diferencias y confirmar</button>
      </form>
    </>
  )
}
