'use client';

import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';

import { LATAM_COUNTRIES, type LatamCountry } from '@/lib/latamCountries';

import { CheckIcon, ChevronDownIcon, SearchIcon } from './icons';

/** Resultado que se emite cada vez que cambia el país o el número. */
export interface WhatsAppPhoneValue {
  /** Prefijo + número local, solo dígitos (formato esperado por la API de WhatsApp). */
  whatsappNumber: string;
  /** País seleccionado. */
  country: LatamCountry;
  /** Link `https://wa.me/...` listo para usar, con mensaje precargado si se pasó `message`. */
  whatsappLink: string;
  /** Número local ya limpio de espacios, guiones u otros caracteres no numéricos. */
  localNumber: string;
  /** `true` si el número local tiene una cantidad mínima de dígitos razonable. */
  isValid: boolean;
}

export interface WhatsAppPhoneInputProps {
  /** Se dispara con el resultado completo cada vez que cambia país o número. */
  onChange: (value: WhatsAppPhoneValue) => void;
  /** Código ISO del país preseleccionado. Por defecto `'AR'`. */
  defaultCountryIso?: string;
  /** Valor inicial del número local (se limpia igual que el resto). */
  defaultLocalNumber?: string;
  /** Mensaje precargado para el link `wa.me`. */
  message?: string;
  id?: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function onlyDigits(text: string): string {
  return text.replace(/\D/g, '');
}

function buildValue(
  country: LatamCountry,
  rawLocalNumber: string,
  message?: string,
): WhatsAppPhoneValue {
  const localNumber = onlyDigits(rawLocalNumber);
  const whatsappNumber = `${onlyDigits(country.dialCode)}${localNumber}`;
  const query = message ? `?text=${encodeURIComponent(message)}` : '';

  return {
    whatsappNumber,
    country,
    whatsappLink: `https://wa.me/${whatsappNumber}${query}`,
    localNumber,
    isValid: localNumber.length >= 6,
  };
}

/**
 * Selector de país de Latinoamérica + input de teléfono, pensado para
 * capturar el número que después se usa en la API de WhatsApp (`wa.me`).
 *
 * El `ref` apunta al contenedor raíz — sirve para hacer `scrollIntoView`
 * hacia el campo desde un formulario que lo requiera.
 */
export const WhatsAppPhoneInput = forwardRef<HTMLDivElement, WhatsAppPhoneInputProps>(
  function WhatsAppPhoneInput(
    {
      onChange,
      defaultCountryIso = 'AR',
      defaultLocalNumber = '',
      message,
      id = 'whatsapp-phone',
      label,
      required,
      placeholder = 'Número de teléfono',
      className = '',
    },
    ref,
  ) {
  const [selectedCountry, setSelectedCountry] = useState<LatamCountry>(
    () =>
      LATAM_COUNTRIES.find((country) => country.isoCode === defaultCountryIso) ??
      LATAM_COUNTRIES[0],
  );
  const [localNumber, setLocalNumber] = useState<string>(defaultLocalNumber);
  const [open, setOpen] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const filteredCountries = useMemo<LatamCountry[]>(() => {
    const query = normalize(search.trim());
    if (!query) return LATAM_COUNTRIES;

    return LATAM_COUNTRIES.filter(
      (country) =>
        normalize(country.name).includes(query) ||
        country.dialCode.replace('+', '').includes(query.replace('+', '')) ||
        normalize(country.isoCode).includes(query),
    );
  }, [search]);

  // Cierra el desplegable al hacer click fuera.
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

  useEffect(() => {
    if (open) {
      setSearch('');
      setActiveIndex(0);
      searchInputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const selectCountry = (country: LatamCountry): void => {
    setSelectedCountry(country);
    setOpen(false);
    onChange(buildValue(country, localNumber, message));
  };

  const handleLocalNumberChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const next = event.target.value;
    setLocalNumber(next);
    onChange(buildValue(selectedCountry, next, message));
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, filteredCountries.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const country = filteredCountries[activeIndex];
      if (country) selectCountry(country);
    }
  };

  const listboxId = `${id}-country-listbox`;

  return (
    <div ref={ref} className={className}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted"
        >
          {label}
        </label>
      )}

      <div ref={containerRef} className={`relative ${label ? 'mt-2' : ''}`}>
        <div className="flex items-stretch overflow-hidden rounded-xl border border-gray-200 bg-white transition-colors focus-within:border-brand">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listboxId}
            onClick={() => setOpen((current) => !current)}
            className="flex shrink-0 items-center gap-1.5 border-r border-gray-200 px-3 py-2.5 text-sm font-medium text-ink hover:bg-gray-50"
          >
            <span aria-hidden="true" className="text-base leading-none">
              {selectedCountry.flag}
            </span>
            <span className="tabular-nums">{selectedCountry.dialCode}</span>
            <ChevronDownIcon
              className={`h-3.5 w-3.5 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>

          <input
            id={id}
            type="tel"
            inputMode="numeric"
            required={required}
            aria-required={required}
            placeholder={placeholder}
            value={localNumber}
            onChange={handleLocalNumberChange}
            className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-0"
          />
        </div>

        {open && (
          <div className="absolute left-0 top-[calc(100%+0.5rem)] z-20 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-card">
            <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5">
              <SearchIcon className="h-4 w-4 shrink-0 text-ink-muted" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Buscar país o prefijo…"
                className="w-full border-0 bg-transparent p-0 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-0"
              />
            </div>

            <ul
              id={listboxId}
              role="listbox"
              aria-label="Países"
              className="scroll-slim max-h-64 overflow-y-auto p-1.5"
            >
              {filteredCountries.length === 0 && (
                <li className="px-3 py-4 text-center text-sm text-ink-muted">
                  Sin resultados
                </li>
              )}
              {filteredCountries.map((country, index) => {
                const active = country.isoCode === selectedCountry.isoCode;
                return (
                  <li key={country.isoCode} role="option" aria-selected={active}>
                    <button
                      ref={(el) => {
                        optionRefs.current[index] = el;
                      }}
                      type="button"
                      onClick={() => selectCountry(country)}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                        index === activeIndex ? 'bg-gray-50' : ''
                      } ${active ? 'font-semibold text-ink' : 'text-ink-soft'}`}
                    >
                      <span aria-hidden="true" className="text-base leading-none">
                        {country.flag}
                      </span>
                      <span className="w-12 shrink-0 tabular-nums text-ink-muted">
                        {country.dialCode}
                      </span>
                      <span className="flex-1 truncate">{country.name}</span>
                      {active && <CheckIcon className="h-4 w-4 shrink-0 text-brand" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
  },
);
