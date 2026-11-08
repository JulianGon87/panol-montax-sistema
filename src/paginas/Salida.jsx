// Registrar salida (RF06): producto, cantidad y trabajador que retira. El área se propone desde el
// trabajador y Bodega puede cambiarla si retira para otra área. Aquí se avisa antes de enviar si la cantidad
// supera el stock, pero quien decide es la base: el trigger validar_stock rechaza toda salida que deje el
// stock en negativo, incluso si dos salidas llegan al mismo tiempo.
import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { mensajeError } from '../errores.js'
import { Avisos, Contador, ElegirProducto } from '../comun.jsx'

export default function Salida({ sesion }) {
  const [productos, setProductos] = useState([])
  const [trabajadores, setTrabajadores] = useState([])
  const [areas, setAreas] = useState([])
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [trabajadorId, setTrabajadorId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cargarStock = () =>
    supabase.from('stock_actual').select('producto_id, nombre, unidad, stock').order('nombre')
      .then(({ data }) => setProductos(data ?? []))

  useEffect(() => {
    cargarStock()
    supabase.from('trabajador').select('id, nombre, area_id').eq('activo', true).order('nombre')
      .then(({ data }) => setTrabajadores(data ?? []))
    supabase.from('area').select('id, nombre').eq('activo', true).order('nombre')
      .then(({ data }) => setAreas(data ?? []))
  }, [])

  const producto = productos.find((p) => p.producto_id === Number(productoId))
  const excede = producto && cantidad > producto.stock

  function elegirTrabajador(id) {
    setTrabajadorId(id)
    const trabajador = trabajadores.find((t) => t.id === Number(id))
    setAreaId(trabajador ? String(trabajador.area_id) : '') // se propone su área habitual
  }

  async function registrar(e) {
    e.preventDefault()
    setError('')
    setExito('')
    if (excede) return setError(`Solo hay ${producto.stock} disponibles. Ingresa ${producto.stock} o menos.`)
    setEnviando(true)
    const { error } = await supabase.from('movimiento').insert({
      producto_id: Number(productoId),
      tipo: 'salida',
      cantidad,
      usuario_id: sesion.user.id,
      trabajador_id: Number(trabajadorId),
      area_id: Number(areaId),
    })
    setEnviando(false)
    if (error) return setError(mensajeError(error))
    setExito(`Salida registrada: ${cantidad} de ${producto.nombre}. Quedan ${producto.stock - cantidad}.`)
    setCantidad(1)
    cargarStock()
  }

  return (
    <form className="formulario" onSubmit={registrar}>
      <ElegirProducto productos={productos} valor={productoId} alCambiar={setProductoId} />
      {producto && <p className="ayuda">Disponibles: <strong>{producto.stock}</strong> (unidad de medida: {producto.unidad})</p>}
      <div className={'campo' + (excede ? ' error' : '')}>
        <label htmlFor="cantidad">Cantidad</label>
        <Contador id="cantidad" valor={cantidad} alCambiar={setCantidad} />
      </div>
      <div className="campo">
        <label htmlFor="trabajador">Trabajador que retira</label>
        <select id="trabajador" required value={trabajadorId} onChange={(e) => elegirTrabajador(e.target.value)}>
          <option value="">Elige un trabajador</option>
          {trabajadores.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="area">Área</label>
        <select id="area" required value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <option value="">Elige un área</option>
          {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
        </select>
        <p className="ayuda">Se propone el área del trabajador; cámbiala si retira para otra.</p>
      </div>
      <Avisos error={error} exito={exito} />
      <button className="boton principal" disabled={enviando}>Registrar salida</button>
    </form>
  )
}
