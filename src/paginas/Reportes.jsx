// Reportes de consumo (RF13): salidas del período sumadas por área, producto o trabajador, con filtro por
// categoría (por ejemplo EPP, para ver las entregas de protección personal). La suma la hace la función
// reporte_consumo de la base. Se exporta a Excel (archivo .csv) el reporte y el stock vigente.
import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { mensajeError } from '../errores.js'
import { Icono } from '../iconos.jsx'
import { descargarCsv } from '../csv.js'
import { Avisos, plural } from '../comun.jsx'

const fecha = (diasAtras) => new Date(Date.now() - diasAtras * 86400000).toLocaleDateString('en-CA') // AAAA-MM-DD
const GRUPOS = { area: 'Área', producto: 'Producto', trabajador: 'Trabajador' }

export default function Reportes() {
  const [desde, setDesde] = useState(fecha(30))
  const [hasta, setHasta] = useState(fecha(0))
  const [agrupar, setAgrupar] = useState('area')
  const [categoria, setCategoria] = useState('') // '': todas
  const [categorias, setCategorias] = useState([])
  const [filas, setFilas] = useState(null)
  const [error, setError] = useState('')
  const periodoValido = desde && hasta && desde <= hasta

  useEffect(() => {
    supabase.from('categoria').select('id, nombre').order('nombre').then(({ data }) => setCategorias(data ?? []))
  }, [])

  useEffect(() => {
    if (!periodoValido) return
    setError('')
    supabase.rpc('reporte_consumo', {
      p_desde: desde, p_hasta: hasta, p_agrupar: agrupar, p_categoria: categoria ? Number(categoria) : null,
    }).then(({ data, error }) => (error ? setError(mensajeError(error)) : setFilas(data)))
  }, [desde, hasta, agrupar, categoria])

  const maximo = Math.max(1, ...(filas ?? []).map((f) => f.unidades))
  const totalSalidas = (filas ?? []).reduce((suma, f) => suma + f.salidas, 0)
  const totalUnidades = (filas ?? []).reduce((suma, f) => suma + f.unidades, 0)

  function exportarReporte() {
    descargarCsv(`consumo_por_${agrupar}_${desde}_a_${hasta}.csv`,
      [[GRUPOS[agrupar], 'Salidas', 'Unidades'], ...filas.map((f) => [f.grupo, f.salidas, f.unidades])])
  }

  async function exportarStock() {
    setError('')
    const { data, error } = await supabase.from('stock_actual')
      .select('nombre, categoria_id, unidad, stock, stock_minimo, estado, consumo_30d, sugerido_compra').order('nombre')
    if (error) return setError(mensajeError(error))
    const nombres = Object.fromEntries(categorias.map((c) => [c.id, c.nombre]))
    descargarCsv(`stock_${fecha(0)}.csv`, [
      ['Producto', 'Categoría', 'Unidad', 'Stock', 'Stock mínimo', 'Estado', 'Consumo 30 días', 'Compra sugerida'],
      ...data.map((p) => [p.nombre, nombres[p.categoria_id], p.unidad, p.stock, p.stock_minimo, p.estado, p.consumo_30d, p.sugerido_compra]),
    ])
  }

  return (
    <>
      <div className="filtros" role="group" aria-label="Agrupar el consumo por">
        {Object.entries(GRUPOS).map(([clave, texto]) => (
          <button key={clave} type="button" className={clave === agrupar ? 'activo' : ''}
            onClick={() => setAgrupar(clave)}>Por {texto.toLowerCase()}</button>
        ))}
      </div>
      <div className="dos-campos">
        <div className="campo"><label htmlFor="desde">Desde</label>
          <input id="desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
        <div className="campo"><label htmlFor="hasta">Hasta</label>
          <input id="hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
      </div>
      <div className="campo">
        <label htmlFor="categoria">Categoría</label>
        <select id="categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      {!periodoValido && <p className="mensaje-error" role="alert"><Icono nombre="alerta" />La fecha inicial no puede ser posterior a la final.</p>}
      <Avisos error={error} />
      {periodoValido && filas && (
        <section className="seccion">
          <h2>Salidas {GRUPOS[agrupar] === 'Área' ? 'por área' : GRUPOS[agrupar] === 'Producto' ? 'por producto' : 'por trabajador'}</h2>
          {filas.length === 0
            ? <p className="nota">No hay salidas en este período.</p>
            : (
              <>
                <p className="nota">{plural(totalUnidades, 'unidad', 'unidades')} en {plural(totalSalidas, 'salida', 'salidas')}.</p>
                <ul className="lista barras">
                  {filas.map((f) => (
                    <li key={f.grupo}>
                      <span>{f.grupo}</span>
                      <span className="pista"><span className="dato" style={{ width: (100 * f.unidades) / maximo + '%' }} /></span>
                      <span className="valor">{f.unidades.toLocaleString('es-CL')}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
        </section>
      )}
      <div className="acciones">
        <button type="button" className="boton secundario" disabled={!filas?.length || !periodoValido} onClick={exportarReporte}>
          <Icono nombre="descargar" />Exportar el reporte a Excel</button>
        <button type="button" className="boton secundario" onClick={exportarStock}>
          <Icono nombre="descargar" />Exportar el stock vigente a Excel</button>
      </div>
    </>
  )
}
