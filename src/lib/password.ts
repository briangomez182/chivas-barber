/**
 * Reglas de complejidad de contraseña.
 *
 * El staff (admin/editor) pide más que un cliente que se registra solo: una
 * cuenta de staff comprometida da acceso al panel entero (datos de todos los
 * clientes, turnos, configuración) — mucho más blast radius que una cuenta
 * de cliente.
 */
export interface PasswordRules {
  minLength: number;
  requireSymbol?: boolean;
}

export const CLIENT_PASSWORD_MIN_LENGTH = 8;
export const STAFF_PASSWORD_MIN_LENGTH = 12;

export const CLIENT_PASSWORD_RULES: PasswordRules = {
  minLength: CLIENT_PASSWORD_MIN_LENGTH,
};

export const STAFF_PASSWORD_RULES: PasswordRules = {
  minLength: STAFF_PASSWORD_MIN_LENGTH,
  requireSymbol: true,
};

const UPPERCASE = /[A-Z]/;
const LOWERCASE = /[a-z]/;
const DIGIT = /[0-9]/;
const SYMBOL = /[^A-Za-z0-9]/;

/**
 * Devuelve un mensaje de error si `password` no cumple `rules`, o `null` si
 * es válida. Además del largo mínimo exige mayúscula + minúscula + número
 * (y símbolo para el staff) — así no alcanza con algo como "aaaaaaaa" o
 * "11111111", que sólo pasarían un chequeo de longitud.
 */
export function validatePassword(password: string, rules: PasswordRules): string | null {
  const { minLength, requireSymbol = false } = rules;

  if (password.length < minLength) {
    return `La contraseña debe tener al menos ${minLength} caracteres`;
  }
  if (!UPPERCASE.test(password) || !LOWERCASE.test(password) || !DIGIT.test(password)) {
    return 'La contraseña debe combinar mayúsculas, minúsculas y números';
  }
  if (requireSymbol && !SYMBOL.test(password)) {
    return 'La contraseña debe incluir al menos un símbolo (ej. !, ?, %, #)';
  }
  return null;
}

/** Texto de ayuda para mostrar debajo del input, coherente con `validatePassword`. */
export function passwordHint(rules: PasswordRules): string {
  const base = `Mínimo ${rules.minLength} caracteres, con mayúsculas, minúsculas y números`;
  return rules.requireSymbol ? `${base} y al menos un símbolo.` : `${base}.`;
}
