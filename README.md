# Chivas Barbería Club

Sitio web + sistema de agendamiento para **Chivas Barbería Club**
(Av. San Juan 2454, C1232 CABA · +54 9 11 6006-8637).

Next.js 15 (App Router) · TypeScript estricto · Tailwind CSS · Framer Motion ·
Three.js vía `@react-three/fiber` + `@react-three/drei`.

---

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # opcional: define AUTH_SECRET
npm run dev                  # http://localhost:3000
```

Otros scripts:

```bash
npm run build      # build de producción
npm run start      # servidor de producción
npm run lint       # ESLint (next/core-web-vitals + next/typescript)
npm run typecheck  # tsc --noEmit
```

> La primera vez que se accede al sitio se crea `data/db.json` con los datos
> semilla: 3 barberos (John, Alex, Mateo), 5 servicios, la configuración de la
> agenda y el usuario administrador.



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
│   ├── types.ts  db.ts  slots.ts  date.ts
│   ├── session.ts  password.ts  guard.ts
│   ├── api-client.ts  brand.ts
└── middleware.ts             # protege /admin (Edge Runtime)
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

- **Persistencia**: store JSON en `data/db.json` (`lib/db.ts`), con cola de
  escritura para evitar condiciones de carrera. Para migrar a Postgres/Prisma
  alcanza con reimplementar ese módulo; la UI no cambia.
- **Auth**: mock con cookie `httpOnly` firmada con HMAC-SHA256 vía **Web
  Crypto**, para que el mismo código valide en Node y en el Edge Runtime del
  middleware. Contraseñas con `scrypt` + salt. Para producción conviene
  reemplazarlo por Auth.js / Clerk / Supabase.
- **Sin `var`**: sólo `const` / `let`, con tipos explícitos en props, estados y
  valores de retorno.
- **HTML semántico**: `header`, `nav`, `main`, `section`, `article`, `aside`,
  `address`, `footer`, `fieldset`/`legend`, `dl`/`dt`/`dd`, `table`/`caption`.

---

## Deploy

Vercel funciona out of the box, con una salvedad: el filesystem de las
funciones serverless es efímero, así que `data/db.json` se reinicia. Antes de
publicar, reemplazá `lib/db.ts` por una base real (Vercel Postgres, Supabase,
Turso, Neon…). Definí también `AUTH_SECRET` en las variables de entorno.
