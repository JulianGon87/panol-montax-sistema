// Gestión del catálogo (RF05): Gerencia crea y edita productos, categorías, áreas y trabajadores, y puede
// desactivarlos. Las cuatro listas funcionan igual; solo cambian la tabla y sus campos (TABLAS).
// Solo Gerencia puede escribir en estas tablas: lo revisan las políticas RLS de la base.
import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { mensajeError } from '../errores.js'
import { Icono } from '../iconos.jsx'
import { Avisos, normalizar } from '../comun.jsx'

const TABLAS = {
  producto: {
    titulo: 'Productos',
    campos: [
      { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', largo: 80 },
      { nombre: 'categoria_id', etiqueta: 'Categoría', tipo: 'categoria' },
      { nombre: 'unidad', etiqueta: 'Unidad (unidad, caja, par, litro…)', tipo: 'texto', largo: 20 },
      { nombre: 'stock_minimo', etiqueta: 'Stock mínimo', tipo: 'numero' },
    ],
  },
  categoria: { titulo: 'Categorías', campos: [{ nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', largo: 40 }] },
  area: { titulo: 'Áreas', campos: [{ nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', largo: 40 }] },
  trabajador: {
    titulo: 'Trabajadores',
    campos: [
      { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', largo: 60 },
      { nombre: 'area_id', etiqueta: 'Área habitual', tipo: 'area' },
    ],
  },
}

export default function Catalogo() {
  const [tabla, setTabla] = useState('producto')
  const [filas, setFilas] = useState([])
  const [categorias, setCategorias] = useState([])
  const [areas, setAreas] = useState([])
  const [edicion, setEdicion] = useState(null) // null: sin formulario; {}: registro nuevo; una fila: edición
  const [texto, setTexto] = useState('')
  const [error, setError] = useState('')
  const [exito, setExito] = useState('')
  const config = TABLAS[tabla]

  async function cargar() {
    const [f, c, a] = await Promise.all([
      supabase.from(tabla).select('*').order('nombre'),
      supabase.from('categoria').select('id, nombre, activo').order('nombre'),
      supabase.from('area').select('id, nombre, activo').order('nombre'),
    ])
    setFilas(f.data ?? [])
    setCategorias(c.data ?? [])
    setAreas(a.data ?? [])
  }

  useEffect(() => {
    setEdicion(null)
    setTexto('')
    setError('')
    setExito('')
    cargar()
  }, [tabla])

  async function guardar(e) {
    e.preventDefault()
    setError('')
    setExito('')
    const datos = Object.fromEntries(config.campos.map((c) =>
      [c.nombre, c.tipo === 'texto' ? edicion[c.nombre].trim() : Number(edicion[c.nombre])]))
    const { error } = edicion.id
      ? await supabase.from(tabla).update(datos).eq('id', edicion.id)
      : await supabase.from(tabla).insert(datos)
    if (error) return setError(mensajeError(error))
    setExito(edicion.id ? 'Cambios guardados.' : 'Registro creado.')
    setEdicion(null)
    cargar()
  }

  // Nada se borra: desactivar lo saca de los formularios, pero conserva el historial.
  async function cambiarEstado(fila) {
    setError('')
    setExito('')
    const { error } = await supabase.from(tabla).update({ activo: !fila.activo }).eq('id', fila.id)
    if (error) return setError(mensajeError(error))
    setExito(`${fila.nombre}: ${fila.activo ? 'desactivado' : 'activado'}.`)
    cargar()
  }

  const nombreDe = (lista, id) => lista.find((x) => x.id === id)?.nombre ?? ''
  const detalle = (f) =>
    tabla === 'producto' ? `${nombreDe(categorias, f.categoria_id)} · ${f.unidad} · mínimo ${f.stock_minimo}`
      : tabla === 'trabajador' ? nombreDe(areas, f.area_id) : ''
  const visibles = filas.filter((f) => normalizar(f.nombre).includes(normalizar(texto)))

  return (
    <>
      <div className="pestanas" role="tablist">
        {Object.entries(TABLAS).map(([t, c]) => (
          <button key={t} type="button" role="tab" aria-selected={t === tabla} className={t === tabla ? 'activa' : ''}
            onClick={() => setTabla(t)}>{c.titulo}</button>
        ))}
      </div>
      <Avisos error={error} exito={exito} />
      {edicion ? (
        <form className="formulario ficha" onSubmit={guardar}>
          <h2>{edicion.id ? 'Editar' : 'Agregar'}: {config.titulo.toLowerCase()}</h2>
          {config.campos.map((c) => (
            <Campo key={c.nombre} campo={c} valor={edicion[c.nombre] ?? ''} categorias={categorias} areas={areas}
              alCambiar={(v) => setEdicion({ ...edicion, [c.nombre]: v })} />
          ))}
          <div className="fila-botones">
            <button type="button" className="boton secundario" onClick={() => setEdicion(null)}>Cancelar</button>
            <button className="boton principal">Guardar</button>
          </div>
        </form>
      ) : (
        <button type="button" className="boton principal" onClick={() => setEdicion({})}>
          <Icono nombre="agregar" />Agregar
        </button>
      )}
      <div className="campo buscador">
        <Icono nombre="buscar" />
        <input aria-label="Buscar" placeholder="Buscar por nombre" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      <ul className="lista">
        {visibles.map((f) => (
          <li key={f.id}>
            <div>
              <p className="nombre">{f.nombre}</p>
              <p className="detalle">{detalle(f)}</p>
            </div>
            <div className="derecha">
              {!f.activo && <span className="estado neutro">Inactivo</span>}
              <div className="botones-fila">
                <button type="button" className="boton compacto secundario" onClick={() => setEdicion(f)}>Editar</button>
                <button type="button" className={'boton compacto ' + (f.activo ? 'peligro' : 'secundario')}
                  onClick={() => cambiarEstado(f)}>{f.activo ? 'Desactivar' : 'Activar'}</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

function Campo({ campo, valor, alCambiar, categorias, areas }) {
  const id = 'campo-' + campo.nombre
  const lista = campo.tipo === 'categoria' ? categorias : campo.tipo === 'area' ? areas : null
  return (
    <div className="campo">
      <label htmlFor={id}>{campo.etiqueta}</label>
      {lista ? (
        <select id={id} required value={valor} onChange={(e) => alCambiar(e.target.value)}>
          <option value="">Elige una opción</option>
          {lista.filter((o) => o.activo || o.id === Number(valor)).map((o) => (
            <option key={o.id} value={o.id}>{o.nombre}</option>
          ))}
        </select>
      ) : (
        <input id={id} required type={campo.tipo === 'numero' ? 'number' : 'text'} min={campo.tipo === 'numero' ? 0 : undefined}
          maxLength={campo.largo} value={valor} onChange={(e) => alCambiar(e.target.value)} />
      )}
    </div>
  )
}
