import { NextResponse } from 'next/server';
import { dataProvider } from '@/lib/data-provider';
import { supabaseAdmin, buildSyntheticEmail } from '@/lib/supabase';
import { authenticateServerRequest } from '@/lib/server-auth';
import { AppRole } from '@/types/database';

export async function POST(req: Request) {
  try {
    // 1. Authenticate caller and verify permissions
    const auth = await authenticateServerRequest(req);
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { isPlatform, isSuperAdmin, isOwner, companyId: callerCompanyId } = auth.context;

    if (!isPlatform && !isOwner) {
      return NextResponse.json(
        { error: 'Forbidden: Only owners and platform administrators can create users.' },
        { status: 403 }
      );
    }

    // 2. Parse and validate payload
    const body = await req.json();
    const { username, company_code, password, full_name, role, pay_type, pay_rate, company_id } = body;

    if (!username || !password || !full_name || !role) {
      return NextResponse.json(
        { error: 'username, password, full_name, and role are required.' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    // 3. Enforce tenant boundary & role hierarchy
    let targetCompanyId: string | null = null;

    if (isOwner && !isPlatform) {
      // Owners can ONLY create users inside their own company
      if (!callerCompanyId) {
        return NextResponse.json(
          { error: 'Forbidden: Owner has no associated company.' },
          { status: 403 }
        );
      }
      targetCompanyId = callerCompanyId;

      // Owners CANNOT create platform-level accounts
      if (['superadmin', 'superstaff'].includes(role)) {
        return NextResponse.json(
          { error: 'Forbidden: Owners cannot create platform administrator accounts.' },
          { status: 403 }
        );
      }
    } else {
      // Platform staff: target company from payload or own
      targetCompanyId = company_id || callerCompanyId || null;

      // Only Super Admin can create superadmin or superstaff
      if (['superadmin', 'superstaff'].includes(role) && !isSuperAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: Only System Super Admin can provision platform roles.' },
          { status: 403 }
        );
      }
    }

    // 4. Create user in Supabase Auth via Admin Client if available
    let authUserId: string | null = null;
    if (supabaseAdmin && password) {
      const email = buildSyntheticEmail(username, company_code || 'COMPANY');
      const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role, username },
      });

      if (!authErr && authUser?.user) {
        authUserId = authUser.user.id;
      }
    }

    // 5. Create company user profile in database
    const res = await dataProvider.createCompanyUser({
      ...body,
      company_id: targetCompanyId || undefined,
      id: authUserId || undefined,
    });

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, profile: res.profile });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create user' }, { status: 500 });
  }
}
