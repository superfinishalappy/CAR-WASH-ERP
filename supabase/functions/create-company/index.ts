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

    // Verify caller role: must be superadmin or superstaff
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
      return new Response(JSON.stringify({ error: 'Forbidden: Super Admin or Super Staff role required.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { name, code, valid_until, timezone, currency, owner_username, owner_full_name, owner_password } = await req.json();

    if (!name || !code || !valid_until || !owner_username || !owner_password) {
      return new Response(JSON.stringify({ error: 'Missing required company or owner fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (owner_password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters long.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const upperCode = code.trim().toUpperCase();

    // 1. Create company record
    const { data: company, error: compErr } = await supabaseClient
      .from('companies')
      .insert({
        name: name.trim(),
        code: upperCode,
        valid_until,
        timezone: timezone || 'Asia/Dubai',
        currency: currency || 'AED',
        active: true,
      })
      .select()
      .single();

    if (compErr) {
      return new Response(JSON.stringify({ error: compErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Initialize company settings
    await supabaseClient
      .from('company_settings')
      .insert({
        company_id: company.id,
      });

    // 3. Create owner auth user with synthetic email
    const syntheticEmail = `${owner_username.trim().toLowerCase()}@${upperCode.toLowerCase()}.erp.local`;
    const { data: authUser, error: authErr } = await supabaseClient.auth.admin.createUser({
      email: syntheticEmail,
      password: owner_password,
      email_confirm: true,
      user_metadata: {
        company_id: company.id,
        username: owner_username.trim().toLowerCase(),
        role: 'owner',
      },
    });

    if (authErr) {
      // Rollback company on failure
      await supabaseClient.from('companies').delete().eq('id', company.id);
      return new Response(JSON.stringify({ error: authErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 4. Create owner profile
    const { error: profErr } = await supabaseClient
      .from('profiles')
      .insert({
        id: authUser.user.id,
        company_id: company.id,
        username: owner_username.trim().toLowerCase(),
        full_name: owner_full_name || 'Company Owner',
        role: 'owner',
        pay_type: 'none',
        pay_rate: 0,
        active: true,
      });

    if (profErr) {
      return new Response(JSON.stringify({ error: profErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, company, owner_id: authUser.user.id }), {
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
