import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

/** POST /api/auth/logout */
export async function POST(): Promise<NextResponse> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
