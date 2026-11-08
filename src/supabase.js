// Conexión con Supabase. La dirección y la clave pública vienen de variables de entorno: .env.local en
// desarrollo y la configuración del proyecto en Vercel. La clave pública puede ir en el navegador porque,
// sin una sesión válida, las políticas RLS de la base no dejan leer ni modificar nada.
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
