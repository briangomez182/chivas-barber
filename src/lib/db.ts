import type { SupabaseClient } from '@supabase/supabase-js';

import { supabaseAdmin } from './supabase/admin';
import {
  SLOT_INTERVALS,
  type Appointment,
  type AppointmentStatus,
  type Barber,
  type PaymentStatus,
  type Profile,
  type Service,
  type Settings,
  type SlotInterval,
  type UserRole,
} from './types';

/**
 * Capa de acceso a datos sobre Postgres (Supabase).
 *
 * Reemplaza al viejo store en `data/db.json`, que no podía funcionar en
 * Vercel: el filesystem de las funciones serverless es de sólo lectura y
 * efímero. Acá cada operación es una consulta puntual — nada de leer y
 * reescribir la base entera en cada request.
 *
 * Convención: Postgres usa snake_case, el dominio de la app camelCase. La
 * traducción vive en los mappers de este archivo y no se filtra hacia afuera.
 */

// ---------------------------------------------------------------------------
// Filas crudas y mappers
// ---------------------------------------------------------------------------

interface SettingsRow {
  slot_interval_min: number;
  opening_time: string;
  closing_time: string;
  working_days: number[];
  buffer_min: number;
  deposit_amount: number;
}

interface BarberRow {
  id: string;
  name: string;
  role: string;
  specialty: string;
  photo_url: string;
  active: boolean;
  created_at: string;
}

interface ServiceRow {
  id: string;
  name: string;
  description: string;
  duration_min: number;
  price: number;
  featured: boolean;
  created_at: string;
}

interface AppointmentRow {
  id: string;
  barber_id: string;
  service_id: string | null;
  date: string;
  time: string;
  duration_min: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  notes: string | null;
  status: AppointmentStatus;
  amount: number | null;
  payment_id: string | null;
  payment_status: string | null;
  created_at: string;
}

function isSlotInterval(value: number): value is SlotInterval {
  return (SLOT_INTERVALS as readonly number[]).includes(value);
}

function toSettings(row: SettingsRow): Settings {
  return {
    slotIntervalMin: isSlotInterval(row.slot_interval_min)
      ? row.slot_interval_min
      : 30,
    openingTime: row.opening_time,
    closingTime: row.closing_time,
    workingDays: row.working_days,
    bufferMin: row.buffer_min,
    depositAmount: row.deposit_amount,
  };
}

function toBarber(row: BarberRow): Barber {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    specialty: row.specialty,
    photoUrl: row.photo_url,
    active: row.active,
    createdAt: row.created_at,
  };
}

function toService(row: ServiceRow): Service {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    durationMin: row.duration_min,
    price: row.price,
    featured: row.featured,
    createdAt: row.created_at,
  };
}

function toAppointment(row: AppointmentRow): Appointment {
  return {
    id: row.id,
    barberId: row.barber_id,
    serviceId: row.service_id,
    date: row.date,
    time: row.time,
    durationMin: row.duration_min,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    notes: row.notes,
    status: row.status,
    amount: row.amount,
    paymentId: row.payment_id,
    paymentStatus: row.payment_status as PaymentStatus | null,
    createdAt: row.created_at,
  };
}

/** Convierte el error de supabase-js en una excepción con contexto. */
function fail(operation: string, error: { message: string }): never {
  throw new Error(`Supabase — ${operation}: ${error.message}`);
}

/**
 * `22P02` = invalid_text_representation: el id de la URL no es un UUID.
 * Es un 404, no un 500 — el recurso simplemente no puede existir.
 */
function isMalformedId(error: { code?: string } | null): boolean {
  return error?.code === '22P02';
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

const SETTINGS_COLUMNS =
  'slot_interval_min, opening_time, closing_time, working_days, buffer_min, deposit_amount';

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabaseAdmin()
    .from('settings')
    .select(SETTINGS_COLUMNS)
    .limit(1)
    .maybeSingle<SettingsRow>();

  if (error) fail('leer settings', error);
  if (!data) {
    throw new Error(
      'La tabla `settings` está vacía. Ejecutá supabase/schema.sql en tu proyecto de Supabase.',
    );
  }

  return toSettings(data);
}

export interface SettingsPatch {
  slotIntervalMin?: SlotInterval;
  openingTime?: string;
  closingTime?: string;
  workingDays?: number[];
  bufferMin?: number;
  depositAmount?: number;
}

export async function updateSettings(patch: SettingsPatch): Promise<Settings> {
  const row: Partial<SettingsRow> = {};
  if (patch.slotIntervalMin !== undefined) {
    row.slot_interval_min = patch.slotIntervalMin;
  }
  if (patch.openingTime !== undefined) row.opening_time = patch.openingTime;
  if (patch.closingTime !== undefined) row.closing_time = patch.closingTime;
  if (patch.workingDays !== undefined) row.working_days = patch.workingDays;
  if (patch.bufferMin !== undefined) row.buffer_min = patch.bufferMin;
  if (patch.depositAmount !== undefined) row.deposit_amount = patch.depositAmount;

  if (Object.keys(row).length === 0) return getSettings();

  const { data, error } = await supabaseAdmin()
    .from('settings')
    .update(row)
    .eq('id', true)
    .select(SETTINGS_COLUMNS)
    .single<SettingsRow>();

  if (error) fail('actualizar settings', error);
  return toSettings(data);
}

// ---------------------------------------------------------------------------
// Barberos
// ---------------------------------------------------------------------------

const BARBER_COLUMNS =
  'id, name, role, specialty, photo_url, active, created_at';

export async function listBarbers(includeInactive = false): Promise<Barber[]> {
  let query = supabaseAdmin()
    .from('barbers')
    .select(BARBER_COLUMNS)
    .order('created_at', { ascending: true });

  if (!includeInactive) query = query.eq('active', true);

  const { data, error } = await query.returns<BarberRow[]>();
  if (error) fail('listar barberos', error);

  return (data ?? []).map(toBarber);
}

export async function getBarber(id: string): Promise<Barber | null> {
  const { data, error } = await supabaseAdmin()
    .from('barbers')
    .select(BARBER_COLUMNS)
    .eq('id', id)
    .maybeSingle<BarberRow>();

  if (error) {
    if (isMalformedId(error)) return null;
    fail('buscar barbero', error);
  }
  return data ? toBarber(data) : null;
}

export interface BarberInput {
  name: string;
  role: string;
  specialty: string;
  photoUrl: string;
  active: boolean;
}

export async function createBarber(input: BarberInput): Promise<Barber> {
  const { data, error } = await supabaseAdmin()
    .from('barbers')
    .insert({
      name: input.name,
      role: input.role,
      specialty: input.specialty,
      photo_url: input.photoUrl,
      active: input.active,
    })
    .select(BARBER_COLUMNS)
    .single<BarberRow>();

  if (error) fail('crear barbero', error);
  return toBarber(data);
}

export async function updateBarber(
  id: string,
  patch: Partial<BarberInput>,
): Promise<Barber | null> {
  const row: Partial<BarberRow> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.role !== undefined) row.role = patch.role;
  if (patch.specialty !== undefined) row.specialty = patch.specialty;
  if (patch.photoUrl !== undefined) row.photo_url = patch.photoUrl;
  if (patch.active !== undefined) row.active = patch.active;

  if (Object.keys(row).length === 0) return getBarber(id);

  const { data, error } = await supabaseAdmin()
    .from('barbers')
    .update(row)
    .eq('id', id)
    .select(BARBER_COLUMNS)
    .maybeSingle<BarberRow>();

  if (error) {
    if (isMalformedId(error)) return null;
    fail('actualizar barbero', error);
  }
  return data ? toBarber(data) : null;
}

/** Los turnos del barbero se borran solos: `on delete cascade` en el esquema. */
export async function deleteBarber(id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from('barbers')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle<{ id: string }>();

  if (error) {
    if (isMalformedId(error)) return false;
    fail('eliminar barbero', error);
  }
  return data !== null;
}

// ---------------------------------------------------------------------------
// Servicios
// ---------------------------------------------------------------------------

const SERVICE_COLUMNS =
  'id, name, description, duration_min, price, featured, created_at';

export async function listServices(): Promise<Service[]> {
  const { data, error } = await supabaseAdmin()
    .from('services')
    .select(SERVICE_COLUMNS)
    .order('created_at', { ascending: true })
    .returns<ServiceRow[]>();

  if (error) fail('listar servicios', error);
  return (data ?? []).map(toService);
}

export async function getService(id: string): Promise<Service | null> {
  const { data, error } = await supabaseAdmin()
    .from('services')
    .select(SERVICE_COLUMNS)
    .eq('id', id)
    .maybeSingle<ServiceRow>();

  if (error) {
    if (isMalformedId(error)) return null;
    fail('buscar servicio', error);
  }
  return data ? toService(data) : null;
}

export interface ServiceInput {
  name: string;
  description: string;
  durationMin: number;
  price: number;
  featured: boolean;
}

export async function createService(input: ServiceInput): Promise<Service> {
  const { data, error } = await supabaseAdmin()
    .from('services')
    .insert({
      name: input.name,
      description: input.description,
      duration_min: input.durationMin,
      price: input.price,
      featured: input.featured,
    })
    .select(SERVICE_COLUMNS)
    .single<ServiceRow>();

  if (error) fail('crear servicio', error);
  return toService(data);
}

export async function updateService(
  id: string,
  patch: Partial<ServiceInput>,
): Promise<Service | null> {
  const row: Partial<ServiceRow> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.durationMin !== undefined) row.duration_min = patch.durationMin;
  if (patch.price !== undefined) row.price = patch.price;
  if (patch.featured !== undefined) row.featured = patch.featured;

  if (Object.keys(row).length === 0) return getService(id);

  const { data, error } = await supabaseAdmin()
    .from('services')
    .update(row)
    .eq('id', id)
    .select(SERVICE_COLUMNS)
    .maybeSingle<ServiceRow>();

  if (error) {
    if (isMalformedId(error)) return null;
    fail('actualizar servicio', error);
  }
  return data ? toService(data) : null;
}

/** Los turnos que lo referencian quedan con `serviceId = null` (`on delete set null`). */
export async function deleteService(id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from('services')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle<{ id: string }>();

  if (error) {
    if (isMalformedId(error)) return false;
    fail('eliminar servicio', error);
  }
  return data !== null;
}

// ---------------------------------------------------------------------------
// Turnos
//
// Las funciones de esta sección reciben un cliente `SupabaseClient` opcional.
// Las rutas de admin no lo pasan (usan `supabaseAdmin()` por default, como
// siempre). Las rutas de editor pasan el cliente de la sesión
// (`createServerSupabaseClient()`), así la query corre autenticada como ese
// usuario y las policies de RLS (ver supabase/migrations/0002_rbac_auth.sql)
// son las que realmente acotan qué puede ver/tocar — no sólo el código acá.
// ---------------------------------------------------------------------------

const APPOINTMENT_COLUMNS =
  'id, barber_id, service_id, date, time, duration_min, customer_name, customer_phone, customer_email, notes, status, amount, payment_id, payment_status, created_at';

export interface AppointmentFilter {
  date?: string;
  barberId?: string;
}

export async function listAppointments(
  filter: AppointmentFilter = {},
  client: SupabaseClient = supabaseAdmin(),
): Promise<Appointment[]> {
  let query = client
    .from('appointments')
    .select(APPOINTMENT_COLUMNS)
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  if (filter.date) query = query.eq('date', filter.date);
  if (filter.barberId) query = query.eq('barber_id', filter.barberId);

  const { data, error } = await query.returns<AppointmentRow[]>();
  if (error) fail('listar turnos', error);

  return (data ?? []).map(toAppointment);
}

export async function getAppointment(
  id: string,
  client: SupabaseClient = supabaseAdmin(),
): Promise<Appointment | null> {
  const { data, error } = await client
    .from('appointments')
    .select(APPOINTMENT_COLUMNS)
    .eq('id', id)
    .maybeSingle<AppointmentRow>();

  if (error) {
    if (isMalformedId(error)) return null;
    fail('buscar turno', error);
  }
  return data ? toAppointment(data) : null;
}

export interface BookingInput {
  barberId: string;
  serviceId: string | null;
  date: string;
  time: string;
  durationMin: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  notes: string | null;
}

export type BookingResult =
  | { appointment: Appointment }
  | { error: 'SLOT_TAKEN' | 'FORBIDDEN' };

/** Igual que `BookingInput`, más el monto a cobrar en Mercado Pago. */
export interface PendingBookingInput extends BookingInput {
  amount: number;
}

export type PendingBookingResult =
  | { appointment: Appointment }
  | { error: 'SLOT_TAKEN' };

/**
 * Reserva un turno de forma atómica.
 *
 * Delega en la función `book_appointment` de Postgres, que toma un advisory
 * lock por (barbero, día) antes de verificar el solapamiento e insertar. Hacer
 * el chequeo acá en JS dejaría una ventana entre el SELECT y el INSERT en la
 * que dos requests simultáneos podrían reservar el mismo horario.
 *
 * Con el cliente admin (default, `auth.uid()` null adentro de la función) no
 * hay chequeo de autorización — así sigue funcionando el booking público
 * anónimo. Pasar el cliente de sesión de un editor exige que sea dueño de
 * `input.barberId`.
 */
export async function bookAppointment(
  input: BookingInput,
  client: SupabaseClient = supabaseAdmin(),
): Promise<BookingResult> {
  const { data, error } = await client
    .rpc('book_appointment', {
      p_barber_id: input.barberId,
      p_service_id: input.serviceId,
      p_date: input.date,
      p_time: input.time,
      p_duration_min: input.durationMin,
      p_customer_name: input.customerName,
      p_customer_phone: input.customerPhone,
      p_customer_email: input.customerEmail,
      p_notes: input.notes,
    })
    .single<AppointmentRow>();

  if (error) {
    if (error.message.includes('SLOT_TAKEN')) return { error: 'SLOT_TAKEN' };
    if (error.message.includes('FORBIDDEN')) return { error: 'FORBIDDEN' };
    fail('reservar turno', error);
  }

  return { appointment: toAppointment(data) };
}

/**
 * Crea un turno en estado `pending_payment` — usado por el flujo público de
 * cobro (`/api/checkout`). Delega en `book_appointment_pending` (mismo
 * advisory lock + chequeo de solapamiento que `book_appointment`, ver
 * supabase/migrations/0004_mercadopago_payments.sql). Siempre corre con la
 * service_role: el checkout es público, sin sesión de usuario.
 */
export async function bookAppointmentPending(
  input: PendingBookingInput,
): Promise<PendingBookingResult> {
  const { data, error } = await supabaseAdmin()
    .rpc('book_appointment_pending', {
      p_barber_id: input.barberId,
      p_service_id: input.serviceId,
      p_date: input.date,
      p_time: input.time,
      p_duration_min: input.durationMin,
      p_customer_name: input.customerName,
      p_customer_phone: input.customerPhone,
      p_customer_email: input.customerEmail,
      p_notes: input.notes,
      p_amount: input.amount,
    })
    .single<AppointmentRow>();

  if (error) {
    if (error.message.includes('SLOT_TAKEN')) return { error: 'SLOT_TAKEN' };
    fail('reservar turno (pendiente de pago)', error);
  }

  return { appointment: toAppointment(data) };
}

/**
 * Actualiza el resultado de un pago de Mercado Pago sobre un turno —
 * usado exclusivamente por el webhook (`/api/mercado-pago/webhook`).
 * `newStatus` es `null` cuando el pago sigue `pending`/`in_process`: el
 * turno se queda en `pending_payment`, sólo se guardan `paymentId`/
 * `paymentStatus` para tener el último estado reportado.
 */
export async function updateAppointmentPayment(
  id: string,
  patch: {
    paymentId: string;
    paymentStatus: PaymentStatus;
    newStatus: AppointmentStatus | null;
  },
): Promise<Appointment | null> {
  const row: Partial<AppointmentRow> = {
    payment_id: patch.paymentId,
    payment_status: patch.paymentStatus,
  };
  if (patch.newStatus) row.status = patch.newStatus;

  const { data, error } = await supabaseAdmin()
    .from('appointments')
    .update(row)
    .eq('id', id)
    .select(APPOINTMENT_COLUMNS)
    .maybeSingle<AppointmentRow>();

  if (error) {
    if (isMalformedId(error)) return null;
    fail('actualizar pago del turno', error);
  }
  return data ? toAppointment(data) : null;
}

export async function setAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  client: SupabaseClient = supabaseAdmin(),
): Promise<Appointment | null> {
  const { data, error } = await client
    .from('appointments')
    .update({ status })
    .eq('id', id)
    .select(APPOINTMENT_COLUMNS)
    .maybeSingle<AppointmentRow>();

  if (error) {
    if (isMalformedId(error)) return null;
    fail('actualizar turno', error);
  }
  return data ? toAppointment(data) : null;
}

export interface RescheduleInput {
  barberId: string;
  serviceId: string | null;
  date: string;
  time: string;
  durationMin: number;
}

export type RescheduleResult =
  | { appointment: Appointment }
  | { error: 'SLOT_TAKEN' | 'FORBIDDEN' | 'NOT_FOUND' };

/**
 * Reagenda un turno existente (fecha/hora/barbero/servicio) de forma atómica.
 * Mismo patrón que `bookAppointment`, pero vía `reschedule_appointment` (ver
 * migración RBAC), que excluye el propio turno del chequeo de solapamiento.
 */
export async function rescheduleAppointment(
  id: string,
  input: RescheduleInput,
  client: SupabaseClient = supabaseAdmin(),
): Promise<RescheduleResult> {
  const { data, error } = await client
    .rpc('reschedule_appointment', {
      p_id: id,
      p_barber_id: input.barberId,
      p_service_id: input.serviceId,
      p_date: input.date,
      p_time: input.time,
      p_duration_min: input.durationMin,
    })
    .single<AppointmentRow>();

  if (error) {
    if (error.message.includes('SLOT_TAKEN')) return { error: 'SLOT_TAKEN' };
    if (error.message.includes('FORBIDDEN')) return { error: 'FORBIDDEN' };
    if (error.message.includes('NOT_FOUND')) return { error: 'NOT_FOUND' };
    fail('reagendar turno', error);
  }

  return { appointment: toAppointment(data) };
}

export async function deleteAppointment(id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from('appointments')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle<{ id: string }>();

  if (error) {
    if (isMalformedId(error)) return false;
    fail('eliminar turno', error);
  }
  return data !== null;
}

// ---------------------------------------------------------------------------
// Usuarios de staff (admin / editor)
//
// Auth vive en Supabase Auth (`auth.users`); acá sólo se gestiona vía el
// Admin API (`service_role`) y la tabla `profiles`. Pensado para el panel de
// administración: listar/crear/editar el equipo (admins y editores), no un
// directorio general de clientes.
// ---------------------------------------------------------------------------

interface ProfileRow {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  barber_id: string | null;
  created_at: string;
}

function toProfile(row: ProfileRow, email: string): Profile {
  return {
    id: row.id,
    email,
    name: row.name,
    phone: row.phone,
    role: row.role,
    barberId: row.barber_id,
    createdAt: row.created_at,
  };
}

const PROFILE_COLUMNS = 'id, name, phone, role, barber_id, created_at';

/** Admins y editores — no incluye clientes. */
export async function listStaffProfiles(): Promise<Profile[]> {
  const { data, error } = await supabaseAdmin()
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .in('role', ['admin', 'editor'])
    .order('created_at', { ascending: true })
    .returns<ProfileRow[]>();

  if (error) fail('listar usuarios', error);
  if (!data || data.length === 0) return [];

  const emails = await Promise.all(
    data.map(async (row) => {
      const { data: userData } = await supabaseAdmin().auth.admin.getUserById(row.id);
      return userData.user?.email ?? '';
    }),
  );

  return data.map((row, index) => toProfile(row, emails[index]));
}

export interface StaffInput {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: 'admin' | 'editor';
  barberId: string | null;
}

export type CreateStaffResult = { profile: Profile } | { error: 'EMAIL_TAKEN' };

/**
 * Alta de un usuario de staff. Crea el `auth.users` con el Admin API —
 * `email_confirm: true` porque lo está dando de alta un admin, no hace falta
 * verificación de email — y pasa `role`/`barber_id` en `app_metadata`
 * (no `user_metadata`: ver comentario en la migración sobre por qué).
 *
 * El trigger `handle_new_user` crea el `profile`, pero GoTrue completa
 * `app_metadata` en un segundo paso posterior al INSERT que dispara ese
 * trigger — el profile puede quedar creado con `role: 'client'` (el default)
 * aunque `auth.users.app_metadata.role` ya diga lo correcto. Por eso acá se
 * pisa el profile a mano con un `update` explícito en vez de confiar en lo
 * que haya insertado el trigger.
 */
export async function createStaffUser(
  input: StaffInput,
): Promise<CreateStaffResult> {
  const { data, error } = await supabaseAdmin().auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name, phone: input.phone },
    app_metadata: { role: input.role, barber_id: input.barberId },
  });

  if (error) {
    if (error.code === 'email_exists') return { error: 'EMAIL_TAKEN' };
    fail('crear usuario', error);
  }

  const { error: profileError } = await supabaseAdmin()
    .from('profiles')
    .update({
      name: input.name,
      phone: input.phone,
      role: input.role,
      barber_id: input.barberId,
    })
    .eq('id', data.user.id);
  if (profileError) fail('actualizar profile del usuario creado', profileError);

  const profile: Profile = {
    id: data.user.id,
    email: data.user.email ?? input.email,
    name: input.name,
    phone: input.phone,
    role: input.role,
    barberId: input.barberId,
    createdAt: data.user.created_at,
  };

  return { profile };
}

export interface ProfilePatch {
  name?: string;
  phone?: string;
  role?: 'admin' | 'editor';
  barberId?: string | null;
}

/**
 * Edita nombre/teléfono/rol/barbero de un usuario de staff. Si el rol deja
 * de ser 'editor', se desvincula el barbero — un admin no debería quedar con
 * un `barber_id` colgado.
 */
export async function updateProfile(
  id: string,
  patch: ProfilePatch,
): Promise<Profile | null> {
  const row: Partial<Pick<ProfileRow, 'name' | 'phone' | 'role' | 'barber_id'>> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.role !== undefined) {
    row.role = patch.role;
    row.barber_id = patch.role === 'editor' ? (patch.barberId ?? null) : null;
  } else if (patch.barberId !== undefined) {
    row.barber_id = patch.barberId;
  }

  if (Object.keys(row).length === 0) {
    const { data } = await supabaseAdmin()
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', id)
      .maybeSingle<ProfileRow>();
    if (!data) return null;
    const { data: userData } = await supabaseAdmin().auth.admin.getUserById(id);
    return toProfile(data, userData.user?.email ?? '');
  }

  const { data, error } = await supabaseAdmin()
    .from('profiles')
    .update(row)
    .eq('id', id)
    .select(PROFILE_COLUMNS)
    .maybeSingle<ProfileRow>();

  if (error) {
    if (isMalformedId(error)) return null;
    fail('actualizar usuario', error);
  }
  if (!data) return null;

  const { data: userData } = await supabaseAdmin().auth.admin.getUserById(id);
  return toProfile(data, userData.user?.email ?? '');
}

/** El admin le fija una contraseña nueva a un usuario de staff. */
export async function resetStaffPassword(
  id: string,
  password: string,
): Promise<boolean> {
  const { error } = await supabaseAdmin().auth.admin.updateUserById(id, { password });
  if (error) {
    if (error.code === 'user_not_found') return false;
    fail('resetear contraseña', error);
  }
  return true;
}

/**
 * Baja de un usuario de staff. Borra el `auth.users` con el Admin API — el
 * `profile` se va solo (`on delete cascade` en `profiles.id`).
 */
export async function deleteStaffUser(id: string): Promise<boolean> {
  const { error } = await supabaseAdmin().auth.admin.deleteUser(id);
  if (error) {
    if (error.code === 'user_not_found') return false;
    fail('eliminar usuario', error);
  }
  return true;
}
