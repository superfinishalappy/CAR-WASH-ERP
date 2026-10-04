import { NextResponse } from 'next/server';
import { dataProvider } from '@/lib/data-provider';
import { authenticateServerRequest } from '@/lib/server-auth';

export async function POST(req: Request) {
  try {
    // 1. Authenticate caller and enforce platform admin role
    const auth = await authenticateServerRequest(req);
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!auth.context.isPlatform) {
      return NextResponse.json(
        { error: 'Forbidden: Only Super Admin or Super Staff can create new companies.' },
        { status: 403 }
      );
    }

    // 2. Validate input
    const body = await req.json();
    const { code, name, valid_until } = body;
    if (!code || !name || !valid_until) {
      return NextResponse.json(
        { error: 'code, name, and valid_until date are required.' },
        { status: 400 }
      );
    }

    const res = await dataProvider.createCompany(body);

    if (!res.success || !res.company) {
      return NextResponse.json({ error: res.error || 'Failed to create company' }, { status: 400 });
    }

    return NextResponse.json({ success: true, company: res.company });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create company' }, { status: 500 });
  }
}
