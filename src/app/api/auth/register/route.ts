import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

interface RegisterBody {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
}

/**
 * POST /api/auth/register — alta de clientes.
 *
 * `signUp` no manda `app_metadata`, así que el trigger `handle_new_user`
 * siempre crea el profile con `role: 'client'` (ver migración RBAC) — no hay
 * forma de que este endpoint dé de alta un admin/editor.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as RegisterBody;

  const name = body.name?.trim() ?? '';
  const email = body.email?.trim().toLowerCase() ?? '';
  const phone = body.phone?.trim() ?? '';
  const password = body.password ?? '';

  if (name.length < 2) {
    return NextResponse.json({ error: 'Ingresá tu nombre' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: 'La contraseña debe tener al menos 6 caracteres' },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, phone } },
  });

  if (error) {
    if (error.code === 'user_already_exists') {
      return NextResponse.json(
        { error: 'Ya existe una cuenta con ese email' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Si el proyecto tiene "Confirm email" activado en Supabase Auth, `signUp`
  // no devuelve sesión hasta que el usuario confirme el link que le llega
  // por mail — acá se lo avisamos al frontend en vez de asumir que ya puede
  // entrar.
  if (!data.session) {
    return NextResponse.json(
      {
        user: { id: data.user?.id, name, email },
        needsEmailConfirmation: true,
      },
      { status: 201 },
    );
  }

  return NextResponse.json(
    { user: { id: data.user!.id, name, email, role: 'client' } },
    { status: 201 },
  );
}
