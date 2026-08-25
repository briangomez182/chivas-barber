# Chivas Barbería Club

Sitio web + sistema de agendamiento para **Chivas Barbería Club**
(Av. San Juan 2454, C1232 CABA · +54 9 11 6006-8637).

Next.js 15 (App Router) · TypeScript estricto · Tailwind CSS · Framer Motion ·
Three.js vía `@react-three/fiber` + `@react-three/drei`.

---

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completá SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
npm run dev                  # http://localhost:3000
```

Otros scripts:

```bash
npm run build      # build de producción
npm run start      # servidor de producción
npm run lint       # ESLint (next/core-web-vitals + next/typescript)
npm run typecheck  # tsc --noEmit
npm run db:seed    # carga los datos iniciales en Supabase
```

### Base de datos (Supabase)

Los datos viven en Postgres, en un proyecto de [Supabase](https://supabase.com).
Preparación, una sola vez:

1. Creá un proyecto en Supabase.
2. En **SQL Editor**, pegá y ejecutá el contenido de
   [`supabase/schema.sql`](supabase/schema.sql). Crea las tablas, los índices,
   la función `book_appointment` y activa Row Level Security.
3. En **Project Settings › API**, copiá la *Project URL* y la *service_role*
   key a `.env.local` (`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`).
4. Cargá los datos iniciales:

   ```bash
   npm run db:seed
   ```

   Si todavía existe `data/db.json` (el store en archivo que se usaba antes),
   el script migra **esos** datos y conserva los hashes de contraseña. Si no,
   carga el catálogo de demo: 3 barberos, 5 servicios y un admin.

   La contraseña del admin sale de `ADMIN_PASSWORD` (por defecto `admin`):

   ```bash
   ADMIN_PASSWORD='algo-mejor' npm run db:seed
   ```

> **La `service_role` key salta Row Level Security: es una credencial de
> servidor.** Sólo se usa desde Route Handlers y Server Components
> (`lib/supabase.ts`). Nunca la pongas en una variable `NEXT_PUBLIC_*`.



---

## Rutas

| Ruta        | Tipo      | Descripción                                                              |
| ----------- | --------- | ------------------------------------------------------------------------ |
| `/`         | Server    | Hero 3D, servicios, barberos, widget de agenda y footer                  |
| `/login`    | Server    | Acceso a administración (formulario cliente dentro de `Suspense`)        |
| `/register` | Server    | Alta de clientes                                                          |
| `/admin`    | Server    | Dashboard protegido por `middleware.ts` + verificación en el server      |
| `not-found` | Client    | 404 interactiva con parallax de cursor                                    |

### API (Route Handlers)

| Método             | Endpoint                              | Auth  |
| ------------------ | ------------------------------------- | ----- |
| `GET`              | `/api/barbers` (`?all=1`)             | —     |
| `POST`             | `/api/barbers`                        | admin |
| `PATCH` / `DELETE` | `/api/barbers/:id`                    | admin |
| `GET`              | `/api/services`                       | —     |
| `POST`             | `/api/services`                       | admin |
| `PATCH` / `DELETE` | `/api/services/:id`                   | admin |
| `GET`              | `/api/settings`                       | —     |
| `PUT`              | `/api/settings`                       | admin |
| `GET`              | `/api/availability?date=&barberId=&duration=` | — |
| `POST`             | `/api/appointments`                   | —     |
| `GET`              | `/api/appointments?date=`             | admin |
| `PATCH` / `DELETE` | `/api/appointments/:id`               | admin |
| `POST`             | `/api/auth/login` · `logout` · `register` | —  |
| `GET`              | `/api/auth/me`                        | —     |

---

## Estructura

```
src/
├── app/
│   ├── layout.tsx            # next/font (Plus Jakarta Sans) + JSON-LD HairSalon
│   ├── page.tsx              # landing (Server Component)
│   ├── not-found.tsx         # 404 interactiva
│   ├── error.tsx             # error boundary global
│   ├── login/ · register/ · admin/
│   └── api/…                 # Route Handlers
├── components/
│   ├── hero/                 # Hero + escena 3D (ClipperScene, ClipperModel)
│   ├── layout/               # SiteHeader, SiteFooter, Logo
│   ├── sections/             # Servicios, Barberos, Local, BookingExperience
│   ├── booking/              # Calendar, DurationPills, SlotGrid, BookingWidget
│   ├── admin/                # AdminDashboard + paneles CRUD
│   └── ui/                   # Modal, Field, BarberAvatar
├── lib/
│   ├── types.ts  db.ts  supabase.ts  slots.ts  date.ts
│   ├── session.ts  password.ts  guard.ts
│   ├── api-client.ts  brand.ts
└── middleware.ts             # protege /admin (Edge Runtime)

supabase/schema.sql           # tablas, índices, book_appointment, RLS
scripts/seed.mjs              # carga inicial / migración desde data/db.json
```

---

## Sistema de agendas

`lib/slots.ts` genera los bloques de cada día a partir de `Settings`:

- **paso** = `slotIntervalMin` (15 / 30 / 45 / 60), configurable desde `/admin`;
- un bloque existe sólo si el servicio completo entra antes del cierre;
- se descartan los bloques que se solapan con turnos existentes del mismo
  barbero (incluyendo `bufferMin` de descanso);
- en el día de hoy los horarios pasados quedan deshabilitados.

Las fechas se manejan siempre como `YYYY-MM-DD` y las horas como `HH:mm`, con
`America/Argentina/Buenos_Aires` como huso de referencia (`lib/date.ts`), para
que servidor y navegador coincidan.

---

## Hero 3D

`ClipperModel.tsx` construye una máquina de afeitar estilizada con primitivas
(`RoundedBox`, `boxGeometry`, `TubeGeometry`) y `meshStandardMaterial` con
`metalness` alto y `roughness` bajo. `ClipperScene.tsx` agrega:

- `Float` (flotado suave) + rotación en loop dentro del propio modelo;
- `ParallaxRig`, que interpola la rotación del grupo siguiendo `state.pointer`
  (efecto parallax con el mouse);
- un `Environment` armado con `Lightformer` — estudio procedural, **sin
  descargar ningún HDRI**, así que funciona offline;
- `ContactShadows` para apoyar el objeto.

El canvas se carga con `next/dynamic({ ssr: false })`: WebGL no existe en el
servidor.

---

## Decisiones técnicas

- **Persistencia**: Postgres en Supabase, vía `@supabase/supabase-js` con la
  `service_role` key desde el servidor (`lib/supabase.ts`). `lib/db.ts` expone
  funciones por entidad (`listBarbers`, `bookAppointment`, …) y traduce entre
  el `snake_case` de Postgres y el `camelCase` del dominio.
- **Reservas sin doble booking**: el chequeo de solapamiento y el `INSERT`
  ocurren dentro de la función Postgres `book_appointment`, que toma un
  advisory lock por (barbero, día). Hacerlo en JS dejaría una ventana entre el
  `SELECT` y el `INSERT` donde dos reservas simultáneas toman el mismo hueco.
- **RLS**: activo en todas las tablas y sin policies, así las claves públicas
  no acceden a nada. El único camino a los datos es el servidor.
- **Auth**: mock con cookie `httpOnly` firmada con HMAC-SHA256 vía **Web
  Crypto**, para que el mismo código valide en Node y en el Edge Runtime del
  middleware. Contraseñas con `scrypt` + salt. Para producción conviene
  reemplazarlo por Auth.js / Clerk / Supabase.
- **Sin `var`**: sólo `const` / `let`, con tipos explícitos en props, estados y
  valores de retorno.
- **HTML semántico**: `header`, `nav`, `main`, `section`, `article`, `aside`,
  `address`, `footer`, `fieldset`/`legend`, `dl`/`dt`/`dd`, `table`/`caption`.

---

## Deploy (Vercel)

1. Importá el repo en Vercel. **Root Directory** tiene que quedar en `./` — es
   donde está `package.json`; si apunta a otro lado el build falla con
   *"No Next.js version detected"*.
2. Cargá las variables de entorno en **Settings › Environment Variables**
   (Production, Preview y Development):

   | Variable | Valor |
   | --- | --- |
   | `AUTH_SECRET` | `openssl rand -base64 32` |
   | `SUPABASE_URL` | Project URL de Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key de Supabase |

3. Deploy. El esquema y los datos ya viven en Supabase, así que no hace falta
   ningún paso de migración en el build.

Si cambiás `AUTH_SECRET` después de publicar, las sesiones abiertas se
invalidan y todo el mundo tiene que volver a entrar.
