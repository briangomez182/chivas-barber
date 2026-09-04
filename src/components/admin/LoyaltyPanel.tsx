'use client';

import { useState } from 'react';

import { LoyaltyStampCard } from '@/components/loyalty/LoyaltyStampCard';
import { Field } from '@/components/ui/Field';
import { WhatsAppIcon } from '@/components/ui/icons';
import { Toast } from '@/components/ui/Toast';
import { api } from '@/lib/api-client';
import { BRAND, customerWhatsappLink, formatCustomerPhone } from '@/lib/brand';
import type { LoyaltyCard } from '@/lib/types';

function onlyDigits(text: string): string {
  return text.replace(/\D/g, '');
}

/** Mensaje de WhatsApp para el cliente al que le falta un solo sello. */
function almostThereMessage(): string {
  return (
    `¡Hola! Te escribimos de ${BRAND.name}. ` +
    'Estás a un solo corte de completar tu Tarjeta de Fidelización: en tu ' +
    'próxima visita sumás el último sello y tu siguiente corte es de regalo. ' +
    'Cuando quieras coordinamos tu turno. ¡Te esperamos!'
  );
}

interface LoyaltyPanelProps {
  /** Sellos necesarios para completar la tarjeta (`settings.loyaltyStampsGoal`). */
  stampsGoal: number;
}

/**
 * Gestión de tarjetas de lealtad para el admin: busca un cliente por
 * teléfono, ve el estado de sus sellos y suma/descuenta sellos a mano.
 *
 * Un solo input de texto: el admin pega el teléfono tal cual lo copió del
 * listado de turnos (`+541133691609`), sin separar prefijo y número local.
 *
 * La tarjeta mostrada queda "anclada" al teléfono con el que se buscó
 * (`cardPhone`). Los botones de ajuste usan ESE teléfono, no lo que haya
 * quedado tipeado en el campo — así no se ajusta el número equivocado ni el
 * botón queda sin efecto si el campo se editó después de buscar.
 */
export function LoyaltyPanel({ stampsGoal }: LoyaltyPanelProps) {
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [card, setCard] = useState<LoyaltyCard | null>(null);
  const [cardPhone, setCardPhone] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [adjusting, setAdjusting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const search = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const digits = onlyDigits(phoneInput);
    if (digits.length < 8) {
      setError('Ingresá un número de teléfono válido (al menos 8 dígitos)');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const { card: found } = await api.loyalty.lookup(digits);
      setCard(found);
      setCardPhone(digits);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo consultar');
      setCard(null);
      setCardPhone('');
    } finally {
      setBusy(false);
    }
  };

  const adjust = async (delta: 1 | -1): Promise<void> => {
    if (!cardPhone) {
      setError('Buscá un cliente antes de ajustar sellos');
      return;
    }

    setAdjusting(true);
    setError(null);

    try {
      const { card: updated } = await api.loyalty.adjust(cardPhone, delta);
      setCard(updated);
      setToast(delta === 1 ? 'Sello agregado' : 'Sello descontado');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar');
    } finally {
      setAdjusting(false);
    }
  };

  const canDecrement =
    card !== null && (card.completedStamps > 0 || card.rewardsEarned > 0);

  // Sellos que faltan para completar la tarjeta en curso.
  const stampsToGo = card ? Math.max(0, stampsGoal - card.completedStamps) : 0;

  return (
    <section aria-labelledby="admin-loyalty-title">
      <header>
        <h2
          id="admin-loyalty-title"
          className="text-xl font-extrabold tracking-[-0.02em] text-ink"
        >
          Tarjetas de lealtad
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Los sellos se suman solos cuando un turno queda atendido o pagado. Acá
          podés consultarlos y corregirlos a mano.
        </p>
      </header>

      <form onSubmit={search} className="card mt-7 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Teléfono del cliente" htmlFor="admin-loyalty-phone">
            <input
              id="admin-loyalty-phone"
              type="tel"
              inputMode="tel"
              placeholder="+541133691609"
              value={phoneInput}
              onChange={(event) => setPhoneInput(event.target.value)}
            />
          </Field>
          <button type="submit" disabled={busy} className="pill-primary">
            {busy ? 'Buscando…' : 'Buscar'}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}
      </form>

      {card && (
        <div className="mt-7 grid gap-6 lg:grid-cols-2 lg:items-start">
          <LoyaltyStampCard card={card} goal={stampsGoal} title="Cliente" />

          <div className="card p-6">
            <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-ink-muted">
              Ajuste manual
            </h3>

            <p className="mt-3 text-sm text-ink-soft">
              {formatCustomerPhone(cardPhone)}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              Sellos: <strong className="text-ink">{card.completedStamps}</strong> /{' '}
              {stampsGoal} · Cortes gratis:{' '}
              <strong className="text-ink">{card.rewardsEarned}</strong>
            </p>

            {!card.exists && (
              <p className="mt-2 text-xs text-ink-muted">
                Este cliente todavía no tiene tarjeta. Al agregar un sello se
                crea automáticamente.
              </p>
            )}

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                disabled={adjusting}
                onClick={() => adjust(1)}
                className="pill-primary flex-1"
              >
                + Agregar sello
              </button>
              <button
                type="button"
                disabled={adjusting || !canDecrement}
                onClick={() => adjust(-1)}
                className="pill-outline flex-1"
              >
                − Descontar sello
              </button>
            </div>

            {stampsToGo === 1 && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-900">
                  Le falta 1 sello para el corte gratis.
                </p>
                <a
                  href={customerWhatsappLink(cardPhone, almostThereMessage())}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="pill mt-3 w-full bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98]"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  Avisar al cliente por WhatsApp
                </a>
                <p className="mt-2 text-xs text-emerald-800/80">
                  Se abre WhatsApp con un mensaje listo para enviar.
                </p>
              </div>
            )}

            <p className="mt-3 text-xs text-ink-muted">
              Al llegar a {stampsGoal} la tarjeta se reinicia y suma un
              corte gratis.
            </p>
          </div>
        </div>
      )}

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </section>
  );
}
