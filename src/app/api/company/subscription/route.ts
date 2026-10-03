import { NextResponse } from 'next/server';
import { dataProvider } from '@/lib/data-provider';

export async function POST(req: Request) {
  try {
    const { company_id, action, valid_until, active } = await req.json();

    if (!company_id || !action) {
      return NextResponse.json({ error: 'company_id and action are required' }, { status: 400 });
    }

    const res = dataProvider.setSubscription(company_id, action, valid_until, active);

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, company: res.company });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
