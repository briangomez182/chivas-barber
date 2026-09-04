/**
 * Datos únicos de la marca. Cualquier dato de contacto que aparezca en la UI
 * debe importarse desde acá para no duplicar strings.
 */
export const BRAND = {
  name: 'Chivas Barbería Club',
  shortName: 'Chivas',
  tagline: 'Barbería de autor en San Cristóbal, Buenos Aires.',
  claim: 'Agendá tu turno',
  street: 'Av. San Juan 2454',
  postalCode: 'C1232',
  city: 'Ciudad Autónoma de Buenos Aires',
  country: 'Argentina',
  phone: '+5491160068637',
  phoneDisplay: '+54 9 11 6006-8637',
  email: 'hola@chivasbarberiaclub.com',
  instagram: 'https://instagram.com/chivasbarberiaclub',
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=Av.+San+Juan+2454,+C1232+CABA',
} as const;

/** Link `wa.me` con mensaje prellenado. */
export function whatsappLink(message?: string): string {
  const digits = BRAND.phone.replace(/[^\d]/g, '');
  const text = message ?? `Hola ${BRAND.name}, quiero reservar un turno.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** Link `tel:` normalizado. */
export const TEL_LINK = `tel:${BRAND.phone}`;

/**
 * Dígitos del teléfono de un cliente, con código de país. Los turnos
 * reservados desde la web ya lo guardan así (`WhatsAppPhoneInput`); los
 * turnos manuales cargados por el barbero en el panel de admin son un
 * número local argentino sin prefijo, así que si no arranca con `54` se lo
 * agregamos.
 */
export function customerPhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('54') ? digits : `54${digits}`;
}

/** Teléfono de un cliente en formato `+<código de país><número>`, para copiar. */
export function formatCustomerPhone(phone: string): string {
  return `+${customerPhoneDigits(phone)}`;
}

/**
 * Link `wa.me` para el teléfono de un cliente, con mensaje prellenado
 * opcional (`?text=`).
 */
export function customerWhatsappLink(phone: string, message?: string): string {
  const base = `https://wa.me/${customerPhoneDigits(phone)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
