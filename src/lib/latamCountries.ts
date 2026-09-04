/** País de Latinoamérica con sus datos para selección de teléfono/WhatsApp. */
export interface LatamCountry {
  /** Nombre en español, tal como se muestra en la UI. */
  name: string;
  /** Código ISO 3166-1 alpha-2. */
  isoCode: string;
  /** Bandera en emoji. */
  flag: string;
  /** Prefijo telefónico internacional, con el signo `+`. */
  dialCode: string;
}

/**
 * Únicamente países de Latinoamérica (Sudamérica, Centroamérica, México y
 * el Caribe hispanohablante), ordenados alfabéticamente por nombre.
 */
export const LATAM_COUNTRIES: LatamCountry[] = [
  { name: 'Argentina', isoCode: 'AR', flag: '🇦🇷', dialCode: '+54' },
  { name: 'Bolivia', isoCode: 'BO', flag: '🇧🇴', dialCode: '+591' },
  { name: 'Brasil', isoCode: 'BR', flag: '🇧🇷', dialCode: '+55' },
  { name: 'Chile', isoCode: 'CL', flag: '🇨🇱', dialCode: '+56' },
  { name: 'Colombia', isoCode: 'CO', flag: '🇨🇴', dialCode: '+57' },
  { name: 'Costa Rica', isoCode: 'CR', flag: '🇨🇷', dialCode: '+506' },
  { name: 'Cuba', isoCode: 'CU', flag: '🇨🇺', dialCode: '+53' },
  { name: 'Ecuador', isoCode: 'EC', flag: '🇪🇨', dialCode: '+593' },
  { name: 'El Salvador', isoCode: 'SV', flag: '🇸🇻', dialCode: '+503' },
  { name: 'Guatemala', isoCode: 'GT', flag: '🇬🇹', dialCode: '+502' },
  { name: 'Honduras', isoCode: 'HN', flag: '🇭🇳', dialCode: '+504' },
  { name: 'México', isoCode: 'MX', flag: '🇲🇽', dialCode: '+52' },
  { name: 'Nicaragua', isoCode: 'NI', flag: '🇳🇮', dialCode: '+505' },
  { name: 'Panamá', isoCode: 'PA', flag: '🇵🇦', dialCode: '+507' },
  { name: 'Paraguay', isoCode: 'PY', flag: '🇵🇾', dialCode: '+595' },
  { name: 'Perú', isoCode: 'PE', flag: '🇵🇪', dialCode: '+51' },
  { name: 'Puerto Rico', isoCode: 'PR', flag: '🇵🇷', dialCode: '+1' },
  { name: 'República Dominicana', isoCode: 'DO', flag: '🇩🇴', dialCode: '+1' },
  { name: 'Uruguay', isoCode: 'UY', flag: '🇺🇾', dialCode: '+598' },
  { name: 'Venezuela', isoCode: 'VE', flag: '🇻🇪', dialCode: '+58' },
];
