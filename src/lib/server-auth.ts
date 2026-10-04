import { supabase, supabaseAdmin } from '@/lib/supabase';
import { Profile, AppRole } from '@/types/database';

export interface AuthContext {
  userId: string;
  email?: string;
  profile: Profile;
  isPlatform: boolean;
  isSuperAdmin: boolean;
  isOwner: boolean;
  companyId: string | null;
}

export type AuthResult =
  | { success: true; context: AuthContext }
  | { success: false; error: string; status: number };

/**
 * Extracts and cryptographically verifies the Supabase JWT Bearer token from the incoming request.
 * Verifies profile existence, active state, and resolves role and company_id.
 */
export async function authenticateServerRequest(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'Unauthorized: Missing or malformed Bearer token', status: 401 };
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return { success: false, error: 'Unauthorized: Empty token', status: 401 };
  }

  if (!supabase) {
    return { success: false, error: 'Internal Server Error: Supabase client unavailable', status: 500 };
  }

  // 1. Verify cryptographic JWT via Supabase Auth
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user?.id) {
    return { success: false, error: 'Unauthorized: Invalid or expired session token', status: 401 };
  }

  const userId = userData.user.id;

  // 2. Fetch caller profile to verify role and active state
  const clientToUse = supabaseAdmin || supabase;
  const { data: profile, error: profileErr } = await clientToUse
    .from('profiles')
    .select('id, company_id, username, full_name, role, active, pay_type, pay_rate')
    .eq('id', userId)
    .single();

  if (profileErr || !profile) {
    return { success: false, error: 'Forbidden: User profile not found', status: 403 };
  }

  if (!profile.active) {
    return { success: false, error: 'Forbidden: Account has been deactivated', status: 403 };
  }

  const isSuperAdmin = profile.role === 'superadmin';
  const isPlatform = ['superadmin', 'superstaff'].includes(profile.role);
  const isOwner = profile.role === 'owner';

  return {
    success: true,
    context: {
      userId,
      email: userData.user.email,
      profile: profile as Profile,
      isPlatform,
      isSuperAdmin,
      isOwner,
      companyId: profile.company_id,
    },
  };
}
