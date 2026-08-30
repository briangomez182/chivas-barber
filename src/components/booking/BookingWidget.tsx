'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { BarberAvatar } from '@/components/ui/BarberAvatar';
import { api } from '@/lib/api-client';
import { formatDuration, formatLongDate, formatPrice, todayIso } from '@/lib/date';
import type {
  Barber,
  Service,
  Settings,
  Slot,
  SlotInterval,
} from '@/lib/types';

import { Calendar } from './Calendar';
import { DurationPills } from './DurationPills';
import { SlotGrid } from './SlotGrid';

interface BookingWidgetProps {
  barbers: Barber[];
  services: Service[];
  settings: Settings;
  selectedBarberId: string;
  onSelectBarber: (barberId: string) => void;
}

export function BookingWidget({
  barbers,
  services,
  settings,
  selectedBarberId,
  onSelectBarber,
}: BookingWidgetProps) {
  const [date, setDate] = useState<string>(todayIso());
  const [durationMin, setDurationMin] = useState<number>(settings.slotIntervalMin);
  const [serviceId, setServiceId] = useState<string>('');
  const [time, setTime] = useState<string | null>(null);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [redirecting, setRedirecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const selectedService = useMemo<Service | undefined>(
    () => services.find((item) => item.id === serviceId),
    [services, serviceId],
  );

  const selectedBarber = useMemo<Barber | undefined>(
    () => barbers.find((item) => item.id === selectedBarberId),
    [barbers, selectedBarberId],
  );

  const loadSlots = useCallback(async (): Promise<void> => {
    if (!selectedBarberId) return;

    setLoadingSlots(true);
    setError(null);

    try {
      const result = await api.availability({
        date,
        barberId: selectedBarberId,
        duration: durationMin,
      });
      setSlots(result.slots);
    } catch (cause) {
      setSlots([]);
      setError(cause instanceof Error ? cause.message : 'Error al cargar horarios');
    } finally {
      setLoadingSlots(false);
    }
  }, [date, selectedBarberId, durationMin]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  // Al cambiar fecha, barbero o duración, la hora elegida deja de ser válida.
  useEffect(() => {
    setTime(null);
  }, [date, selectedBarberId, durationMin]);

  const handleServiceChange = (nextId: string): void => {
    setServiceId(nextId);
    const service = services.find((item) => item.id === nextId);
    if (service) setDurationMin(service.durationMin);
  };

  const handleDurationChange = (minutes: SlotInterval): void => {
    setDurationMin(minutes);
    // Si el servicio elegido ya no coincide con la duración, se deselecciona.
    if (selectedService && selectedService.durationMin !== minutes) {
      setServiceId('');
    }
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    if (!time || !selectedBarber || !serviceId) return;

    setSubmitting(true);
    setError(null);

    const payload = {
      barberId: selectedBarberId,
      serviceId,
      date,
      time,
      durationMin,
      customerName,
      customerPhone,
      customerEmail,
      notes,
    };

    try {
      if (settings.depositEnabled) {
        // Crea el turno en estado "pendiente de pago" y obtiene el link de
        // Checkout Pro de Mercado Pago. El turno recién queda confirmado
        // cuando Mercado Pago avisa que el pago fue aprobado — por eso acá
        // no mostramos ninguna confirmación todavía, sólo redirigimos a
        // pagar.
        const { checkoutUrl } = await api.checkout(payload);
        setRedirecting(true);
        window.location.href = checkoutUrl;
      } else {
        // Sin seña configurada: el turno queda `confirmed` directo, sin
        // pasar por Mercado Pago. Reusamos la pantalla de éxito del flujo
        // pago (misma page, mismo botón de WhatsApp) para que el cliente
        // pueda avisarle al local.
        const { appointment } = await api.book(payload);
        setRedirecting(true);
        window.location.href = `/booking/success?external_reference=${appointment.id}`;
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'No pudimos confirmar el turno',
      );
      await loadSlots();
      setSubmitting(false);
    }
  };

  const canSubmit =
    Boolean(time) &&
    Boolean(selectedBarberId) &&
    Boolean(serviceId) &&
    customerName.trim().length >= 2 &&
    customerPhone.replace(/\D/g, '').length >= 8 &&
    !submitting &&
    !redirecting;

  return (
    <section
      id="agenda"
      aria-labelledby="agenda-title"
      className="border-t border-gray-100 bg-gray-50 py-24 lg:py-32"
    >
      <div className="container-page">
        <div className="max-w-xl">
          <p className="eyebrow">Reservas</p>
          <h2 id="agenda-title" className="section-title mt-3">
            Elegí tu turno
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            Seleccioná barbero, servicio y horario. Los bloques se generan
            automáticamente cada {settings.slotIntervalMin} minutos entre las{' '}
            {settings.openingTime} y las {settings.closingTime}.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          {/* Columna izquierda: calendario mensual */}
          <aside
            aria-label="Selección de fecha"
            className="card h-fit p-6 sm:p-8"
          >
            <Calendar
              value={date}
              onChange={setDate}
              workingDays={settings.workingDays}
            />

            <div className="mt-8 border-t border-gray-100 pt-6">
              <DurationPills value={durationMin} onChange={handleDurationChange} />
            </div>
          </aside>

          {/* Columna derecha: barbero, servicio, slots y datos */}
          <div className="card p-6 sm:p-8">
            <fieldset>
              <legend className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
                Barbero
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {barbers.map((barber) => {
                  const active = barber.id === selectedBarberId;
                  return (
                    <button
                      key={barber.id}
                      type="button"
                      onClick={() => onSelectBarber(barber.id)}
                      aria-pressed={active}
                      className={`flex items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-4 text-sm font-semibold transition-all duration-200 ${
                        active
                          ? 'border-brand bg-brand text-white shadow-brand'
                          : 'border-gray-200 bg-white text-ink hover:border-ink'
                      }`}
                    >
                      <BarberAvatar
                        name={barber.name}
                        photoUrl={barber.photoUrl}
                        size={28}
                        className="ring-0"
                      />
                      {barber.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-7">
              <label
                htmlFor="service"
                className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted"
              >
                Servicio
              </label>
              <select
                id="service"
                required
                aria-required="true"
                value={serviceId}
                onChange={(event) => handleServiceChange(event.target.value)}
                className="mt-3"
              >
                <option value="" disabled>
                  Elegí un servicio…
                </option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} — {formatDuration(service.durationMin)} —{' '}
                    {formatPrice(service.price)}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-7 border-t border-gray-100 pt-7">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-bold text-ink">
                  {formatLongDate(date)}
                </h3>
                <span className="text-xs text-ink-muted">
                  Bloques de {formatDuration(durationMin)}
                </span>
              </div>

              <SlotGrid
                slots={slots}
                value={time}
                onChange={setTime}
                loading={loadingSlots}
              />
            </div>

            <form onSubmit={handleSubmit} className="mt-7 border-t border-gray-100 pt-7">
              <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
                Tus datos
              </h3>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="sr-only">
                    Nombre y apellido
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Nombre y apellido"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="sr-only">
                    Teléfono
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    required
                    autoComplete="tel"
                    placeholder="Teléfono"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="email" className="sr-only">
                    Email (opcional)
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="Email (opcional)"
                    value={customerEmail}
                    onChange={(event) => setCustomerEmail(event.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="notes" className="sr-only">
                    Comentarios
                  </label>
                  <textarea
                    id="notes"
                    rows={2}
                    placeholder="Comentarios para tu barbero (opcional)"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    role="alert"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-ink-soft">
                  {!selectedService ? (
                    'Elegí un servicio para continuar'
                  ) : time ? (
                    <>
                      <span className="font-semibold text-ink">{time} h</span>{' '}
                      con {selectedBarber?.name ?? '—'} · {selectedService.name}
                    </>
                  ) : (
                    'Elegí un horario para continuar'
                  )}
                </p>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="pill-primary w-full px-8 py-3 sm:w-auto"
                >
                  {settings.depositEnabled
                    ? redirecting
                      ? 'Redirigiendo a Mercado Pago…'
                      : submitting
                        ? 'Preparando el pago…'
                        : 'Pagar seña y confirmar turno'
                    : submitting || redirecting
                      ? 'Confirmando turno…'
                      : 'Confirmar turno'}
                </button>
              </div>

              <p className="mt-3 text-xs text-ink-muted">
                {settings.depositEnabled ? (
                  <>
                    Al confirmar vas a ser redirigido a Mercado Pago para pagar
                    una seña de {formatPrice(settings.depositAmount)}
                    {selectedService
                      ? ` (el resto, ${formatPrice(Math.max(selectedService.price - settings.depositAmount, 0))}, se abona en el local)`
                      : ''}
                    . El turno queda reservado recién cuando el pago se aprueba.
                  </>
                ) : (
                  'Al confirmar, tu turno queda reservado al instante — el pago se '
                  + 'arregla en el local. Vas a poder avisarnos por WhatsApp desde la siguiente pantalla.'
                )}
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* Overlay mientras se redirige a Mercado Pago */}
      <AnimatePresence>
        {redirecting && (
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] grid place-items-center bg-ink/40 p-5 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="flex max-w-sm flex-col items-center gap-4 rounded-3xl bg-white p-8 text-center shadow-2xl"
            >
              <span
                aria-hidden="true"
                className="h-10 w-10 animate-spin rounded-full border-[3px] border-gray-200 border-t-brand"
              />
              <p className="text-sm font-semibold text-ink">
                {settings.depositEnabled
                  ? 'Te estamos redirigiendo a Mercado Pago para completar el pago…'
                  : 'Turno confirmado. Te estamos llevando a la pantalla de contacto…'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
