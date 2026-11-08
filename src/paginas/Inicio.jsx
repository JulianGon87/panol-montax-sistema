// Inicio de cada perfil: alerta con los productos sin stock y por reponer (RF08) y accesos directos.
import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { mensajeError } from '../errores.js'
import { Icono } from '../iconos.jsx'
import { Avisos, Estado } from '../comun.jsx'

export default function Inicio({ usuario }) {
  const [alertas, setAlertas] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('stock_actual').select('producto_id, nombre, unidad, stock, stock_minimo, estado')
      .in('estado', ['SIN STOCK', 'REPONER']).order('stock').order('nombre')
      .then(({ data, error }) => (error ? setError(mensajeError(error)) : setAlertas(data)))
  }, [])

  const contar = (estado) => (alertas ? alertas.filter((p) => p.estado === estado).length : '…')
  const esBodega = usuario.rol.nombre === 'bodega'

  return (
    <>
      <p className="saludo">Hola, <strong>{usuario.nombre.split(' ')[0]}</strong></p>
      <div className="resumen">
        <a className="cifra critico" href="#/stock"><strong>{contar('SIN STOCK')}</strong><span>sin stock</span></a>
        <a className="cifra alerta" href="#/stock"><strong>{contar('REPONER')}</strong><span>por reponer</span></a>
      </div>
      <div className="acciones">
        {esBodega ? (
          <>
            <a className="boton principal" href="#/salida"><Icono nombre="salida" />Registrar salida</a>
            <a className="boton secundario" href="#/entrada"><Icono nombre="entrada" />Registrar entrada</a>
          </>
        ) : (
          <>
            <a className="boton principal" href="#/stock"><Icono nombre="stock" />Ver stock</a>
            <div className="par">
              <a className="boton secundario" href="#/catalogo"><Icono nombre="catalogo" />Catálogo</a>
              <a className="boton secundario" href="#/usuarios"><Icono nombre="usuarios" />Usuarios</a>
            </div>
          </>
        )}
      </div>
      <section className="seccion">
        <h2>Sin stock y por reponer</h2>
        <Avisos error={error} />
        {alertas?.length === 0 && <p className="nota">Todos los productos están sobre su stock mínimo.</p>}
        {alertas?.length > 0 && (
          <ul className="lista">
            {alertas.map((p) => (
              <li key={p.producto_id}>
                <div>
                  <p className="nombre">{p.nombre}</p>
                  <p className="detalle">Quedan {p.stock} {p.unidad} de un mínimo de {p.stock_minimo}</p>
                </div>
                <Estado valor={p.estado} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
