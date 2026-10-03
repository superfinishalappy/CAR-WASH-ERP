import { NextResponse } from 'next/server';
import { dataProvider } from '@/lib/data-provider';

export async function POST(req: Request) {
  try {
    const { company_id } = await req.json();

    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const res = dataProvider.deleteCompany(company_id);

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Company deleted' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
