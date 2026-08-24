import { NextResponse } from 'next/server';

import { SESSION_COOKIE } from '@/lib/session';

/** POST /api/auth/logout — borra la cookie de sesión. */
export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
