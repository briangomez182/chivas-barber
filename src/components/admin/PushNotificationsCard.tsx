'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { api } from '@/lib/api-client';

/**
 * Alta/baja de notificaciones push (Web Push) para el dispositivo actual.
 *
 * Se muestra como una tarjeta más en Configuraciones. Es autónoma: no forma
 * parte del formulario de settings, hace sus propias llamadas a `/api/push*`.
 *
 * Flujo: registra `/sw.js` → pide permiso de notificaciones → se suscribe con
 * la clave VAPID pública → manda el `PushSubscription` al server. En Android
 * Chrome funciona en una pestaña normal; en iOS sólo con la PWA instalada
 * (iOS 16.4+).
 */

/** La clave VAPID viene en base64url; `pushManager.subscribe` la quiere como bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

type Support = 'checking' | 'unsupported' | 'ok';
type Perm = NotificationPermission;

export function PushNotificationsCard() {
  const [support, setSupport] = useState<Support>('checking');
  const [configured, setConfigured] = useState<boolean>(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [deviceCount, setDeviceCount] = useState<number>(0);
  const [permission, setPermission] = useState<Perm>('default');
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const regRef = useRef<ServiceWorkerRegistration | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const cfg = await api.push.config();
      setConfigured(cfg.configured);
      setPublicKey(cfg.publicKey);
      setDeviceCount(cfg.deviceCount);
    } catch {
      // Silencioso: el estado de soporte/permiso igual se muestra.
    }
  }, []);

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    if (!supported) {
      setSupport('unsupported');
      return;
    }

    setSupport('ok');
    setPermission(Notification.permission);

    let cancelled = false;
    (async (): Promise<void> => {
      await refresh();
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        if (cancelled) return;
        regRef.current = reg;
        const existing = await reg.pushManager.getSubscription();
        if (!cancelled) setSubscribed(existing !== null);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? `No se pudo registrar el service worker: ${cause.message}`
              : 'No se pudo registrar el service worker.',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const enable = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (!publicKey) {
        throw new Error('El servidor todavía no tiene la clave pública VAPID.');
      }

      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        throw new Error(
          'Permiso de notificaciones denegado. Activalo desde los ajustes del navegador para este sitio.',
        );
      }

      const reg =
        regRef.current ?? (await navigator.serviceWorker.register('/sw.js'));
      regRef.current = reg;
      await navigator.serviceWorker.ready;

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await api.push.subscribe(subscription.toJSON() as PushSubscriptionJSON);
      setSubscribed(true);
      setMessage('Listo. Este dispositivo va a recibir los avisos de turnos nuevos.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo activar.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const reg = regRef.current;
      const subscription = reg ? await reg.pushManager.getSubscription() : null;
      if (subscription) {
        await api.push.unsubscribe(subscription.endpoint).catch(() => {});
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      setMessage('Notificaciones desactivadas en este dispositivo.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo desactivar.');
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const summary = await api.push.test();
      setMessage(
        `Prueba enviada: ${summary.sent} enviada(s), ${summary.failed} con error` +
          (summary.removed ? `, ${summary.removed} suscripción(es) vencida(s) eliminada(s)` : '') +
          '.',
      );
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo enviar la prueba.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-7">
      <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
        Notificaciones push (app)
      </h3>

      <p className="mt-4 text-sm text-ink-soft">
        Recibí un aviso en el celular cada vez que entra un turno nuevo, con la
        app instalada en la pantalla de inicio.
      </p>

      {support === 'unsupported' && (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
          Este navegador no soporta notificaciones push. En iPhone: instalá la
          app en la pantalla de inicio (Compartir → Agregar a inicio) y abrila
          desde ahí.
        </p>
      )}

      {support === 'ok' && !configured && (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
          Falta configurar las claves VAPID en el servidor
          (<code>VAPID_PUBLIC_KEY</code> y <code>VAPID_PRIVATE_KEY</code> en
          Vercel). Generá el par con{' '}
          <code>npx web-push generate-vapid-keys</code>.
        </p>
      )}

      {support === 'ok' && configured && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {!subscribed ? (
              <button
                type="button"
                onClick={enable}
                disabled={busy}
                className="pill-primary text-sm"
              >
                {busy ? 'Activando…' : 'Activar en este dispositivo'}
              </button>
            ) : (
              <>
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand">
                  ● Activadas en este dispositivo
                </span>
                <button
                  type="button"
                  onClick={sendTest}
                  disabled={busy}
                  className="pill-outline text-sm"
                >
                  Enviar prueba
                </button>
                <button
                  type="button"
                  onClick={disable}
                  disabled={busy}
                  className="pill-ghost text-sm"
                >
                  Desactivar
                </button>
              </>
            )}
          </div>

          <p className="mt-3 text-xs text-ink-muted">
            {deviceCount === 0
              ? 'Ningún dispositivo suscrito todavía.'
              : `${deviceCount} dispositivo(s) suscrito(s) en total.`}
            {permission === 'denied' &&
              ' · El permiso está bloqueado para este sitio: habilitalo en los ajustes del navegador.'}
          </p>
        </>
      )}

      {message && (
        <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-xs font-medium text-brand">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
