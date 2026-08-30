/**
 * Crea N turnos con clientes aleatorios, usando la misma función atómica
 * `book_appointment` que usa la app (respeta solapamientos y buffer).
 *
 *   node --env-file=.env.local scripts/seed-random-appointments.mjs [cantidad]
 */

import { createClient } from '@supabase/supabase-js';

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Falta la variable de entorno ${name}.`);
    console.error('Pasá el archivo de entorno: node --env-file=.env.local scripts/seed-random-appointments.mjs');
    process.exit(1);
  }
  return value;
}

const db = createClient(
  required('NEXT_PUBLIC_SUPABASE_URL'),
  required('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const COUNT = Number(process.argv[2]) || 10;

const FIRST_NAMES = [
  'Mateo', 'Lucas', 'Benjamín', 'Santiago', 'Joaquín', 'Tomás', 'Bautista',
  'Facundo', 'Agustín', 'Nicolás', 'Valentino', 'Franco', 'Ignacio', 'Thiago',
  'Camila', 'Valentina', 'Martina', 'Sofía', 'Julieta', 'Emilia', 'Catalina',
  'Florencia', 'Micaela', 'Rocío',
];

const LAST_NAMES = [
  'González', 'Rodríguez', 'Fernández', 'López', 'Martínez', 'Díaz', 'Pérez',
  'Sánchez', 'Romero', 'Álvarez', 'Torres', 'Ruiz', 'Ramírez', 'Flores',
  'Acosta', 'Benítez', 'Medina', 'Herrera', 'Suárez', 'Rojas',
];

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomName() {
  return `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`;
}

function randomPhone() {
  const line = String(Math.floor(1000000 + Math.random() * 9000000));
  return `11${line}`;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function randomFutureWorkingDate(workingDays) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const offset = 1 + Math.floor(Math.random() * 21); // próximas 3 semanas
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + offset);
    if (workingDays.includes(date.getUTCDay())) return toIsoDate(date);
  }
  return toIsoDate(new Date());
}

function randomTime(openingTime, closingTime, slotIntervalMin, durationMin) {
  const [openH, openM] = openingTime.split(':').map(Number);
  const [closeH, closeM] = closingTime.split(':').map(Number);
  const openMin = openH * 60 + openM;
  const closeMin = closeH * 60 + closeM;

  const lastStart = closeMin - durationMin;
  if (lastStart < openMin) return openingTime;

  const slots = Math.floor((lastStart - openMin) / slotIntervalMin) + 1;
  const pick = openMin + Math.floor(Math.random() * slots) * slotIntervalMin;
  const hours = String(Math.floor(pick / 60)).padStart(2, '0');
  const minutes = String(pick % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

async function main() {
  const { data: settingsRow, error: settingsError } = await db
    .from('settings')
    .select('slot_interval_min, opening_time, closing_time, working_days')
    .limit(1)
    .single();
  if (settingsError) throw settingsError;

  const { data: barbers, error: barbersError } = await db
    .from('barbers')
    .select('id, name')
    .eq('active', true);
  if (barbersError) throw barbersError;
  if (!barbers?.length) throw new Error('No hay barberos activos.');

  const { data: services, error: servicesError } = await db
    .from('services')
    .select('id, name, duration_min');
  if (servicesError) throw servicesError;
  if (!services?.length) throw new Error('No hay servicios cargados.');

  const workingDays = settingsRow.working_days;
  let created = 0;

  for (let i = 0; i < COUNT; i += 1) {
    const barber = randomItem(barbers);
    const service = randomItem(services);
    const customerName = randomName();
    const customerPhone = randomPhone();

    let lastError = null;
    for (let attempt = 0; attempt < 8 && !lastError?.done; attempt += 1) {
      const date = randomFutureWorkingDate(workingDays);
      const time = randomTime(
        settingsRow.opening_time,
        settingsRow.closing_time,
        settingsRow.slot_interval_min,
        service.duration_min,
      );

      const { data, error } = await db
        .rpc('book_appointment', {
          p_barber_id: barber.id,
          p_service_id: service.id,
          p_date: date,
          p_time: time,
          p_duration_min: service.duration_min,
          p_customer_name: customerName,
          p_customer_phone: customerPhone,
          p_customer_email: null,
          p_notes: null,
        })
        .single();

      if (!error) {
        created += 1;
        console.log(
          `✓ ${customerName} — ${barber.name} — ${service.name} — ${date} ${time}`,
        );
        lastError = { done: true };
      } else if (error.message.includes('SLOT_TAKEN')) {
        lastError = error;
      } else {
        throw error;
      }
    }

    if (lastError && !lastError.done) {
      console.warn(`✗ No se pudo agendar a ${customerName} tras varios intentos (slots ocupados).`);
    }
  }

  console.log(`\nListo: ${created}/${COUNT} turnos creados.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
