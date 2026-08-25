import { supabase } from './supabase';
import {
  SLOT_INTERVALS,
  type Appointment,
  type AppointmentStatus,
  type Barber,
  type Service,
  type Settings,
  type SlotInterval,
  type User,
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
  created_at: string;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  password_hash: string;
  role: User['role'];
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
    createdAt: row.created_at,
  };
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    passwordHash: row.password_hash,
    role: row.role,
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
  'slot_interval_min, opening_time, closing_time, working_days, buffer_min';

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase()
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

  if (Object.keys(row).length === 0) return getSettings();

  const { data, error } = await supabase()
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
  let query = supabase()
    .from('barbers')
    .select(BARBER_COLUMNS)
    .order('created_at', { ascending: true });

  if (!includeInactive) query = query.eq('active', true);

  const { data, error } = await query.returns<BarberRow[]>();
  if (error) fail('listar barberos', error);

  return (data ?? []).map(toBarber);
}

export async function getBarber(id: string): Promise<Barber | null> {
  const { data, error } = await supabase()
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
  const { data, error } = await supabase()
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

  const { data, error } = await supabase()
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
  const { data, error } = await supabase()
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
  const { data, error } = await supabase()
    .from('services')
    .select(SERVICE_COLUMNS)
    .order('created_at', { ascending: true })
    .returns<ServiceRow[]>();

  if (error) fail('listar servicios', error);
  return (data ?? []).map(toService);
}

export async function getService(id: string): Promise<Service | null> {
  const { data, error } = await supabase()
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
  const { data, error } = await supabase()
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

  const { data, error } = await supabase()
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
  const { data, error } = await supabase()
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
// ---------------------------------------------------------------------------

const APPOINTMENT_COLUMNS =
  'id, barber_id, service_id, date, time, duration_min, customer_name, customer_phone, customer_email, notes, status, created_at';

export interface AppointmentFilter {
  date?: string;
  barberId?: string;
}

export async function listAppointments(
  filter: AppointmentFilter = {},
): Promise<Appointment[]> {
  let query = supabase()
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
  | { error: 'SLOT_TAKEN' };

/**
 * Reserva un turno de forma atómica.
 *
 * Delega en la función `book_appointment` de Postgres, que toma un advisory
 * lock por (barbero, día) antes de verificar el solapamiento e insertar. Hacer
 * el chequeo acá en JS dejaría una ventana entre el SELECT y el INSERT en la
 * que dos requests simultáneos podrían reservar el mismo horario.
 */
export async function bookAppointment(
  input: BookingInput,
): Promise<BookingResult> {
  const { data, error } = await supabase()
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
    fail('reservar turno', error);
  }

  return { appointment: toAppointment(data) };
}

export async function setAppointmentStatus(
  id: string,
  status: AppointmentStatus,
): Promise<Appointment | null> {
  const { data, error } = await supabase()
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

export async function deleteAppointment(id: string): Promise<boolean> {
  const { data, error } = await supabase()
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
// Usuarios
// ---------------------------------------------------------------------------

const USER_COLUMNS = 'id, name, email, phone, password_hash, role, created_at';

/**
 * Busca por email sin distinguir mayúsculas.
 *
 * Filtra por igualdad exacta sobre `email_lower` (columna generada). Usar
 * `ilike` sería un error: trata `%` y `_` como comodines, así que un intento
 * de login con el email `%` haría match con una cuenta cualquiera.
 */
export async function findUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await supabase()
    .from('users')
    .select(USER_COLUMNS)
    .eq('email_lower', email.trim().toLowerCase())
    .maybeSingle<UserRow>();

  if (error) fail('buscar usuario', error);
  return data ? toUser(data) : null;
}

export interface UserInput {
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: User['role'];
}

export type CreateUserResult = { user: User } | { error: 'EMAIL_TAKEN' };

/**
 * Alta de usuario. El duplicado lo detecta el índice único sobre
 * `lower(email)` (código 23505), no un SELECT previo: así dos registros
 * simultáneos con el mismo email no pueden pasar los dos.
 */
export async function createUser(input: UserInput): Promise<CreateUserResult> {
  const { data, error } = await supabase()
    .from('users')
    .insert({
      name: input.name,
      email: input.email,
      phone: input.phone,
      password_hash: input.passwordHash,
      role: input.role,
    })
    .select(USER_COLUMNS)
    .single<UserRow>();

  if (error) {
    if (error.code === '23505') return { error: 'EMAIL_TAKEN' };
    fail('crear usuario', error);
  }

  return { user: toUser(data) };
}
