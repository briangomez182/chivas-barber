/**
 * Modelo de dominio de Chivas Barbería Club.
 * Todo el proyecto usa exclusivamente `const` / `let` y tipado explícito.
 */

/** Duraciones/intervalos admitidos por el sistema de agendas. */
export const SLOT_INTERVALS = [15, 30, 45, 60] as const;
export type SlotInterval = (typeof SLOT_INTERVALS)[number];

export type AppointmentStatus =
  | 'pending'
  | 'pending_payment'
  | 'confirmed'
  | 'cancelled'
  | 'done';
export type UserRole = 'admin' | 'editor' | 'client';

/** Estados de pago tal como los reporta la API de Mercado Pago. */
export type PaymentStatus =
  | 'pending'
  | 'approved'
  | 'authorized'
  | 'in_process'
  | 'in_mediation'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'charged_back';

export interface Barber {
  id: string;
  name: string;
  role: string;
  specialty: string;
  photoUrl: string;
  active: boolean;
  createdAt: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  /** Duración en minutos. */
  durationMin: number;
  /** Precio en pesos argentinos. */
  price: number;
  featured: boolean;
  createdAt: string;
}

export interface Settings {
  /** Intervalo global del calendario. */
  slotIntervalMin: SlotInterval;
  /** Apertura en formato `HH:mm`. */
  openingTime: string;
  /** Cierre en formato `HH:mm`. */
  closingTime: string;
  /** Días laborables: 0 = domingo … 6 = sábado. */
  workingDays: number[];
  /** Minutos de descanso entre turnos. */
  bufferMin: number;
  /**
   * Seña fija en pesos que se cobra por Mercado Pago al reservar (no el
   * precio total del servicio). El resto se abona en el local.
   */
  depositAmount: number;
}

export interface Appointment {
  id: string;
  barberId: string;
  serviceId: string | null;
  /** Fecha local en formato `YYYY-MM-DD`. */
  date: string;
  /** Hora de inicio en formato `HH:mm`. */
  time: string;
  durationMin: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  notes: string | null;
  status: AppointmentStatus;
  /** Precio del servicio al momento de la reserva (congelado). */
  amount: number | null;
  /** ID de pago de Mercado Pago, una vez que existe un intento de cobro. */
  paymentId: string | null;
  /** Último estado de pago reportado por el webhook de Mercado Pago. */
  paymentStatus: PaymentStatus | null;
  createdAt: string;
}

/**
 * Perfil de `public.profiles`, 1:1 con un `auth.users` de Supabase Auth.
 * `email` sale de `auth.users` (Admin API), no de `profiles`.
 */
export interface Profile {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  /** Barbero vinculado — sólo tiene sentido para `role: 'editor'`. */
  barberId: string | null;
  createdAt: string;
}

/** Un bloque horario calculado para una fecha + barbero. */
export interface Slot {
  /** `HH:mm` */
  time: string;
  /** `HH:mm` de finalización, ya incluido el servicio. */
  endTime: string;
  available: boolean;
  reason?: 'taken' | 'past' | 'closed';
}

/** Sesión resuelta desde Supabase Auth + el profile del usuario. */
export interface Session {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  barberId: string | null;
}

/** Respuesta estándar de error de las API Routes. */
export interface ApiError {
  error: string;
}
