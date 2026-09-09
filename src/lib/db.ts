import type { SupabaseClient } from '@supabase/supabase-js';

import { customerPhoneDigits } from './brand';
import { supabaseAdmin } from './supabase/admin';
import {
  LOYALTY_STAMPS_GOALS,
  SLOT_INTERVALS,
  type Appointment,
  type AppointmentNotification,
  type AppointmentStatus,
  type Barber,
  type BarberPortfolioImage,
  type LoyaltyCard,
  type LoyaltyStampsGoal,
  type NotificationStatus,
  type PaymentStatus,
  type Profile,
  type ScheduleBlock,
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
  deposit_enabled: boolean;
  show_pagination_count: boolean;
  show_optional_booking_fields: boolean;
  loyalty_enabled: boolean;
  loyalty_stamps_goal: number;
  owner_whatsapp: string | null;
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
  barber_id: string;
  name: string;
  description: string;
  duration_min: number;
  price: number;
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

interface BarberPortfolioImageRow {
  id: string;
  barber_id: string;
  image_url: string;
  sort_order: number;
  created_at: string;
}

interface ScheduleBlockRow {
  id: string;
  barber_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string;
  created_at: string;
}

/** Fila que devuelven las RPC `get_loyalty_card` / `admin_adjust_loyalty_stamp`. */
interface LoyaltyCardRpcRow {
  phone_number: string;
  completed_stamps: number;
  rewards_earned: number;
  updated_at: string | null;
  card_exists: boolean;
}

function isSlotInterval(value: number): value is SlotInterval {
  return (SLOT_INTERVALS as readonly number[]).includes(value);
}

function isLoyaltyStampsGoal(value: number): value is LoyaltyStampsGoal {
  return (LOYALTY_STAMPS_GOALS as readonly number[]).includes(value);
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
    depositEnabled: row.deposit_enabled,
    showPaginationCount: row.show_pagination_count,
    showOptionalBookingFields: row.show_optional_booking_fields,
    loyaltyEnabled: row.loyalty_enabled,
    loyaltyStampsGoal: isLoyaltyStampsGoal(row.loyalty_stamps_goal)
      ? row.loyalty_stamps_goal
      : 10,
    ownerWhatsapp: row.owner_whatsapp ?? null,
  };
}

const NOTIFICATION_COLUMNS =
  'id, appointment_id, kind, channel, recipient, status, attempts, last_error, payload, provider_message_id, next_retry_at, created_at, sent_at';

interface NotificationRow {
  id: string;
  appointment_id: string;
  kind: string;
  channel: string;
  recipient: string;
  status: NotificationStatus;
  attempts: number;
  last_error: string | null;
  payload: Record<string, unknown> | null;
  provider_message_id: string | null;
  next_retry_at: string | null;
  created_at: string;
  sent_at: string | null;
}

function toNotification(row: NotificationRow): AppointmentNotification {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    kind: row.kind,
    channel: row.channel,
    recipient: row.recipient,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    payload: row.payload,
    providerMessageId: row.provider_message_id,
    nextRetryAt: row.next_retry_at,
    createdAt: row.created_at,
    sentAt: row.sent_at,
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
    barberId: row.barber_id,
    name: row.name,
    description: row.description,
    durationMin: row.duration_min,
    price: row.price,
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

function toScheduleBlock(row: ScheduleBlockRow): ScheduleBlock {
  return {
    id: row.id,
    barberId: row.barber_id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

function toLoyaltyCard(row: LoyaltyCardRpcRow): LoyaltyCard {
  return {
    phoneNumber: row.phone_number,
    completedStamps: row.completed_stamps,
    rewardsEarned: row.rewards_earned,
    updatedAt: row.updated_at,
    exists: row.card_exists,
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
  'slot_interval_min, opening_time, closing_time, working_days, buffer_min, deposit_amount, deposit_enabled, show_pagination_count, show_optional_booking_fields, loyalty_enabled, loyalty_stamps_goal, owner_whatsapp';

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
  depositEnabled?: boolean;
  showPaginationCount?: boolean;
  showOptionalBookingFields?: boolean;
  loyaltyEnabled?: boolean;
  loyaltyStampsGoal?: LoyaltyStampsGoal;
  /** `null` explícito borra el número (desactiva el aviso). */
  ownerWhatsapp?: string | null;
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
  if (patch.depositEnabled !== undefined) row.deposit_enabled = patch.depositEnabled;
  if (patch.showPaginationCount !== undefined) {
    row.show_pagination_count = patch.showPaginationCount;
  }
  if (patch.showOptionalBookingFields !== undefined) {
    row.show_optional_booking_fields = patch.showOptionalBookingFields;
  }
  if (patch.loyaltyEnabled !== undefined) row.loyalty_enabled = patch.loyaltyEnabled;
  if (patch.loyaltyStampsGoal !== undefined) {
    row.loyalty_stamps_goal = patch.loyaltyStampsGoal;
  }
  if (patch.ownerWhatsapp !== undefined) row.owner_whatsapp = patch.ownerWhatsapp;

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

/** Bucket público de Supabase Storage donde se guardan las fotos de barberos. */
const BARBER_PHOTOS_BUCKET = 'barberos';

/**
 * Sube un archivo al bucket `barberos` y devuelve su URL pública. Usada por
 * la foto de perfil (`uploadBarberPhoto`) y por el portafolio
 * (`uploadBarberPortfolioPhoto`) — cada una arma su propio `path` dentro del
 * bucket.
 *
 * Nunca se escribe al filesystem del proyecto: en un deploy serverless (ver
 * el comentario al principio de este archivo) es de sólo lectura y efímero,
 * así que cualquier archivo guardado ahí desaparece en la siguiente
 * invocación. Supabase Storage es el equivalente persistente.
 */
async function uploadToBarberBucket(
  path: string,
  file: Buffer,
  contentType: 'image/png' | 'image/jpeg',
): Promise<string> {
  const { error: uploadError } = await supabaseAdmin()
    .storage.from(BARBER_PHOTOS_BUCKET)
    .upload(path, file, { contentType, upsert: false });

  if (uploadError) fail('subir imagen', uploadError);

  const {
    data: { publicUrl },
  } = supabaseAdmin().storage.from(BARBER_PHOTOS_BUCKET).getPublicUrl(path);

  return publicUrl;
}

function imageExtension(contentType: 'image/png' | 'image/jpeg'): 'png' | 'jpg' {
  return contentType === 'image/png' ? 'png' : 'jpg';
}

/** Sube la foto de perfil de un barbero y actualiza `photo_url`. */
export async function uploadBarberPhoto(
  barberId: string,
  file: Buffer,
  contentType: 'image/png' | 'image/jpeg',
): Promise<Barber | null> {
  const path = `${barberId}-${Date.now()}.${imageExtension(contentType)}`;
  const publicUrl = await uploadToBarberBucket(path, file, contentType);
  return updateBarber(barberId, { photoUrl: publicUrl });
}

// ---------------------------------------------------------------------------
// Portafolio de imágenes del barbero
// ---------------------------------------------------------------------------

const PORTFOLIO_IMAGE_COLUMNS = 'id, barber_id, image_url, sort_order, created_at';
const MAX_PORTFOLIO_IMAGES = 5;

function toPortfolioImage(row: BarberPortfolioImageRow): BarberPortfolioImage {
  return {
    id: row.id,
    barberId: row.barber_id,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export async function listBarberPortfolioImages(
  barberId: string,
): Promise<BarberPortfolioImage[]> {
  const { data, error } = await supabaseAdmin()
    .from('barber_portfolio_images')
    .select(PORTFOLIO_IMAGE_COLUMNS)
    .eq('barber_id', barberId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .returns<BarberPortfolioImageRow[]>();

  if (error) fail('listar imágenes de portafolio', error);
  return (data ?? []).map(toPortfolioImage);
}

export async function addBarberPortfolioImage(
  barberId: string,
  imageUrl: string,
): Promise<BarberPortfolioImage | { error: 'MAX_IMAGES_REACHED' }> {
  // Contamos cuántas imágenes tiene ya este barbero.
  const { count, error: countError } = await supabaseAdmin()
    .from('barber_portfolio_images')
    .select('id', { count: 'exact', head: true })
    .eq('barber_id', barberId);

  if (countError) fail('contar imágenes de portafolio', countError);
  if ((count ?? 0) >= MAX_PORTFOLIO_IMAGES) return { error: 'MAX_IMAGES_REACHED' };

  const { data, error } = await supabaseAdmin()
    .from('barber_portfolio_images')
    .insert({ barber_id: barberId, image_url: imageUrl, sort_order: count ?? 0 })
    .select(PORTFOLIO_IMAGE_COLUMNS)
    .single<BarberPortfolioImageRow>();

  if (error) fail('agregar imagen de portafolio', error);
  return toPortfolioImage(data);
}

/**
 * Sube una foto de portafolio al bucket `barberos` (subcarpeta `portfolio/`,
 * separada de las fotos de perfil) y la agrega vía `addBarberPortfolioImage`
 * — mismo tope de {@link MAX_PORTFOLIO_IMAGES} que la carga por URL.
 */
export async function uploadBarberPortfolioPhoto(
  barberId: string,
  file: Buffer,
  contentType: 'image/png' | 'image/jpeg',
): Promise<BarberPortfolioImage | { error: 'MAX_IMAGES_REACHED' }> {
  const path = `portfolio/${barberId}-${Date.now()}.${imageExtension(contentType)}`;
  const publicUrl = await uploadToBarberBucket(path, file, contentType);
  return addBarberPortfolioImage(barberId, publicUrl);
}

export async function deleteBarberPortfolioImage(
  id: string,
  barberId: string,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from('barber_portfolio_images')
    .delete()
    .eq('id', id)
    .eq('barber_id', barberId)
    .select('id')
    .maybeSingle<{ id: string }>();

  if (error) {
    if (isMalformedId(error)) return false;
    fail('eliminar imagen de portafolio', error);
  }
  return data !== null;
}

/**
 * Reordena las imágenes de portafolio de un barbero actualizando `sort_order`
 * según la posición en el array `ids` recibido.
 */
export async function reorderBarberPortfolioImages(
  barberId: string,
  ids: string[],
): Promise<void> {
  await Promise.all(
    ids.map((id, index) =>
      supabaseAdmin()
        .from('barber_portfolio_images')
        .update({ sort_order: index })
        .eq('id', id)
        .eq('barber_id', barberId),
    ),
  );
}

// ---------------------------------------------------------------------------

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
  'id, barber_id, name, description, duration_min, price, created_at';

/**
 * Lista servicios. Sin argumento devuelve la carta de todos los barberos
 * (la home y el panel de admin la agrupan por barbero); con `barberId`
 * devuelve sólo los de ese barbero.
 */
export async function listServices(barberId?: string): Promise<Service[]> {
  let query = supabaseAdmin()
    .from('services')
    .select(SERVICE_COLUMNS)
    .order('barber_id', { ascending: true })
    .order('created_at', { ascending: true });

  if (barberId) query = query.eq('barber_id', barberId);

  const { data, error } = await query.returns<ServiceRow[]>();

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
  barberId: string;
  name: string;
  description: string;
  durationMin: number;
  price: number;
}

export async function createService(input: ServiceInput): Promise<Service> {
  const { data, error } = await supabaseAdmin()
    .from('services')
    .insert({
      barber_id: input.barberId,
      name: input.name,
      description: input.description,
      duration_min: input.durationMin,
      price: input.price,
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

export interface AppointmentPage {
  appointments: Appointment[];
  total: number;
}

/**
 * Igual que `listAppointments`, pero paginado — usada por la vista de
 * turnos de admin/editor, que no necesita traer todo de una. `page` empieza
 * en 1.
 */
export async function listAppointmentsPage(
  filter: AppointmentFilter = {},
  page: number,
  pageSize: number,
  client: SupabaseClient = supabaseAdmin(),
): Promise<AppointmentPage> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = client
    .from('appointments')
    .select(APPOINTMENT_COLUMNS, { count: 'exact' })
    .order('date', { ascending: true })
    .order('time', { ascending: true })
    .range(from, to);

  if (filter.date) query = query.eq('date', filter.date);
  if (filter.barberId) query = query.eq('barber_id', filter.barberId);

  const { data, error, count } = await query.returns<AppointmentRow[]>();
  if (error) fail('listar turnos', error);

  return { appointments: (data ?? []).map(toAppointment), total: count ?? 0 };
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
// Bloqueos de agenda
//
// Mismo patrón que la sección de Turnos: cliente `SupabaseClient` opcional
// (default = admin). Rutas de admin no lo pasan; rutas de editor pasan el
// cliente de la sesión para que RLS acote a su propio barbero de verdad.
// ---------------------------------------------------------------------------

const SCHEDULE_BLOCK_COLUMNS = 'id, barber_id, date, start_time, end_time, reason, created_at';

export interface ScheduleBlockFilter {
  barberId?: string;
  date?: string;
}

export async function listScheduleBlocks(
  filter: ScheduleBlockFilter = {},
  client: SupabaseClient = supabaseAdmin(),
): Promise<ScheduleBlock[]> {
  let query = client
    .from('schedule_blocks')
    .select(SCHEDULE_BLOCK_COLUMNS)
    .order('date', { ascending: true });

  if (filter.barberId) query = query.eq('barber_id', filter.barberId);
  if (filter.date) query = query.eq('date', filter.date);

  const { data, error } = await query.returns<ScheduleBlockRow[]>();
  if (error) fail('listar bloqueos', error);

  return (data ?? []).map(toScheduleBlock);
}

export interface ScheduleBlockInput {
  barberId: string;
  date: string;
  /** `null` en ambos = bloquea el día completo. */
  startTime: string | null;
  endTime: string | null;
  reason: string;
}

export async function createScheduleBlock(
  input: ScheduleBlockInput,
  client: SupabaseClient = supabaseAdmin(),
): Promise<ScheduleBlock> {
  const { data, error } = await client
    .from('schedule_blocks')
    .insert({
      barber_id: input.barberId,
      date: input.date,
      start_time: input.startTime,
      end_time: input.endTime,
      reason: input.reason,
    })
    .select(SCHEDULE_BLOCK_COLUMNS)
    .single<ScheduleBlockRow>();

  if (error) fail('crear bloqueo', error);
  return toScheduleBlock(data);
}

/**
 * Borra un bloqueo (el barbero "vuelve antes" de lo planeado). Con el
 * cliente de sesión de un editor, RLS ya le impide borrar bloqueos de otro
 * barbero — acá simplemente no encuentra la fila y devuelve `false`.
 */
export async function deleteScheduleBlock(
  id: string,
  client: SupabaseClient = supabaseAdmin(),
): Promise<boolean> {
  const { data, error } = await client
    .from('schedule_blocks')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle<{ id: string }>();

  if (error) {
    if (isMalformedId(error)) return false;
    fail('eliminar bloqueo', error);
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

// ---------------------------------------------------------------------------
// Programa de lealtad — tarjeta de sellos
//
// La suma de sellos la hace un trigger en Postgres cuando un turno se
// completa/paga (ver supabase/migrations/0012_loyalty_program.sql). Acá sólo
// viven la consulta pública (por teléfono) y el ajuste manual del admin. Las
// dos van contra funciones SECURITY DEFINER, así que la normalización del
// teléfono y las reglas de rollover están en un único lugar: la base.
// ---------------------------------------------------------------------------

/**
 * Tarjeta de sellos de un cliente por su teléfono. Devuelve siempre una
 * tarjeta: si el cliente todavía no sumó nada, `exists: false` y ceros.
 */
export async function getLoyaltyCard(
  phone: string,
  client: SupabaseClient = supabaseAdmin(),
): Promise<LoyaltyCard> {
  const { data, error } = await client
    .rpc('get_loyalty_card', { p_phone: phone })
    .single<LoyaltyCardRpcRow>();

  if (error) fail('consultar tarjeta de lealtad', error);

  return toLoyaltyCard(data);
}

export type LoyaltyAdjustResult =
  | { card: LoyaltyCard }
  | { error: 'FORBIDDEN' | 'INVALID_PHONE' };

/**
 * Ajuste manual de sellos (+1 / -1). Usa `service_role` por default (como el
 * resto del panel de admin); la ruta ya autorizó con `requireAdmin()`. La
 * función de Postgres `admin_adjust_loyalty_stamp` revalida el rol si la
 * llamada trae una sesión de usuario.
 */
export async function adjustLoyaltyStamp(
  phone: string,
  delta: number,
  client: SupabaseClient = supabaseAdmin(),
): Promise<LoyaltyAdjustResult> {
  const { data, error } = await client
    .rpc('admin_adjust_loyalty_stamp', { p_phone: phone, p_delta: delta })
    .single<LoyaltyCardRpcRow>();

  if (error) {
    if (error.message.includes('FORBIDDEN')) return { error: 'FORBIDDEN' };
    if (error.message.includes('INVALID_PHONE')) return { error: 'INVALID_PHONE' };
    fail('ajustar tarjeta de lealtad', error);
  }

  return { card: toLoyaltyCard(data) };
}

// ---------------------------------------------------------------------------
// Notificaciones (outbox) — ver supabase/migrations/0015 y lib/notifications.ts
// ---------------------------------------------------------------------------

export interface CreateNotificationInput {
  appointmentId: string;
  kind: string;
  channel: string;
  recipient: string;
  payload: Record<string, unknown>;
}

/**
 * Encola una notificación salvo que ya exista una para el mismo
 * `(appointment_id, kind)` — `on conflict do nothing` vía `upsert` con
 * `ignoreDuplicates`. Devuelve la fila recién creada, o `null` si ya había
 * una (caso típico: Mercado Pago reenvía el webhook del mismo pago). El
 * `null` es la señal de "no reenviar".
 */
export async function createNotificationIfAbsent(
  input: CreateNotificationInput,
): Promise<AppointmentNotification | null> {
  const { data, error } = await supabaseAdmin()
    .from('notifications')
    .upsert(
      {
        appointment_id: input.appointmentId,
        kind: input.kind,
        channel: input.channel,
        recipient: input.recipient,
        payload: input.payload,
      },
      { onConflict: 'appointment_id,kind', ignoreDuplicates: true },
    )
    .select(NOTIFICATION_COLUMNS)
    .maybeSingle<NotificationRow>();

  if (error) fail('encolar notificación', error);
  return data ? toNotification(data) : null;
}

/**
 * Notificaciones que el cron puede intentar ahora: `pending` y con
 * `next_retry_at` vencido (o sin fecha). Orden FIFO por `created_at`.
 */
export async function listDispatchableNotifications(
  limit: number,
): Promise<AppointmentNotification[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin()
    .from('notifications')
    .select(NOTIFICATION_COLUMNS)
    .eq('status', 'pending')
    .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
    .order('created_at', { ascending: true })
    .limit(limit)
    .returns<NotificationRow[]>();

  if (error) fail('listar notificaciones pendientes', error);
  return (data ?? []).map(toNotification);
}

export interface NotificationPatch {
  status?: NotificationStatus;
  attempts?: number;
  lastError?: string | null;
  providerMessageId?: string | null;
  nextRetryAt?: string | null;
  sentAt?: string | null;
}

export async function updateNotification(
  id: string,
  patch: NotificationPatch,
): Promise<void> {
  const row: Partial<NotificationRow> = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.attempts !== undefined) row.attempts = patch.attempts;
  if (patch.lastError !== undefined) row.last_error = patch.lastError;
  if (patch.providerMessageId !== undefined) {
    row.provider_message_id = patch.providerMessageId;
  }
  if (patch.nextRetryAt !== undefined) row.next_retry_at = patch.nextRetryAt;
  if (patch.sentAt !== undefined) row.sent_at = patch.sentAt;

  if (Object.keys(row).length === 0) return;

  const { error } = await supabaseAdmin()
    .from('notifications')
    .update(row)
    .eq('id', id);

  if (error) fail('actualizar notificación', error);
}

// ---------------------------------------------------------------------------
// Suscripciones a notificaciones push (PWA) — ver supabase/migrations/0016 y
// lib/push.ts
// ---------------------------------------------------------------------------

const PUSH_SUBSCRIPTION_COLUMNS =
  'id, endpoint, p256dh, auth, user_agent, created_at, last_success_at, last_error';

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  last_success_at: string | null;
  last_error: string | null;
}

export interface StoredPushSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

function toPushSubscription(row: PushSubscriptionRow): StoredPushSubscription {
  return {
    id: row.id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
  };
}

export interface SavePushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
}

/**
 * Alta (o refresco) de la suscripción de un dispositivo. `endpoint` es la
 * clave natural: si el mismo navegador se re-suscribe, se pisan las claves y
 * se limpia el último error en vez de crear otra fila.
 */
export async function savePushSubscription(
  input: SavePushSubscriptionInput,
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('push_subscriptions')
    .upsert(
      {
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        user_agent: input.userAgent,
        last_error: null,
      },
      { onConflict: 'endpoint' },
    );

  if (error) fail('guardar suscripción push', error);
}

/** Baja de la suscripción de un dispositivo (el usuario apagó el switch). */
export async function deletePushSubscription(endpoint: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);

  if (error) fail('eliminar suscripción push', error);
}

export async function listPushSubscriptions(): Promise<StoredPushSubscription[]> {
  const { data, error } = await supabaseAdmin()
    .from('push_subscriptions')
    .select(PUSH_SUBSCRIPTION_COLUMNS)
    .order('created_at', { ascending: true })
    .returns<PushSubscriptionRow[]>();

  if (error) fail('listar suscripciones push', error);
  return (data ?? []).map(toPushSubscription);
}

export async function countPushSubscriptions(): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from('push_subscriptions')
    .select('id', { count: 'exact', head: true });

  if (error) fail('contar suscripciones push', error);
  return count ?? 0;
}

/** Marca el resultado del último envío a un endpoint. */
export async function markPushSubscription(
  endpoint: string,
  patch: { lastSuccessAt?: string; lastError?: string | null },
): Promise<void> {
  const row: Partial<PushSubscriptionRow> = {};
  if (patch.lastSuccessAt !== undefined) row.last_success_at = patch.lastSuccessAt;
  if (patch.lastError !== undefined) row.last_error = patch.lastError;
  if (Object.keys(row).length === 0) return;

  const { error } = await supabaseAdmin()
    .from('push_subscriptions')
    .update(row)
    .eq('endpoint', endpoint);

  if (error) fail('actualizar suscripción push', error);
}

// ---------------------------------------------------------------------------
// Clientes — no hay tabla de clientes; se derivan de `appointments`
// ---------------------------------------------------------------------------

export interface CustomerHit {
  /** Nombre tal cual quedó guardado en el turno más reciente. */
  name: string;
  /**
   * Teléfono normalizado a dígitos con código de país
   * (`customerPhoneDigits`) — es la clave con la que se deduplica y la que
   * se usa después para buscar la tarjeta de lealtad.
   */
  phone: string;
}

/**
 * Busca clientes por nombre (coincidencia parcial, sin distinción de
 * mayúsculas/acentos según la config de la base) para el autocompletado del
 * panel. Como no hay tabla de clientes, se sacan de `appointments`: se traen
 * los turnos más recientes que matchean y se deduplica por teléfono,
 * quedando el nombre del turno más nuevo de cada cliente.
 *
 * La clave de deduplicación es el teléfono NORMALIZADO (`customerPhoneDigits`,
 * misma regla que `normalize_loyalty_phone` en la base): un mismo cliente
 * puede tener turnos guardados como `1133691609` (alta manual, sin prefijo) y
 * como `541133691609` (reserva web) — son strings distintos pero el mismo
 * número, así que sin normalizar aparecían dos veces.
 */
export async function searchCustomersByName(
  query: string,
  limit = 8,
): Promise<CustomerHit[]> {
  // Se sacan `%` y `_` para que no actúen como comodines de LIKE (un nombre
  // no los lleva) y `\` para no dejar un escape colgando.
  const term = query.trim().replace(/[%_\\]/g, '');
  if (term.length < 2) return [];

  const { data, error } = await supabaseAdmin()
    .from('appointments')
    .select('customer_name, customer_phone, created_at')
    .ilike('customer_name', `%${term}%`)
    .order('created_at', { ascending: false })
    .limit(300)
    .returns<
      { customer_name: string; customer_phone: string; created_at: string }[]
    >();

  if (error) fail('buscar clientes por nombre', error);

  const seen = new Set<string>();
  const hits: CustomerHit[] = [];
  for (const row of data ?? []) {
    const raw = (row.customer_phone ?? '').replace(/\D/g, '');
    if (!raw) continue;
    const phone = customerPhoneDigits(raw);
    if (seen.has(phone)) continue;
    seen.add(phone);
    hits.push({ name: row.customer_name, phone });
    if (hits.length >= limit) break;
  }
  return hits;
}

/**
 * Igual que `searchCustomersByName` pero por teléfono: el admin escribe (o
 * pega) parte del número y ve los clientes cuyo teléfono contiene esos
 * dígitos, deduplicados por número normalizado y ordenados por turno más
 * reciente.
 *
 * Un mismo cliente puede tener el número guardado con o sin el prefijo de
 * país `54` (alta manual vs. reserva web), así que se busca `ilike` contra
 * las dos formas y después se confirma la coincidencia sobre los dígitos ya
 * normalizados (la columna puede traer espacios o `+`).
 */
export async function searchCustomersByPhone(
  query: string,
  limit = 8,
): Promise<CustomerHit[]> {
  const term = query.replace(/\D/g, '');
  if (term.length < 3) return [];

  const local = term.startsWith('54') ? term.slice(2) : term;
  const needles = Array.from(new Set([term, local, `54${local}`]));
  const orFilter = needles
    .map((needle) => `customer_phone.ilike.*${needle}*`)
    .join(',');

  const { data, error } = await supabaseAdmin()
    .from('appointments')
    .select('customer_name, customer_phone, created_at')
    .or(orFilter)
    .order('created_at', { ascending: false })
    .limit(300)
    .returns<
      { customer_name: string; customer_phone: string; created_at: string }[]
    >();

  if (error) fail('buscar clientes por teléfono', error);

  const seen = new Set<string>();
  const hits: CustomerHit[] = [];
  for (const row of data ?? []) {
    const raw = (row.customer_phone ?? '').replace(/\D/g, '');
    if (!raw) continue;
    const phone = customerPhoneDigits(raw);
    if (!phone.includes(local)) continue;
    if (seen.has(phone)) continue;
    seen.add(phone);
    hits.push({ name: row.customer_name, phone });
    if (hits.length >= limit) break;
  }
  return hits;
}
