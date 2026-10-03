import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Browser-safe Supabase client (only anon key, never service role key!)
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

// Server-only Supabase client (service role key, bypasses RLS for admin operations)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
export const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/**
 * Helper to build synthetic email from username and company code
 * Standard RFC-compliant domain format accepted by Supabase Auth
 * Format: lower(username) . lower(company_code) @ carwash.app
 */
export function buildSyntheticEmail(username: string, companyCode: string): string {
  const cleanUser = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  const cleanCode = companyCode.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  return `${cleanUser}.${cleanCode}@carwash.app`;
}

/**
 * Rate limiter utility for login attempts (in-memory per client)
 */
const loginAttempts: Record<string, { count: number; lockedUntil: number }> = {};

export function checkLoginRateLimit(key: string): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const record = loginAttempts[key];

  if (!record) return { allowed: true };

  if (record.lockedUntil > now) {
    const waitSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  // Reset if window passed
  if (now - record.lockedUntil > 60000) {
    delete loginAttempts[key];
    return { allowed: true };
  }

  return { allowed: true };
}

export function recordFailedLogin(key: string): void {
  const now = Date.now();
  const record = loginAttempts[key] || { count: 0, lockedUntil: 0 };
  record.count += 1;

  // Lock for 30 seconds after 5 failed attempts
  if (record.count >= 5) {
    record.lockedUntil = now + 30000;
  }
  loginAttempts[key] = record;
}

export function resetLoginAttempts(key: string): void {
  delete loginAttempts[key];
}
