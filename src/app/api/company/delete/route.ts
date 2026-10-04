import { NextResponse } from 'next/server';
import { dataProvider } from '@/lib/data-provider';
import { authenticateServerRequest } from '@/lib/server-auth';
import { supabaseAdmin, supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    // 1. Authenticate caller and enforce Super Admin role
    const auth = await authenticateServerRequest(req);
    if (!auth.success) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!auth.context.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Only System Super Admin can delete companies.' },
        { status: 403 }
      );
    }

    // 2. Validate input
    const { company_id } = await req.json();
    if (!company_id || typeof company_id !== 'string') {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    // 3. Delete from database using elevated client or dataProvider
    const client = supabaseAdmin || supabase;
    if (client) {
      const { error: delErr } = await client
        .from('companies')
        .delete()
        .eq('id', company_id);

      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 400 });
      }
    }

    dataProvider.deleteCompany(company_id);

    return NextResponse.json({ success: true, message: 'Company deleted successfully.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete company' }, { status: 500 });
  }
}
