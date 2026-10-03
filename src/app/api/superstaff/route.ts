import { NextResponse } from 'next/server';
import { dataProvider } from '@/lib/data-provider';

export async function POST(req: Request) {
  try {
    const { action, username, full_name, password, user_id } = await req.json();

    if (action === 'create') {
      const res = dataProvider.createSuperStaff(username, full_name, password);
      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, profile: res.profile });
    } else if (action === 'remove') {
      const res = dataProvider.removeSuperStaff(user_id);
      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'Super Staff removed' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
