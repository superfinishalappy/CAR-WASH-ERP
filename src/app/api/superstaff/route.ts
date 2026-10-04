import { NextResponse } from 'next/server';
import { dataProvider } from '@/lib/data-provider';
import { authenticateServerRequest } from '@/lib/server-auth';

export async function POST(req: Request) {
  try {
    // 1. Authenticate caller and enforce Super Admin role
    const auth = await authenticateServerRequest(req);
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!auth.context.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Only System Super Admin can manage Super Staff.' },
        { status: 403 }
      );
    }

    // 2. Process action
    const { action, username, full_name, password, user_id } = await req.json();

    if (action === 'create') {
      if (!username || !full_name || !password) {
        return NextResponse.json(
          { error: 'username, full_name, and password are required' },
          { status: 400 }
        );
      }
      if (password.length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters long.' },
          { status: 400 }
        );
      }
      const res = dataProvider.createSuperStaff(username, full_name, password);
      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, profile: res.profile });
    } else if (action === 'remove') {
      if (!user_id) {
        return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
      }
      const res = dataProvider.removeSuperStaff(user_id);
      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'Super Staff removed' });
    }

    return NextResponse.json({ error: 'Invalid action. Must be create or remove.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to process request' }, { status: 500 });
  }
}
