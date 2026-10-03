import { NextResponse } from 'next/server';
import { dataProvider } from '@/lib/data-provider';
import { supabaseAdmin, buildSyntheticEmail } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await dataProvider.createCompany(body);

    if (!res.success || !res.company) {
      return NextResponse.json({ error: res.error || 'Failed to create company' }, { status: 400 });
    }

    return NextResponse.json({ success: true, company: res.company });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
