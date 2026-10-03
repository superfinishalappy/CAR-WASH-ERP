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

    // Verify caller role: MUST BE superadmin ONLY
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

    if (!callerProfile || callerProfile.role !== 'superadmin') {
      return new Response(JSON.stringify({ error: 'Forbidden: Super Admin role required to manage Super Staff accounts.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'create') {
      const { username, full_name, password } = body;
      if (!username || !password) {
        return new Response(JSON.stringify({ error: 'Username and password are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (password.length < 8) {
        return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const sanitizedUsername = username.trim().toLowerCase();
      // Super Staff uses synthetic email with admin company code: username@admin.erp.local
      const syntheticEmail = `${sanitizedUsername}@admin.erp.local`;

      const { data: authUser, error: authErr } = await supabaseClient.auth.admin.createUser({
        email: syntheticEmail,
        password,
        email_confirm: true,
        user_metadata: {
          username: sanitizedUsername,
          role: 'superstaff',
        },
      });

      if (authErr) {
        return new Response(JSON.stringify({ error: authErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const { data: profile, error: profErr } = await supabaseClient
        .from('profiles')
        .insert({
          id: authUser.user.id,
          company_id: null,
          username: sanitizedUsername,
          full_name: full_name || sanitizedUsername,
          role: 'superstaff',
          pay_type: 'none',
          pay_rate: 0,
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
    } else if (action === 'remove') {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: 'user_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Ensure user is superstaff and not superadmin
      const { data: targetProfile } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', user_id)
        .single();

      if (targetProfile?.role !== 'superstaff') {
        return new Response(JSON.stringify({ error: 'Can only delete accounts with role superstaff' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      await supabaseClient.from('profiles').delete().eq('id', user_id);
      await supabaseClient.auth.admin.deleteUser(user_id);

      return new Response(JSON.stringify({ success: true, message: 'Super Staff removed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Must be create or remove.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
