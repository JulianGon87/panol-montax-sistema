// Traduce los errores de Supabase a mensajes en español que dicen qué corregir (RNF06).
// Las reglas viven en la base de datos: cada restricción tiene nombre y aquí se le asigna su mensaje.
const RESTRICCIONES = {
  movimiento_salida_chk: 'Una salida necesita trabajador y área.',
  movimiento_cantidad_chk: 'La cantidad debe ser mayor que cero.',
  movimiento_tipo_chk: 'El tipo de movimiento no es válido.',
  movimiento_solicitud_chk: 'Solo una entrada puede asociarse a una solicitud de compra.',
  movimiento_conteo_chk: 'Los ajustes solo se generan desde un conteo físico.',
  movimiento_anulacion_chk: 'Para anular hay que indicar el motivo.',
  producto_stock_minimo_chk: 'El stock mínimo no puede ser negativo.',
  solicitud_estado_chk: 'El estado de la solicitud no es válido.',
  solicitud_resolucion_chk: 'Falta indicar quién resolvió la solicitud.',
  detalle_solicitud_sugerida_chk: 'La cantidad sugerida no puede ser negativa.',
  detalle_solicitud_solicitada_chk: 'La cantidad solicitada debe ser mayor que cero.',
  detalle_conteo_contada_chk: 'La cantidad contada no puede ser negativa.',
}

export function mensajeError(error) {
  if (!error) return ''
  const texto = `${error.message ?? ''} ${error.details ?? ''}`
  if (texto.includes('Stock insuficiente')) return 'No hay stock suficiente para esa cantidad. Revisa el stock disponible.'
  if (texto.includes('Solo se pueden pedir')) return 'Solo se pueden pedir productos sin stock o por reponer. Actualiza la pantalla.'
  if (texto.includes('al menos un producto')) return 'Elige al menos un producto para la solicitud.'
  if (texto.includes('Solo Gerencia')) return 'Solo Gerencia puede cambiar el perfil o el estado de una cuenta.'
  if (texto.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (texto.includes('should be different')) return 'La nueva contraseña debe ser distinta de la actual.'
  if (texto.includes('Password should be')) return 'La contraseña es muy débil: usa al menos 8 caracteres.'
  if (texto.includes('rate limit')) return 'Se hicieron demasiados intentos. Espera unos minutos y vuelve a intentar.'
  if (texto.includes('row-level security') || error.code === '42501') return 'Tu perfil no tiene permiso para esta acción.'
  if (error.code === '23505') return 'Ya existe un registro con ese nombre.'
  if (error.code === '23502') return 'Falta completar un campo obligatorio.'
  for (const [restriccion, mensaje] of Object.entries(RESTRICCIONES)) {
    if (texto.includes(restriccion)) return mensaje
  }
  if (texto.includes('Failed to fetch')) return 'No hay conexión con el servidor. Revisa la conexión a internet.'
  return 'No se pudo completar la operación: ' + (error.message ?? 'error desconocido')
}
