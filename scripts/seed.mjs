/**
 * Carga los datos iniciales en Supabase.
 *
 *   node --env-file=.env.local scripts/seed.mjs
 *
 * Si existe `data/db.json` (el viejo store en archivo), migra barberos,
 * servicios y turnos de ahí. Si no existe, carga el catálogo de demo.
 *
 * Los usuarios NO se migran desde `data/db.json`: ese store guardaba hashes
 * `scrypt` propios, que no son compatibles con el hash de contraseñas de
 * Supabase Auth. En su lugar, este script crea (o deja como está, si ya
 * existe) un admin con el Admin API de Supabase Auth.
 *
 * Es idempotente: si barbers/services/appointments ya tienen filas, no las
 * toca (ni duplica) — sólo se salta esa parte y sigue con el admin. Usá
 * --force para vaciarlas y recargar el catálogo de todos modos. El admin se
 * crea siempre que no exista uno, sin importar `--force` ni el estado del
 * catálogo.
 */

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';

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
  required('NEXT_PUBLIC_SUPABASE_URL'),
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
  // Cada barbero trae su propia carta de servicios y su propia agenda
  // (horario, días e intervalo pueden variar entre barberos). Sin `schedule`
  // se aplican los defaults de la tabla: 10:00–20:00, Lun–Sáb, 30 min, 0.
  barbers: [
    {
      name: 'John',
      role: 'Master Barber',
      specialty: 'Fades y diseños',
      photoUrl: 'https://images.unsplash.com/photo-1503443207922-dff7d543fd0e?auto=format&fit=crop&w=480&q=80',
      active: true,
      schedule: { openingTime: '10:00', closingTime: '19:00', workingDays: [2, 3, 4, 5, 6], slotIntervalMin: 30, bufferMin: 0 },
      services: [
        { name: 'Fade premium', description: 'Degradado a piel, perfilado y diseño de líneas.', durationMin: 60, price: 17000 },
        { name: 'Corte clásico', description: 'Lavado, corte a tijera y máquina, peinado y acabado.', durationMin: 45, price: 13000 },
        { name: 'Corte + barba', description: 'El combo completo del club. Corte, barba y ritual final.', durationMin: 60, price: 21000 },
      ],
    },
    {
      name: 'Alex',
      role: 'Senior Barber',
      specialty: 'Barba y afeitado clásico',
      photoUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=480&q=80',
      active: true,
      schedule: { openingTime: '09:00', closingTime: '18:00', workingDays: [1, 2, 3, 4, 5], slotIntervalMin: 15, bufferMin: 5 },
      services: [
        { name: 'Barba & afeitado', description: 'Toalla caliente, navaja, aceites y bálsamo.', durationMin: 30, price: 9500 },
        { name: 'Corte clásico', description: 'Corte a tijera y máquina, peinado y acabado.', durationMin: 45, price: 12000 },
        { name: 'Perfilado express', description: 'Retoque de contornos, patillas y nuca.', durationMin: 15, price: 5000 },
      ],
    },
    {
      name: 'Mateo',
      role: 'Barber & Color',
      specialty: 'Color y texturas',
      photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=480&q=80',
      active: true,
      schedule: { openingTime: '11:00', closingTime: '20:00', workingDays: [3, 4, 5, 6], slotIntervalMin: 60, bufferMin: 10 },
      services: [
        { name: 'Color + corte', description: 'Coloración completa, corte y acabado.', durationMin: 90, price: 28000 },
        { name: 'Mechas / platinado', description: 'Decoloración, matizado y tratamiento.', durationMin: 120, price: 35000 },
        { name: 'Corte clásico', description: 'Corte a tijera y máquina, peinado y acabado.', durationMin: 45, price: 12500 },
      ],
    },
  ],
  appointments: [],
};

async function main() {
  // --- ¿Hay datos ya cargados? ---------------------------------------------
  const tables = ['appointments', 'barbers', 'services'];
  const counts = {};

  for (const table of tables) {
    const { count, error } = await db.from(table).select('*', { count: 'exact', head: true });
    check(`contar ${table}`, error);
    counts[table] = count ?? 0;
  }

  const populated = tables.filter((t) => counts[t] > 0);

  if (populated.length > 0 && !force) {
    console.log(
      '· La base ya tiene datos:',
      populated.map((t) => `${t}=${counts[t]}`).join(', '),
    );
    console.log('  No se toca el catálogo (usá `--force` para vaciarlo y recargarlo). Sigo con el admin.');
  } else {
    if (force) {
      // Orden importa: appointments referencia a barbers y services.
      for (const table of tables) {
        const { error } = await db.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        check(`vaciar ${table}`, error);
      }
      console.log('· Tablas vaciadas (appointments/barbers/services)');
    }

    // --- Origen de los datos ------------------------------------------------
    const legacy = await readLegacyStore();
    const source = legacy ?? DEMO;
    console.log(legacy ? '· Migrando data/db.json (barberos/servicios/turnos)' : '· Cargando catálogo de demo');

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
      // Agenda propia del barbero; sin `schedule` aplican los defaults de la tabla.
      ...(b.schedule
        ? {
            opening_time: b.schedule.openingTime,
            closing_time: b.schedule.closingTime,
            working_days: b.schedule.workingDays,
            slot_interval_min: b.schedule.slotIntervalMin,
            buffer_min: b.schedule.bufferMin,
          }
        : {}),
      ...(b.createdAt ? { created_at: b.createdAt } : {}),
    }));

    let insertedBarbers = [];
    if (barbers.length > 0) {
      const { data, error } = await db.from('barbers').insert(barbers).select('id, name');
      check('barbers', error);
      insertedBarbers = data ?? [];
    }
    console.log(`✓ barbers (${insertedBarbers.length})`);

    // Servicios: la carta es propia de cada barbero (`services.barber_id`).
    const barberIdByName = new Map(insertedBarbers.map((b) => [b.name, b.id]));
    let services = [];

    if (legacy) {
      // El store viejo tenía un catálogo global sin barbero: se asigna todo
      // al primer barbero para no perder los datos. Después se reparte a mano.
      const fallbackId = insertedBarbers[0]?.id;
      if (fallbackId) {
        services = (source.services ?? []).map((x) => ({
          ...(x.id ? { id: x.id } : {}),
          barber_id: x.barberId ?? fallbackId,
          name: x.name,
          description: x.description ?? '',
          duration_min: x.durationMin,
          price: x.price,
          ...(x.createdAt ? { created_at: x.createdAt } : {}),
        }));
      }
    } else {
      services = (source.barbers ?? []).flatMap((b) => {
        const barberId = barberIdByName.get(b.name);
        if (!barberId) return [];
        return (b.services ?? []).map((x) => ({
          barber_id: barberId,
          name: x.name,
          description: x.description ?? '',
          duration_min: x.durationMin,
          price: x.price,
        }));
      });
    }

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
  }

  // --- admin (Supabase Auth) -------------------------------------------------
  // No se toca si ya existe algún profile con role='admin' — a diferencia de
  // barberos/servicios/turnos, esto no se ve afectado por `--force`: borrar
  // cuentas de Auth es una operación aparte y más delicada.
  const { count: adminCount, error: adminCountError } = await db
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'admin');
  check('contar admins', adminCountError);

  if (adminCount > 0) {
    console.log('· Ya existe un admin, no se crea otro.');
  } else {
    const email = process.env.ADMIN_EMAIL ?? 'admin@chivasbarber.club';
    const password = process.env.ADMIN_PASSWORD ?? 'admin123';

    const { data: created, error: createError } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: 'Administrador', phone: '' },
      app_metadata: { role: 'admin' },
    });
    check('crear admin', createError);

    // El trigger `handle_new_user` crea el profile, pero GoTrue completa
    // `app_metadata` en un paso posterior al INSERT que lo dispara — puede
    // quedar creado con role='client'. Se pisa a mano para no depender de
    // ese timing (mismo fix que `createStaffUser` en src/lib/db.ts).
    check('fijar role admin en profile', (await db.from('profiles').update({ role: 'admin' }).eq('id', created.user.id)).error);

    console.log(`✓ admin: ${email} / ${password}`);
    if (!process.env.ADMIN_PASSWORD) {
      console.log('⚠  Cambiá esa contraseña antes de publicar el sitio (ADMIN_PASSWORD=... al correr el seed).');
    }
  }

  console.log('\nListo.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
