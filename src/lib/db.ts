import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import type { Database } from './types';
import { hashPassword } from './password';

/**
 * Store de datos en archivo JSON.
 *
 * Es un "backend real" (corre en el servidor, no en el navegador) pero sin
 * dependencias externas: cada Route Handler lee y escribe `data/db.json`.
 * Para migrar a Postgres/Prisma sólo hay que reimplementar `readDb`/`writeDb`
 * y las funciones de este módulo — la UI no cambia.
 */

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

/** Cola de escritura: evita que dos requests simultáneos pisen el archivo. */
let writeQueue: Promise<unknown> = Promise.resolve();

export function createId(): string {
  return randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

async function seed(): Promise<Database> {
  const createdAt = nowIso();
  const adminHash = await hashPassword('admin');

  return {
    settings: {
      slotIntervalMin: 30,
      openingTime: '10:00',
      closingTime: '20:00',
      workingDays: [1, 2, 3, 4, 5, 6],
      bufferMin: 0,
    },
    barbers: [
      {
        id: createId(),
        name: 'John',
        role: 'Master Barber',
        specialty: 'Fades y diseños',
        photoUrl:
          'https://images.unsplash.com/photo-1503443207922-dff7d543fd0e?auto=format&fit=crop&w=480&q=80',
        active: true,
        createdAt,
      },
      {
        id: createId(),
        name: 'Alex',
        role: 'Senior Barber',
        specialty: 'Barba y afeitado clásico',
        photoUrl:
          'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=480&q=80',
        active: true,
        createdAt,
      },
      {
        id: createId(),
        name: 'Mateo',
        role: 'Barber & Color',
        specialty: 'Color y texturas',
        photoUrl:
          'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=480&q=80',
        active: true,
        createdAt,
      },
    ],
    services: [
      {
        id: createId(),
        name: 'Corte clásico',
        description: 'Lavado, corte a tijera y máquina, peinado y acabado.',
        durationMin: 45,
        price: 12000,
        featured: true,
        createdAt,
      },
      {
        id: createId(),
        name: 'Fade premium',
        description: 'Degradado a piel, perfilado y diseño de líneas.',
        durationMin: 60,
        price: 16000,
        featured: true,
        createdAt,
      },
      {
        id: createId(),
        name: 'Barba & afeitado',
        description: 'Toalla caliente, navaja, aceites y bálsamo.',
        durationMin: 30,
        price: 9000,
        featured: false,
        createdAt,
      },
      {
        id: createId(),
        name: 'Corte + Barba',
        description: 'El combo completo del club. Corte, barba y ritual final.',
        durationMin: 60,
        price: 19000,
        featured: true,
        createdAt,
      },
      {
        id: createId(),
        name: 'Perfilado express',
        description: 'Retoque de contornos, patillas y nuca.',
        durationMin: 15,
        price: 5000,
        featured: false,
        createdAt,
      },
    ],
    appointments: [],
    users: [
      {
        id: createId(),
        name: 'Administrador',
        email: 'admin',
        phone: '+5491160068637',
        passwordHash: adminHash,
        role: 'admin',
        createdAt,
      },
    ],
  };
}

export async function readDb(): Promise<Database> {
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    return JSON.parse(raw) as Database;
  } catch {
    const fresh = await seed();
    await persist(fresh);
    return fresh;
  }
}

async function persist(db: Database): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
}

/**
 * Lee, muta y guarda el store de forma serializada.
 * `mutator` recibe el objeto y devuelve el valor que se le responderá al caller.
 */
export async function updateDb<T>(
  mutator: (db: Database) => T | Promise<T>,
): Promise<T> {
  const task = writeQueue.then(async () => {
    const db = await readDb();
    const result = await mutator(db);
    await persist(db);
    return result;
  });

  writeQueue = task.catch(() => undefined);
  return task;
}
