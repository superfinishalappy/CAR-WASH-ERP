import { NextResponse } from 'next/server';
import { dataProvider } from '@/lib/data-provider';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { authenticateServerRequest } from '@/lib/server-auth';

export async function POST(req: Request) {
  try {
    // 1. Authenticate caller
    const auth = await authenticateServerRequest(req);
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { isPlatform, isOwner, companyId: callerCompanyId } = auth.context;
    if (!isPlatform && !isOwner) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions to reset passwords.' },
        { status: 403 }
      );
    }

    // 2. Validate input
    const { user_id, new_password } = await req.json();
    if (!user_id || !new_password) {
      return NextResponse.json(
        { error: 'user_id and new_password are required' },
        { status: 400 }
      );
    }

    if (new_password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    // 3. Verify target user
    const client = supabaseAdmin || supabase;
    if (client) {
      const { data: targetProfile, error: targetErr } = await client
        .from('profiles')
        .select('id, company_id, role')
        .eq('id', user_id)
        .single();

      if (targetErr || !targetProfile) {
        return NextResponse.json({ error: 'Target user not found.' }, { status: 404 });
      }

      // Enforce owner boundaries
      if (isOwner && !isPlatform) {
        if (targetProfile.company_id !== callerCompanyId) {
          return NextResponse.json(
            { error: 'Forbidden: You can only reset passwords for users in your company.' },
            { status: 403 }
          );
        }
        if (['superadmin', 'superstaff'].includes(targetProfile.role)) {
          return NextResponse.json(
            { error: 'Forbidden: Cannot reset platform administrator accounts.' },
            { status: 403 }
          );
        }
      }

      // Update password in Supabase Auth if admin client is configured
      if (supabaseAdmin) {
        const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
          password: new_password,
        });
        if (authErr) {
          return NextResponse.json({ error: authErr.message }, { status: 400 });
        }
      }
    }

    const res = dataProvider.resetUserPassword(user_id, new_password);
    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Password reset successfully.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to reset password' }, { status: 500 });
  }
}
