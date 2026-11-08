# Pañol Montax

Sistema web para el control de inventario y la reposición de insumos del pañol de Montax (Viña del Mar). Proyecto de título de Julián González Aguilera, IPLACEX, 2026.

Dos perfiles: **Bodega** registra salidas y entradas y consulta el stock; **Gerencia** consulta el stock y administra el catálogo y las cuentas.

## Arquitectura

Cliente-servidor con backend como servicio:

- **Frontend** (`src/`): React con Vite y hoja de estilos propia (`src/estilos.css`), sin librerías de componentes. Se publica en Vercel.
- **Backend** (Supabase): autenticación, API REST sobre PostgreSQL y la Edge Function `supabase/functions/crear-usuario`, que crea cuentas a pedido de Gerencia.
- **Base de datos** (PostgreSQL en Supabase): las reglas de negocio y los permisos por perfil están en la base (restricciones, triggers, la vista `stock_actual` y políticas RLS), no en la aplicación.

## Cómo ejecutarlo

Requiere Node.js 20 o superior.

```bash
npm install
cp .env.example .env.local   # y completar la clave pública de Supabase
npm run dev                  # http://localhost:5173
```

`npm run build` genera la versión publicable en `dist/`.

## Publicación

- **Vercel:** importar este repositorio y definir las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- **Edge Function:** desplegar `supabase/functions/crear-usuario` en el proyecto de Supabase (panel de Edge Functions o `supabase functions deploy crear-usuario --no-verify-jwt`), con la verificación de JWT de la plataforma desactivada: la función revisa en su código quién la llama. Usa las claves que Supabase entrega a toda función; no necesita secretos adicionales.
- **Supabase Auth:** desactivar el registro abierto y agregar la dirección de la aplicación en *URL Configuration* (para el enlace de recuperación de contraseña).

## Estructura

| Carpeta o archivo | Contenido |
|---|---|
| `src/App.jsx` | Sesión, perfil del usuario, menú según el perfil y navegación |
| `src/supabase.js` | Conexión con Supabase |
| `src/errores.js` | Traducción de los errores de la base a mensajes en español |
| `src/comun.jsx`, `src/iconos.jsx` | Piezas compartidas e íconos |
| `src/paginas/` | Una pantalla por requerimiento: inicio de sesión, inicio, salidas, entradas, stock, catálogo, usuarios y mi perfil |
| `supabase/functions/crear-usuario/` | Edge Function para crear cuentas (RF04) |
