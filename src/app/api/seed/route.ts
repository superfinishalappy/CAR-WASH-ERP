import { NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { getLocalDateString } from '@/lib/date-utils';

export async function GET() {
  return handleSeed();
}

export async function POST() {
  return handleSeed();
}

async function handleSeed() {
  if (!supabaseAdmin) {
    return NextResponse.json(
      {
        success: false,
        error:
          'SUPABASE_SERVICE_ROLE_KEY is not configured in .env.local. Please add your service_role key to enable automatic seeding, or run the SQL script in your Supabase Dashboard.',
      },
      { status: 400 }
    );
  }

  try {
    const today = getLocalDateString();
    const companyId = '11111111-1111-1111-1111-111111111111';

    // 1. Upsert Company ALNOOR
    const { error: compErr } = await supabaseAdmin.from('companies').upsert(
      {
        id: companyId,
        code: 'ALNOOR',
        name: 'Al Noor Auto Care & Garage',
        valid_until: getLocalDateString(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
        active: true,
        timezone: 'Asia/Dubai',
        currency: 'AED',
      },
      { onConflict: 'code' }
    );
    if (compErr) console.warn('Company upsert:', compErr.message);

    // 2. Company Settings
    await supabaseAdmin.from('company_settings').upsert(
      {
        company_id: companyId,
        work_types: ['Wash', 'Polish', 'Painting', 'Mechanical', 'Oil change', 'AC service', 'Detailing'],
        vehicle_types: ['Sedan', 'SUV', 'Hatchback', 'Pickup', 'Van', 'Sports', 'Bike'],
        expense_categories: ['Rent', 'Utilities', 'Materials', 'Maintenance', 'Equipment', 'Staff Food', 'Transport', 'Other'],
        thresholds: {
          margin_warn: 0.15,
          staff_warn: 0.4,
          staff_bad: 0.5,
          opex_warn: 0.2,
          opex_bad: 0.3,
          unpaid_warn: 0.1,
          unpaid_bad: 0.25,
          advance_warn: 0.15,
          sales_drop_warn: -0.1,
          sales_drop_bad: -0.25,
          expense_growth: 0.2,
        },
      },
      { onConflict: 'company_id' }
    );

    // 3. Helper to create user cleanly with Supabase Admin API
    const usersToCreate = [
      {
        email: 'admin.admin@carwash.app',
        password: 'AdminPassword123!',
        company_id: null,
        username: 'admin',
        full_name: 'System Super Admin',
        role: 'superadmin',
        pay_type: 'none',
        pay_rate: 0,
      },
      {
        email: 'admin.alnoor@carwash.app',
        password: 'AdminPassword123!',
        company_id: companyId,
        username: 'admin',
        full_name: 'Al Noor Garage Admin',
        role: 'owner',
        pay_type: 'none',
        pay_rate: 0,
      },
    ];

    const createdUsers: Record<string, string> = {};

    for (const u of usersToCreate) {
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
      const existing = listData?.users?.find((x) => x.email === u.email);

      let userId = existing?.id;
      if (!userId) {
        const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: {
            username: u.username,
            full_name: u.full_name,
            role: u.role,
          },
        });
        if (createErr) {
          console.error(`Failed to create ${u.email}:`, createErr);
          continue;
        }
        userId = newUser.user?.id;
      } else {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: u.password,
          email_confirm: true,
        });
      }

      if (userId) {
        createdUsers[u.username] = userId;
        await supabaseAdmin.from('profiles').upsert(
          {
            id: userId,
            company_id: u.company_id,
            username: u.username,
            full_name: u.full_name,
            role: u.role,
            pay_type: u.pay_type,
            pay_rate: u.pay_rate,
            active: true,
          },
          { onConflict: 'id' }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Supabase database initialized with clean slate: Al Noor Auto Care & Garage + Admin accounts only (0 dummy records)!',
      users: Object.keys(createdUsers),
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
