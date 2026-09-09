/**
 * Modelo de dominio de Chivas Barbería Club.
 * Todo el proyecto usa exclusivamente `const` / `let` y tipado explícito.
 */

/** Duraciones/intervalos admitidos por el sistema de agendas. */
export const SLOT_INTERVALS = [15, 30, 45, 60] as const;
export type SlotInterval = (typeof SLOT_INTERVALS)[number];

/** Cantidades de sellos admitidas para completar la tarjeta de fidelización. */
export const LOYALTY_STAMPS_GOALS = [5, 10, 15, 20] as const;
export type LoyaltyStampsGoal = (typeof LOYALTY_STAMPS_GOALS)[number];

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

export interface BarberPortfolioImage {
  id: string;
  barberId: string;
  imageUrl: string;
  sortOrder: number;
  createdAt: string;
}

export interface Barber {
  id: string;
  name: string;
  role: string;
  specialty: string;
  photoUrl: string;
  active: boolean;
  createdAt: string;
  /**
   * Agenda propia del barbero: cada uno abre/cierra a su hora, trabaja los
   * días que quiere y genera bloques en su propio intervalo. Reemplaza a la
   * agenda global (que dejó de tener pantalla en el panel). Valores por
   * defecto al crear un barbero: 10:00–20:00, Lun–Sáb, bloques de 30 min,
   * sin descanso.
   */
  /** Apertura en formato `HH:mm`. */
  openingTime: string;
  /** Cierre en formato `HH:mm`. */
  closingTime: string;
  /** Días laborables: 0 = domingo … 6 = sábado. */
  workingDays: number[];
  /** Paso entre bloques de horario, en minutos. */
  slotIntervalMin: SlotInterval;
  /** Minutos de descanso entre un turno y el siguiente. */
  bufferMin: number;
  /** Imágenes de portafolio (hasta 5). Se popula sólo cuando se pide explícitamente. */
  portfolioImages?: BarberPortfolioImage[];
}

export interface Service {
  id: string;
  /** Barbero dueño de este servicio: la carta es propia de cada barbero. */
  barberId: string;
  name: string;
  description: string;
  /** Duración en minutos. */
  durationMin: number;
  /** Precio en pesos argentinos. */
  price: number;
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
   * precio total del servicio). El resto se abona en el local. Sólo se
   * cobra si `depositEnabled` es `true`.
   */
  depositAmount: number;
  /** Switch general del módulo de pagos: si es `false`, el checkout online queda deshabilitado sin importar `depositAmount`. */
  depositEnabled: boolean;
  /**
   * Módulo Turnos: si es `true`, la paginación de la vista de turnos
   * (admin y editor) muestra "Página X de Y · N turnos". Si es `false`,
   * sólo se ven los botones Anterior/Siguiente.
   */
  showPaginationCount: boolean;
  /**
   * Módulo "Formulario de turnos": si es `true`, el formulario público de
   * reserva (BookingWidget) muestra los campos de email y comentarios
   * (ambos opcionales). Si es `false`, se ocultan por completo.
   */
  showOptionalBookingFields: boolean;
  /**
   * Módulo "Tarjeta de Fidelización": si es `true`, se ven la sección
   * "Lealtad" del sitio público (búsqueda + tarjeta de sellos) y la pestaña
   * "Lealtad" del panel de admin. Si es `false`, ambas quedan ocultas.
   */
  loyaltyEnabled: boolean;
  /** Sellos necesarios para completar la tarjeta y ganar un corte gratis. */
  loyaltyStampsGoal: LoyaltyStampsGoal;
  /**
   * Teléfono del dueño en formato internacional (ej. `+5491160068637`) que
   * recibe un aviso por WhatsApp cuando un cliente paga la seña de un turno.
   * `null` = la notificación queda desactivada.
   */
  ownerWhatsapp: string | null;
}

/** Estado de una fila de la cola de notificaciones (`public.notifications`). */
export type NotificationStatus = 'pending' | 'sent' | 'failed';

/**
 * Aviso encolado en la outbox — hoy sólo `kind: 'deposit_paid'` (WhatsApp al
 * dueño cuando se paga una seña). Lo maneja `lib/notifications.ts`.
 */
export interface AppointmentNotification {
  id: string;
  appointmentId: string;
  kind: string;
  channel: string;
  /** Destinatario congelado al momento de encolar. */
  recipient: string;
  status: NotificationStatus;
  attempts: number;
  lastError: string | null;
  /** Snapshot de los datos del mensaje (incluye `bodyParams`). */
  payload: Record<string, unknown> | null;
  providerMessageId: string | null;
  /** Cuándo puede reintentarse (backoff); `null` = ya. */
  nextRetryAt: string | null;
  createdAt: string;
  sentAt: string | null;
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
  /**
   * Seña cobrada por Mercado Pago al reservar (no el precio total del
   * servicio) — `null` si el turno no pasó por el flujo de cobro (alta
   * manual de staff, o reserva pública con la seña deshabilitada).
   */
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
  reason?: 'taken' | 'past' | 'closed' | 'blocked';
}

/** Estado de un bloque en la vista Turnero. */
export type TurneroBlockState = 'booked' | 'free' | 'blocked';

/**
 * Uno de los próximos bloques de la agenda del barbero para el Turnero.
 * `time`/`endTime` en `null` = fila de relleno (la jornada ya no tiene más
 * bloques), se muestra igual como "Libre".
 */
export interface TurneroBlock {
  time: string | null;
  endTime: string | null;
  state: TurneroBlockState;
  /** Turno que ocupa el bloque — sólo si `state === 'booked'`. */
  appointment: Appointment | null;
  /** Motivo del bloqueo — sólo si `state === 'blocked'`. */
  blockedReason: string | null;
}

/** Respuesta de `GET /api/turnero` — lo que consume la vista en vivo. */
export interface TurneroSnapshot {
  /** Fecha de hoy (huso de la barbería), `YYYY-MM-DD`. */
  date: string;
  barberId: string;
  barberName: string;
  /** Siempre 3 bloques (con relleno "Libre" si faltan). */
  blocks: TurneroBlock[];
  /** Turnos de hoy no cancelados, ordenados por hora — para detectar altas. */
  today: Appointment[];
}

/**
 * Tramo de agenda que un barbero (o el admin) marca como no disponible —
 * "me desconecto 4 horas", vacaciones, etc. No es un turno: no tiene
 * cliente ni pago, sólo bloquea horarios en `buildSlots`.
 */
export interface ScheduleBlock {
  id: string;
  barberId: string;
  /** Fecha local en formato `YYYY-MM-DD`. */
  date: string;
  /** `HH:mm`, o `null` si bloquea el día completo. */
  startTime: string | null;
  /** `HH:mm`, o `null` si bloquea el día completo. */
  endTime: string | null;
  reason: string;
  createdAt: string;
}

/** Sesión resuelta desde Supabase Auth + el profile del usuario. */
export interface Session {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  barberId: string | null;
}

/**
 * Estado de la tarjeta de sellos de un cliente, identificada por su teléfono
 * normalizado (dígitos con código de país, ej. `5491160068637`).
 */
export interface LoyaltyCard {
  phoneNumber: string;
  /** Sellos de la tarjeta en curso — entre 0 y `settings.loyaltyStampsGoal`. */
  completedStamps: number;
  /** Cortes gratis acumulados (tarjetas ya completadas). */
  rewardsEarned: number;
  updatedAt: string | null;
  /** `false` si el cliente todavía no tiene ninguna tarjeta registrada. */
  exists: boolean;
}

/** Respuesta estándar de error de las API Routes. */
export interface ApiError {
  error: string;
}
