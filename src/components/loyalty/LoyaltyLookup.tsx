'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

import { LoyaltyStampCard } from '@/components/loyalty/LoyaltyStampCard';
import {
  WhatsAppPhoneInput,
  type WhatsAppPhoneValue,
} from '@/components/ui/WhatsAppPhoneInput';
import { api } from '@/lib/api-client';
import { BRAND } from '@/lib/brand';
import type { LoyaltyCard } from '@/lib/types';

interface LoyaltyLookupProps {
  /** Sellos necesarios para completar la tarjeta (`settings.loyaltyStampsGoal`). */
  stampsGoal: number;
}

/**
 * Formulario público de consulta de la tarjeta de sellos. El cliente ingresa
 * su teléfono (con selector de prefijo) y se muestra su tarjeta digital.
 */
export function LoyaltyLookup({ stampsGoal }: LoyaltyLookupProps) {
  const [phone, setPhone] = useState<WhatsAppPhoneValue | null>(null);
  const [card, setCard] = useState<LoyaltyCard | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!phone || !phone.isValid) {
      setError('Ingresá tu número de teléfono completo');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const { card: found } = await api.loyalty.lookup(phone.whatsappNumber);
      setCard(found);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo consultar');
      setCard(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
      <form onSubmit={search} className="card p-6">
        <WhatsAppPhoneInput
          id="loyalty-phone"
          label="Tu teléfono"
          onChange={setPhone}
          message={`Hola ${BRAND.name}, quiero consultar mi tarjeta de sellos.`}
        />

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="pill-primary mt-4 w-full">
          {busy ? 'Buscando…' : 'Ver mi tarjeta'}
        </button>

        <p className="mt-3 text-xs text-ink-muted">
          Usá el mismo número con el que reservás tus turnos.
        </p>
      </form>

      <div className="lg:pt-1">
        {card ? (
          <motion.div
            key={card.phoneNumber + card.completedStamps + card.rewardsEarned}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <LoyaltyStampCard card={card} goal={stampsGoal} title={`★ ${BRAND.shortName} ★`} />
          </motion.div>
        ) : (
          <div className="flex min-h-[240px] items-center justify-center rounded-3xl border border-dashed border-gray-200 p-8 text-center text-sm text-ink-muted">
            Ingresá tu teléfono y tocá &ldquo;Ver mi tarjeta&rdquo; para ver
            cuántos sellos tenés acumulados.
          </div>
        )}
      </div>
    </div>
  );
}
