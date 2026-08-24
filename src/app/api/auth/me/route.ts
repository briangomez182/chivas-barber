import { NextResponse } from 'next/server';

import { getSession } from '@/lib/guard';

/** GET /api/auth/me — devuelve la sesión activa o `null`. */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  return NextResponse.json({ session });
}
