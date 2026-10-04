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
        { error: 'Forbidden: Only Super Admin or Super Staff can manage subscriptions.' },
        { status: 403 }
      );
    }

    // 2. Validate input
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
    return NextResponse.json({ error: err.message || 'Failed to update subscription' }, { status: 500 });
  }
}
