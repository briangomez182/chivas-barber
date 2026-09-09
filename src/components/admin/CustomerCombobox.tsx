'use client';

import { useEffect, useRef, useState } from 'react';

import { Field } from '@/components/ui/Field';
import { SearchIcon } from '@/components/ui/icons';
import { api } from '@/lib/api-client';

/** Cliente sugerido: nombre + teléfono normalizado (dígitos con prefijo). */
export interface CustomerHit {
  name: string;
  phone: string;
}

interface CustomerComboboxProps {
  id: string;
  label: string;
  hint?: string;
  placeholder?: string;
  /** Campo por el que se busca en la base: nombre o teléfono. */
  by: 'name' | 'phone';
  /** Mínimo de caracteres tipeados para disparar la búsqueda (default 2). */
  minChars?: number;
  type?: 'text' | 'tel';
  inputMode?: 'text' | 'tel';
  /** Texto del input, controlado por el padre. */
  value: string;
  /** Texto tipeado por el usuario. */
  onChange: (text: string) => void;
  /** Texto que queda en el input al elegir una sugerencia. */
  toInputText: (hit: CustomerHit) => string;
  /** Línea principal (negrita) de cada opción del desplegable. */
  primaryText: (hit: CustomerHit) => string;
  /** Línea secundaria (chica) de cada opción. */
  secondaryText: (hit: CustomerHit) => string;
  /** Acción al elegir una sugerencia (además de completar el input). */
  onSelect: (hit: CustomerHit) => void;
}

/**
 * Input con autocompletado de clientes para el panel de admin. Busca
 * coincidencias en `/api/customers/search` —por nombre o por teléfono, según
 * `by`— con debounce y las muestra en un desplegable navegable con teclado.
 *
 * El texto lo controla el padre (`value` / `onChange`). Al elegir una opción
 * se completa el input con `toInputText(hit)` y se llama a `onSelect(hit)`;
 * ese cambio de texto no vuelve a disparar una búsqueda (`skipNextSearch`).
 * Además, sólo se busca y se abre el desplegable cuando el campo está enfocado,
 * así completar el input desde afuera (p. ej. al elegir un nombre se carga el
 * teléfono) no abre este menú.
 */
export function CustomerCombobox({
  id,
  label,
  hint,
  placeholder,
  by,
  minChars = 2,
  type = 'text',
  inputMode,
  value,
  onChange,
  toInputText,
  primaryText,
  secondaryText,
  onSelect,
}: CustomerComboboxProps) {
  const [suggestions, setSuggestions] = useState<CustomerHit[]>([]);
  const [open, setOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  // Se ignoran las respuestas que llegan fuera de orden.
  const searchSeq = useRef<number>(0);
  // No volver a buscar cuando el texto cambió porque se eligió una opción.
  const skipNextSearch = useRef<boolean>(false);
  // Sólo se busca mientras el usuario está tipeando en este campo.
  const focused = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const listboxId = `${id}-listbox`;

  // Término normalizado: al buscar por teléfono sólo cuentan los dígitos.
  const term = by === 'phone' ? value.replace(/\D/g, '') : value.trim();

  // Busca sugerencias con debounce cada vez que cambia el texto.
  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }

    if (!focused.current || term.length < minChars) {
      setSuggestions([]);
      setLoading(false);
      setOpen(false);
      return;
    }

    setLoading(true);
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      try {
        const { customers } = await api.customers.search(term, by);
        if (seq !== searchSeq.current) return;
        setSuggestions(customers);
        setActiveIndex(customers.length > 0 ? 0 : -1);
        setOpen(true);
      } catch {
        if (seq !== searchSeq.current) return;
        setSuggestions([]);
        setOpen(false);
      } finally {
        if (seq === searchSeq.current) setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [term, by, minChars]);

  // Cierra el desplegable al hacer click fuera del campo.
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent): void {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const select = (hit: CustomerHit): void => {
    skipNextSearch.current = true;
    onChange(toInputText(hit));
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
    onSelect(hit);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ): void => {
    if (!open || suggestions.length === 0) return;

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
        select(hit);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef}>
      <Field label={label} htmlFor={id} hint={hint}>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
            <SearchIcon className="h-4 w-4" />
          </span>
          <input
            id={id}
            type={type}
            inputMode={inputMode}
            role="combobox"
            autoComplete="off"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined
            }
            placeholder={placeholder}
            className="!pl-9"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={() => {
              focused.current = true;
              if (suggestions.length > 0) setOpen(true);
            }}
            onBlur={() => {
              focused.current = false;
            }}
            onKeyDown={handleKeyDown}
          />

          {open && (
            <ul
              id={listboxId}
              role="listbox"
              className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-20 max-h-64 overflow-auto rounded-xl border border-gray-100 bg-white py-1 shadow-card"
            >
              {loading && suggestions.length === 0 && (
                <li className="px-3 py-2 text-sm text-ink-muted">Buscando…</li>
              )}
              {!loading && suggestions.length === 0 && (
                <li className="px-3 py-2 text-sm text-ink-muted">
                  Sin coincidencias
                </li>
              )}
              {suggestions.map((hit, index) => (
                <li key={`${hit.phone}-${index}`} role="none">
                  <button
                    type="button"
                    id={`${id}-opt-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => select(hit)}
                    className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors ${
                      index === activeIndex ? 'bg-brand-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-sm font-semibold text-ink">
                      {primaryText(hit)}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {secondaryText(hit)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>
    </div>
  );
}
