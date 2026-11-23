# Pañol Montax

Sistema web para el control de inventario y la reposición de insumos del pañol de Montax (Viña del Mar). Proyecto de título de Julián González Aguilera, IPLACEX, 2026.

Aplicación publicada: https://panol-montax-sistema.vercel.app

Dos perfiles diferenciados:
- **Bodega** (Jefe de Bodega): consulta alertas y stock, registra salidas y entradas, crea solicitudes de compra con cantidad sugerida según consumo, realiza conteos físicos desde el celular, consulta el historial de movimientos y edita su perfil.
- **Gerencia** (Gerente de Logística): consulta alertas y stock, aprueba, rechaza o marca como compradas las solicitudes, genera reportes de consumo por área, producto y trabajador (incluido EPP) exportables a Excel, anula movimientos con motivo y administra el catálogo (productos, categorías, áreas y trabajadores) y las cuentas de usuario.

## Arquitectura

Patrón cliente-servidor con backend como servicio (*Backend as a Service*):

- **Frontend (`src/`):** aplicación React con Vite y hoja de estilos propia (`src/estilos.css`), responsiva desde 360 px y sin librerías de componentes. Se aloja en Vercel.
- **Backend (Supabase):** autenticación con JWT (Supabase Auth), API de datos REST sobre PostgreSQL (PostgREST) y la Edge Function `supabase/functions/crear-usuario`, que crea cuentas a pedido de Gerencia con la clave de servicio del proyecto.
- **Base de datos (`supabase/01_crear_bd.sql` y `supabase/02_datos_iniciales.sql`):** PostgreSQL en tercera forma normal (11 tablas y la vista `stock_actual`). Las reglas de negocio y el control de acceso por perfil viven en la base de datos: 12 restricciones CHECK con nombre, 14 índices, 4 triggers (incluido bloqueo transaccional `pg_advisory_xact_lock` contra stock negativo en salidas simultáneas), funciones transaccionales para solicitudes, conteos y reportes, y 24 políticas Row Level Security (RLS).

## Estructura del repositorio

| Carpeta o archivo | Contenido |
|---|---|
| `src/App.jsx` | Sesión, perfil del usuario conectado, barra de navegación según el perfil (RF01) y cambio entre pantallas |
| `src/supabase.js` | Conexión del cliente con Supabase (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`) |
| `src/errores.js` | Traducción de los errores de PostgreSQL y Supabase Auth a mensajes en español (RNF06) |
| `src/csv.js` | Exportación de reportes de consumo y del stock vigente a CSV con separador `;` y BOM UTF-8 para Excel (RF13) |
| `src/comun.jsx`, `src/iconos.jsx` | Componentes compartidos (semáforo de stock, avisos, selector de producto con buscador) e íconos SVG |
| `src/estilos.css` | Hoja de estilos propia y responsiva (RNF01) |
| `src/paginas/Login.jsx`, `NuevaClave.jsx` | Inicio de sesión y recuperación de contraseña por correo (RF01, RF02) |
| `src/paginas/Perfil.jsx` | Edición de nombre, teléfono y cambio de contraseña (RF03) |
| `src/paginas/Usuarios.jsx` | Administración de cuentas y perfiles por Gerencia (RF04) |
| `src/paginas/Catalogo.jsx` | Gestión de productos, stocks mínimos, categorías, áreas y trabajadores (RF05) |
| `src/paginas/Salida.jsx` | Registro de salidas con trabajador, área propuesta y validación de stock (RF06) |
| `src/paginas/Entrada.jsx` | Registro de entradas y recepción asociada a solicitudes compradas (RF07) |
| `src/paginas/Inicio.jsx`, `Stock.jsx` | Alertas de reposición y consulta de stock por nombre y categoría (RF08) |
| `src/paginas/Solicitudes.jsx` | Creación de solicitudes con cantidad sugerida, aprobación, rechazo y seguimiento (RF09, RF10) |
| `src/paginas/Conteo.jsx` | Conteo físico con guardado local en el celular y generación transaccional de ajustes (RF11) |
| `src/paginas/Historial.jsx` | Historial con filtros y anulación de movimientos con motivo por Gerencia (RF12, RNF04) |
| `src/paginas/Reportes.jsx` | Reportes de consumo por área, producto y trabajador, filtro EPP y exportación a Excel (RF13) |
| `src/paginas/Mas.jsx` | Menú secundario para mantener cinco accesos en la barra inferior del celular |
| `supabase/01_crear_bd.sql` | Esquema completo de la base de datos: tablas, índices, vista `stock_actual`, funciones, triggers y políticas RLS |
| `supabase/02_datos_iniciales.sql` | Carga inicial de categorías, áreas, 116 productos con sus stocks mínimos y conteo físico inicial |
| `supabase/functions/crear-usuario/` | Edge Function de Supabase para la creación de cuentas por parte de Gerencia (RF04) |

## Instalación y ejecución local (Frontend)

Requiere Node.js 20 o superior.

```bash
npm install
cp .env.example .env.local   # completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev                  # abre http://localhost:5173
```

`npm run build` genera la versión de producción en `dist/`.

## Configuración del Backend y la Base de Datos (Supabase)

1. **Crear el esquema:** en el *SQL Editor* de un proyecto nuevo de Supabase, ejecutar completo `supabase/01_crear_bd.sql`.
2. **Crear el primer usuario Gerencia:** en *Authentication → Users*, crear la cuenta del gerente y luego activarla con el perfil Gerencia en el *SQL Editor*:
   ```sql
   update usuario
      set rol_id = (select id from rol where nombre = 'gerencia'),
          nombre = 'Gerente de Logística',
          activo = true
    where id = '<uuid-del-usuario>';
   ```
3. **Cargar el catálogo y el stock inicial:** ejecutar en el *SQL Editor* el script `supabase/02_datos_iniciales.sql`.
4. **Supabase Auth:** desactivar el registro abierto de usuarios (*Allow new users to sign up* apagado) y agregar la URL de la aplicación en *Authentication → URL Configuration* para los enlaces de recuperación de contraseña.
5. **Edge Function (`crear-usuario`):** desplegar `supabase/functions/crear-usuario` en el proyecto de Supabase (`supabase functions deploy crear-usuario --no-verify-jwt`), con la verificación automática de JWT de la plataforma desactivada, ya que la función valida el token y el rol Gerencia en su propio código.

## Publicación (Vercel)

Importar este repositorio en Vercel y configurar las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Cada `git push` a la rama `main` despliega automáticamente la versión publicada.
