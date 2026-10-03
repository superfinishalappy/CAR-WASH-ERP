import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: callerProfile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!callerProfile || !['superadmin', 'superstaff'].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden: Super Admin or Super Staff required.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { company_id, action, valid_until, active } = await req.json();

    if (!company_id) {
      return new Response(JSON.stringify({ error: 'company_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch current company
    const { data: company, error: fetchErr } = await supabaseClient
      .from('companies')
      .select('*')
      .eq('id', company_id)
      .single();

    if (fetchErr || !company) {
      return new Response(JSON.stringify({ error: 'Company not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let updatePayload: Record<string, any> = {};

    if (action === 'add_30_days') {
      const curDate = new Date(company.valid_until);
      const now = new Date();
      // If already expired, add 30 days from now, otherwise add 30 days to existing valid_until
      const baseDate = curDate < now ? now : curDate;
      baseDate.setDate(baseDate.getDate() + 30);
      updatePayload.valid_until = baseDate.toISOString().split('T')[0];
      updatePayload.active = true;
    } else if (action === 'set_date') {
      if (!valid_until) {
        return new Response(JSON.stringify({ error: 'valid_until date is required for set_date' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      updatePayload.valid_until = valid_until;
    } else if (action === 'toggle_active') {
      updatePayload.active = typeof active === 'boolean' ? active : !company.active;
    } else {
      if (valid_until) updatePayload.valid_until = valid_until;
      if (typeof active === 'boolean') updatePayload.active = active;
    }

    const { data: updated, error: updateErr } = await supabaseClient
      .from('companies')
      .update(updatePayload)
      .eq('id', company_id)
      .select()
      .single();

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, company: updated }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
