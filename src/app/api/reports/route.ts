import { NextResponse } from 'next/server';
import { dataProvider } from '@/lib/data-provider';
import { authenticateServerRequest } from '@/lib/server-auth';

export async function POST(req: Request) {
  try {
    // 1. Authenticate caller
    const auth = await authenticateServerRequest(req);
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { isPlatform, profile, companyId: callerCompanyId } = auth.context;
    const canViewReports = isPlatform || ['owner', 'manager', 'accountant'].includes(profile.role);
    if (!canViewReports) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions to view reports.' },
        { status: 403 }
      );
    }

    // 2. Validate input and enforce tenant boundary
    const { start_date, end_date, company_id } = await req.json();

    if (!start_date || !end_date) {
      return NextResponse.json({ error: 'start_date and end_date are required' }, { status: 400 });
    }

    const targetCompanyId = isPlatform ? (company_id || callerCompanyId) : callerCompanyId;
    if (!targetCompanyId) {
      return NextResponse.json({ error: 'Target company_id is required' }, { status: 400 });
    }

    const report = dataProvider.getCompanyReport(start_date, end_date, targetCompanyId);

    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to generate report' }, { status: 500 });
  }
}
