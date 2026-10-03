import { NextResponse } from 'next/server';
import { dataProvider } from '@/lib/data-provider';
import { supabaseAdmin, buildSyntheticEmail } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, company_code, password, full_name, role, pay_type, pay_rate, company_id } = body;

    let authUserId: string | null = null;
    if (supabaseAdmin && password) {
      const email = buildSyntheticEmail(username, company_code || 'COMPANY');
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role, username },
      });
      if (!authErr && authUser?.user) {
        authUserId = authUser.user.id;
      }
    }

    const res = await dataProvider.createCompanyUser({
      ...body,
      id: authUserId || undefined,
    });

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, profile: res.profile });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
