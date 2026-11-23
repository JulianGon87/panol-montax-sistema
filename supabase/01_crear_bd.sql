-- ============================================================================
-- Pañol MONTAX - Script de creación de la base de datos (PostgreSQL / Supabase)
-- Tablas, claves primarias y foráneas, restricciones, índices, vista de stock,
-- reglas de integridad (triggers) y seguridad por perfil (RLS).
-- Se ejecuta completo y en orden, sobre una base vacía.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLAS
-- ---------------------------------------------------------------------------

-- Perfiles del sistema: bodega y gerencia.
create table rol (
  id      smallint    generated always as identity primary key,
  nombre  varchar(20) not null unique
);

-- Cuentas. El id es el mismo del inicio de sesión de Supabase (auth.users):
-- el correo y las contraseñas las guarda Supabase, nunca esta base.
create table usuario (
  id        uuid        primary key references auth.users (id),
  rol_id    smallint    not null references rol (id),
  nombre    varchar(60) not null,
  telefono  varchar(20),
  activo    boolean     not null default true
);

-- Áreas que retiran materiales (carpintería, soldadura, pintura, etc.).
create table area (
  id      smallint    generated always as identity primary key,
  nombre  varchar(40) not null unique,
  activo  boolean     not null default true
);

-- Personas que retiran. No usan el sistema: solo se guarda su nombre y su área.
-- El área es la habitual: se propone en cada salida, y Bodega puede cambiarla
-- cuando el trabajador retira para otra área.
create table trabajador (
  id       integer     generated always as identity primary key,
  area_id  smallint    not null references area (id),
  nombre   varchar(60) not null,
  activo   boolean     not null default true
);

create table categoria (
  id      smallint    generated always as identity primary key,
  nombre  varchar(40) not null unique,
  activo  boolean     not null default true
);

-- El stock actual NO se guarda: se calcula en la vista stock_actual.
create table producto (
  id            integer     generated always as identity primary key,
  categoria_id  smallint    not null references categoria (id),
  nombre        varchar(80) not null unique,
  unidad        varchar(20) not null,                          -- unidad, caja, litro, metro...
  stock_minimo  integer     not null default 0
                constraint producto_stock_minimo_chk check (stock_minimo >= 0),
  activo        boolean     not null default true
);

-- Solicitud de compra: la crea Bodega, la resuelve Gerencia y luego se marca comprada.
-- La recepción no tiene estado propio: son los movimientos de entrada ligados a la solicitud.
create table solicitud_compra (
  id                 integer      generated always as identity primary key,
  creada_por         uuid         not null references usuario (id),
  fecha_creacion     timestamptz  not null default now(),
  estado             varchar(10)  not null default 'pendiente'
                     constraint solicitud_estado_chk check (estado in ('pendiente', 'aprobada', 'rechazada', 'comprada')),
  comentario         varchar(200),                              -- comentario de Gerencia al aprobar o rechazar
  resuelta_por       uuid         references usuario (id),     -- quien aprobó o rechazó
  -- Toda solicitud que salió de "pendiente" tiene quién la resolvió.
  constraint solicitud_resolucion_chk check ((estado = 'pendiente') = (resuelta_por is null))
);

create table detalle_solicitud (
  solicitud_id         integer not null references solicitud_compra (id) on delete cascade,
  producto_id          integer not null references producto (id),
  cantidad_sugerida    integer not null                        -- la propone el sistema
                       constraint detalle_solicitud_sugerida_chk check (cantidad_sugerida >= 0),
  cantidad_solicitada  integer not null                        -- Bodega puede modificarla
                       constraint detalle_solicitud_solicitada_chk check (cantidad_solicitada > 0),
  primary key (solicitud_id, producto_id)
);

create table conteo_fisico (
  id           integer      generated always as identity primary key,
  usuario_id   uuid         not null references usuario (id),
  fecha        timestamptz  not null default now(),
  observacion  varchar(200)
);

create table detalle_conteo (
  conteo_id         integer not null references conteo_fisico (id) on delete cascade,
  producto_id       integer not null references producto (id),
  cantidad_sistema  integer not null,                          -- stock según el sistema al contar
  cantidad_contada  integer not null
                    constraint detalle_conteo_contada_chk check (cantidad_contada >= 0),
  primary key (conteo_id, producto_id)
);

-- Todo cambio de stock es un movimiento. Stock = suma de movimientos no anulados.
--   entrada: suma (opcionalmente ligada a una solicitud de compra)
--   salida:  resta (exige área y trabajador)
--   ajuste:  diferencia de un conteo físico (con signo, distinta de cero)
-- Un movimiento está anulado cuando tiene anulado_por; no hay un indicador aparte.
create table movimiento (
  id                 bigint       generated always as identity primary key,
  producto_id        integer      not null references producto (id),
  tipo               varchar(7)   not null
                     constraint movimiento_tipo_chk check (tipo in ('entrada', 'salida', 'ajuste')),
  cantidad           integer      not null,
  fecha              timestamptz  not null default now(),
  usuario_id         uuid         not null references usuario (id),   -- quién lo registró
  area_id            smallint     references area (id),               -- área de la salida
  trabajador_id      integer      references trabajador (id),
  solicitud_id       integer      references solicitud_compra (id),
  conteo_id          integer      references conteo_fisico (id),
  motivo_anulacion   varchar(200),
  anulado_por        uuid         references usuario (id),
  fecha_anulacion    timestamptz,
  -- Entradas y salidas son positivas; el ajuste lleva signo.
  constraint movimiento_cantidad_chk
    check ((tipo = 'ajuste' and cantidad <> 0) or (tipo <> 'ajuste' and cantidad > 0)),
  -- Solo las salidas llevan área y trabajador (el Form actual los exigía también en entradas).
  constraint movimiento_salida_chk
    check ((tipo = 'salida' and area_id is not null and trabajador_id is not null)
        or (tipo <> 'salida' and area_id is null and trabajador_id is null)),
  -- La solicitud solo aplica a entradas; el conteo es obligatorio en ajustes y solo en ellos.
  constraint movimiento_solicitud_chk check (solicitud_id is null or tipo = 'entrada'),
  constraint movimiento_conteo_chk check ((tipo = 'ajuste') = (conteo_id is not null)),
  -- Un movimiento no se borra: se anula con motivo, responsable y fecha, los tres juntos.
  constraint movimiento_anulacion_chk
    check ((anulado_por is null) = (motivo_anulacion is null) and (anulado_por is null) = (fecha_anulacion is null))
);

-- ---------------------------------------------------------------------------
-- 2. ÍNDICES (claves foráneas y consultas frecuentes)
-- ---------------------------------------------------------------------------
create index on usuario (rol_id);
create index on trabajador (area_id);
create index on producto (categoria_id);
create index on solicitud_compra (estado);
create index on solicitud_compra (creada_por);
create index on detalle_solicitud (producto_id);
create index on conteo_fisico (usuario_id);
create index on detalle_conteo (producto_id);
create index on movimiento (producto_id, fecha);   -- stock y consumo de 30 días por producto
create index on movimiento (area_id);
create index on movimiento (trabajador_id);
create index on movimiento (solicitud_id);
create index on movimiento (conteo_id);
create index on movimiento (usuario_id);

-- ---------------------------------------------------------------------------
-- 3. VISTA DE STOCK: único lugar donde se calcula el stock, el semáforo y la compra sugerida
-- ---------------------------------------------------------------------------
create view stock_actual with (security_invoker = true) as
select
  p.id as producto_id,
  p.categoria_id,
  p.nombre,
  p.unidad,
  p.stock_minimo,
  s.stock,
  s.consumo_30d,
  case when s.stock <= 0 then 'SIN STOCK'
       when s.stock <= p.stock_minimo then 'REPONER'
       else 'OK' end as estado,
  -- Lo necesario para volver al doble del mínimo o para cubrir el consumo del último mes.
  greatest(p.stock_minimo * 2 - s.stock, p.stock_minimo - s.stock + s.consumo_30d, 0) as sugerido_compra
from producto p
cross join lateral (
  select
    coalesce(sum(case m.tipo when 'salida' then -m.cantidad else m.cantidad end), 0)::integer as stock,
    coalesce(sum(m.cantidad) filter (where m.tipo = 'salida' and m.fecha >= now() - interval '30 days'), 0)::integer as consumo_30d
  from movimiento m
  where m.producto_id = p.id and m.anulado_por is null
) s
where p.activo;

-- ---------------------------------------------------------------------------
-- 4. REGLAS DE INTEGRIDAD (triggers)
-- ---------------------------------------------------------------------------

-- El stock nunca puede quedar negativo, sea por una salida, un ajuste o una anulación.
-- Un candado por producto, que dura hasta el fin de la transacción, pone en fila dos registros
-- simultáneos del mismo producto: el segundo espera y calcula el stock ya con el primero.
-- (No se usa "select ... for update" sobre producto: RLS solo deja a Gerencia modificar
-- productos, así que para Bodega no bloquearía nada.)
create function validar_stock() returns trigger
language plpgsql as $$
declare
  v_stock integer;
begin
  perform pg_advisory_xact_lock(new.producto_id);
  select coalesce(sum(case tipo when 'salida' then -cantidad else cantidad end), 0)
    into v_stock
    from movimiento
   where producto_id = new.producto_id and anulado_por is null;
  if v_stock < 0 then
    raise exception 'Stock insuficiente: la operación dejaría el stock en %', v_stock;
  end if;
  return null;
end $$;

create trigger movimiento_valida_stock
  after insert or update on movimiento
  for each row execute function validar_stock();

-- Perfil del usuario conectado. Las políticas de seguridad lo usan para decidir permisos.
create function rol_actual() returns varchar
language sql stable security definer set search_path = '' as $$
  select r.nombre
    from public.usuario u join public.rol r on r.id = u.rol_id
   where u.id = auth.uid() and u.activo
$$;

-- Toda cuenta nueva de Supabase (Authentication) recibe su fila en usuario desactivada: no puede
-- hacer nada hasta que se active con su perfil. La Edge Function con que Gerencia crea usuarios
-- (RF04) la activa al crearla; la cuenta del primer gerente se activa desde el SQL Editor.
create function crear_usuario_pendiente() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.usuario (id, rol_id, nombre, activo)
  values (new.id, (select id from public.rol where nombre = 'bodega'),
          left(coalesce(new.email, 'Sin nombre'), 60), false);
  return new;
end $$;

create trigger cuenta_nueva
  after insert on auth.users
  for each row execute function crear_usuario_pendiente();

-- Cada usuario puede editar su nombre y su teléfono, pero solo Gerencia cambia el perfil o desactiva cuentas.
-- (Sin sesión de la app, como en el panel de Supabase, la regla no aplica: así se crea el primer gerente.)
create function proteger_usuario() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null
     and (new.rol_id <> old.rol_id or new.activo <> old.activo)
     and rol_actual() is distinct from 'gerencia' then
    raise exception 'Solo Gerencia puede cambiar el perfil o el estado de una cuenta';
  end if;
  return new;
end $$;

create trigger usuario_protegido
  before update on usuario
  for each row execute function proteger_usuario();

-- Una solicitud solo avanza de pendiente a aprobada o rechazada, y de aprobada a comprada. Así el flujo no
-- depende de que la pantalla lo respete: también lo exige la base, venga la petición de donde venga.
create function validar_estado_solicitud() returns trigger
language plpgsql as $$
begin
  if old.estado <> new.estado and not (
       (old.estado = 'pendiente' and new.estado in ('aprobada', 'rechazada'))
    or (old.estado = 'aprobada' and new.estado = 'comprada')) then
    raise exception 'Una solicitud % no puede pasar a %', old.estado, new.estado;
  end if;
  return new;
end $$;

create trigger solicitud_estado
  before update of estado on solicitud_compra
  for each row execute function validar_estado_solicitud();

-- Crea una solicitud de compra con sus productos en una sola transacción (RF09): se guarda completa o
-- no se guarda. Recibe un arreglo JSON [{"producto_id": 1, "cantidad": 20}, ...]. La cantidad sugerida
-- la toma de stock_actual, no del navegador, y solo se piden productos sin stock o por reponer.
-- Corre con los permisos de quien la llama: las políticas RLS dejan crear solicitudes solo a Bodega.
create function crear_solicitud(p_productos jsonb) returns integer
language plpgsql as $$
declare
  v_id integer;
begin
  if coalesce(jsonb_array_length(p_productos), 0) = 0 then
    raise exception 'La solicitud necesita al menos un producto';
  end if;

  insert into solicitud_compra (creada_por) values (auth.uid()) returning id into v_id;

  insert into detalle_solicitud (solicitud_id, producto_id, cantidad_sugerida, cantidad_solicitada)
  select v_id, s.producto_id, s.sugerido_compra, i.cantidad
    from jsonb_to_recordset(p_productos) as i(producto_id integer, cantidad integer)
    join stock_actual s on s.producto_id = i.producto_id and s.estado <> 'OK';

  if (select count(*) from detalle_solicitud where solicitud_id = v_id) <> jsonb_array_length(p_productos) then
    raise exception 'Solo se pueden pedir productos sin stock o por reponer';
  end if;
  return v_id;
end $$;

-- Confirma un conteo físico (RF11) en una sola transacción: guarda el conteo, el detalle de cada producto
-- contado (con el stock que tenía el sistema) y un movimiento de tipo ajuste por cada diferencia. Recibe
-- [{"producto_id": 1, "cantidad_contada": 205}, ...]. Solo cuenta los productos que vienen en la lista:
-- los demás no se ajustan. Corre con los permisos de quien la llama: las políticas RLS dejan contar solo a
-- Bodega, y el trigger de stock rechaza cualquier ajuste que lo deje negativo.
create function confirmar_conteo(p_conteo jsonb) returns jsonb
language plpgsql as $$
declare
  v_id integer;
  v_ajustes integer;
begin
  if coalesce(jsonb_array_length(p_conteo), 0) = 0 then
    raise exception 'El conteo necesita al menos un producto';
  end if;

  insert into conteo_fisico (usuario_id) values (auth.uid()) returning id into v_id;

  insert into detalle_conteo (conteo_id, producto_id, cantidad_sistema, cantidad_contada)
  select v_id, s.producto_id, s.stock, i.cantidad_contada
    from jsonb_to_recordset(p_conteo) as i(producto_id integer, cantidad_contada integer)
    join stock_actual s on s.producto_id = i.producto_id;

  if (select count(*) from detalle_conteo where conteo_id = v_id) <> jsonb_array_length(p_conteo) then
    raise exception 'Solo se pueden contar productos activos del catálogo';
  end if;

  insert into movimiento (producto_id, tipo, cantidad, usuario_id, conteo_id)
  select producto_id, 'ajuste', cantidad_contada - cantidad_sistema, auth.uid(), v_id
    from detalle_conteo
   where conteo_id = v_id and cantidad_contada <> cantidad_sistema;
  get diagnostics v_ajustes = row_count;

  return jsonb_build_object('conteo_id', v_id, 'contados', jsonb_array_length(p_conteo), 'ajustes', v_ajustes);
end $$;

-- Reporte de consumo (RF13): salidas no anuladas de un período, sumadas por área, producto o trabajador,
-- con un filtro opcional por categoría (por ejemplo EPP). Las fechas se toman en hora de Chile, para que una
-- salida de la noche no pase al día siguiente. Corre con los permisos de quien la llama; el reporte es de Gerencia (RF13).
create function reporte_consumo(p_desde date, p_hasta date, p_agrupar text, p_categoria integer default null)
returns table (grupo text, salidas integer, unidades integer)
language plpgsql stable as $$
begin
  if (select rol_actual()) is distinct from 'gerencia' then
    raise exception 'Solo Gerencia puede consultar los reportes';
  end if;
  if p_agrupar not in ('area', 'producto', 'trabajador') then
    raise exception 'Agrupación no válida: %', p_agrupar;
  end if;
  return query
  select (case p_agrupar when 'area' then a.nombre when 'producto' then p.nombre else t.nombre end)::text,
         count(*)::integer, sum(m.cantidad)::integer
    from movimiento m
    join producto p on p.id = m.producto_id
    join area a on a.id = m.area_id
    join trabajador t on t.id = m.trabajador_id
   where m.tipo = 'salida' and m.anulado_por is null
     and (m.fecha at time zone 'America/Santiago')::date between p_desde and p_hasta
     and (p_categoria is null or p.categoria_id = p_categoria)
   group by 1
   order by 3 desc, 1;
end $$;

-- ---------------------------------------------------------------------------
-- 5. SEGURIDAD POR PERFIL (Row Level Security)
-- Sin sesión no se accede a nada; con sesión, cada perfil hace solo lo suyo.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;

alter table rol               enable row level security;
alter table usuario           enable row level security;
alter table area              enable row level security;
alter table trabajador        enable row level security;
alter table categoria         enable row level security;
alter table producto          enable row level security;
alter table solicitud_compra  enable row level security;
alter table detalle_solicitud enable row level security;
alter table conteo_fisico     enable row level security;
alter table detalle_conteo    enable row level security;
alter table movimiento        enable row level security;

-- Catálogos: los ve cualquier usuario con sesión; solo Gerencia los modifica.
create policy ver_rol        on rol        for select to authenticated using (true);
create policy ver_area       on area       for select to authenticated using (true);
create policy ver_trabajador on trabajador for select to authenticated using (true);
create policy ver_categoria  on categoria  for select to authenticated using (true);
create policy ver_producto   on producto   for select to authenticated using (true);

create policy gerencia_area       on area       for all to authenticated
  using ((select rol_actual()) = 'gerencia') with check ((select rol_actual()) = 'gerencia');
create policy gerencia_trabajador on trabajador for all to authenticated
  using ((select rol_actual()) = 'gerencia') with check ((select rol_actual()) = 'gerencia');
create policy gerencia_categoria  on categoria  for all to authenticated
  using ((select rol_actual()) = 'gerencia') with check ((select rol_actual()) = 'gerencia');
create policy gerencia_producto   on producto   for all to authenticated
  using ((select rol_actual()) = 'gerencia') with check ((select rol_actual()) = 'gerencia');

-- Usuarios: cada uno ve y edita su propia fila; Gerencia administra todas.
create policy ver_usuario      on usuario for select to authenticated
  using (id = auth.uid() or (select rol_actual()) = 'gerencia');
create policy editar_perfil    on usuario for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy gerencia_usuario on usuario for all to authenticated
  using ((select rol_actual()) = 'gerencia') with check ((select rol_actual()) = 'gerencia');

-- Movimientos: los ven ambos perfiles; solo Bodega los registra; solo Gerencia los anula.
create policy ver_movimiento on movimiento for select to authenticated using (true);
create policy bodega_registra_movimiento on movimiento for insert to authenticated
  with check ((select rol_actual()) = 'bodega' and usuario_id = auth.uid() and anulado_por is null);
create policy gerencia_anula_movimiento on movimiento for update to authenticated
  using ((select rol_actual()) = 'gerencia' and anulado_por is null)
  with check (anulado_por = auth.uid());
-- Solo pueden cambiar los datos de anulación; el resto del movimiento queda fijo.
revoke update on movimiento from authenticated;
grant update (motivo_anulacion, anulado_por, fecha_anulacion) on movimiento to authenticated;

-- Solicitudes de compra: Bodega crea, Gerencia resuelve y marca como comprada.
create policy ver_solicitud on solicitud_compra for select to authenticated using (true);
create policy bodega_crea_solicitud on solicitud_compra for insert to authenticated
  with check ((select rol_actual()) = 'bodega' and creada_por = auth.uid() and estado = 'pendiente');
create policy gerencia_resuelve_solicitud on solicitud_compra for update to authenticated
  using ((select rol_actual()) = 'gerencia') with check ((select rol_actual()) = 'gerencia');

create policy ver_detalle_solicitud on detalle_solicitud for select to authenticated using (true);
-- Solo se agregan productos a una solicitud propia que sigue pendiente: lo aprobado no se altera.
create policy bodega_crea_detalle_solicitud on detalle_solicitud for insert to authenticated
  with check ((select rol_actual()) = 'bodega'
    and exists (select 1 from solicitud_compra s
                 where s.id = solicitud_id and s.creada_por = auth.uid() and s.estado = 'pendiente'));

-- Conteos físicos: los hace Bodega; ambos perfiles los consultan.
create policy ver_conteo on conteo_fisico for select to authenticated using (true);
create policy bodega_crea_conteo on conteo_fisico for insert to authenticated
  with check ((select rol_actual()) = 'bodega' and usuario_id = auth.uid());

create policy ver_detalle_conteo on detalle_conteo for select to authenticated using (true);
-- Solo se agregan productos a un conteo propio que todavía no generó ajustes: un conteo confirmado no se altera.
create policy bodega_crea_detalle_conteo on detalle_conteo for insert to authenticated
  with check ((select rol_actual()) = 'bodega'
    and exists (select 1 from conteo_fisico c
                 where c.id = conteo_id and c.usuario_id = auth.uid()
                   and not exists (select 1 from movimiento m where m.conteo_id = c.id)));

-- ---------------------------------------------------------------------------
-- 6. DATOS BASE (los dos perfiles del sistema)
-- ---------------------------------------------------------------------------
insert into rol (nombre) values ('bodega'), ('gerencia');
