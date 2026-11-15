// "Más": en el celular reúne las opciones de menor uso, para que la barra inferior no pase de cinco accesos.
// En el computador no se usa: el menú lateral muestra todas las opciones.
import { Icono } from '../iconos.jsx'

export default function Mas({ opciones }) {
  return (
    <ul className="lista mas">
      {opciones.map(([ruta, titulo, icono]) => (
        <li key={ruta}><a href={'#/' + ruta}><Icono nombre={icono} />{titulo}</a></li>
      ))}
    </ul>
  )
}
