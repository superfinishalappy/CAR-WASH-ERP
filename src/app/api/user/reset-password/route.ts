import { NextResponse } from 'next/server';
import { dataProvider } from '@/lib/data-provider';

export async function POST(req: Request) {
  try {
    const { user_id, new_password } = await req.json();

    if (!user_id || !new_password) {
      return NextResponse.json({ error: 'user_id and new_password are required' }, { status: 400 });
    }

    const res = dataProvider.resetUserPassword(user_id, new_password);

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Password reset successful' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
