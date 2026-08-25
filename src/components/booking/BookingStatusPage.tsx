'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';

import { api } from '@/lib/api-client';
import { BRAND, whatsappLink } from '@/lib/brand';
import { formatDuration, formatLongDate, formatPrice } from '@/lib/date';

type TrackedAppointment = Awaited<
  ReturnType<typeof api.appointments.track>
>['appointment'];

interface BookingStatusPageProps {
  /** A qué `back_url` de Mercado Pago corresponde esta página. */
  kind: 'success' | 'pending' | 'failure';
}

const ICONS = {
  ok: (
    <svg viewBox="0 0 20 20" className="h-7 w-7 fill-current">
      <path d="M8.1 13.4 4.7 10l-1.4 1.4 4.8 4.8 8.6-8.6-1.4-1.4z" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 20 20" className="h-7 w-7 fill-current">
      <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm.75 4v4.4l3.4 2-.75 1.3-4.15-2.45V6h1.5Z" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 20 20" className="h-7 w-7 fill-current">
      <path d="M10 8.6 6.7 5.3 5.3 6.7 8.6 10l-3.3 3.3 1.4 1.4L10 11.4l3.3 3.3 1.4-1.4L11.4 10l3.3-3.3-1.4-1.4L10 8.6Z" />
    </svg>
  ),
};

// Mientras Mercado Pago redirige más rápido de lo que llega el webhook, se
// consulta el turno unas cuantas veces antes de rendirse y mostrar un
// mensaje de "lo estamos confirmando".
const POLL_ATTEMPTS = 6;
const POLL_DELAY_MS = 2000;

export function BookingStatusPage({ kind }: BookingStatusPageProps) {
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get('external_reference');

  const [appointment, setAppointment] = useState<TrackedAppointment | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notFound, setNotFound] = useState<boolean>(false);
  const attemptsRef = useRef<number>(0);

  useEffect(() => {
    if (!appointmentId) {
      setLoading(false);
      setNotFound(true);
      return;
    }

    let cancelled = false;

    const poll = async (): Promise<void> => {
      try {
        const { appointment: found } = await api.appointments.track(appointmentId);
        if (cancelled) return;

        setAppointment(found);
        setLoading(false);

        const stillWaiting = found.status === 'pending_payment';
        attemptsRef.current += 1;

        if (stillWaiting && attemptsRef.current < POLL_ATTEMPTS) {
          setTimeout(() => void poll(), POLL_DELAY_MS);
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
          setNotFound(true);
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  const confirmed = appointment?.status === 'confirmed';
  const stillPending = appointment?.status === 'pending_payment';
  const cancelled = appointment?.status === 'cancelled';

  const tone: 'ok' | 'clock' | 'x' = confirmed ? 'ok' : cancelled ? 'x' : 'clock';

  const title = loading
    ? 'Confirmando…'
    : notFound
      ? 'No encontramos ese turno'
      : confirmed
        ? '¡Turno confirmado!'
        : cancelled
          ? 'El pago no se completó'
          : kind === 'failure'
            ? 'El pago no se completó'
            : 'Estamos confirmando tu pago';

  const description = loading
    ? 'Un segundo, estamos verificando el estado de tu pago con Mercado Pago.'
    : notFound
      ? 'El link no tiene un turno asociado válido. Si ya pagaste, escribinos por WhatsApp con tu comprobante y lo confirmamos a mano.'
      : confirmed
        ? 'Tu pago fue aprobado y el horario quedó reservado. Te esperamos.'
        : cancelled
          ? 'El pago fue rechazado o cancelado. El horario quedó liberado — podés intentar de nuevo.'
          : stillPending
            ? 'Mercado Pago todavía está procesando el pago (esto puede pasar con transferencias o pagos en efectivo). Te vamos a avisar apenas se acredite; podés cerrar esta página tranquilo.'
            : 'No pudimos confirmar el estado del pago todavía.';

  return (
    <main className="grid min-h-dvh place-items-center bg-gray-50 p-5">
      <motion.article
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl"
      >
        <span
          aria-hidden="true"
          className={`mx-auto grid h-14 w-14 place-items-center rounded-full text-white ${
            tone === 'ok'
              ? 'bg-brand'
              : tone === 'x'
                ? 'bg-red-500'
                : 'bg-amber-500'
          }`}
        >
          {loading ? (
            <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-white/40 border-t-white" />
          ) : (
            ICONS[tone]
          )}
        </span>

        <h1 className="mt-6 text-2xl font-extrabold tracking-[-0.03em] text-ink">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">{description}</p>

        {appointment && !notFound && (
          <dl className="mt-6 space-y-1 rounded-2xl bg-gray-50 p-4 text-left text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Fecha</dt>
              <dd className="font-semibold text-ink">
                {formatLongDate(appointment.date)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-muted">Hora</dt>
              <dd className="font-semibold text-ink">
                {appointment.time} h · {formatDuration(appointment.durationMin)}
              </dd>
            </div>
            {appointment.barberName && (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Barbero</dt>
                <dd className="font-semibold text-ink">{appointment.barberName}</dd>
              </div>
            )}
            {appointment.serviceName && (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Servicio</dt>
                <dd className="font-semibold text-ink">{appointment.serviceName}</dd>
              </div>
            )}
            {appointment.amount !== null && (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Monto</dt>
                <dd className="font-semibold text-ink">
                  {formatPrice(appointment.amount)}
                </dd>
              </div>
            )}
          </dl>
        )}

        <div className="mt-7 flex flex-col gap-2 sm:flex-row">
          <a
            href={whatsappLink(
              confirmed && appointment
                ? `Hola, reservé un turno el ${appointment.date} a las ${appointment.time}.`
                : 'Hola, tengo una consulta sobre un pago de un turno.',
            )}
            target="_blank"
            rel="noreferrer noopener"
            className="pill-outline flex-1"
          >
            Escribir por WhatsApp
          </a>
          <Link href="/" className="pill-primary flex-1">
            Volver al inicio
          </Link>
        </div>

        <p className="mt-4 text-xs text-ink-muted">
          {BRAND.street}, {BRAND.city}
        </p>
      </motion.article>
    </main>
  );
}
