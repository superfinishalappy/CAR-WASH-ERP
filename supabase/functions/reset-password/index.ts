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
      return new Response(JSON.stringify({ error: 'Forbidden: Insufficient permissions to reset password.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user_id, new_password } = await req.json();

    if (!user_id || !new_password) {
      return new Response(JSON.stringify({ error: 'User ID and new password are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (new_password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters long.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Target profile verification
    const { data: targetProfile, error: targetErr } = await supabaseClient
      .from('profiles')
      .select('id, company_id, role')
      .eq('id', user_id)
      .single();

    if (targetErr || !targetProfile) {
      return new Response(JSON.stringify({ error: 'Target user profile not found.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Owner can only reset users in their own company, and cannot reset superadmin/superstaff
    if (isOwner && !isPlatform) {
      if (targetProfile.company_id !== callerProfile?.company_id) {
        return new Response(JSON.stringify({ error: 'Forbidden: You can only reset passwords for users in your company.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (['superadmin', 'superstaff'].includes(targetProfile.role)) {
        return new Response(JSON.stringify({ error: 'Forbidden: Cannot reset platform accounts.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Update password via admin auth
    const { error: updateErr } = await supabaseClient.auth.admin.updateUserById(user_id, {
      password: new_password,
    });

    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, message: 'Password reset successfully.' }), {
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
