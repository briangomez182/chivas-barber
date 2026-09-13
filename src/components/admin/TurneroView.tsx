'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';

import { Logo } from '@/components/layout/Logo';
import { XIcon } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { Toast } from '@/components/ui/Toast';
import { api } from '@/lib/api-client';
import { formatCustomerPhone } from '@/lib/brand';
import { TIMEZONE, formatDuration, formatLongDate, formatPrice } from '@/lib/date';
import type { Appointment, TurneroBlock, TurneroSnapshot } from '@/lib/types';

/** Cada cuánto se refresca la vista. */
const POLL_MS = 10_000;
/** Cuánto queda visible el cartel de "nuevo turno" antes de auto-ocultarse. */
const ARRIVAL_TTL_MS = 25_000;

interface TurneroViewProps {
  role: 'admin' | 'editor';
  userName: string;
  barbers: { id: string; name: string }[];
  initialBarberId: string | null;
  services: { id: string; name: string }[];
}

const STATUS_LABELS: Record<Appointment['status'], string> = {
  confirmed: 'Confirmado',
  pending: 'Pendiente',
  pending_payment: 'Esperando pago',
  done: 'Atendido',
  cancelled: 'Cancelado',
};

/** ¿El turno pagó la seña por Mercado Pago? */
function isPaidDeposit(appointment: Appointment): boolean {
  return appointment.amount != null && appointment.status === 'confirmed';
}

/**
 * Clave estable por bloque para que `AnimatePresence` sepa cuál sale y cuál
 * entra cuando la agenda avanza (pasa la hora del primer turno).
 */
function blockKey(block: TurneroBlock, index: number): string {
  if (block.appointment) return `appt-${block.appointment.id}`;
  if (block.time) return `${block.state}-${block.time}`;
  return `filler-${index}`;
}

/** Cuánto suena la alerta en total (campanita ascendente que se repite). */
const BEEP_DURATION_S = 2;
/** do–mi–sol; cada motivo dura ~0.4 s y se repite cada 0.55 s. */
const BEEP_MOTIF = [523.25, 659.25, 783.99];
const BEEP_NOTE_GAP_S = 0.11;
const BEEP_REPEAT_EVERY_S = 0.55;

/**
 * Un único `AudioContext` para toda la vida de la página. Crear/cerrar uno
 * por cada beep chocaba con el límite de contextos de Chrome y el `close()`
 * diferido cortaba el sonido después del primer motivo.
 */
let audioCtx: AudioContext | null = null;
// Reloj del `AudioContext` hasta el que ya hay notas agendadas: evita que dos
// llamadas casi simultáneas (StrictMode en dev, doble disparo del poll, etc.)
// apilen la alerta y suene el doble de largo.
let beepScheduledUntil = 0;
// El barbero ya confirmó el sonido en esta pestaña (con el botón del modal).
// Vive fuera del componente para no volver a pedirlo al navegar entre
// /admin/mis-turnos y /admin/turnero; se reinicia al recargar la página.
let soundArmed = false;

/** ¿El audio está bloqueado por la política de autoplay del navegador? */
function isAudioBlocked(): boolean {
  const ctx = getAudioCtx();
  return !ctx || ctx.state !== 'running';
}

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) {
    try {
      audioCtx = new Ctor();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

/** Reanuda el contexto — llamar desde un gesto del usuario (botón/modal). */
function unlockAudio(): void {
  const ctx = getAudioCtx();
  if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => {});
}

/**
 * Alerta sonora con WebAudio (sin archivos): campanita de 3 notas ascendentes
 * que se repite durante `BEEP_DURATION_S` s. Todas las notas se agendan de
 * una sola vez contra el reloj del `AudioContext`.
 */
function playBeep(): void {
  const ctx = getAudioCtx();
  if (!ctx) return;

  const schedule = (): void => {
    // Si ya hay una alerta sonando/agendada, no se apila otra encima.
    if (ctx.currentTime < beepScheduledUntil) return;

    const base = ctx.currentTime + 0.03;
    const noteTail = 0.28;
    for (let start = 0; start < BEEP_DURATION_S; start += BEEP_REPEAT_EVERY_S) {
      BEEP_MOTIF.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = base + start + i * BEEP_NOTE_GAP_S;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + noteTail);
      });
    }
    beepScheduledUntil = base + BEEP_DURATION_S;
  };

  if (ctx.state === 'suspended') {
    void ctx.resume().then(schedule).catch(() => {
      /* el navegador bloqueó el audio hasta la primera interacción */
    });
  } else {
    schedule();
  }
}

export function TurneroView({
  role,
  userName,
  barbers,
  initialBarberId,
  services,
}: TurneroViewProps) {
  const [barberId, setBarberId] = useState<string | null>(initialBarberId);
  const [snapshot, setSnapshot] = useState<TurneroSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [arrival, setArrival] = useState<Appointment | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  // Modal recordatorio: aparece en cada carga/recarga si el navegador tiene
  // el audio bloqueado por la política de autoplay (contexto `suspended`).
  const [needsSoundUnlock, setNeedsSoundUnlock] = useState<boolean>(false);
  // TEMPORAL: botón "Turno de prueba" (siempre visible para staff). Quitar
  // junto con /api/turnero/test cuando no se use más.
  const [creatingTest, setCreatingTest] = useState<boolean>(false);

  // `id -> status` del poll anterior: dispara el cartel cuando un turno pasa
  // a `confirmed` (pagó la seña), no sólo cuando aparece la fila.
  const prevStatus = useRef<Map<string, Appointment['status']>>(new Map());
  const primed = useRef<boolean>(false);

  const serviceName = useCallback(
    (id: string | null): string =>
      services.find((service) => service.id === id)?.name ?? 'Sin servicio',
    [services],
  );

  // Al entrar a la vista (montaje): si todavía no se confirmó el audio en esta
  // pestaña, se muestra el modal para activarlo con un clic. Aparece tanto al
  // recargar como al navegar desde "Mis turnos" — el navegador exige un gesto
  // del usuario para poder reproducir audio.
  useEffect(() => {
    if (!soundArmed) setNeedsSoundUnlock(true);
  }, []);

  const enableSound = useCallback((): void => {
    unlockAudio();
    playBeep();
    soundArmed = true;
    setNeedsSoundUnlock(false);
    setToast('Sonido activado. Vas a escuchar un aviso con cada turno nuevo.');
  }, []);

  // Suena la alerta; si el navegador la bloqueó, vuelve a pedir activarla.
  const beepOrPrompt = useCallback((): void => {
    playBeep();
    if (isAudioBlocked()) {
      soundArmed = false;
      setNeedsSoundUnlock(true);
    }
  }, []);

  // Reloj en vivo.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const createTestTurn = useCallback(async (): Promise<void> => {
    setCreatingTest(true);
    try {
      const { appointment } = await api.turnero.createTest(
        role === 'admin' ? (barberId ?? undefined) : undefined,
      );
      setToast(
        `Turno de prueba creado: ${appointment.customerName} · ${appointment.time}. El cartel aparece en el próximo refresco.`,
      );
    } catch (cause) {
      setToast(
        cause instanceof Error
          ? cause.message
          : 'No se pudo crear el turno de prueba',
      );
    } finally {
      setCreatingTest(false);
    }
  }, [barberId, role]);

  // Auto-oculta el cartel de llegada.
  useEffect(() => {
    if (!arrival) return;
    const timer = setTimeout(() => setArrival(null), ARRIVAL_TTL_MS);
    return () => clearTimeout(timer);
  }, [arrival]);

  // Poll cada POLL_MS. Se reinicia al cambiar de barbero.
  useEffect(() => {
    if (!barberId) {
      setLoading(false);
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    primed.current = false;
    prevStatus.current = new Map();
    setSnapshot(null);
    setLoading(true);

    const tick = async (): Promise<void> => {
      try {
        const snap = await api.turnero.get(role === 'admin' ? barberId : undefined);
        if (!active) return;

        setSnapshot(snap);
        setError(null);
        setLastUpdated(new Date());

        if (!primed.current) {
          primed.current = true;
        } else {
          const justPaid = snap.today.filter(
            (appointment) =>
              isPaidDeposit(appointment) &&
              prevStatus.current.get(appointment.id) !== 'confirmed',
          );
          const otherNew = snap.today.filter(
            (appointment) =>
              !prevStatus.current.has(appointment.id) &&
              appointment.status !== 'pending_payment' &&
              !isPaidDeposit(appointment),
          );

          if (justPaid.length > 0) {
            setArrival(justPaid[justPaid.length - 1]);
            beepOrPrompt();
          } else if (otherNew.length > 0) {
            const appointment = otherNew[otherNew.length - 1];
            setToast(`Nuevo turno: ${appointment.customerName} · ${appointment.time}`);
            beepOrPrompt();
          }
        }

        prevStatus.current = new Map(
          snap.today.map((appointment) => [appointment.id, appointment.status]),
        );
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'No se pudo actualizar');
      } finally {
        if (active) {
          setLoading(false);
          timer = setTimeout(() => void tick(), POLL_MS);
        }
      }
    };

    void tick();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [barberId, role, beepOrPrompt]);

  const clock = now.toLocaleTimeString('es-AR', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const todayLabel = snapshot ? formatLongDate(snapshot.date) : '';

  const baseBlocks = snapshot?.blocks ?? [];

  return (
    <div className="min-h-dvh bg-gray-50 text-ink">
      <header className="border-b border-gray-100 bg-white">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-4 max-[749px]:hidden">
            <Logo />
            <div>
              <h1 className="text-lg font-extrabold tracking-[-0.02em] text-ink">
                Turnero
              </h1>
              <p className="text-sm text-ink-soft">
                {snapshot?.barberName ?? barbers.find((b) => b.id === barberId)?.name ?? '—'}
                {todayLabel ? ` · ${todayLabel}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="max-w-[32vw] truncate text-sm text-ink-soft">
              <span className="hidden sm:inline">Hola, </span>
              <strong className="font-semibold text-ink">{userName}</strong>
            </span>

            {/* En pantallas angostas (< 750px) se oculta el resto de los
                controles y sólo quedan visibles el nombre y el botón
                "Volver": el Turnero se abre desde el celular sobre todo para
                salir rápido, no para ver la animación ni crear turnos de
                prueba. */}
            <div className="flex flex-wrap items-center gap-2 max-[749px]:hidden">
              {role === 'admin' && barbers.length > 0 && (
                <>
                  <label htmlFor="turnero-barber" className="sr-only">
                    Barbero
                  </label>
                  <select
                    id="turnero-barber"
                    value={barberId ?? ''}
                    onChange={(event) => setBarberId(event.target.value || null)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    {barbers.map((barber) => (
                      <option key={barber.id} value={barber.id}>
                        {barber.name}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <span className="tabular-nums text-sm font-semibold text-ink-soft">
                {clock}
              </span>

              {/* TEMPORAL: crear un turno de prueba con seña "paga". */}
              <button
                type="button"
                onClick={() => void createTestTurn()}
                disabled={creatingTest || (role === 'admin' && !barberId)}
                className="rounded-full border border-dashed border-amber-400 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-40"
              >
                {creatingTest ? 'Creando…' : '🧪 Turno de prueba'}
              </button>
            </div>

            <Link
              href={role === 'editor' ? '/admin/mis-turnos' : '/admin'}
              className="pill-ghost text-sm"
            >
              Volver
            </Link>
          </div>
          </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <AnimatePresence>
          {arrival && (
            <motion.div
              key={arrival.id}
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mb-8 max-w-2xl rounded-4xl bg-brand p-7 text-center text-white shadow-brand"
            >
              <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/80">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                </span>
                Nuevo turno · seña paga
              </div>

              <p className="mt-4 text-3xl font-extrabold leading-tight">
                {arrival.customerName}
              </p>
              <p className="mt-1 text-lg font-semibold text-white/90">
                {arrival.time} · {serviceName(arrival.serviceId)} ·{' '}
                {formatDuration(arrival.durationMin)}
              </p>
              <p className="mt-3 text-sm text-white/85">
                Seña {formatPrice(arrival.amount ?? 0)} paga ·{' '}
                {formatCustomerPhone(arrival.customerPhone)}
              </p>

              <button
                type="button"
                onClick={() => setArrival(null)}
                className="pill mt-5 inline-flex items-center gap-1.5 bg-white/15 text-white hover:bg-white/25"
              >
                <XIcon className="h-4 w-4" />
                Entendido
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {error ? (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-600"
          >
            {error}
          </p>
        ) : (
          <p className="mb-4 text-center text-xs text-ink-muted">
            Se actualiza cada {POLL_MS / 1000} s
            {lastUpdated
              ? ` · última ${lastUpdated.toLocaleTimeString('es-AR', {
                  timeZone: TIMEZONE,
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}`
              : ''}
          </p>
        )}

        <h2 className="mb-4 text-center text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
          Próximos 3 bloques
        </h2>

        {loading && !snapshot ? (
          <p className="text-center text-sm text-ink-muted">Cargando…</p>
        ) : !barberId ? (
          <p className="text-center text-sm text-ink-muted">
            Elegí un barbero para ver su turnero.
          </p>
        ) : (
          <div className="relative overflow-hidden px-1 py-1">
            <ul className="flex flex-col gap-4">
              <AnimatePresence initial={false} mode="popLayout">
                {baseBlocks.map((block, index) => (
                  <motion.li
                    key={blockKey(block, index)}
                    layout
                    initial={{ opacity: 0, y: 48, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -56, scale: 0.96 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <BlockCard block={block} serviceName={serviceName} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </div>
        )}
      </main>

      <Modal
        open={needsSoundUnlock}
        title="Activá el sonido de avisos"
        onClose={() => setNeedsSoundUnlock(false)}
      >
        <div className="space-y-4 text-sm leading-relaxed text-ink-soft">
          <p>
            Por la política de reproducción automática del navegador, el aviso
            sonoro de nuevos turnos queda bloqueado hasta que hagas un clic en
            esta pestaña.
          </p>
          <p>
            Tocá{' '}
            <strong className="font-semibold text-ink">Activar sonido</strong> una
            vez cada vez que abrís el Turnero o recargás la página, y vas a
            escuchar un pitido con cada turno nuevo.
          </p>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => setNeedsSoundUnlock(false)}
            className="pill-outline flex-1"
          >
            Ahora no
          </button>
          <button
            type="button"
            onClick={enableSound}
            className="pill-primary flex-1"
          >
            Activar sonido
          </button>
        </div>
      </Modal>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

interface BlockCardProps {
  block: TurneroBlock;
  serviceName: (id: string | null) => string;
}

function BlockCard({ block, serviceName }: BlockCardProps) {
  const range = block.time ? `${block.time} – ${block.endTime}` : '—';

  if (block.state === 'booked' && block.appointment) {
    const appointment = block.appointment;
    return (
      <div className="rounded-4xl border border-brand-100 bg-white p-6 text-center shadow-card">
        <p className="text-sm font-bold tabular-nums text-brand">{range}</p>
        <p className="mt-2 text-2xl font-extrabold text-ink">
          {appointment.customerName}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {serviceName(appointment.serviceId)} ·{' '}
          {formatDuration(appointment.durationMin)}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {appointment.amount != null && (
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand">
              Seña {formatPrice(appointment.amount)} paga
            </span>
          )}
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-ink-soft">
            {STATUS_LABELS[appointment.status]}
          </span>
          <span className="text-xs text-ink-muted">
            {formatCustomerPhone(appointment.customerPhone)}
          </span>
        </div>
      </div>
    );
  }

  if (block.state === 'blocked') {
    return (
      <div className="rounded-4xl border border-gray-200 bg-gray-50 p-6 text-center">
        <p className="text-sm font-bold tabular-nums text-ink-muted">{range}</p>
        <p className="mt-2 text-lg font-bold text-ink-soft">Bloqueado</p>
        {block.blockedReason && (
          <p className="mt-1 text-sm text-ink-muted">{block.blockedReason}</p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-4xl border border-dashed border-gray-300 bg-white p-6 text-center">
      <p className="text-sm font-bold tabular-nums text-ink-muted">{range}</p>
      <p className="mt-2 text-2xl font-extrabold text-emerald-600">Libre</p>
    </div>
  );
}
