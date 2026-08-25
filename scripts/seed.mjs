/**
 * Carga los datos iniciales en Supabase.
 *
 *   node --env-file=.env.local scripts/seed.mjs
 *
 * Si existe `data/db.json` (el viejo store en archivo), migra ESOS datos —
 * barberos, servicios, turnos y usuarios, conservando los hashes de contraseña
 * existentes. Si no existe, carga el catálogo de demo y un admin.
 *
 * Es idempotente en el sentido práctico: si las tablas ya tienen filas, aborta
 * en vez de duplicar. Usá --force para vaciarlas y volver a cargar.
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes, scrypt } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

/** Mismo formato `salt:hash` que src/lib/password.ts. */
async function hashPassword(plain) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scryptAsync(plain, salt, 32);
  return `${salt}:${derived.toString('hex')}`;
}

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Falta la variable de entorno ${name}.`);
    console.error('Pasá el archivo de entorno: node --env-file=.env.local scripts/seed.mjs');
    process.exit(1);
  }
  return value;
}

const db = createClient(
  required('SUPABASE_URL'),
  required('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const force = process.argv.includes('--force');

function check(label, error) {
  if (error) {
    console.error(`✗ ${label}: ${error.message}`);
    process.exit(1);
  }
}

/** Lee el store viejo en archivo, o `null` si ya no está. */
async function readLegacyStore() {
  try {
    return JSON.parse(await readFile(new URL('../data/db.json', import.meta.url), 'utf8'));
  } catch {
    return null;
  }
}

const DEMO = {
  settings: {
    slotIntervalMin: 30,
    openingTime: '10:00',
    closingTime: '20:00',
    workingDays: [1, 2, 3, 4, 5, 6],
    bufferMin: 0,
  },
  barbers: [
    {
      name: 'John',
      role: 'Master Barber',
      specialty: 'Fades y diseños',
      photoUrl: 'https://images.unsplash.com/photo-1503443207922-dff7d543fd0e?auto=format&fit=crop&w=480&q=80',
      active: true,
    },
    {
      name: 'Alex',
      role: 'Senior Barber',
      specialty: 'Barba y afeitado clásico',
      photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=480&q=80',
      active: true,
    },
    {
      name: 'Mateo',
      role: 'Barber & Color',
      specialty: 'Color y texturas',
      photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=480&q=80',
      active: true,
    },
  ],
  services: [
    { name: 'Corte clásico', description: 'Lavado, corte a tijera y máquina, peinado y acabado.', durationMin: 45, price: 12000, featured: true },
    { name: 'Fade premium', description: 'Degradado a piel, perfilado y diseño de líneas.', durationMin: 60, price: 16000, featured: true },
    { name: 'Barba & afeitado', description: 'Toalla caliente, navaja, aceites y bálsamo.', durationMin: 30, price: 9000, featured: false },
    { name: 'Corte + Barba', description: 'El combo completo del club. Corte, barba y ritual final.', durationMin: 60, price: 19000, featured: true },
    { name: 'Perfilado express', description: 'Retoque de contornos, patillas y nuca.', durationMin: 15, price: 5000, featured: false },
  ],
  appointments: [],
  users: [],
};

async function main() {
  // --- ¿Hay datos ya cargados? ---------------------------------------------
  const tables = ['appointments', 'barbers', 'services', 'users'];
  const counts = {};

  for (const table of tables) {
    const { count, error } = await db.from(table).select('*', { count: 'exact', head: true });
    check(`contar ${table}`, error);
    counts[table] = count ?? 0;
  }

  const populated = tables.filter((t) => counts[t] > 0);

  if (populated.length > 0 && !force) {
    console.error('La base ya tiene datos:', populated.map((t) => `${t}=${counts[t]}`).join(', '));
    console.error('Usá `--force` para vaciarla y volver a cargar (BORRA todo).');
    process.exit(1);
  }

  if (force) {
    // Orden importa: appointments referencia a barbers y services.
    for (const table of tables) {
      const { error } = await db.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      check(`vaciar ${table}`, error);
    }
    console.log('· Tablas vaciadas');
  }

  // --- Origen de los datos --------------------------------------------------
  const legacy = await readLegacyStore();
  const source = legacy ?? DEMO;
  console.log(legacy ? '· Migrando data/db.json' : '· Cargando catálogo de demo');

  // --- settings -------------------------------------------------------------
  const s = source.settings ?? DEMO.settings;
  check('settings', (await db.from('settings').update({
    slot_interval_min: s.slotIntervalMin,
    opening_time: s.openingTime,
    closing_time: s.closingTime,
    working_days: s.workingDays,
    buffer_min: s.bufferMin,
  }).eq('id', true)).error);
  console.log('✓ settings');

  // --- barberos y servicios -------------------------------------------------
  // Se reusan los ids del store viejo para que los turnos sigan apuntando bien.
  const barbers = (source.barbers ?? []).map((b) => ({
    ...(b.id ? { id: b.id } : {}),
    name: b.name,
    role: b.role ?? 'Barber',
    specialty: b.specialty ?? '',
    photo_url: b.photoUrl ?? '',
    active: b.active ?? true,
    ...(b.createdAt ? { created_at: b.createdAt } : {}),
  }));

  if (barbers.length > 0) {
    check('barbers', (await db.from('barbers').insert(barbers)).error);
  }
  console.log(`✓ barbers (${barbers.length})`);

  const services = (source.services ?? []).map((x) => ({
    ...(x.id ? { id: x.id } : {}),
    name: x.name,
    description: x.description ?? '',
    duration_min: x.durationMin,
    price: x.price,
    featured: x.featured ?? false,
    ...(x.createdAt ? { created_at: x.createdAt } : {}),
  }));

  if (services.length > 0) {
    check('services', (await db.from('services').insert(services)).error);
  }
  console.log(`✓ services (${services.length})`);

  // --- turnos ---------------------------------------------------------------
  const appointments = (source.appointments ?? []).map((a) => ({
    ...(a.id ? { id: a.id } : {}),
    barber_id: a.barberId,
    service_id: a.serviceId ?? null,
    date: a.date,
    time: a.time,
    duration_min: a.durationMin,
    customer_name: a.customerName,
    customer_phone: a.customerPhone,
    customer_email: a.customerEmail ?? null,
    notes: a.notes ?? null,
    status: a.status ?? 'confirmed',
    ...(a.createdAt ? { created_at: a.createdAt } : {}),
  }));

  if (appointments.length > 0) {
    check('appointments', (await db.from('appointments').insert(appointments)).error);
  }
  console.log(`✓ appointments (${appointments.length})`);

  // --- usuarios -------------------------------------------------------------
  // Los hashes del store viejo se conservan tal cual: las contraseñas siguen
  // funcionando. Si no hay ninguno, se crea un admin.
  let users = (source.users ?? []).map((u) => ({
    ...(u.id ? { id: u.id } : {}),
    name: u.name,
    email: u.email,
    phone: u.phone ?? '',
    password_hash: u.passwordHash,
    role: u.role ?? 'client',
    ...(u.createdAt ? { created_at: u.createdAt } : {}),
  }));

  let adminPassword = null;

  if (!users.some((u) => u.role === 'admin')) {
    adminPassword = process.env.ADMIN_PASSWORD ?? 'admin';
    users = users.concat({
      name: 'Administrador',
      email: process.env.ADMIN_EMAIL ?? 'admin',
      phone: '',
      password_hash: await hashPassword(adminPassword),
      role: 'admin',
    });
  }

  if (users.length > 0) {
    check('users', (await db.from('users').insert(users)).error);
  }
  console.log(`✓ users (${users.length})`);

  console.log('\nListo.');
  if (adminPassword) {
    console.log(`Admin: ${process.env.ADMIN_EMAIL ?? 'admin'} / ${adminPassword}`);
    if (adminPassword === 'admin') {
      console.log('⚠  Cambiá esa contraseña antes de publicar el sitio (ADMIN_PASSWORD=... al correr el seed).');
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
