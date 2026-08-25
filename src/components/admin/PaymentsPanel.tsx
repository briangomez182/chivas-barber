'use client';

import { useState } from 'react';

import { Field } from '@/components/ui/Field';
import { api } from '@/lib/api-client';
import { formatPrice } from '@/lib/date';
import type { Settings } from '@/lib/types';

interface PaymentsPanelProps {
  settings: Settings;
  onChange: (settings: Settings) => void;
}

export function PaymentsPanel({ settings, onChange }: PaymentsPanelProps) {
  const [depositAmount, setDepositAmount] = useState<number>(settings.depositAmount);
  const [busy, setBusy] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const { settings: saved } = await api.settings.update({ depositAmount });
      onChange(saved);
      setDepositAmount(saved.depositAmount);
      setMessage('Seña actualizada. Ya impacta en las próximas reservas.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="admin-payments-title">
      <header>
        <h2
          id="admin-payments-title"
          className="text-xl font-extrabold tracking-[-0.02em] text-ink"
        >
          Pagos
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Seña que se cobra por Mercado Pago al reservar online. El resto del
          servicio se abona en el local.
        </p>
      </header>

      <form onSubmit={save} className="card mt-7 max-w-md p-7">
        <Field
          label="Seña (ARS)"
          htmlFor="deposit-amount"
          hint={
            depositAmount > 0
              ? `Se cobra ${formatPrice(depositAmount)} al confirmar el turno online.`
              : 'En 0: el checkout online queda deshabilitado hasta configurarla.'
          }
        >
          <input
            id="deposit-amount"
            type="number"
            min={0}
            step={100}
            required
            value={depositAmount}
            onChange={(event) => setDepositAmount(Number(event.target.value))}
          />
        </Field>

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

        <div className="mt-8 flex justify-end">
          <button type="submit" disabled={busy} className="pill-primary px-8 py-3">
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </section>
  );
}
