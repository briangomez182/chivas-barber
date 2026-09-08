# Notificación de WhatsApp al dueño (seña pagada)

Cuando un cliente paga la seña de un turno por Mercado Pago, el sistema le
manda un WhatsApp al dueño con los datos del turno.

## Cómo funciona

```
Webhook de Mercado Pago (pago approved)
  → turno pasa a "confirmed"
  → se encola una fila en `public.notifications` (idempotente: 1 por turno)
  → se intenta enviar en el acto por la WhatsApp Cloud API de Meta
       éxito  → fila queda "sent"
       falla  → fila queda "pending" con next_retry_at

Cron /api/notifications/dispatch (1 vez por día en Hobby, ver vercel.json)
  → reintenta las "pending" con backoff (1m, 2m, 4m, 8m… hasta 5 intentos)
  → tras 5 intentos fallidos la fila queda "failed"
```

Archivos: `src/lib/whatsapp.ts` (cliente Graph API), `src/lib/notifications.ts`
(orquestación), `src/app/api/notifications/dispatch/route.ts` (cron),
`supabase/migrations/0015_whatsapp_notifications.sql` (tabla + columna).

## Puesta en marcha

### 1. Migración

Ejecutar `supabase/migrations/0015_whatsapp_notifications.sql` en el proyecto
de Supabase (SQL Editor). Es idempotente.

### 2. Número del dueño

Panel admin → **Configuraciones → Notificaciones → WhatsApp del dueño**.
Formato internacional, ej. `+5491160068637`. Vacío = aviso desactivado.

### 3. App de Meta + WhatsApp Cloud API

1. Ir a <https://developers.facebook.com/> → **My Apps → Create App** → tipo
   **Business**.
2. En el panel de la app, **Add Product → WhatsApp → Set up**.
3. En **WhatsApp → API Setup**:
   - Para probar: usar el **número de test** que da Meta y agregar el número
     del dueño en **"To"** como destinatario de prueba (te pide un código de
     verificación por WhatsApp).
   - Para producción: registrar el número real (requiere verificación del
     negocio y un número que NO tenga WhatsApp normal / Business activo).
   - Copiar el **Phone number ID** (es el ID numérico, no el teléfono) →
     `WHATSAPP_PHONE_NUMBER_ID`.
4. Token permanente: **Business Settings → Users → System Users → Add**
   (rol Admin) → **Generate token** → seleccionar la app → permiso
   **`whatsapp_business_messaging`** (y `whatsapp_business_management`) →
   copiar → `WHATSAPP_ACCESS_TOKEN`. (El token que aparece en "API Setup"
   sirve para probar pero vence a las 24 h.)

### 4. Plantilla

Los mensajes iniciados por el negocio necesitan una plantilla aprobada
(no se puede mandar texto libre).

**WhatsApp Manager → Plantillas de mensajes → Crear plantilla**

| Campo | Valor |
|---|---|
| Nombre | `turno_confirmado` |
| Categoría | **Utility** (Utilidad) |
| Idioma | Español (`es_AR`) o Español (`es`) |

**Cuerpo:**

```
Nuevo turno con seña pagada ✅

Cliente: {{1}}
Tel: {{2}}
Servicio: {{3}}
Barbero: {{4}}
Fecha: {{5}}
Hora: {{6}}
```

Sin encabezado, sin botones, sin pie. Meta pide un ejemplo para cada
variable — usar algo tipo `Juan Pérez`, `+5491122334455`, `Corte`, `Nico`,
`Lunes 8 de septiembre`, `15:30`.

El orden de las variables lo arma `buildDepositPaidPayload()` en
`src/lib/notifications.ts` — si cambiás el texto de la plantilla, mantené
las 6 variables en ese orden o ajustá esa función.

Cuando la plantilla quede **Approved**, poné su nombre en
`WHATSAPP_TEMPLATE_NAME` y el idioma exacto en `WHATSAPP_TEMPLATE_LANG`.

### 5. Variables de entorno

En `.env.local` (dev) y en Vercel (Project → Settings → Environment
Variables):

```
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_TEMPLATE_NAME=turno_confirmado
WHATSAPP_TEMPLATE_LANG=es_AR
CRON_SECRET=<string aleatorio largo>
```

### 6. Cron en Vercel

`vercel.json` define el cron **una vez por día** (`0 8 * * *`), que es el
máximo que permite el plan Hobby — una expresión más frecuente hace fallar el
deploy. Ojo:

- El envío **inline** desde el webhook cubre el caso normal (llega en el
  momento); el cron diario sólo levanta los avisos que hayan quedado
  `pending` por un fallo puntual.
- Si querés reintentos más frecuentes: pasás a plan Pro y ponés
  `*/5 * * * *`, o usás un pinger externo (cron-job.org, GitHub Actions) que
  pegue cada N minutos a `GET /api/notifications/dispatch` con el header
  `Authorization: Bearer <CRON_SECRET>`.
- El `CRON_SECRET` tiene que estar en las env vars del proyecto para que
  Vercel lo incluya en el request del cron. Sin él, el endpoint responde 401.

## Probar

- **Sin credenciales de Meta**: pagá una seña de prueba → debería aparecer
  una fila en `public.notifications` con `status = 'pending'`. Al cargar las
  env vars y pegarle al endpoint de dispatch, se manda.
- **Con credenciales**: pagá una seña de prueba → llega el WhatsApp al número
  del dueño y la fila queda `status = 'sent'` con `provider_message_id`.
- Reintento manual:

  ```
  curl -X POST https://TU-SITIO/api/notifications/dispatch \
    -H "Authorization: Bearer $CRON_SECRET"
  ```

## Diagnóstico

Todo queda en la fila de `public.notifications`:

- `status` — `pending` / `sent` / `failed`
- `attempts` — intentos hechos
- `last_error` — texto del último error de la Graph API
- `next_retry_at` — cuándo se reintenta
- `provider_message_id` — `wamid...` de Meta si salió bien

Errores frecuentes de Meta:

- **131030** "Recipient phone number not in allowed list" → la app está en
  modo desarrollo; agregá el número como destinatario de prueba, o pasá la
  app a modo Live con la plantilla aprobada.
- **132001** "Template not found" → nombre o idioma no coinciden con
  `WHATSAPP_TEMPLATE_NAME` / `WHATSAPP_TEMPLATE_LANG`.
- **190** "Access token expired" → estás usando el token temporal de 24 h;
  generá el de System User.
