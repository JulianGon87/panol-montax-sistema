// Consulta de stock (RF08): stock actual de cada producto con su estado, búsqueda por nombre y filtro por
// categoría. El stock, el estado y la compra sugerida los calcula la vista stock_actual de la base.
import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { mensajeError } from '../errores.js'
import { Icono } from '../iconos.jsx'
import { Avisos, Estado, normalizar } from '../comun.jsx'

export default function Stock() {
  const [productos, setProductos] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState(0) // 0: todas
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('stock_actual').select('producto_id, nombre, unidad, stock, stock_minimo, estado, categoria_id')
      .order('nombre')
      .then(({ data, error }) => (error ? setError(mensajeError(error)) : setProductos(data)))
    supabase.from('categoria').select('id, nombre').eq('activo', true).order('nombre')
      .then(({ data }) => setCategorias(data ?? []))
  }, [])

  const visibles = (productos ?? []).filter((p) =>
    (!categoria || p.categoria_id === categoria) && normalizar(p.nombre).includes(normalizar(texto)))

  return (
    <>
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
      <Avisos error={error} />
      {productos && <p className="nota">{visibles.length} productos</p>}
      <ul className="lista">
        {visibles.map((p) => (
          <li key={p.producto_id}>
            <div>
              <p className="nombre">{p.nombre}</p>
              <p className="detalle">Mínimo {p.stock_minimo} {p.unidad}</p>
            </div>
            <div className="derecha">
              <p className="cantidad">{p.stock} <small>{p.unidad}</small></p>
              <Estado valor={p.estado} />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
