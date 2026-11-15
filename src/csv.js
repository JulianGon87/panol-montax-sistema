// Descarga un archivo .csv que Excel abre con doble clic: separador ";" (el de Excel en español) y marca
// BOM al inicio para que respete las tildes y la eñe. Un texto que empieza con = + - @ se antecede con una
// comilla simple, para que Excel no lo ejecute como fórmula.
const celda = (c) => {
  if (typeof c === 'number') return c
  const texto = String(c ?? '')
  return '"' + (/^[=+\-@]/.test(texto) ? "'" : '') + texto.replaceAll('"', '""') + '"'
}

export function descargarCsv(nombre, filas) {
  const contenido = '﻿' + filas.map((fila) => fila.map(celda).join(';')).join('\r\n')
  const enlace = document.createElement('a')
  enlace.href = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }))
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(enlace.href)
}
