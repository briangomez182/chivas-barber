'use client';

import { useCallback, useRef, useState } from 'react';

import { CustomerCombobox } from '@/components/admin/CustomerCombobox';
import { LoyaltyStampCard } from '@/components/loyalty/LoyaltyStampCard';
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

/**
 * Mensaje de WhatsApp para el cliente que ya completó la tarjeta y tiene uno
 * o más cortes gratis disponibles para usar.
 */
function rewardReadyMessage(stampsGoal: number, rewards: number): string {
  const reward = rewards === 1 ? 'un corte gratis' : `${rewards} cortes gratis`;

  return (
    `¡Hola! Te escribimos de ${BRAND.name}. ` +
    `¡Completaste tu Tarjeta de Fidelización! Tenés ${reward} por completar ` +
    `${stampsGoal} servicios con nosotros. ` +
    'Cuando quieras coordinamos tu turno para que lo aproveches. ¡Te esperamos!'
  );
}

interface LoyaltyPanelProps {
  /** Sellos necesarios para completar la tarjeta (`settings.loyaltyStampsGoal`). */
  stampsGoal: number;
}

/**
 * Gestión de tarjetas de lealtad para el admin: busca un cliente por nombre
 * o por teléfono (ambos campos con autocompletado), ve el estado de sus
 * sellos y suma/descuenta sellos a mano.
 *
 * Como no hay tabla de clientes, el autocompletado sale de los turnos
 * (`/api/customers/search`, por nombre o por teléfono). Al elegir una
 * sugerencia se completan los dos campos y se dispara la búsqueda de la
 * tarjeta con ese número.
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
  const [cardName, setCardName] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [adjusting, setAdjusting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Texto de los campos de búsqueda (el autocompletado lo maneja
  // `CustomerCombobox`); los dos se mantienen sincronizados al elegir un cliente.
  const [nameQuery, setNameQuery] = useState<string>('');
  // Si se lanzan dos consultas de tarjeta seguidas, sólo la última pinta su
  // resultado.
  const lookupSeq = useRef<number>(0);

  const runLookup = useCallback(
    async (digits: string, displayName?: string | null): Promise<void> => {
      if (digits.length < 8) {
        setError('Ingresá un número de teléfono válido (al menos 8 dígitos)');
        return;
      }

      const seq = ++lookupSeq.current;

      // Cada búsqueda arranca de cero: si quedó en pantalla la tarjeta de otro
      // cliente (con su aviso de corte gratis y su botón de WhatsApp), se limpia
      // antes de traer la nueva para no mezclar los datos de dos personas.
      setBusy(true);
      setError(null);
      setCard(null);
      setCardPhone('');
      setCardName(null);

      try {
        const { card: found } = await api.loyalty.lookup(digits);
        if (seq !== lookupSeq.current) return;
        setCard(found);
        setCardPhone(digits);
        setCardName(displayName ?? null);
      } catch (cause) {
        if (seq !== lookupSeq.current) return;
        setError(cause instanceof Error ? cause.message : 'No se pudo consultar');
        setCard(null);
        setCardPhone('');
        setCardName(null);
      } finally {
        if (seq === lookupSeq.current) setBusy(false);
      }
    },
    [],
  );

  const search = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void runLookup(onlyDigits(phoneInput));
  };

  // Al elegir un cliente en cualquiera de los dos autocompletados: se completan
  // ambos campos y se trae su tarjeta.
  const pickCustomer = (hit: { name: string; phone: string }): void => {
    setNameQuery(hit.name);
    setPhoneInput(formatCustomerPhone(hit.phone));
    void runLookup(onlyDigits(hit.phone), hit.name);
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
        <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
          <CustomerCombobox
            id="admin-loyalty-name"
            label="Nombre del cliente"
            hint="Escribí y elegí un cliente de la lista para traer su tarjeta."
            placeholder="Ej. Juan Pérez"
            by="name"
            minChars={2}
            value={nameQuery}
            onChange={setNameQuery}
            toInputText={(hit) => hit.name}
            primaryText={(hit) => hit.name}
            secondaryText={(hit) => formatCustomerPhone(hit.phone)}
            onSelect={pickCustomer}
          />

          <CustomerCombobox
            id="admin-loyalty-phone"
            label="Teléfono del cliente"
            hint="Escribí el número o pegalo del listado de turnos y elegí el cliente."
            placeholder="+541133691609"
            by="phone"
            minChars={4}
            type="tel"
            inputMode="tel"
            value={phoneInput}
            onChange={setPhoneInput}
            toInputText={(hit) => formatCustomerPhone(hit.phone)}
            primaryText={(hit) => formatCustomerPhone(hit.phone)}
            secondaryText={(hit) => hit.name}
            onSelect={pickCustomer}
          />
        </div>

        <div className="mt-4 flex justify-end">
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

            {cardName && (
              <p className="mt-3 text-sm font-semibold text-ink">{cardName}</p>
            )}
            <p className={`${cardName ? 'mt-1' : 'mt-3'} text-sm text-ink-soft`}>
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

            {card.rewardsEarned > 0 && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-900">
                  {card.rewardsEarned === 1
                    ? 'Completó la tarjeta: tiene un corte gratis para usar.'
                    : `Completó la tarjeta: tiene ${card.rewardsEarned} cortes gratis para usar.`}
                </p>
                <a
                  href={customerWhatsappLink(
                    cardPhone,
                    rewardReadyMessage(stampsGoal, card.rewardsEarned),
                  )}
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
