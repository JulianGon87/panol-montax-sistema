// Piezas que comparten varias pantallas.
import { useState } from 'react'
import { Icono } from './iconos.jsx'

// "1 producto", "2 productos".
export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

// Para buscar sin importar mayúsculas ni tildes.
export const normalizar = (texto) => (texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Semáforo de stock (el estado lo calcula la vista stock_actual de la base) y estado de una solicitud de compra.
const ESTADOS = {
  'SIN STOCK': ['sin-stock', 'Sin stock'], REPONER: ['reponer', 'Reponer'], OK: ['ok', 'OK'],
  pendiente: ['pendiente', 'Pendiente'], aprobada: ['ok', 'Aprobada'], rechazada: ['sin-stock', 'Rechazada'], comprada: ['ok', 'Comprada'],
}

export function Estado({ valor }) {
  const [clase, texto] = ESTADOS[valor] ?? ['neutro', valor]
  return <span className={'estado ' + clase}>{texto}</span>
}

export function Avisos({ error, exito }) {
  return (
    <>
      {error && <p className="mensaje-error" role="alert"><Icono nombre="alerta" />{error}</p>}
      {exito && <p className="mensaje-exito" role="status">{exito}</p>}
    </>
  )
}

// Cantidad con botones para restar y sumar, cómodos en el celular.
export function Contador({ id, valor, alCambiar }) {
  return (
    <div className="contador">
      <button type="button" aria-label="Restar" onClick={() => alCambiar(Math.max(1, valor - 1))}>−</button>
      <input id={id} type="number" inputMode="numeric" min="1" required value={valor}
        onChange={(e) => alCambiar(Number(e.target.value))} />
      <button type="button" aria-label="Sumar" onClick={() => alCambiar(valor + 1)}>+</button>
    </div>
  )
}

// Elegir un producto: el buscador filtra la lista, porque el pañol tiene más de cien productos.
export function ElegirProducto({ productos, valor, alCambiar }) {
  const [texto, setTexto] = useState('')
  const visibles = productos.filter((p) =>
    normalizar(p.nombre).includes(normalizar(texto)) || p.producto_id === Number(valor))
  return (
    <div className="campo">
      <label htmlFor="producto">Producto</label>
      <div className="buscador">
        <Icono nombre="buscar" />
        <input aria-label="Buscar producto" placeholder="Escribe para buscar" value={texto}
          onChange={(e) => setTexto(e.target.value)} />
      </div>
      <select id="producto" required value={valor} onChange={(e) => alCambiar(e.target.value)}>
        <option value="">Elige un producto ({visibles.length})</option>
        {visibles.map((p) => <option key={p.producto_id} value={p.producto_id}>{p.nombre}</option>)}
      </select>
    </div>
  )
}
