# Notificaciones push (PWA) al staff

Aviso instantáneo en el celular cada vez que entra un turno nuevo, con el
sitio instalado como app en la pantalla de inicio. Pensado sobre todo para
**Chrome en Android** (en iPhone sólo funciona con la PWA instalada y iOS
16.4+).

## Cómo funciona

```
Turno nuevo
  ├─ con seña   → webhook de Mercado Pago (pago approved) → notifyNewAppointment()
  └─ sin seña   → POST /api/book (turno confirmed directo) → notifyNewAppointment()

notifyNewAppointment()  (src/lib/push.ts)
  → lee todas las filas de `public.push_subscriptions`
  → le pega a cada endpoint con las claves VAPID (Web Push Protocol)
       éxito           → last_success_at
       404 / 410       → suscripción vencida: se BORRA la fila
       otro error      → last_error (sin reintento)
```

Es best-effort: no hay cola ni cron. El aviso "con reintentos" sigue siendo
el de WhatsApp (`docs/whatsapp-setup.md`); este es el complemento rápido.

Archivos: `src/lib/push.ts` (envío), `src/app/api/push/*` (config + alta/baja +
prueba), `public/sw.js` (service worker), `src/app/manifest.ts` (PWA),
`src/components/admin/PushNotificationsCard.tsx` (UI del panel),
`supabase/migrations/0016_push_subscriptions.sql` (tabla).

## Puesta en marcha

### 1. Migración

Ejecutar `supabase/migrations/0016_push_subscriptions.sql` en el SQL Editor de
Supabase. Es idempotente.

### 2. Claves VAPID

```bash
npx web-push generate-vapid-keys
```

Cargar en Vercel (**Settings → Environment Variables**) y en `.env.local`:

| Variable            | Valor                                  |
| ------------------- | -------------------------------------- |
| `VAPID_PUBLIC_KEY`  | la *Public Key* que imprimió el comando |
| `VAPID_PRIVATE_KEY` | la *Private Key*                        |
| `VAPID_SUBJECT`     | `mailto:hola@chivasbarberiaclub.com` (opcional) |

Redeploy después de agregarlas.

### 3. Activar en el dispositivo (1 vez por celular)

1. Abrir el sitio en Chrome de Android e instalarlo (menú ⋮ → *Agregar a
   pantalla de inicio*).
2. Entrar al panel → **Configuraciones → Notificaciones push (app)** →
   **Activar en este dispositivo** y aceptar el permiso.
3. **Enviar prueba** para confirmar que llega.

Si el permiso quedó bloqueado: ajustes del navegador → el sitio →
Notificaciones → Permitir.

## Notas

- La tabla `push_subscriptions` sólo la toca la `service_role` (RLS activo sin
  policies), igual que `notifications` y `rate_limits`.
- La clave pública VAPID no es secreta, pero se sirve sólo a staff vía
  `GET /api/push`.
- Cada dispositivo es una fila (`endpoint` único). Al desinstalar la PWA o
  revocar el permiso, la fila se limpia sola en el próximo envío (404/410).
