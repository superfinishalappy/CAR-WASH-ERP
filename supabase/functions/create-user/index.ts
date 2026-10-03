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
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    const isPlatform = callerProfile && ['superadmin', 'superstaff'].includes(callerProfile.role);
    const isOwner = callerProfile && callerProfile.role === 'owner';

    if (!isPlatform && !isOwner) {
      return new Response(JSON.stringify({ error: 'Forbidden: Only owners and platform staff can create users.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { company_id, username, full_name, role, password, pay_type, pay_rate } = await req.json();

    const targetCompanyId = isPlatform ? (company_id || callerProfile?.company_id) : callerProfile?.company_id;

    if (!targetCompanyId || !username || !password || !role) {
      return new Response(JSON.stringify({ error: 'Missing required user parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Owner cannot create platform roles or owners
    if (!isPlatform && ['superadmin', 'superstaff', 'owner'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Owners can only create manager, accountant, or staff roles.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch company code
    const { data: company, error: compErr } = await supabaseClient
      .from('companies')
      .select('code')
      .eq('id', targetCompanyId)
      .single();

    if (compErr || !company) {
      return new Response(JSON.stringify({ error: 'Company not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const sanitizedUsername = username.trim().toLowerCase();
    const syntheticEmail = `${sanitizedUsername}@${company.code.toLowerCase()}.erp.local`;

    // Create auth user
    const { data: authUser, error: authErr } = await supabaseClient.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
      user_metadata: {
        company_id: targetCompanyId,
        username: sanitizedUsername,
        role,
      },
    });

    if (authErr) {
      return new Response(JSON.stringify({ error: authErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Create profile
    const { data: profile, error: profErr } = await supabaseClient
      .from('profiles')
      .insert({
        id: authUser.user.id,
        company_id: targetCompanyId,
        username: sanitizedUsername,
        full_name: full_name || sanitizedUsername,
        role,
        pay_type: pay_type || 'none',
        pay_rate: pay_rate || 0,
        active: true,
      })
      .select()
      .single();

    if (profErr) {
      await supabaseClient.auth.admin.deleteUser(authUser.user.id);
      return new Response(JSON.stringify({ error: profErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, user: profile }), {
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
