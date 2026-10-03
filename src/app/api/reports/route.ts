import { NextResponse } from 'next/server';
import { dataProvider } from '@/lib/data-provider';

export async function POST(req: Request) {
  try {
    const { start_date, end_date, company_id } = await req.json();

    if (!start_date || !end_date) {
      return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 });
    }

    const report = dataProvider.getCompanyReport(start_date, end_date, company_id);

    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
}
