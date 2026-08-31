import { NextResponse } from 'next/server';

import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface LoginBody {
  email?: string;
  password?: string;
}

interface ProfileRow {
  name: string;
  role: string;
}

/** POST /api/auth/login */
export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  if (!(await checkRateLimit(`login:${ip}`, 5, 60))) {
    return rateLimitResponse();
  }

  const body = (await request.json().catch(() => ({}))) as LoginBody;
  const email = body.email?.trim().toLowerCase() ?? '';
  const password = body.password ?? '';

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email y contraseña son obligatorios' },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return NextResponse.json(
      { error: 'Email o contraseña incorrectos' },
      { status: 401 },
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', data.user.id)
    .maybeSingle<ProfileRow>();

  return NextResponse.json({
    user: {
      id: data.user.id,
      name: profile?.name ?? '',
      email: data.user.email,
      role: profile?.role ?? 'client',
    },
  });
}
