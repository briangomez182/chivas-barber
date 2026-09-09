'use client';

import { useState } from 'react';

import { Field } from '@/components/ui/Field';
import { api } from '@/lib/api-client';
import { formatPrice } from '@/lib/date';
import { LOYALTY_STAMPS_GOALS, type LoyaltyStampsGoal, type Settings } from '@/lib/types';

import { PushNotificationsCard } from './PushNotificationsCard';

interface ConfiguracionesPanelProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
}

interface SwitchRowProps {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** Fila con switch — reusada por cada módulo de configuración. */
function SwitchRow({ id, label, hint, checked, onChange }: SwitchRowProps) {
  return (
    <label htmlFor={id} className="flex items-center justify-between gap-4">
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="block text-xs text-ink-muted">{hint}</span>
      </span>
      <span className="relative inline-flex shrink-0 cursor-pointer items-center">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-gray-200 transition-colors peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40" />
        <span className="absolute left-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

/**
 * Configuraciones generales y chicas del proyecto, agrupadas por módulo en
 * una grilla de 2 columnas (una sola en mobile). Cada módulo nuevo se agrega
 * como una tarjeta más al final del grid — se acomoda solo, no hace falta
 * reordenar nada.
 */
export function ConfiguracionesPanel({ settings, onChange }: ConfiguracionesPanelProps) {
  const [depositEnabled, setDepositEnabled] = useState<boolean>(settings.depositEnabled);
  // Texto crudo del input — no un `number`. El input es `type="text"` +
  // `inputMode="numeric"` (no `type="number"`, que tiene comportamiento de
  // selección/borrado inconsistente entre navegadores) y filtra no-dígitos
  // a mano. Se parsea a number recién al guardar.
  const [depositAmountText, setDepositAmountText] = useState<string>(
    String(settings.depositAmount),
  );
  const depositAmount = Number(depositAmountText) || 0;
  const [showPaginationCount, setShowPaginationCount] = useState<boolean>(
    settings.showPaginationCount,
  );
  const [showOptionalBookingFields, setShowOptionalBookingFields] = useState<boolean>(
    settings.showOptionalBookingFields,
  );
  const [loyaltyEnabled, setLoyaltyEnabled] = useState<boolean>(settings.loyaltyEnabled);
  const [loyaltyStampsGoal, setLoyaltyStampsGoal] = useState<LoyaltyStampsGoal>(
    settings.loyaltyStampsGoal,
  );
  // El switch del módulo: `ownerWhatsapp === null` en la DB significa "aviso
  // desactivado", así que ese es el estado inicial del toggle.
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(
    settings.ownerWhatsapp !== null,
  );
  // Sólo dígitos y un `+` al frente — se normaliza a `+<dígitos>` al guardar.
  const [ownerWhatsappText, setOwnerWhatsappText] = useState<string>(
    settings.ownerWhatsapp ?? '',
  );
  const [busy, setBusy] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setMessage(null);

    if (notificationsEnabled && !ownerWhatsappText.trim()) {
      setError(
        'Ingresá el WhatsApp del dueño para poder habilitar las notificaciones.',
      );
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const { settings: saved } = await api.settings.update({
        depositEnabled,
        depositAmount,
        showPaginationCount,
        showOptionalBookingFields,
        loyaltyEnabled,
        loyaltyStampsGoal,
        ownerWhatsapp: notificationsEnabled ? ownerWhatsappText.trim() : null,
      });
      onChange(saved);
      setDepositEnabled(saved.depositEnabled);
      setDepositAmountText(String(saved.depositAmount));
      setShowPaginationCount(saved.showPaginationCount);
      setShowOptionalBookingFields(saved.showOptionalBookingFields);
      setLoyaltyEnabled(saved.loyaltyEnabled);
      setLoyaltyStampsGoal(saved.loyaltyStampsGoal);
      setOwnerWhatsappText(saved.ownerWhatsapp ?? '');
      setNotificationsEnabled(saved.ownerWhatsapp !== null);
      setMessage('Configuración actualizada.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="admin-configuraciones-title">
      <header>
        <h2
          id="admin-configuraciones-title"
          className="text-xl font-extrabold tracking-[-0.02em] text-ink"
        >
          Configuraciones
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Parámetros generales del proyecto.
        </p>
      </header>

      <form onSubmit={save} className="mt-7 max-w-12xl">
        {/*
          Grilla responsiva: 1 columna en mobile, 2 en tablet, 3 en desktop.
          Cada módulo nuevo se agrega como una `<div className="card">` más al
          final de este grid — todas las tarjetas mantienen el mismo ancho,
          no hace falta tocar nada más.
        */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="card p-7">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
              Pagos
            </h3>

            <div className="mt-4">
              <SwitchRow
                id="deposit-enabled"
                label="Cobrar seña online"
                hint="Si está apagado, las reservas online no piden pago por adelantado."
                checked={depositEnabled}
                onChange={setDepositEnabled}
              />
            </div>

            {depositEnabled && (
              <Field
                className="mt-6"
                label="Seña (ARS)"
                htmlFor="deposit-amount"
                hint={
                  depositAmount > 0
                    ? `Se cobra ${formatPrice(depositAmount)} al confirmar el turno online.`
                    : 'Ingresá un monto mayor a 0 para poder guardar.'
                }
              >
                <input
                  id="deposit-amount"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  value={depositAmountText}
                  onChange={(event) =>
                    setDepositAmountText(event.target.value.replace(/[^\d]/g, ''))
                  }
                  onFocus={(event) => event.target.select()}
                />
              </Field>
            )}
          </div>

          <div className="card p-7">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
              Turnos
            </h3>

            <div className="mt-4">
              <SwitchRow
                id="show-pagination-count"
                label="Mostrar cantidad de páginas en la paginación"
                hint={
                  showPaginationCount
                    ? 'Se ve "Página X de Y · N turnos" junto a Anterior/Siguiente.'
                    : 'Sólo se ven los botones Anterior/Siguiente, sin el detalle de páginas.'
                }
                checked={showPaginationCount}
                onChange={setShowPaginationCount}
              />
            </div>
          </div>

          <div className="card p-7">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
              Formulario de turnos
            </h3>

            <div className="mt-4">
              <SwitchRow
                id="show-optional-booking-fields"
                label="Mostrar campos de email y comentarios"
                hint={
                  showOptionalBookingFields
                    ? 'El formulario público de reserva pide email y comentarios (ambos opcionales).'
                    : 'El formulario público de reserva sólo pide nombre y teléfono.'
                }
                checked={showOptionalBookingFields}
                onChange={setShowOptionalBookingFields}
              />
            </div>
          </div>

          <div className="card p-7">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
              Tarjeta de Fidelización
            </h3>

            <div className="mt-4">
              <SwitchRow
                id="loyalty-enabled"
                label="Habilitar tarjeta de fidelización"
                hint={
                  loyaltyEnabled
                    ? 'La sección "Lealtad" del sitio y la pestaña "Lealtad" del admin están visibles.'
                    : 'La sección "Lealtad" del sitio y la pestaña "Lealtad" del admin quedan ocultas.'
                }
                checked={loyaltyEnabled}
                onChange={setLoyaltyEnabled}
              />
            </div>

            {loyaltyEnabled && (
              <fieldset className="mt-6">
                <legend className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
                  Sellos para completar la tarjeta
                </legend>
                <div className="mt-3 inline-flex w-full gap-1 rounded-full bg-gray-100 p-1">
                  {LOYALTY_STAMPS_GOALS.map((goal) => {
                    const active = loyaltyStampsGoal === goal;
                    return (
                      <label
                        key={goal}
                        className={`flex-1 cursor-pointer rounded-full px-3 py-2 text-center text-sm font-semibold transition-all ${
                          active
                            ? 'bg-brand text-white shadow-brand'
                            : 'text-ink-soft hover:text-ink'
                        }`}
                      >
                        <input
                          type="radio"
                          name="loyaltyStampsGoal"
                          className="sr-only"
                          checked={active}
                          onChange={() => setLoyaltyStampsGoal(goal)}
                        />
                        {goal}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </div>

          <div className="card p-7">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">
              Notificaciones
            </h3>

            <div className="mt-4">
              <SwitchRow
                id="notifications-enabled"
                label="Habilitar notificaciones"
                hint={
                  notificationsEnabled
                    ? 'El dueño recibe un aviso por WhatsApp cada vez que un cliente paga la seña de un turno.'
                    : 'No se envían avisos por WhatsApp al dueño.'
                }
                checked={notificationsEnabled}
                onChange={setNotificationsEnabled}
              />
            </div>

            {notificationsEnabled && (
              <Field
                className="mt-6"
                label="WhatsApp del dueño"
                htmlFor="owner-whatsapp"
                hint="Número que recibe el aviso. Formato internacional, ej. +5491160068637."
              >
                <input
                  id="owner-whatsapp"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="+5491160068637"
                  value={ownerWhatsappText}
                  onChange={(event) =>
                    setOwnerWhatsappText(event.target.value.replace(/[^\d+]/g, ''))
                  }
                />
              </Field>
            )}
          </div>

          <PushNotificationsCard />
        </div>

        {message && (
          <p className="mt-6 rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <button type="submit" disabled={busy} className="pill-primary px-8 py-3">
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </section>
  );
}
