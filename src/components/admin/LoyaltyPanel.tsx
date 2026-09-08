'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { LoyaltyStampCard } from '@/components/loyalty/LoyaltyStampCard';
import { Field } from '@/components/ui/Field';
import { SearchIcon, WhatsAppIcon } from '@/components/ui/icons';
import { Toast } from '@/components/ui/Toast';
import { api } from '@/lib/api-client';
import { BRAND, customerWhatsappLink, formatCustomerPhone } from '@/lib/brand';
import type { LoyaltyCard } from '@/lib/types';

function onlyDigits(text: string): string {
  return text.replace(/\D/g, '');
}

interface CustomerHit {
  name: string;
  phone: string;
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
 * Gestión de tarjetas de lealtad para el admin: busca un cliente por nombre
 * (con autocompletado) o pegando el teléfono, ve el estado de sus sellos y
 * suma/descuenta sellos a mano.
 *
 * Como no hay tabla de clientes, el autocompletado de nombres sale de los
 * turnos (`/api/customers/search`). Al elegir una sugerencia se completa el
 * teléfono y se dispara la búsqueda con ese número.
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

  // --- Autocompletado por nombre -------------------------------------------
  const [nameQuery, setNameQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<CustomerHit[]>([]);
  const [suggestOpen, setSuggestOpen] = useState<boolean>(false);
  const [suggestLoading, setSuggestLoading] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  // Se ignoran las respuestas viejas si llegan fuera de orden.
  const searchSeq = useRef<number>(0);
  // No volver a buscar cuando el cambio de texto viene de elegir una opción.
  const skipNextSearch = useRef<boolean>(false);
  const nameFieldRef = useRef<HTMLDivElement>(null);

  const runLookup = useCallback(
    async (digits: string, displayName?: string | null): Promise<void> => {
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
        setCardName(displayName ?? null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudo consultar');
        setCard(null);
        setCardPhone('');
        setCardName(null);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const search = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void runLookup(onlyDigits(phoneInput));
  };

  // Busca sugerencias con debounce cada vez que cambia el texto del nombre.
  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }

    const term = nameQuery.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setSuggestLoading(false);
      setSuggestOpen(false);
      return;
    }

    setSuggestLoading(true);
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      try {
        const { customers } = await api.customers.search(term);
        if (seq !== searchSeq.current) return;
        setSuggestions(customers);
        setActiveIndex(customers.length > 0 ? 0 : -1);
        setSuggestOpen(true);
      } catch {
        if (seq !== searchSeq.current) return;
        setSuggestions([]);
        setSuggestOpen(false);
      } finally {
        if (seq === searchSeq.current) setSuggestLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [nameQuery]);

  // Cierra el desplegable al hacer click fuera del campo.
  useEffect(() => {
    if (!suggestOpen) return;

    function handleClickOutside(event: MouseEvent): void {
      if (!nameFieldRef.current?.contains(event.target as Node)) {
        setSuggestOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [suggestOpen]);

  const selectSuggestion = (hit: CustomerHit): void => {
    skipNextSearch.current = true;
    setNameQuery(hit.name);
    setPhoneInput(formatCustomerPhone(hit.phone));
    setSuggestions([]);
    setSuggestOpen(false);
    setActiveIndex(-1);
    void runLookup(onlyDigits(hit.phone), hit.name);
  };

  const handleNameKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ): void => {
    if (!suggestOpen || suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      const hit = suggestions[activeIndex];
      if (hit) {
        event.preventDefault();
        selectSuggestion(hit);
      }
    } else if (event.key === 'Escape') {
      setSuggestOpen(false);
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

  const listboxId = 'admin-loyalty-name-listbox';

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
          <div ref={nameFieldRef}>
            <Field
              label="Nombre del cliente"
              htmlFor="admin-loyalty-name"
              hint="Escribí y elegí un cliente de la lista para traer su tarjeta."
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
                  <SearchIcon className="h-4 w-4" />
                </span>
                <input
                  id="admin-loyalty-name"
                  type="text"
                  role="combobox"
                  autoComplete="off"
                  aria-expanded={suggestOpen}
                  aria-controls={listboxId}
                  aria-autocomplete="list"
                  aria-activedescendant={
                    activeIndex >= 0
                      ? `admin-loyalty-opt-${activeIndex}`
                      : undefined
                  }
                  placeholder="Ej. Juan Pérez"
                  className="!pl-9"
                  value={nameQuery}
                  onChange={(event) => setNameQuery(event.target.value)}
                  onFocus={() => {
                    if (suggestions.length > 0) setSuggestOpen(true);
                  }}
                  onKeyDown={handleNameKeyDown}
                />

                {suggestOpen && (
                  <ul
                    id={listboxId}
                    role="listbox"
                    className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-20 max-h-64 overflow-auto rounded-xl border border-gray-100 bg-white py-1 shadow-card"
                  >
                    {suggestLoading && suggestions.length === 0 && (
                      <li className="px-3 py-2 text-sm text-ink-muted">
                        Buscando…
                      </li>
                    )}
                    {!suggestLoading && suggestions.length === 0 && (
                      <li className="px-3 py-2 text-sm text-ink-muted">
                        Sin coincidencias
                      </li>
                    )}
                    {suggestions.map((hit, index) => (
                      <li key={`${hit.phone}-${index}`} role="none">
                        <button
                          type="button"
                          id={`admin-loyalty-opt-${index}`}
                          role="option"
                          aria-selected={index === activeIndex}
                          onMouseDown={(event) => event.preventDefault()}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => selectSuggestion(hit)}
                          className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors ${
                            index === activeIndex ? 'bg-brand-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <span className="text-sm font-semibold text-ink">
                            {hit.name}
                          </span>
                          <span className="text-xs text-ink-muted">
                            {formatCustomerPhone(hit.phone)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Field>
          </div>

          <Field
            label="Teléfono del cliente"
            htmlFor="admin-loyalty-phone"
            hint="O pegá el número tal cual lo copiaste del listado de turnos."
          >
            <input
              id="admin-loyalty-phone"
              type="tel"
              inputMode="tel"
              placeholder="+541133691609"
              value={phoneInput}
              onChange={(event) => setPhoneInput(event.target.value)}
            />
          </Field>
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
