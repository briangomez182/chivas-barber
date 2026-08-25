/**
 * Modelo de dominio de Chivas Barbería Club.
 * Todo el proyecto usa exclusivamente `const` / `let` y tipado explícito.
 */

/** Duraciones/intervalos admitidos por el sistema de agendas. */
export const SLOT_INTERVALS = [15, 30, 45, 60] as const;
export type SlotInterval = (typeof SLOT_INTERVALS)[number];

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'done';
export type UserRole = 'admin' | 'client';

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
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
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

/** Sesión mínima almacenada en la cookie firmada. */
export interface SessionPayload {
  sub: string;
  name: string;
  role: UserRole;
  exp: number;
}

/** Respuesta estándar de error de las API Routes. */
export interface ApiError {
  error: string;
}
