// Registrar entrada (RF07): producto y cantidad recibida, con la opción de asociarla a una solicitud de compra.
import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { mensajeError } from '../errores.js'
import { Avisos, Contador, ElegirProducto } from '../comun.jsx'

export default function Entrada({ sesion }) {
  const [productos, setProductos] = useState([])
  const [solicitudes, setSolicitudes] = useState([])
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [solicitudId, setSolicitudId] = useState('')
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const [enviando, setEnviando] = useState(false)

  const cargarStock = () =>
    supabase.from('stock_actual').select('producto_id, nombre, unidad, stock').order('nombre')
      .then(({ data }) => setProductos(data ?? []))

  useEffect(() => {
    cargarStock()
    // Solo las solicitudes aprobadas o compradas pueden recibirse.
    supabase.from('solicitud_compra').select('id, fecha_creacion, estado').in('estado', ['aprobada', 'comprada'])
      .order('id', { ascending: false })
      .then(({ data }) => setSolicitudes(data ?? []))
  }, [])

  const producto = productos.find((p) => p.producto_id === Number(productoId))

  async function registrar(e) {
    e.preventDefault()
    setError('')
    setExito('')
    setEnviando(true)
    const { error } = await supabase.from('movimiento').insert({
      producto_id: Number(productoId),
      tipo: 'entrada',
      cantidad,
      usuario_id: sesion.user.id,
      solicitud_id: solicitudId ? Number(solicitudId) : null,
    })
    setEnviando(false)
    if (error) return setError(mensajeError(error))
    setExito(`Entrada registrada: ${cantidad} de ${producto.nombre}. Ahora hay ${producto.stock + cantidad}.`)
    setCantidad(1)
    cargarStock()
  }

  return (
    <form className="formulario" onSubmit={registrar}>
      <ElegirProducto productos={productos} valor={productoId} alCambiar={setProductoId} />
      {producto && <p className="ayuda">Stock actual: <strong>{producto.stock}</strong> (unidad de medida: {producto.unidad})</p>}
      <div className="campo">
        <label htmlFor="cantidad">Cantidad recibida</label>
        <Contador id="cantidad" valor={cantidad} alCambiar={setCantidad} />
      </div>
      <div className="campo">
        <label htmlFor="solicitud">Solicitud de compra (opcional)</label>
        <select id="solicitud" value={solicitudId} onChange={(e) => setSolicitudId(e.target.value)}>
          <option value="">Sin solicitud asociada</option>
          {solicitudes.map((s) => (
            <option key={s.id} value={s.id}>
              N.º {s.id} del {new Date(s.fecha_creacion).toLocaleDateString('es-CL')} ({s.estado})
            </option>
          ))}
        </select>
      </div>
      <Avisos error={error} exito={exito} />
      <button className="boton principal" disabled={enviando}>Registrar entrada</button>
    </form>
  )
}
