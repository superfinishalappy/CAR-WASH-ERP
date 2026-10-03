import { NextResponse } from 'next/server';
import { dataProvider } from '@/lib/data-provider';
import { buildSyntheticEmail } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { company_id, username, password } = await req.json();

    if (!company_id || !username || !password) {
      return NextResponse.json({ error: 'Company ID, username, and password are required' }, { status: 400 });
    }

    const syntheticEmail = buildSyntheticEmail(username, company_id);

    const res = await dataProvider.login(company_id, username, password);

    if (!res.success) {
      return NextResponse.json(
        { error: res.error, isExpired: res.isExpired },
        { status: res.isExpired ? 403 : 401 }
      );
    }

    return NextResponse.json({
      success: true,
      synthetic_email: syntheticEmail,
      session: res.session,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
