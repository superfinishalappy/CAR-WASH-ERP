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

    // Find companies expiring in 7 days or 1 day
    const { data: companies, error } = await supabaseClient
      .from('companies')
      .select('id, name, code, valid_until, timezone, active')
      .eq('active', true);

    if (error) throw error;

    const notifications: Array<{ company: string; days_left: number; alert: string }> = [];

    const now = new Date();
    for (const comp of companies || []) {
      const validUntil = new Date(comp.valid_until);
      const diffTime = validUntil.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 7 || diffDays === 1) {
        notifications.push({
          company: comp.name,
          days_left: diffDays,
          alert: `Subscription for ${comp.name} expires in ${diffDays} day(s).`,
        });

        // Insert notification into audit log or notification queue
        await supabaseClient.from('audit_log').insert({
          company_id: comp.id,
          table_name: 'companies',
          row_id: comp.id,
          action: 'EXPIRY_ALERT',
          new_data: { days_left: diffDays, alert: `Subscription expires in ${diffDays} day(s).` },
        });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: companies?.length, alerts: notifications }), {
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
