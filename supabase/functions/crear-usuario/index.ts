// Edge Function crear-usuario (RF04): Gerencia crea la cuenta de una persona y le asigna su perfil.
// Corre en los servidores de Supabase, no en el navegador, porque crear cuentas necesita la clave secreta del
// proyecto (permisos de administrador), que nunca puede quedar expuesta en la aplicación.
// Se publica con la verificación de JWT de la plataforma desactivada: la función revisa en su propio código
// quién la llama, como recomienda Supabase para las claves nuevas (sb_publishable / sb_secret).
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

// Clave secreta: la nueva (SUPABASE_SECRET_KEYS) o, en proyectos con claves antiguas, la service_role.
const claveSecreta = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}').default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const admin = createClient(Deno.env.get('SUPABASE_URL')!, claveSecreta)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // 1. Quién llama: Supabase Auth valida su token, y su fila en la tabla usuario dice si es Gerencia y está activa.
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: sesion } = await admin.auth.getUser(token)
  if (!sesion?.user) return responder({ error: 'Inicia sesión para crear cuentas.' }, 401)
  const { data: quien } = await admin.from('usuario').select('activo, rol(nombre)').eq('id', sesion.user.id).single()
  if (!quien?.activo || quien.rol?.nombre !== 'gerencia') return responder({ error: 'Solo Gerencia puede crear cuentas.' }, 403)

  // 2. Datos de la cuenta nueva.
  const { nombre, correo, clave, telefono, rol_id } = await req.json()
  if (!nombre || !correo || !rol_id) return responder({ error: 'Faltan el nombre, el correo o el perfil.' }, 400)
  if (!clave || String(clave).length < 8) return responder({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400)

  // 3. Crear la cuenta. El trigger cuenta_nueva de la base le crea su fila en la tabla usuario, desactivada.
  const { data, error } = await admin.auth.admin.createUser({ email: correo, password: clave, email_confirm: true })
  if (error) {
    const yaExiste = /already|registered|exists/i.test(error.message)
    return responder({ error: yaExiste ? 'Ya existe una cuenta con ese correo.' : error.message }, 400)
  }

  // 4. Activar la cuenta con su nombre, teléfono y perfil.
  const { error: errorPerfil } = await admin.from('usuario')
    .update({ nombre, telefono: telefono || null, rol_id, activo: true })
    .eq('id', data.user.id)
  if (errorPerfil) return responder({ error: errorPerfil.message }, 400)
  return responder({ id: data.user.id })
})
