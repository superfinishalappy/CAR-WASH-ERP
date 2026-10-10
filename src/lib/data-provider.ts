import {
  Company,
  Profile,
  Customer,
  Job,
  Expense,
  Advance,
  Attendance,
  CustomerPayment,
  CompanySettings,
  AuditLogEntry,
  ReportData,
  UserSession,
  DiagnosticWarning,
  AppRole,
  InventoryItem,
  InventoryLog,
  FixedExpense,
  DailyCashAdjustment,
} from '@/types/database';
import { supabase, buildSyntheticEmail } from '@/lib/supabase';
import {
  getLocalDateString,
  getTodayString,
  getYesterdayString,
  getFirstDayOfMonthString,
} from '@/lib/date-utils';
import { generateUUID } from '@/lib/uuid';

// Client-side cache key only for maintaining active session across page reloads
const SESSION_STORAGE_KEY = 'garage_erp_session_cache';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function loadCachedSession(): UserSession | null {
  if (!isBrowser()) return null;
  try {
    const data = localStorage.getItem(SESSION_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

function saveCachedSession(session: UserSession | null): void {
  if (!isBrowser()) return;
  try {
    if (session) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Failed to save session cache:', e);
  }
}

export class DataProvider {
  private companies: Company[] = [];
  private profiles: Profile[] = [];
  private customers: Customer[] = [];
  private jobs: Job[] = [];
  private expenses: Expense[] = [];
  private advances: Advance[] = [];
  private attendance: Attendance[] = [];
  private customerPayments: CustomerPayment[] = [];
  private settings: Record<string, CompanySettings> = {};
  private auditLog: AuditLogEntry[] = [];
  
  // Phase 2: Inventory
  private inventoryItems: InventoryItem[] = [];
  private inventoryLogs: InventoryLog[] = [];
  
  // Phase 3: Fixed Expenses
  private fixedExpenses: FixedExpense[] = [];
  
  // Daily Cash Adjustments
  private cashAdjustments: DailyCashAdjustment[] = [];
  
  private currentSession: UserSession | null = null;
  private isInitialized = false;

  constructor() {
    this.currentSession = loadCachedSession();
    if (isBrowser()) {
      // Background sync when browser loads
      this.init();
    }
  }

  private dispatchSyncError(message: string) {
    if (isBrowser()) {
      window.dispatchEvent(new CustomEvent('app-sync-error', { detail: { message } }));
    }
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;
    await this.syncFromSupabase();
  }

  /**
   * Sync all live database entities directly from Supabase tables
   */
  public async syncFromSupabase(): Promise<void> {
    if (!supabase) return;

    try {
      const cid = this.getEffectiveCompanyId();
      const isPlatform =
        this.currentSession &&
        ['superadmin', 'superstaff'].includes(this.currentSession.profile.role);

      // 1. Companies
      const { data: compData, error: compErr } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });
      if (!compErr && compData) {
        this.companies = compData;
      }

      // 2. Profiles
      let profQuery = supabase.from('profiles').select('*');
      if (!isPlatform && cid) {
        profQuery = profQuery.eq('company_id', cid);
      }
      const { data: profData, error: profErr } = await profQuery;
      if (!profErr && profData) {
        this.profiles = profData;
      }

      // 3. Settings
      const { data: settData, error: settErr } = await supabase.from('company_settings').select('*');
      if (!settErr && settData) {
        this.settings = {};
        for (const s of settData) {
          this.settings[s.company_id] = s;
        }
      }

      // 4. Customers (Safeguarded to most recent 2,500 records)
      let custQuery = supabase.from('customers').select('*').order('created_at', { ascending: false }).limit(2500);
      if (!isPlatform && cid) {
        custQuery = custQuery.eq('company_id', cid);
      }
      const { data: custData, error: custErr } = await custQuery;
      if (!custErr && custData) {
        this.customers = custData;
      }

      // 5. Jobs (Safeguarded to most recent 2,500 jobs for instant operational cache)
      let jobQuery = supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(2500);
      if (!isPlatform && cid) {
        jobQuery = jobQuery.eq('company_id', cid);
      }
      const { data: jobData, error: jobErr } = await jobQuery;
      if (!jobErr && jobData) {
        this.jobs = jobData;
      }

      // 6. Expenses (Safeguarded to most recent 1,500 records)
      let expQuery = supabase.from('expenses').select('*').order('created_at', { ascending: false }).limit(1500);
      if (!isPlatform && cid) {
        expQuery = expQuery.eq('company_id', cid);
      }
      const { data: expData, error: expErr } = await expQuery;
      if (!expErr && expData) {
        this.expenses = expData;
      }

      // 7. Advances
      let advQuery = supabase.from('advances').select('*').order('created_at', { ascending: false }).limit(1000);
      if (!isPlatform && cid) {
        advQuery = advQuery.eq('company_id', cid);
      }
      const { data: advData, error: advErr } = await advQuery;
      if (!advErr && advData) {
        this.advances = advData;
      }

      // 8. Attendance (Safeguarded to most recent 1,500 records)
      let attQuery = supabase.from('attendance').select('*').order('created_at', { ascending: false }).limit(1500);
      if (!isPlatform && cid) {
        attQuery = attQuery.eq('company_id', cid);
      }
      const { data: attData, error: attErr } = await attQuery;
      if (!attErr && attData) {
        this.attendance = attData;
      }

      // 9. Customer Payments (Safeguarded to most recent 1,500 records)
      let payQuery = supabase.from('customer_payments').select('*').order('created_at', { ascending: false }).limit(1500);
      if (!isPlatform && cid) {
        payQuery = payQuery.eq('company_id', cid);
      }
      const { data: payData, error: payErr } = await payQuery;
      if (!payErr && payData) {
        this.customerPayments = payData;
      }

      // 10. Audit Log
      let logQuery = supabase.from('audit_log').select('*').order('timestamp', { ascending: false }).limit(200);
      if (!isPlatform && cid) {
        logQuery = logQuery.eq('company_id', cid);
      }
      const { data: logData, error: logErr } = await logQuery;
      if (!logErr && logData) {
        this.auditLog = logData;
      }

      // 11. Inventory Items
      let invItemQuery = supabase.from('inventory_items').select('*');
      if (!isPlatform && cid) {
        invItemQuery = invItemQuery.eq('company_id', cid);
      }
      const { data: invItemData, error: invItemErr } = await invItemQuery;
      if (!invItemErr && invItemData) {
        this.inventoryItems = invItemData;
      }

      // 12. Inventory Logs
      let invLogQuery = supabase.from('inventory_logs').select('*').order('created_at', { ascending: false }).limit(1000);
      if (!isPlatform && cid) {
        invLogQuery = invLogQuery.eq('company_id', cid);
      }
      const { data: invLogData, error: invLogErr } = await invLogQuery;
      if (!invLogErr && invLogData) {
        this.inventoryLogs = invLogData;
      }
      
      // 13. Fixed Expenses
      let feQuery = supabase.from('fixed_expenses').select('*');
      if (!isPlatform && cid) {
        feQuery = feQuery.eq('company_id', cid);
      }
      const { data: feData, error: feErr } = await feQuery;
      if (!feErr && feData) {
        this.fixedExpenses = feData;
      }

      // 14. Daily Cash Adjustments
      let dcaQuery = supabase.from('daily_cash_adjustments').select('*').order('created_at', { ascending: false }).limit(500);
      if (!isPlatform && cid) {
        dcaQuery = dcaQuery.eq('company_id', cid);
      }
      const { data: dcaData, error: dcaErr } = await dcaQuery;
      if (!dcaErr && dcaData) {
        this.cashAdjustments = dcaData;
      }

      // If active session exists, refresh company & profile in session
      if (this.currentSession) {
        const freshProfile = this.profiles.find((p) => p.id === this.currentSession?.profile.id);
        if (freshProfile) {
          this.currentSession.profile = freshProfile;
        }
        if (this.currentSession.company) {
          const freshCompany = this.companies.find((c) => c.id === this.currentSession?.company?.id);
          if (freshCompany) {
            this.currentSession.company = freshCompany;
          }
        }
        saveCachedSession(this.currentSession);
      }

      // Point-in-Time Lock Guarantee:
      // Freeze rates on all historical entries loaded up to this moment
      this.freezeHistoricalRates();
    } catch (err) {
      console.error('Failed to sync from Supabase:', err);
    }
  }

  private getRatesCache(): {
    jobs: Record<string, { rate: number; amount: number }>;
    attendance: Record<string, number>;
  } {
    const fromSettings: Record<string, number> = {};
    const cid = this.getEffectiveCompanyId();
    if (cid && this.settings[cid]) {
      const th = this.settings[cid].thresholds as any;
      if (th && th.daily_rates && typeof th.daily_rates === 'object') {
        Object.assign(fromSettings, th.daily_rates);
      }
    }

    if (typeof window === 'undefined') return { jobs: {}, attendance: fromSettings };
    try {
      const jRaw = localStorage.getItem('garage_erp_job_rates');
      const aRaw = localStorage.getItem('garage_erp_attendance_rates');
      const localAtt = aRaw ? JSON.parse(aRaw) : {};
      return {
        jobs: jRaw ? JSON.parse(jRaw) : {},
        attendance: { ...fromSettings, ...localAtt },
      };
    } catch (e) {
      return { jobs: {}, attendance: fromSettings };
    }
  }

  private saveJobRateCache(jobId: string, rate: number, amount: number) {
    if (typeof window === 'undefined') return;
    try {
      const cache = this.getRatesCache();
      cache.jobs[jobId] = { rate, amount };
      localStorage.setItem('garage_erp_job_rates', JSON.stringify(cache.jobs));
    } catch (e) {}
  }

  private saveAttendanceRateCache(key: string, rate: number) {
    if (typeof window !== 'undefined') {
      try {
        const cache = this.getRatesCache();
        cache.attendance[key] = rate;
        localStorage.setItem('garage_erp_attendance_rates', JSON.stringify(cache.attendance));
      } catch (e) {}
    }

    // Persist to Supabase company_settings.thresholds.daily_rates so ALL browsers stay in sync!
    const cid = this.getEffectiveCompanyId();
    if (cid && this.settings[cid]) {
      const th = (this.settings[cid].thresholds || {}) as any;
      if (!th.daily_rates) th.daily_rates = {};
      th.daily_rates[key] = rate;
      if (supabase) {
        supabase.from('company_settings').update({ thresholds: th }).eq('company_id', cid).then(() => {});
      }
    }
  }

  /**
   * Point-in-Time Lock Guarantee:
   * Permanently freeze/stamp historical commission rates and daily wages onto all records
   * loaded up to this moment so that past entries are never retroactively corrupted by future rate changes.
   * Commission is calculated on Base Price only (extra excluded).
   */
  public freezeHistoricalRates(): void {
    const { jobs: cachedJobs, attendance: cachedAtt } = this.getRatesCache();

    // 1. Freeze historical commission rates on all existing jobs
    // Computed strictly on Base Price only (extra excluded)
    for (const job of this.jobs) {
      if (cachedJobs[job.id]) {
        job.commission_rate = cachedJobs[job.id].rate;
        job.commission_amount = Math.round((job.price * (job.commission_rate / 100)) * 100) / 100;
      } else {
        const staff = this.profiles.find((p) => p.id === job.staff_id);
        if (staff && staff.pay_type === 'commission') {
          if (job.commission_rate === undefined) {
            job.commission_rate = Number(staff.pay_rate) || 0;
          }
          job.commission_amount = Math.round((job.price * (job.commission_rate / 100)) * 100) / 100;
          this.saveJobRateCache(job.id, job.commission_rate, job.commission_amount);
        }
      }
    }

    // 2. Freeze historical daily wages on all existing attendance records
    // Sanitize cached attendance rates: strictly ONLY for staff with pay_type === 'daily'
    let dirtyAttCache = false;
    for (const att of this.attendance) {
      const attKey = `${att.entry_date}_${att.staff_id}`;
      const staff = this.profiles.find((p) => p.id === att.staff_id);

      if (!staff || staff.pay_type !== 'daily') {
        // Commission, monthly, or none staff NEVER have a daily wage rate!
        att.daily_rate = undefined;
        if (cachedAtt[attKey] !== undefined) {
          delete cachedAtt[attKey];
          dirtyAttCache = true;
        }
        continue;
      }

      // For daily staff:
      if (cachedAtt[attKey] !== undefined) {
        att.daily_rate = cachedAtt[attKey];
      } else if (att.status === 'present') {
        att.daily_rate = Number(staff.pay_rate) || 0;
        cachedAtt[attKey] = att.daily_rate;
        dirtyAttCache = true;
      }
    }

    // Also purge any orphan keys in cachedAtt for any staff whose current pay_type is not daily
    for (const k of Object.keys(cachedAtt)) {
      const parts = k.split('_');
      const sId = parts.length > 1 ? parts.slice(1).join('_') : '';
      const st = this.profiles.find((p) => p.id === sId);
      if (st && st.pay_type !== 'daily') {
        delete cachedAtt[k];
        dirtyAttCache = true;
      }
    }

    if (dirtyAttCache && typeof window !== 'undefined') {
      try {
        localStorage.setItem('garage_erp_attendance_rates', JSON.stringify(cachedAtt));
      } catch (e) {}
    }
  }

  // Session & Authentication
  public getCurrentSession(): UserSession | null {
    return this.currentSession;
  }

  public setActingCompany(companyId: string | null): void {
    if (!this.currentSession) return;
    const isPlatform = ['superadmin', 'superstaff'].includes(this.currentSession.profile.role);
    if (!isPlatform) return;

    if (!companyId) {
      this.currentSession.actingCompanyId = null;
      this.currentSession.actingCompany = null;
    } else {
      const company = this.companies.find((c) => c.id === companyId);
      if (company) {
        this.currentSession.actingCompanyId = company.id;
        this.currentSession.actingCompany = company;
      }
    }
    saveCachedSession(this.currentSession);
    this.syncFromSupabase();
  }

  public getEffectiveCompanyId(): string | null {
    if (!this.currentSession) return null;
    if (this.currentSession.actingCompanyId) {
      return this.currentSession.actingCompanyId;
    }
    return this.currentSession.company?.id || null;
  }

  public async login(
    companyCode: string,
    username: string,
    password: string
  ): Promise<{ success: boolean; session?: UserSession; isExpired?: boolean; error?: string }> {
    const codeUpper = companyCode.trim().toUpperCase();
    const userClean = username.trim().toLowerCase();

    if (!supabase) {
      return { success: false, error: 'Supabase client is not initialized.' };
    }

    try {
      const isPlatformLogin = codeUpper === 'ADMIN';

      // 1. Authenticate with Supabase Auth (strict cryptographic password verification)
      const syntheticEmail = buildSyntheticEmail(userClean, codeUpper);
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password,
      });

      if (authError || !authData?.user?.id) {
        return {
          success: false,
          error: authError?.message || 'Invalid username or password.',
        };
      }

      const userId = authData.user.id;
      // 2. Fetch authenticated user's profile
      const { data: pData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileErr || !pData) {
        return {
          success: false,
          error: 'User profile not found in database.',
        };
      }
      const profile = pData as Profile;
      let company: Company | null = null;

      if (!profile.active) {
        return { success: false, error: 'Account is deactivated. Contact administrator.' };
      }

      const isPlatform = ['superadmin', 'superstaff'].includes(profile.role);

      if (!isPlatform) {
        if (!company && profile.company_id) {
          const { data: comp } = await supabase
            .from('companies')
            .select('*')
            .eq('id', profile.company_id)
            .single();
          company = comp;
        }

        if (!company) {
          return { success: false, error: 'Company record not found in Supabase.' };
        }

        const todayStr = getTodayString(company?.timezone);
        const isExpired = company.valid_until < todayStr || !company.active;

        if (isExpired) {
          return {
            success: false,
            error: 'Subscription expired. Contact your provider.',
            isExpired: true,
          };
        }
      }

      const session: UserSession = {
        user: {
          id: profile.id,
          email: syntheticEmail,
          username: profile.username,
          company_code: company ? company.code : 'ADMIN',
        },
        profile,
        company: company || null,
        actingCompanyId: null,
        actingCompany: null,
      };

      this.currentSession = session;
      saveCachedSession(this.currentSession);

      // Load all tenant data from Supabase
      await this.syncFromSupabase();

      return { success: true, session };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed.' };
    }
  }

  public async logout(): Promise<void> {
    if (supabase) {
      await supabase.auth.signOut();
    }
    this.currentSession = null;
    this.companies = [];
    this.profiles = [];
    this.customers = [];
    this.jobs = [];
    this.expenses = [];
    this.advances = [];
    this.attendance = [];
    this.customerPayments = [];
    this.settings = {};
    this.auditLog = [];
    saveCachedSession(null);
  }

  // Permissions Enforcement Matrix (§3)
  public isSameDay(entryDate: string): boolean {
    const todayStr = getTodayString(this.currentSession?.company?.timezone);
    return entryDate === todayStr;
  }

  public canAdd(entryDate: string): boolean {
    if (!this.currentSession) return false;
    const role = this.currentSession.profile.role;
    if (['superadmin', 'superstaff', 'owner'].includes(role)) return true;
    return this.isSameDay(entryDate);
  }

  public canEdit(entryDate: string): boolean {
    if (!this.currentSession) return false;
    const role = this.currentSession.profile.role;
    if (['superadmin', 'superstaff', 'owner'].includes(role)) return true;
    return this.isSameDay(entryDate);
  }

  public canDeleteJob(entryDate: string): boolean {
    if (!this.currentSession) return false;
    const role = this.currentSession.profile.role;
    if (['superadmin', 'superstaff', 'owner'].includes(role)) return true;
    if (role === 'manager') return this.isSameDay(entryDate);
    return false;
  }

  public canDeleteFinancial(entryDate: string): boolean {
    if (!this.currentSession) return false;
    const role = this.currentSession.profile.role;
    if (['superadmin', 'superstaff', 'owner'].includes(role)) return true;
    if (['manager', 'accountant'].includes(role)) return this.isSameDay(entryDate);
    return false;
  }

  private logAudit(tableName: string, recordId: string, action: 'INSERT' | 'UPDATE' | 'DELETE', oldData: any, newData: any) {
    const cid = this.getEffectiveCompanyId();
    const entry: AuditLogEntry = {
      id: Date.now(),
      company_id: cid,
      table_name: tableName,
      action,
      row_id: recordId,
      old_data: oldData,
      new_data: newData,
      user_id: this.currentSession?.user.id || null,
      at: new Date().toISOString(),
    };
    this.auditLog.unshift(entry);

    if (supabase) {
      supabase.from('audit_log').insert({
        company_id: cid,
        table_name: tableName,
        action,
        record_id: recordId,
        old_data: oldData,
        new_data: newData,
        performed_by: this.currentSession?.user.id || null,
      }).then(() => {});
    }
  }

  // Companies Management (Superadmin & Superstaff)
  public getCompanies(): Company[] {
    return this.companies;
  }

  public async createCompany(data: {
    code: string;
    name: string;
    valid_until: string;
    timezone?: string;
    currency?: string;
    owner_username?: string;
    owner_full_name?: string;
    owner_password?: string;
  }): Promise<{ success: boolean; company?: Company; error?: string }> {
    const codeUpper = data.code.trim().toUpperCase();
    if (this.companies.some((c) => c.code.toUpperCase() === codeUpper)) {
      return { success: false, error: 'Company code already exists.' };
    }

    const company: Company = {
      id: generateUUID(),
      code: codeUpper,
      name: data.name.trim(),
      valid_until: data.valid_until,
      active: true,
      timezone: data.timezone || 'Asia/Dubai',
      currency: data.currency || 'AED',
      created_at: new Date().toISOString(),
    };

    this.companies.unshift(company);

    // Initial settings for company
    const defSettings: CompanySettings = {
      company_id: company.id,
      work_types: ['Wash', 'Polish', 'Painting', 'Mechanical', 'Oil change', 'AC service', 'Detailing'],
      vehicle_types: ['Sedan', 'SUV', 'Hatchback', 'Pickup', 'Van', 'Sports', 'Bike'],
      expense_categories: ['Staff Salary', 'Rent', 'Utilities', 'Materials', 'Maintenance', 'Equipment', 'Staff Food', 'Transport', 'Other'],
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
    };
    this.settings[company.id] = defSettings;

    // Dispatch to Supabase
    if (supabase) {
      const { error: compErr } = await supabase.from('companies').insert({
        id: company.id,
        code: company.code,
        name: company.name,
        valid_until: company.valid_until,
        active: company.active,
        timezone: company.timezone,
        currency: company.currency,
      });

      if (compErr) {
        console.error('Supabase createCompany error:', compErr.message);
        return { success: false, error: compErr.message };
      }

      await supabase.from('company_settings').insert(defSettings);

      // Automatically create owner user in Supabase Auth & Profiles
      if (data.owner_username && data.owner_password) {
        await this.createCompanyUser({
          company_id: company.id,
          username: data.owner_username,
          full_name: data.owner_full_name || 'Company Owner',
          role: 'owner',
          password: data.owner_password,
        });
      }
    }

    return { success: true, company };
  }

  public setCompanyActive(id: string, active: boolean): { success: boolean; error?: string } {
    const comp = this.companies.find((c) => c.id === id);
    if (!comp) return { success: false, error: 'Company not found' };
    comp.active = active;

    if (supabase) {
      supabase.from('companies').update({ active }).eq('id', id).then(() => {});
    }
    return { success: true };
  }

  public setCompanySubscription(id: string, validUntil: string): { success: boolean; error?: string } {
    const comp = this.companies.find((c) => c.id === id);
    if (!comp) return { success: false, error: 'Company not found' };
    comp.valid_until = validUntil;

    if (supabase) {
      supabase.from('companies').update({ valid_until: validUntil }).eq('id', id).then(() => {});
    }
    return { success: true };
  }

  public async updateCompanyCurrency(companyId: string, currency: string): Promise<{ success: boolean; error?: string }> {
    const comp = this.companies.find((c) => c.id === companyId);
    if (!comp) return { success: false, error: 'Company not found' };
    const curUpper = currency.trim().toUpperCase() || 'AED';
    comp.currency = curUpper;

    if (this.currentSession?.company?.id === companyId) {
      this.currentSession.company.currency = curUpper;
      saveCachedSession(this.currentSession);
    }

    if (supabase) {
      const { error } = await supabase.from('companies').update({ currency: curUpper }).eq('id', companyId);
      if (error) {
        console.error('Supabase update currency error:', error.message);
        return { success: false, error: error.message };
      }
    }

    return { success: true };
  }

  public deleteCompany(id: string): { success: boolean; error?: string } {
    const idx = this.companies.findIndex((c) => c.id === id);
    if (idx === -1) return { success: false, error: 'Company not found' };
    this.companies.splice(idx, 1);

    if (supabase) {
      supabase.from('companies').delete().eq('id', id).then(() => {});
    }
    return { success: true };
  }

  public getCrossCompanySummaries(): Array<{
    company: Company;
    userCount: number;
    thisMonthRevenue: number;
    daysLeft: number;
    status: 'active' | 'suspended' | 'expired' | 'expiring_soon';
  }> {
    const today = new Date();
    const todayStr = getTodayString();
    const firstDayOfMonth = getFirstDayOfMonthString(today);

    return this.companies.map((company) => {
      const users = this.profiles.filter((p) => p.company_id === company.id && p.active);
      const mJobs = this.jobs.filter(
        (j) => j.company_id === company.id && j.entry_date >= firstDayOfMonth && j.entry_date <= todayStr
      );
      const thisMonthRevenue = Math.round(mJobs.reduce((sum, j) => sum + j.total, 0) * 100) / 100;

      const validD = new Date(company.valid_until);
      const daysLeft = Math.ceil((validD.getTime() - today.getTime()) / (1000 * 3600 * 24));

      let status: 'active' | 'suspended' | 'expired' | 'expiring_soon' = 'active';
      if (!company.active) {
        status = 'suspended';
      } else if (daysLeft < 0) {
        status = 'expired';
      } else if (daysLeft <= 7) {
        status = 'expiring_soon';
      }

      return {
        company,
        userCount: users.length,
        thisMonthRevenue,
        daysLeft,
        status,
      };
    });
  }

  public setSubscription(
    companyId: string,
    action: 'add_30_days' | 'toggle_active' | 'set_date',
    customDate?: string,
    active?: boolean
  ): { success: boolean; company?: Company; error?: string } {
    const company = this.companies.find((c) => c.id === companyId);
    if (!company) return { success: false, error: 'Company not found' };

    if (action === 'add_30_days') {
      const todayStr = getTodayString();
      const base = new Date(company.valid_until > todayStr ? company.valid_until : new Date());
      base.setDate(base.getDate() + 30);
      company.valid_until = getLocalDateString(base);
      company.active = true;
    } else if (action === 'toggle_active') {
      company.active = active !== undefined ? active : !company.active;
    } else if (action === 'set_date' && customDate) {
      company.valid_until = customDate;
      if (active !== undefined) company.active = active;
    }

    if (supabase) {
      supabase.from('companies').update({
        valid_until: company.valid_until,
        active: company.active,
      }).eq('id', companyId).then(() => {});
    }

    return { success: true, company };
  }

  public getSuperStaffList(): Profile[] {
    return this.profiles.filter((p) => p.role === 'superstaff');
  }

  public createSuperStaff(
    username: string,
    fullName: string,
    password?: string
  ): { success: boolean; profile?: Profile; error?: string } {
    const userClean = username.trim().toLowerCase();
    if (this.profiles.some((p) => p.role === 'superstaff' && p.username.toLowerCase() === userClean)) {
      return { success: false, error: 'Super Staff with this username already exists.' };
    }

    const profile: Profile = {
      id: generateUUID(),
      company_id: null,
      username: userClean,
      full_name: fullName.trim(),
      role: 'superstaff',
      pay_type: 'none',
      pay_rate: 0,
      active: true,
      created_at: new Date().toISOString(),
    };

    this.profiles.push(profile);
    this.logAudit('profiles', profile.id, 'INSERT', null, profile);

    if (supabase) {
      supabase.from('profiles').insert({
        id: profile.id,
        company_id: null,
        username: profile.username,
        full_name: profile.full_name,
        role: profile.role,
        pay_type: profile.pay_type,
        pay_rate: profile.pay_rate,
        active: profile.active,
      }).then(({ error }) => {
        if (error) console.error('Supabase createSuperStaff error:', error.message);
      });
    }

    return { success: true, profile };
  }

  public removeSuperStaff(userId: string): { success: boolean; error?: string } {
    const idx = this.profiles.findIndex((p) => p.id === userId && p.role === 'superstaff');
    if (idx === -1) return { success: false, error: 'Super Staff not found.' };

    const old = this.profiles[idx];
    this.profiles.splice(idx, 1);
    this.logAudit('profiles', userId, 'DELETE', old, null);

    if (supabase) {
      supabase.from('profiles').delete().eq('id', userId).then(() => {});
    }

    return { success: true };
  }

  // Profiles (Staff / Users)
  public getCompanyProfiles(companyId?: string): Profile[] {
    const cid = companyId || this.getEffectiveCompanyId();
    if (!cid) return [];
    return this.profiles.filter((p) => p.company_id === cid);
  }

  public async createCompanyUser(data: {
    id?: string;
    username: string;
    full_name: string;
    role: AppRole;
    pay_type?: 'none' | 'commission' | 'daily' | 'monthly';
    pay_rate?: number;
    password?: string;
    company_id?: string;
  }): Promise<{ success: boolean; profile?: Profile; error?: string }> {
    const cid = data.company_id || this.getEffectiveCompanyId();
    if (!cid) return { success: false, error: 'Company ID required' };

    const company = this.companies.find((c) => c.id === cid);
    const companyCode = company ? company.code : 'COMPANY';

    const usernameClean = data.username.trim().toLowerCase();
    if (this.profiles.some((p) => p.company_id === cid && p.username.toLowerCase() === usernameClean)) {
      return { success: false, error: 'Username already exists in this company.' };
    }

    const userId = data.id || generateUUID();
    const syntheticEmail = buildSyntheticEmail(usernameClean, companyCode);
    const password = data.password || 'TempPassword123!';

    if (supabase) {
      const { error: rpcErr } = await supabase.rpc('seed_user', {
        p_user_id: userId,
        p_email: syntheticEmail,
        p_password: password,
        p_company_id: cid,
        p_username: usernameClean,
        p_full_name: data.full_name.trim(),
        p_role: data.role,
        p_pay_type: data.pay_type || 'none',
        p_pay_rate: Number(data.pay_rate) || 0,
      });

      if (rpcErr) {
        console.error('Supabase seed_user RPC error:', rpcErr.message);
        return { success: false, error: rpcErr.message };
      }
    }

    const profile: Profile = {
      id: userId,
      company_id: cid,
      username: usernameClean,
      full_name: data.full_name.trim(),
      role: data.role,
      pay_type: data.pay_type || 'none',
      pay_rate: Number(data.pay_rate) || 0,
      active: true,
      created_at: new Date().toISOString(),
    };

    this.profiles.push(profile);
    this.logAudit('profiles', profile.id, 'INSERT', null, profile);

    return { success: true, profile };
  }

  public resetUserPassword(userId: string, newPass: string): { success: boolean; error?: string } {
    const p = this.profiles.find((x) => x.id === userId);
    if (!p) return { success: false, error: 'User not found' };
    this.logAudit('profiles', userId, 'UPDATE', { action: 'password_reset' }, { updated: true });
    return { success: true };
  }

  public toggleUserActive(userId: string): { success: boolean; profile?: Profile; error?: string } {
    const p = this.profiles.find((x) => x.id === userId);
    if (!p) return { success: false, error: 'User not found' };
    const old = { ...p };
    p.active = !p.active;
    this.logAudit('profiles', userId, 'UPDATE', old, p);

    if (supabase) {
      supabase.from('profiles').update({ active: p.active }).eq('id', userId).then(() => {});
    }
    return { success: true, profile: p };
  }

  public async updateStaffPayRate(
    staffId: string,
    payType: 'none' | 'commission' | 'daily' | 'monthly',
    payRate: number
  ): Promise<{ success: boolean; profile?: Profile; error?: string }> {
    const profile = this.profiles.find((x) => x.id === staffId);
    if (!profile) return { success: false, error: 'Staff profile not found' };

    // Point-in-Time Lock Guarantee:
    // Before updating the profile's rate, freeze and lock all existing jobs and attendance
    // entries for this staff member at their historical rate active right up to this moment!
    for (const job of this.jobs) {
      if (job.staff_id === staffId && job.commission_rate === undefined && profile.pay_type === 'commission') {
        job.commission_rate = Number(profile.pay_rate) || 0;
        job.commission_amount = Math.round((job.price * (job.commission_rate / 100)) * 100) / 100;
        this.saveJobRateCache(job.id, job.commission_rate, job.commission_amount);
      }
    }
    for (const att of this.attendance) {
      if (att.staff_id === staffId && att.daily_rate === undefined && profile.pay_type === 'daily' && att.status === 'present') {
        att.daily_rate = Number(profile.pay_rate) || 0;
        this.saveAttendanceRateCache(`${att.entry_date}_${att.staff_id}`, att.daily_rate);
      }
    }

    const old = { ...profile };
    profile.pay_type = payType;
    profile.pay_rate = Number(payRate) || 0;

    // Track historical pay change timeline
    if (!profile.pay_history) {
      profile.pay_history = [];
    }
    profile.pay_history.push({
      effective_date: getTodayString(),
      pay_type: old.pay_type,
      pay_rate: old.pay_rate,
    });

    this.logAudit('profiles', staffId, 'UPDATE', old, profile);

    if (supabase) {
      const { error } = await supabase
        .from('profiles')
        .update({
          pay_type: profile.pay_type,
          pay_rate: profile.pay_rate,
        })
        .eq('id', staffId);

      if (error) {
        console.error('Supabase updateStaffPayRate error:', error.message);
        return { success: false, error: error.message };
      }
    }

    return { success: true, profile };
  }

  // Customers
  public getCustomers(companyId?: string): Customer[] {
    const cid = companyId || this.getEffectiveCompanyId();
    if (!cid) return [];

    return this.customers
      .filter((c) => c.company_id === cid)
      .map((c) => {
        // Running balance = sum(unpaid customer jobs) - sum(customer_payments.amount)
        const jobDebits = this.jobs
          .filter((j) => j.customer_id === c.id && !j.is_paid)
          .reduce((sum, j) => sum + j.total, 0);

        const paymentCredits = this.customerPayments
          .filter((p) => p.customer_id === c.id)
          .reduce((sum, p) => sum + p.amount, 0);

        const current_balance = Math.round((jobDebits - paymentCredits) * 100) / 100;
        let status: 'ok' | 'near_limit' | 'over_limit' = 'ok';

        if (c.credit_limit > 0) {
          const ratio = current_balance / c.credit_limit;
          if (current_balance > c.credit_limit) {
            status = 'over_limit';
          } else if (ratio >= 0.8) {
            status = 'near_limit';
          }
        }

        return {
          ...c,
          current_balance,
          status,
        };
      });
  }

  public addCustomer(data: {
    name: string;
    mobile?: string;
    credit_limit?: number;
    company_id?: string;
  }): { success: boolean; customer?: Customer; error?: string } {
    const cid = data.company_id || this.getEffectiveCompanyId();
    if (!cid) return { success: false, error: 'Company ID required' };

    const customer: Customer = {
      id: generateUUID(),
      company_id: cid,
      name: data.name.trim(),
      mobile: data.mobile?.trim() || null,
      credit_limit: Number(data.credit_limit) || 0,
      created_at: new Date().toISOString(),
    };

    this.customers.unshift(customer);
    this.logAudit('customers', customer.id, 'INSERT', null, customer);

    if (supabase) {
      supabase.from('customers').insert({
        id: customer.id,
        company_id: customer.company_id,
        name: customer.name,
        mobile: customer.mobile,
        credit_limit: customer.credit_limit,
      }).then(({ error }) => {
        if (error) console.error('Supabase customer insert error:', error.message);
      });
    }

    return { success: true, customer };
  }

  public updateCustomer(
    id: string,
    data: { name?: string; mobile?: string; credit_limit?: number }
  ): { success: boolean; customer?: Customer; error?: string } {
    const cust = this.customers.find((c) => c.id === id);
    if (!cust) return { success: false, error: 'Customer not found' };

    const old = { ...cust };
    if (data.name !== undefined) cust.name = data.name.trim();
    if (data.mobile !== undefined) cust.mobile = data.mobile.trim() || null;
    if (data.credit_limit !== undefined) cust.credit_limit = Number(data.credit_limit) || 0;

    this.logAudit('customers', id, 'UPDATE', old, cust);

    if (supabase) {
      supabase.from('customers').update({
        name: cust.name,
        mobile: cust.mobile,
        credit_limit: cust.credit_limit,
      }).eq('id', id).then(() => {});
    }

    return { success: true, customer: cust };
  }

  public deleteCustomer(id: string): { success: boolean; error?: string } {
    const hasJobs = this.jobs.some((j) => j.customer_id === id);
    if (hasJobs) {
      return { success: false, error: 'Cannot delete customer with existing jobs history.' };
    }

    const idx = this.customers.findIndex((c) => c.id === id);
    if (idx === -1) return { success: false, error: 'Customer not found' };

    const old = this.customers[idx];
    this.customers.splice(idx, 1);
    this.logAudit('customers', id, 'DELETE', old, null);

    if (supabase) {
      supabase.from('customers').delete().eq('id', id).then(() => {});
    }

    return { success: true };
  }

  public getCustomerStatement(
    customerId: string,
    startDate?: string,
    endDate?: string
  ): {
    customer: Customer;
    startDate?: string;
    endDate?: string;
    opening_balance: number;
    total_billed: number;
    total_paid: number;
    pending_amount: number;
    closing_balance: number;
    items: Array<{
      id: string;
      type: 'service' | 'payment';
      date: string;
      ref_no: string;
      description: string;
      vehicle_plate?: string;
      vehicle_type?: string;
      work_type?: string;
      debit: number;
      credit: number;
      balance: number;
      is_paid?: boolean;
      payment_note?: string;
    }>;
  } | null {
    const cust = this.customers.find((c) => c.id === customerId);
    if (!cust) return null;

    const allCustJobs = this.jobs.filter((j) => j.customer_id === customerId);
    const allCustPayments = this.customerPayments.filter((p) => p.customer_id === customerId);

    const jobs = allCustJobs.map((j) => {
      const isPaid = Boolean(j.is_paid);
      return {
        id: j.id,
        type: 'service' as const,
        date: j.entry_date,
        createdAt: j.created_at || j.entry_date,
        ref_no: `INV-${j.entry_date.replace(/-/g, '')}-${j.id.slice(0, 5).toUpperCase()}`,
        description: `${j.work_type} (${j.plate || 'No plate'})${isPaid ? ' [✓ Paid at Counter]' : ' [Unpaid Credit]'}`,
        vehicle_plate: j.plate || undefined,
        vehicle_type: j.vehicle_type,
        work_type: j.work_type,
        debit: j.total,
        credit: isPaid ? j.total : 0,
        is_paid: isPaid,
        payment_note: undefined as string | undefined,
      };
    });

    const payments = allCustPayments.map((p) => ({
      id: p.id,
      type: 'payment' as const,
      date: p.entry_date,
      createdAt: p.created_at || p.entry_date,
      ref_no: `PAY-${p.entry_date.replace(/-/g, '')}-${p.id.slice(0, 5).toUpperCase()}`,
      description: `Payment received: ${p.note || 'Cash/Card Transfer'}`,
      vehicle_plate: undefined,
      vehicle_type: undefined,
      work_type: undefined,
      debit: 0,
      credit: p.amount,
      is_paid: true,
      payment_note: p.note || undefined,
    }));

    const combined = [...jobs, ...payments].sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return a.createdAt.localeCompare(b.createdAt);
    });

    // Opening balance calculation (all transactions before startDate)
    let opening_balance = 0;
    const priorItems = startDate ? combined.filter((i) => i.date < startDate) : [];
    for (const item of priorItems) {
      opening_balance += item.debit - item.credit;
    }
    opening_balance = Math.round(opening_balance * 100) / 100;

    // Filter items within date range
    const inRangeItems = combined.filter((i) => {
      if (startDate && i.date < startDate) return false;
      if (endDate && i.date > endDate) return false;
      return true;
    });

    let running = opening_balance;
    let total_billed = 0;
    let total_paid = 0;

    const items = inRangeItems.map((item) => {
      running += item.debit - item.credit;
      total_billed += item.debit;
      total_paid += item.credit;
      return {
        id: item.id,
        type: item.type,
        date: item.date,
        ref_no: item.ref_no,
        description: item.description,
        vehicle_plate: item.vehicle_plate,
        vehicle_type: item.vehicle_type,
        work_type: item.work_type,
        debit: item.debit,
        credit: item.credit,
        balance: Math.round(running * 100) / 100,
        is_paid: item.is_paid,
        payment_note: item.payment_note,
      };
    });

    // Total lifetime running balance for customer
    let lifetimeBalance = 0;
    for (const item of combined) {
      lifetimeBalance += item.debit - item.credit;
    }
    const closing_balance = Math.round(running * 100) / 100;

    return {
      customer: {
        ...cust,
        current_balance: Math.round(lifetimeBalance * 100) / 100,
      },
      startDate,
      endDate,
      opening_balance,
      total_billed: Math.round(total_billed * 100) / 100,
      total_paid: Math.round(total_paid * 100) / 100,
      pending_amount: Math.round(Math.max(0, closing_balance) * 100) / 100,
      closing_balance,
      items,
    };
  }

  // Jobs (Vehicles)
  public getJobs(date?: string, companyId?: string): Job[] {
    const cid = companyId || this.getEffectiveCompanyId();
    if (!cid) return [];

    let list = this.jobs.filter((j) => j.company_id === cid);
    if (date) {
      list = list.filter((j) => j.entry_date === date);
    }

    return list.map((j) => {
      const staff = this.profiles.find((p) => p.id === j.staff_id);
      const cust = j.customer_id ? this.customers.find((c) => c.id === j.customer_id) : null;
      return {
        ...j,
        staff_name: staff?.full_name || 'Staff',
        customer_name: cust?.name,
      };
    });
  }

  public getDailyCashAdjustments(date: string, companyId?: string): DailyCashAdjustment[] {
    const cid = companyId || this.getEffectiveCompanyId();
    if (!cid) return [];
    return this.cashAdjustments.filter((a) => a.company_id === cid && a.entry_date === date);
  }

  public addDailyCashAdjustment(
    date: string,
    amount: number,
    note?: string,
    companyId?: string
  ): { success: boolean; error?: string } {
    const cid = companyId || this.getEffectiveCompanyId();
    if (!cid) return { success: false, error: 'Company ID required' };
    
    const adj: DailyCashAdjustment = {
      id: generateUUID(),
      company_id: cid,
      entry_date: date,
      amount,
      note,
      created_by: this.currentSession?.user.id,
      created_at: new Date().toISOString()
    };
    
    this.cashAdjustments.unshift(adj);
    
    if (supabase) {
      supabase.from('daily_cash_adjustments').insert(adj).then(({ error }) => {
        if (error) console.error('Error adding daily cash adjustment:', error);
      });
    }
    
    return { success: true };
  }

  public deleteDailyCashAdjustment(id: string): { success: boolean; error?: string } {
    this.cashAdjustments = this.cashAdjustments.filter(a => a.id !== id);
    if (supabase) {
      supabase.from('daily_cash_adjustments').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Error deleting daily cash adjustment:', error);
      });
    }
    return { success: true };
  }

  public addJob(data: {
    entry_date: string;
    plate?: string;
    mobile?: string;
    work_type: string;
    vehicle_type: string;
    staff_id: string;
    price: number;
    extra_amount?: number;
    customer_id?: string | null;
    is_paid?: boolean;
    company_id?: string;
  }): { success: boolean; job?: Job; error?: string } {
    const cid = data.company_id || this.getEffectiveCompanyId();
    if (!cid) return { success: false, error: 'Company ID required' };

    if (!this.canAdd(data.entry_date)) {
      return { success: false, error: 'Records for past days can only be added by the Owner.' };
    }

    const price = Number(data.price) || 0;
    const extra = Number(data.extra_amount) || 0;
    const total = price + extra;
    const isPaid = data.is_paid !== undefined ? Boolean(data.is_paid) : (data.customer_id ? false : true);

    const staff = this.profiles.find((p) => p.id === data.staff_id);
    const commRate = staff && staff.pay_type === 'commission' ? Number(staff.pay_rate) || 0 : undefined;
    const commAmount = commRate !== undefined ? Math.round(price * (commRate / 100) * 100) / 100 : undefined;

    const job: Job = {
      id: generateUUID(),
      company_id: cid,
      entry_date: data.entry_date,
      plate: data.plate?.trim() || null,
      mobile: data.mobile?.trim() || null,
      work_type: data.work_type,
      vehicle_type: data.vehicle_type,
      staff_id: data.staff_id,
      price,
      extra_amount: extra,
      total,
      customer_id: data.customer_id || null,
      is_paid: isPaid,
      commission_rate: commRate,
      commission_amount: commAmount,
      created_by: this.currentSession?.user.id || '',
      created_at: new Date().toISOString(),
    };

    if (commRate !== undefined && commAmount !== undefined) {
      this.saveJobRateCache(job.id, commRate, commAmount);
    }

    this.jobs.unshift(job);
    this.logAudit('jobs', job.id, 'INSERT', null, job);

    if (supabase) {
      supabase.from('jobs').insert({
        id: job.id,
        company_id: job.company_id,
        entry_date: job.entry_date,
        plate: job.plate,
        mobile: job.mobile,
        work_type: job.work_type,
        vehicle_type: job.vehicle_type,
        staff_id: job.staff_id,
        price: job.price,
        extra_amount: job.extra_amount,
        commission_rate: job.commission_rate,
        commission_amount: job.commission_amount,
        customer_id: job.customer_id,
        is_paid: job.is_paid,
        created_by: job.created_by,
      }).then(({ error }) => {
        if (error) {
          console.error('Supabase job insert error:', error.message);
          this.jobs = this.jobs.filter((j) => j.id !== job.id);
          this.dispatchSyncError(`Failed to save job (Sync Error): ${error.message}`);
        }
      });
    }

    return { success: true, job };
  }

  public updateJob(
    id: string,
    data: {
      plate?: string;
      mobile?: string;
      work_type: string;
      vehicle_type: string;
      staff_id: string;
      price: number;
      extra_amount?: number;
      is_paid?: boolean;
      customer_id?: string | null;
      entry_date?: string;
      photo_url?: string;
    }
  ): { success: boolean; job?: Job; error?: string } {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) return { success: false, error: 'Job not found' };

    if (!this.canEdit(job.entry_date)) {
      return { success: false, error: 'You cannot edit records from previous days.' };
    }

    const old = { ...job };
    const price = Number(data.price) || 0;
    const extra = Number(data.extra_amount) || 0;

    const callerRole = this.currentSession?.profile.role;
    if (data.entry_date && data.entry_date !== job.entry_date) {
      if (!['superadmin', 'superstaff', 'owner'].includes(callerRole || '')) {
        return { success: false, error: 'Non-owners cannot change entry_date.' };
      }
      job.entry_date = data.entry_date;
    }

    job.plate = data.plate?.trim() || null;
    job.mobile = data.mobile?.trim() || null;
    job.work_type = data.work_type;
    job.vehicle_type = data.vehicle_type;
    job.staff_id = data.staff_id;
    job.price = price;
    job.extra_amount = extra;
    job.total = price + extra;
    job.customer_id = data.customer_id || null;
    job.is_paid = data.is_paid !== undefined ? Boolean(data.is_paid) : (data.customer_id ? false : true);
    if (data.photo_url !== undefined) {
      job.photo_url = data.photo_url;
    }

    // Point-in-Time Lock Guarantee:
    // If the staff member didn't change, strictly preserve the locked commission_rate from that moment!
    // Even if price changes, recalculate using the locked historical rate on TOTAL amount, never the staff's current rate.
    const staffChanged = data.staff_id !== old.staff_id;
    if (staffChanged) {
      const newStaff = this.profiles.find((p) => p.id === data.staff_id);
      if (newStaff && newStaff.pay_type === 'commission') {
        job.commission_rate = Number(newStaff.pay_rate) || 0;
        job.commission_amount = Math.round(job.price * (job.commission_rate / 100) * 100) / 100;
        this.saveJobRateCache(job.id, job.commission_rate, job.commission_amount);
      } else {
        job.commission_rate = undefined;
        job.commission_amount = undefined;
      }
    } else {
      if (job.commission_rate !== undefined) {
        job.commission_amount = Math.round(job.price * (job.commission_rate / 100) * 100) / 100;
        this.saveJobRateCache(job.id, job.commission_rate, job.commission_amount);
      } else {
        const staff = this.profiles.find((p) => p.id === data.staff_id);
        if (staff && staff.pay_type === 'commission') {
          job.commission_rate = Number(staff.pay_rate) || 0;
          job.commission_amount = Math.round(job.price * (job.commission_rate / 100) * 100) / 100;
          this.saveJobRateCache(job.id, job.commission_rate, job.commission_amount);
        }
      }
    }

    this.logAudit('jobs', job.id, 'UPDATE', old, job);

    if (supabase) {
      supabase.from('jobs').update({
        plate: job.plate,
        mobile: job.mobile,
        work_type: job.work_type,
        vehicle_type: job.vehicle_type,
        staff_id: job.staff_id,
        price: job.price,
        extra_amount: job.extra_amount,
        commission_rate: job.commission_rate,
        commission_amount: job.commission_amount,
        customer_id: job.customer_id,
        is_paid: job.is_paid,
        entry_date: job.entry_date,
        photo_url: job.photo_url,
      }).eq('id', id).then(({ error }) => {
        if (error) {
          console.error('Supabase job update error:', error.message);
          Object.assign(job, old);
          this.dispatchSyncError(`Failed to update job (Sync Error): ${error.message}`);
        }
      });
    }

    return { success: true, job };
  }

  public async toggleJobPayment(
    id: string,
    forceLocal = false
  ): Promise<{ success: boolean; job?: Job; error?: string; isConstraintError?: boolean; sqlFix?: string }> {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) return { success: false, error: 'Job not found' };

    const old = { ...job };
    job.is_paid = !job.is_paid;

    this.logAudit('jobs', job.id, 'UPDATE', old, job);

    if (supabase && !forceLocal) {
      const { error } = await supabase.from('jobs').update({ is_paid: job.is_paid }).eq('id', id);
      if (error) {
        console.error('Supabase toggleJobPayment error:', error.message);
        const isConstraint =
          error.code === '23514' ||
          error.message.includes('jobs_check') ||
          error.message.includes('jobs_customer_id_check') ||
          error.message.includes('check constraint');
        let errMsg = error.message;
        if (isConstraint) {
          errMsg = 'Database constraint "jobs_check" blocked this. Run in Supabase SQL Editor: ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_check;';
        }
        job.is_paid = old.is_paid;
        return {
          success: false,
          error: errMsg,
          isConstraintError: isConstraint,
          sqlFix:
            'ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_check;\nALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_customer_id_check;',
        };
      }
    }

    return { success: true, job };
  }

  public async setJobPaymentStatus(
    id: string,
    isPaid: boolean,
    forceLocal = false
  ): Promise<{ success: boolean; job?: Job; error?: string; isConstraintError?: boolean; sqlFix?: string }> {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) return { success: false, error: 'Job not found' };

    const old = { ...job };
    job.is_paid = isPaid;

    this.logAudit('jobs', job.id, 'UPDATE', old, job);

    if (supabase && !forceLocal) {
      const { error } = await supabase.from('jobs').update({ is_paid: job.is_paid }).eq('id', id);
      if (error) {
        console.error('Supabase setJobPaymentStatus error:', error.message);
        const isConstraint =
          error.code === '23514' ||
          error.message.includes('jobs_check') ||
          error.message.includes('jobs_customer_id_check') ||
          error.message.includes('check constraint');
        let errMsg = error.message;
        if (isConstraint) {
          errMsg = 'Database constraint "jobs_check" blocked this. Run in Supabase SQL Editor: ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_check;';
        }
        job.is_paid = old.is_paid;
        job.payment_date = old.payment_date;
        return {
          success: false,
          error: errMsg,
          isConstraintError: isConstraint,
          sqlFix:
            'ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_check;\nALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_customer_id_check;',
        };
      }
    }

    return { success: true, job };
  }

  public getCustomerPendingJobs(customerId: string): Job[] {
    return this.jobs.filter((j) => j.customer_id === customerId && !j.is_paid);
  }

  public async settleCustomerJobs(customerId: string, jobIds?: string[]): Promise<{ success: boolean; count: number; error?: string }> {
    const targetJobs = this.jobs.filter(
      (j) => j.customer_id === customerId && !j.is_paid && (!jobIds || jobIds.includes(j.id))
    );

    if (targetJobs.length === 0) {
      return { success: true, count: 0 };
    }

    let successCount = 0;
    for (const j of targetJobs) {
      const res = await this.setJobPaymentStatus(j.id, true);
      if (res.success) {
        successCount++;
      } else {
        return { success: false, count: successCount, error: res.error };
      }
    }

    return { success: true, count: successCount };
  }

  public deleteJob(id: string): { success: boolean; error?: string } {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) return { success: false, error: 'Job not found' };

    if (!this.canDeleteJob(job.entry_date)) {
      return { success: false, error: 'You do not have permission to delete this vehicle record.' };
    }

    const idx = this.jobs.findIndex((j) => j.id === id);
    const old = this.jobs[idx];
    this.jobs.splice(idx, 1);
    this.logAudit('jobs', id, 'DELETE', old, null);

    if (supabase) {
      supabase.from('jobs').delete().eq('id', id).then(({ error }) => {
        if (error) {
          console.error('Supabase job delete error:', error.message);
          this.jobs.splice(idx, 0, old);
          this.dispatchSyncError(`Failed to delete job (Sync Error): ${error.message}`);
        }
      });
    }

    return { success: true };
  }

  // Expenses
  public getExpenses(date?: string, companyId?: string): Expense[] {
    const cid = companyId || this.getEffectiveCompanyId();
    if (!cid) return [];
    let list = this.expenses.filter((e) => e.company_id === cid);
    if (date) {
      list = list.filter((e) => e.entry_date === date);
    }
    return list;
  }

  public addExpense(data: {
    entry_date: string;
    category: string;
    description?: string;
    amount: number;
    company_id?: string;
  }): { success: boolean; expense?: Expense; error?: string } {
    const cid = data.company_id || this.getEffectiveCompanyId();
    if (!cid) return { success: false, error: 'Company ID required' };

    if (!this.canAdd(data.entry_date)) {
      return { success: false, error: 'Expenses for past days can only be recorded by the Owner.' };
    }

    const expense: Expense = {
      id: generateUUID(),
      company_id: cid,
      entry_date: data.entry_date,
      category: data.category,
      description: data.description?.trim() || null,
      amount: Number(data.amount) || 0,
      created_by: this.currentSession?.user.id,
      created_at: new Date().toISOString(),
    };
    this.expenses.unshift(expense);
    this.logAudit('expenses', expense.id, 'INSERT', null, expense);

    if (supabase) {
      supabase.from('expenses').insert({
        id: expense.id,
        company_id: expense.company_id,
        entry_date: expense.entry_date,
        category: expense.category,
        description: expense.description,
        amount: expense.amount,
        created_by: expense.created_by,
      }).then(({ error }) => {
        if (error) console.error('Supabase expense insert error:', error.message);
      });
    }

    return { success: true, expense };
  }

  public recordSalaryPayment(data: {
    staff_id: string;
    entry_date: string;
    amount: number;
    payment_method?: 'cash' | 'bank' | 'card';
    note?: string;
    company_id?: string;
  }): { success: boolean; expense?: Expense; error?: string } {
    const staff = this.profiles.find((p) => p.id === data.staff_id);
    const staffName = staff ? staff.full_name : 'Staff';
    const method = (data.payment_method || 'cash').toUpperCase();
    const desc = `Salary Payout: ${staffName} (${method}) [STAFF:${data.staff_id}]${data.note ? ' - ' + data.note : ''}`;

    return this.addExpense({
      entry_date: data.entry_date,
      category: 'Staff Salary',
      description: desc,
      amount: data.amount,
      company_id: data.company_id,
    });
  }

  public deleteExpense(id: string): { success: boolean; error?: string } {
    const expense = this.expenses.find((e) => e.id === id);
    if (!expense) return { success: false, error: 'Expense not found' };

    if (!this.canDeleteFinancial(expense.entry_date)) {
      return { success: false, error: 'You do not have permission to delete this expense.' };
    }

    const idx = this.expenses.findIndex((e) => e.id === id);
    const old = this.expenses[idx];
    this.expenses.splice(idx, 1);
    this.logAudit('expenses', id, 'DELETE', old, null);

    if (supabase) {
      supabase.from('expenses').delete().eq('id', id).then(() => {});
    }

    return { success: true };
  }

  // Staff Salary Advances
  public getAdvances(companyId?: string): Advance[] {
    const cid = companyId || this.getEffectiveCompanyId();
    if (!cid) return [];

    return this.advances
      .filter((a) => a.company_id === cid)
      .map((a) => {
        const staff = this.profiles.find((p) => p.id === a.staff_id);
        return {
          ...a,
          staff_name: staff?.full_name || 'Staff',
        };
      });
  }

  public addAdvance(data: {
    entry_date: string;
    staff_id: string;
    amount: number;
    note?: string;
    company_id?: string;
  }): { success: boolean; advance?: Advance; error?: string } {
    const cid = data.company_id || this.getEffectiveCompanyId();
    if (!cid) return { success: false, error: 'Company ID required' };

    if (!this.canAdd(data.entry_date)) {
      return { success: false, error: 'Advances for past days can only be recorded by the Owner.' };
    }

    const advance: Advance = {
      id: generateUUID(),
      company_id: cid,
      entry_date: data.entry_date,
      staff_id: data.staff_id,
      amount: Number(data.amount) || 0,
      note: data.note?.trim() || null,
      created_by: this.currentSession?.user.id,
      created_at: new Date().toISOString(),
    };

    this.advances.unshift(advance);
    this.logAudit('advances', advance.id, 'INSERT', null, advance);

    if (supabase) {
      supabase.from('advances').insert({
        id: advance.id,
        company_id: advance.company_id,
        entry_date: advance.entry_date,
        staff_id: advance.staff_id,
        amount: advance.amount,
        note: advance.note,
        created_by: advance.created_by,
      }).then(({ error }) => {
        if (error) console.error('Supabase advance insert error:', error.message);
      });
    }

    return { success: true, advance };
  }

  public deleteAdvance(id: string): { success: boolean; error?: string } {
    const advance = this.advances.find((a) => a.id === id);
    if (!advance) return { success: false, error: 'Advance not found' };

    if (!this.canDeleteFinancial(advance.entry_date)) {
      return { success: false, error: 'You do not have permission to delete this advance.' };
    }

    const idx = this.advances.findIndex((a) => a.id === id);
    const old = this.advances[idx];
    this.advances.splice(idx, 1);
    this.logAudit('advances', id, 'DELETE', old, null);

    if (supabase) {
      supabase.from('advances').delete().eq('id', id).then(() => {});
    }

    return { success: true };
  }

  // Attendance
  public getAttendance(date: string, companyId?: string): Attendance[] {
    const cid = companyId || this.getEffectiveCompanyId();
    if (!cid) return [];

    return this.attendance
      .filter((a) => a.company_id === cid && a.entry_date === date)
      .map((a) => {
        const staff = this.profiles.find((p) => p.id === a.staff_id);
        return {
          ...a,
          staff_name: staff?.full_name || 'Staff',
          daily_rate: a.daily_rate !== undefined ? a.daily_rate : (staff?.pay_type === 'daily' ? staff.pay_rate : undefined),
        };
      });
  }

  public getAttendanceRange(
    startDate: string,
    endDate: string,
    staffId?: string,
    companyId?: string
  ): Attendance[] {
    const cid = companyId || this.getEffectiveCompanyId();
    if (!cid) return [];

    return this.attendance
      .filter((a) => {
        if (a.company_id !== cid) return false;
        if (a.entry_date < startDate || a.entry_date > endDate) return false;
        if (staffId && staffId !== 'all' && a.staff_id !== staffId) return false;
        return true;
      })
      .map((a) => {
        const staff = this.profiles.find((p) => p.id === a.staff_id);
        return {
          ...a,
          staff_name: staff?.full_name || 'Staff',
          daily_rate: a.daily_rate !== undefined ? a.daily_rate : (staff?.pay_type === 'daily' ? staff.pay_rate : undefined),
        };
      })
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  }

  public getStaffAttendanceSummary(
    startDate: string,
    endDate: string,
    staffId?: string,
    companyId?: string
  ): Array<{
    staff_id: string;
    full_name: string;
    username: string;
    role: string;
    pay_type: string;
    pay_rate: number;
    totalDays: number;
    presentDays: number;
    leaveDays: number;
    unmarkedDays: number;
    attendanceRate: number;
    totalDailyWage: number;
    records: Attendance[];
  }> {
    const cid = companyId || this.getEffectiveCompanyId();
    if (!cid) return [];

    const activeStaff = this.profiles
      .filter((p) => p.company_id === cid && p.active)
      .filter((p) => !staffId || staffId === 'all' || p.id === staffId);

    const d1 = new Date(startDate);
    const d2 = new Date(endDate);
    const diffTime = Math.max(0, d2.getTime() - d1.getTime());
    const totalDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

    return activeStaff.map((staff) => {
      const records = this.attendance.filter(
        (a) => a.company_id === cid && a.staff_id === staff.id && a.entry_date >= startDate && a.entry_date <= endDate
      );

      const presentRecords = records.filter((r) => r.status === 'present');
      const presentDays = presentRecords.length;
      const leaveDays = records.filter((r) => r.status === 'leave').length;
      const unmarkedDays = Math.max(0, totalDays - presentDays - leaveDays);
      const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

      let totalDailyWage = 0;
      if (staff.pay_type === 'daily') {
        totalDailyWage = presentRecords.reduce((sum, r) => {
          const rate = r.daily_rate !== undefined ? r.daily_rate : (Number(staff.pay_rate) || 0);
          return sum + rate;
        }, 0);
      }

      return {
        staff_id: staff.id,
        full_name: staff.full_name,
        username: staff.username,
        role: staff.role,
        pay_type: staff.pay_type,
        pay_rate: staff.pay_rate,
        totalDays,
        presentDays,
        leaveDays,
        unmarkedDays,
        attendanceRate,
        totalDailyWage,
        records: records.sort((a, b) => b.entry_date.localeCompare(a.entry_date)),
      };
    });
  }

  public markAttendance(
    staffId: string,
    date: string,
    status: 'present' | 'leave',
    dailyRate?: number,
    companyId?: string
  ): { success: boolean; attendance?: Attendance; error?: string } {
    const cid = companyId || this.getEffectiveCompanyId();
    if (!cid) return { success: false, error: 'Company ID required' };

    if (!this.canAdd(date)) {
      return { success: false, error: 'Attendance for past days can only be recorded by the Owner.' };
    }

    const staff = this.profiles.find((p) => p.id === staffId);
    const existingIdx = this.attendance.findIndex((a) => a.staff_id === staffId && a.entry_date === date);

    if (existingIdx !== -1) {
      const existing = this.attendance[existingIdx];
      const old = { ...existing };
      existing.status = status;

      // Point-in-Time Lock Guarantee:
      // If caller provided an explicit dailyRate override, apply it;
      // otherwise PRESERVE the existing historical daily_rate so old entries never change unexpectedly!
      if (dailyRate !== undefined) {
        existing.daily_rate = dailyRate;
        this.saveAttendanceRateCache(`${date}_${staffId}`, dailyRate);
      } else if (existing.daily_rate === undefined && staff?.pay_type === 'daily') {
        existing.daily_rate = Number(staff.pay_rate) || 0;
        this.saveAttendanceRateCache(`${date}_${staffId}`, existing.daily_rate);
      }

      this.logAudit('attendance', existing.id, 'UPDATE', old, existing);

      if (supabase) {
        supabase.from('attendance').update({ status }).eq('id', existing.id).then(() => {});
      }

      return { success: true, attendance: existing };
    }

    const resolvedRate = dailyRate !== undefined
      ? dailyRate
      : (staff?.pay_type === 'daily' ? Number(staff.pay_rate) || 0 : undefined);

    if (resolvedRate !== undefined) {
      this.saveAttendanceRateCache(`${date}_${staffId}`, resolvedRate);
    }

    const att: Attendance = {
      id: generateUUID(),
      company_id: cid,
      entry_date: date,
      staff_id: staffId,
      status,
      daily_rate: resolvedRate,
      created_at: new Date().toISOString(),
    };
    this.attendance.push(att);
    this.logAudit('attendance', att.id, 'INSERT', null, att);

    if (supabase) {
      supabase.from('attendance').insert({
        id: att.id,
        company_id: att.company_id,
        entry_date: att.entry_date,
        staff_id: att.staff_id,
        status: att.status,
      }).then(({ error }) => {
        if (error) console.error('Supabase attendance insert error:', error.message);
      });
    }

    return { success: true, attendance: att };
  }

  public markAllPresent(date: string, companyId?: string): { success: boolean; count?: number; error?: string } {
    const cid = companyId || this.getEffectiveCompanyId();
    if (!cid) return { success: false, error: 'Company ID required' };

    if (!this.canAdd(date)) {
      return { success: false, error: 'Attendance for past days can only be recorded by the Owner.' };
    }

    const staffList = this.getCompanyProfiles(cid).filter((p) => p.active);
    let count = 0;

    for (const staff of staffList) {
      this.markAttendance(staff.id, date, 'present', undefined, cid);
      count++;
    }

    return { success: true, count };
  }

  // Customer Payments
  public recordCustomerPayment(data: {
    customer_id: string;
    entry_date: string;
    amount: number;
    note?: string;
    company_id?: string;
  }): { success: boolean; payment?: CustomerPayment; error?: string } {
    const cid = data.company_id || this.getEffectiveCompanyId();
    if (!cid) return { success: false, error: 'Company ID required' };

    const payment: CustomerPayment = {
      id: generateUUID(),
      company_id: cid,
      entry_date: data.entry_date,
      customer_id: data.customer_id,
      amount: Number(data.amount) || 0,
      note: data.note?.trim() || null,
      created_by: this.currentSession?.user.id,
      created_at: new Date().toISOString(),
    };

    this.customerPayments.unshift(payment);
    this.logAudit('customer_payments', payment.id, 'INSERT', null, payment);

    if (supabase) {
      supabase.from('customer_payments').insert({
        id: payment.id,
        company_id: payment.company_id,
        entry_date: payment.entry_date,
        customer_id: payment.customer_id,
        amount: payment.amount,
        note: payment.note,
        created_by: payment.created_by,
      }).then(({ error }) => {
        if (error) console.error('Supabase customer payment insert error:', error.message);
      });
    }

    return { success: true, payment };
  }

  // Company Settings
  public getSettings(companyId?: string): CompanySettings {
    const cid = companyId || this.getEffectiveCompanyId();
    const fallback: CompanySettings = {
      company_id: cid || 'default',
      work_types: ['Wash', 'Polish', 'Painting', 'Mechanical', 'Oil change', 'AC service', 'Other'],
      vehicle_types: ['Sedan', 'SUV', 'Hatchback', 'Pickup', 'Van', 'Bike'],
      expense_categories: ['Rent', 'Utilities', 'Materials', 'Transport', 'Maintenance', 'Food', 'Other'],
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
    };

    if (!cid || !this.settings[cid]) {
      return fallback;
    }
    return this.settings[cid];
  }

  public updateSettings(
    data: Partial<Omit<CompanySettings, 'company_id'>>,
    companyId?: string
  ): { success: boolean; settings?: CompanySettings; error?: string } {
    const cid = companyId || this.getEffectiveCompanyId();
    if (!cid) return { success: false, error: 'Company ID required' };

    const current = this.getSettings(cid);
    const updated: CompanySettings = {
      ...current,
      ...data,
      company_id: cid,
    };
    this.settings[cid] = updated;
    this.logAudit('company_settings', cid, 'UPDATE', current, updated);

    if (supabase) {
      supabase.from('company_settings').upsert({
        company_id: cid,
        work_types: updated.work_types,
        vehicle_types: updated.vehicle_types,
        expense_categories: updated.expense_categories,
        thresholds: updated.thresholds,
        monthly_fixed_costs: updated.monthly_fixed_costs,
        monthly_rent: updated.monthly_rent,
        weekly_fixed_costs: updated.weekly_fixed_costs,
        daily_fixed_costs: updated.daily_fixed_costs,
      }).then(() => {});
    }

    return { success: true, settings: updated };
  }

  // Audit Logs
  public getAuditLogs(companyId?: string): AuditLogEntry[] {
    const cid = companyId || this.getEffectiveCompanyId();
    if (!cid) return [];

    return this.auditLog.filter((a) => !a.company_id || a.company_id === cid);
  }

  // Comprehensive Reports Engine (§7 & §8)
  public getCompanyReport(startDate: string, endDate: string, companyId?: string): ReportData {
    const cid = companyId || this.getEffectiveCompanyId();
    if (!cid) {
      throw new Error('Company ID required for report');
    }

    const company = this.companies.find((c) => c.id === cid);
    const settings = this.getSettings(cid);
    const th = settings.thresholds;

    // Filter period jobs
    const pJobs = this.jobs.filter((j) => j.company_id === cid && j.entry_date >= startDate && j.entry_date <= endDate);

    const revenue = pJobs.reduce((sum, j) => sum + j.total, 0);
    const baseAmount = pJobs.reduce((sum, j) => sum + (j.price || 0), 0);
    const extraAmount = pJobs.reduce((sum, j) => sum + (j.extra_amount || 0), 0);
    const collected = pJobs.filter((j) => j.is_paid).reduce((sum, j) => sum + j.total, 0);
    const unpaid = revenue - collected;
    const totalVehicles = pJobs.length;

    // Previous Period calculation
    const startD = new Date(startDate);
    const endD = new Date(endDate);
    const periodDays = Math.max(1, Math.round((endD.getTime() - startD.getTime()) / (1000 * 3600 * 24)) + 1);

    const prevEnd = new Date(startD.getTime() - 86400000);
    const prevStart = new Date(prevEnd.getTime() - (periodDays - 1) * 86400000);
    const prevStartStr = getLocalDateString(prevStart);
    const prevEndStr = getLocalDateString(prevEnd);

    // Filter period expenses
    const pExpenses = this.expenses.filter((e) => e.company_id === cid && e.entry_date >= startDate && e.entry_date <= endDate);
    // Operating Expenses (OPEX): All operational expenses (supplies, utilities, chemicals, etc.) EXCLUDING 'Staff Salary' payouts
    // This prevents salary from being double-deducted alongside totalSalary payroll!
    const operatingExpenses = pExpenses.filter((e) => e.category !== 'Staff Salary').reduce((sum, e) => sum + e.amount, 0);

    // Customer accounts all-time
    const custAccounts = this.getCustomers(cid);
    const customerBalancesDue = custAccounts.reduce((sum, c) => sum + Math.max(0, c.current_balance || 0), 0);
    const overLimitCustomers = custAccounts.filter((c) => c.status === 'over_limit').map((c) => c.name);

    // Staff Payroll
    const companyStaff = this.profiles.filter((p) => p.company_id === cid && p.active);
    const staffPayroll: any[] = [];
    let totalSalary = 0;
    let totalAdvances = 0;

    for (const staff of companyStaff) {
      let grossSalary = 0;
      const sJobs = pJobs.filter((j) => j.staff_id === staff.id);
      const sJobsSales = sJobs.reduce((sum, j) => sum + (j.price || 0), 0);

      // Attendance in period
      const sAtt = this.attendance.filter(
        (t) => t.company_id === cid && t.staff_id === staff.id && t.entry_date >= startDate && t.entry_date <= endDate
      );
      const presentDays = sAtt.filter((t) => t.status === 'present').length;
      const leaveDays = sAtt.filter((t) => t.status === 'leave').length;

      // 1. Point-in-Time Commission: ONLY for staff with pay_type === 'commission'
      // Computed strictly on BASE price (extra excluded)
      const commEarned = staff.pay_type === 'commission'
        ? sJobs.reduce((sum, j) => {
            if (j.commission_amount !== undefined) return sum + j.commission_amount;
            const rate = j.commission_rate !== undefined ? j.commission_rate : (Number(staff.pay_rate) || 0);
            return sum + (j.price * (rate / 100));
          }, 0)
        : 0;

      // 2. Point-in-Time Daily Wage: ONLY for staff with pay_type === 'daily'
      const presentRecords = sAtt.filter((t) => t.status === 'present');
      const dailyEarned = staff.pay_type === 'daily'
        ? presentRecords.reduce((sum, r) => {
            const rate = r.daily_rate !== undefined ? r.daily_rate : (Number(staff.pay_rate) || 0);
            return sum + rate;
          }, 0)
        : 0;

      // 3. Monthly Fixed Salary: ONLY for staff with pay_type === 'monthly'
      const monthlyEarned = staff.pay_type === 'monthly' ? (staff.pay_rate / 30) * periodDays : 0;

      // Single source of contract truth: exactly matching pay_type
      if (staff.pay_type === 'commission') {
        grossSalary = commEarned;
      } else if (staff.pay_type === 'daily') {
        grossSalary = dailyEarned;
      } else if (staff.pay_type === 'monthly') {
        grossSalary = monthlyEarned;
      } else {
        grossSalary = 0;
      }

      // Advances in period
      const sAdv = this.advances
        .filter((a) => a.company_id === cid && a.staff_id === staff.id && a.entry_date >= startDate && a.entry_date <= endDate)
        .reduce((sum, a) => sum + a.amount, 0);

      // Salary payouts recorded in period for this staff (expenses category 'Staff Salary')
      const sPaid = this.expenses
        .filter(
          (e) =>
            e.company_id === cid &&
            e.category === 'Staff Salary' &&
            (e.description?.includes(staff.id) ||
             (staff.full_name && e.description?.toLowerCase().includes(staff.full_name.toLowerCase())) ||
             (staff.username && e.description?.toLowerCase().includes(staff.username.toLowerCase()))) &&
            e.entry_date >= startDate &&
            e.entry_date <= endDate
        )
        .reduce((sum, e) => sum + e.amount, 0);

      const balanceToPay = Math.max(0, Math.round((grossSalary - sAdv - sPaid) * 100) / 100);

      totalSalary += grossSalary;
      totalAdvances += sAdv;

      staffPayroll.push({
        staff_id: staff.id,
        full_name: staff.full_name,
        role: staff.role,
        pay_type: staff.pay_type,
        pay_rate: staff.pay_rate,
        jobs_count: sJobs.length,
        jobs_sales: Math.round(sJobsSales * 100) / 100,
        present_days: presentDays,
        leave_days: leaveDays,
        gross_salary: Math.round(grossSalary * 100) / 100,
        advances: Math.round(sAdv * 100) / 100,
        paid_salary: Math.round(sPaid * 100) / 100,
        balance_to_pay: balanceToPay,
      });
    }

    const daysDiff = Math.max(1, Math.round((endD.getTime() - startD.getTime()) / (1000 * 3600 * 24)) + 1);
    const monthlyRent = settings.monthly_rent || 0;
    
    // Sum fixed expenses by frequency
    const pFixedExps = this.fixedExpenses.filter(e => e.company_id === cid);
    const monthlyOther = pFixedExps.filter(e => e.frequency === 'monthly').reduce((sum, e) => sum + Number(e.amount), 0) + (settings.monthly_fixed_costs || 0);
    const weeklyOther = pFixedExps.filter(e => e.frequency === 'weekly').reduce((sum, e) => sum + Number(e.amount), 0) + (settings.weekly_fixed_costs || 0);
    const dailyOther = pFixedExps.filter(e => e.frequency === 'daily').reduce((sum, e) => sum + Number(e.amount), 0) + (settings.daily_fixed_costs || 0);
    
    // Convert all to daily rate, then multiply by days in period
    const dailyAmortizedFixed = (monthlyRent + monthlyOther) / 30 + (weeklyOther / 7) + dailyOther;
    const periodFixedCost = dailyAmortizedFixed * daysDiff;

    const netProfit = revenue - operatingExpenses - totalSalary - periodFixedCost;
    const cashProfit = collected - operatingExpenses - totalSalary - periodFixedCost;
    const netMargin = revenue > 0 ? Math.round((netProfit / revenue) * 10000) / 10000 : 0;

    // Previous Period Calculations
    const prevJobs = this.jobs.filter((j) => j.company_id === cid && j.entry_date >= prevStartStr && j.entry_date <= prevEndStr);
    const prevRevenue = prevJobs.reduce((sum, j) => sum + j.total, 0);
    const prevVehicles = prevJobs.length;

    const prevExpList = this.expenses.filter((e) => e.company_id === cid && e.entry_date >= prevStartStr && e.entry_date <= prevEndStr);
    const prevExpenses = prevExpList.filter((e) => e.category !== 'Staff Salary').reduce((sum, e) => sum + e.amount, 0);

    let prevSalary = 0;
    for (const staff of companyStaff) {
      if (staff.pay_type === 'commission') {
        const psJobs = prevJobs.filter((j) => j.staff_id === staff.id);
        const prevComm = psJobs.reduce((sum, j) => {
          if (j.commission_amount !== undefined) return sum + j.commission_amount;
          const rate = j.commission_rate !== undefined ? j.commission_rate : (Number(staff.pay_rate) || 0);
          return sum + (j.price * (rate / 100));
        }, 0);
        prevSalary += prevComm;
      } else if (staff.pay_type === 'daily') {
        const pPres = this.attendance.filter(
          (t) => t.company_id === cid && t.staff_id === staff.id && t.entry_date >= prevStartStr && t.entry_date <= prevEndStr && t.status === 'present'
        );
        const prevDaily = pPres.reduce((sum, att) => {
          const rate = att.daily_rate !== undefined ? att.daily_rate : (Number(staff.pay_rate) || 0);
          return sum + rate;
        }, 0);
        prevSalary += prevDaily;
      } else if (staff.pay_type === 'monthly') {
        const prevMonthly = (staff.pay_rate / 30) * periodDays;
        prevSalary += prevMonthly;
      }
    }
    const prevNet = prevRevenue - prevExpenses - prevSalary;
    const salesGrowth = prevRevenue > 0 ? (revenue - prevRevenue) / prevRevenue : 0;
    const expGrowth = prevExpenses > 0 ? (operatingExpenses - prevExpenses) / prevExpenses : 0;

    // 10-Rule Diagnostic Health Score Engine (§8)
    let healthScore = 100;
    const warnings: DiagnosticWarning[] = [];

    // Rule 1: Net Margin
    if (netMargin < 0) {
      healthScore -= 20;
      warnings.push({
        code: 'margin_loss',
        level: 'red',
        title: 'Net Loss Incurred',
        description: `Net margin is ${(netMargin * 100).toFixed(1)}% (negative profit). Operating costs exceed total revenue.`,
        action: 'Audit operating overhead and review pricing tiers immediately.',
      });
    } else if (netMargin < th.margin_warn) {
      healthScore -= 8;
      warnings.push({
        code: 'margin_low',
        level: 'orange',
        title: 'Thin Profit Margin',
        description: `Net margin is ${(netMargin * 100).toFixed(1)}%, lower than the recommended ${(th.margin_warn * 100).toFixed(0)}%.`,
        action: 'Increase high-margin add-ons (polishing, detailing) and tighten material waste.',
      });
    }

    // Rule 2: Staff Cost Ratio
    if (revenue > 0) {
      const staffRatio = totalSalary / revenue;
      if (staffRatio > th.staff_bad) {
        healthScore -= 20;
        warnings.push({
          code: 'staff_bad',
          level: 'red',
          title: 'Severe Staff Cost Overrun',
          description: `Payroll consumes ${(staffRatio * 100).toFixed(1)}% of revenue (critical threshold: ${(th.staff_bad * 100).toFixed(0)}%).`,
          action: 'Shift daily wages to performance commission or optimize staffing schedule.',
        });
      } else if (staffRatio > th.staff_warn) {
        healthScore -= 8;
        warnings.push({
          code: 'staff_warn',
          level: 'orange',
          title: 'High Staff Cost',
          description: `Payroll is ${(staffRatio * 100).toFixed(1)}% of revenue (recommended below ${(th.staff_warn * 100).toFixed(0)}%).`,
          action: 'Increase daily job volume per technician to balance labor overhead.',
        });
      }

      // Rule 3: Operating Expenses Ratio (Pure OPEX, labor evaluated separately in Rule 2)
      const opexRatio = operatingExpenses / revenue;
      if (opexRatio > th.opex_bad) {
        healthScore -= 20;
        warnings.push({
          code: 'opex_bad',
          level: 'red',
          title: 'Excessive Operating Expenses',
          description: `Operating expenses represent ${(opexRatio * 100).toFixed(1)}% of revenue (critical ceiling: ${(th.opex_bad * 100).toFixed(0)}%).`,
          action: 'Renegotiate vendor supply agreements and eliminate non-essential expenses.',
        });
      } else if (opexRatio > th.opex_warn) {
        healthScore -= 8;
        warnings.push({
          code: 'opex_warn',
          level: 'orange',
          title: 'Elevated Operating Expenses',
          description: `Expenses stand at ${(opexRatio * 100).toFixed(1)}% of revenue (recommended below ${(th.opex_warn * 100).toFixed(0)}%).`,
          action: 'Monitor utility and material usage for leakage or unnecessary replenishment.',
        });
      }

      // Rule 4: Unpaid Ratio
      const unpaidRatio = unpaid / revenue;
      if (unpaidRatio > th.unpaid_bad) {
        healthScore -= 20;
        warnings.push({
          code: 'unpaid_bad',
          level: 'red',
          title: 'Critical Uncollected Revenue',
          description: `${(unpaidRatio * 100).toFixed(1)}% of revenue remains unpaid (critical ceiling: ${(th.unpaid_bad * 100).toFixed(0)}%).`,
          action: 'Instruct cashier to demand payment on delivery and collect credit invoices.',
        });
      } else if (unpaidRatio > th.unpaid_warn) {
        healthScore -= 8;
        warnings.push({
          code: 'unpaid_warn',
          level: 'orange',
          title: 'Uncollected Revenue Warning',
          description: `${(unpaidRatio * 100).toFixed(1)}% of revenue is pending collection.`,
          action: 'Follow up with walk-in customers and enforce stricter customer account terms.',
        });
      }
    }

    // Rule 5: Advances ÷ Salary
    if (totalSalary > 0 && totalAdvances / totalSalary > th.advance_warn) {
      healthScore -= 8;
      warnings.push({
        code: 'advances_high',
        level: 'orange',
        title: 'High Salary Advance Ratio',
        description: `Advances make up ${((totalAdvances / totalSalary) * 100).toFixed(1)}% of total earned salary (threshold: ${(th.advance_warn * 100).toFixed(0)}%).`,
        action: 'Cap advance disbursements to 15% of projected monthly earnings.',
      });
    }

    // Rule 6: Sales Drop vs Previous Period
    if (prevRevenue > 0) {
      if (salesGrowth <= th.sales_drop_bad) {
        healthScore -= 20;
        warnings.push({
          code: 'sales_plunge',
          level: 'red',
          title: 'Severe Revenue Decline',
          description: `Sales plunged ${(Math.abs(salesGrowth) * 100).toFixed(1)}% compared to the preceding period.`,
          action: 'Investigate lost fleet accounts, competitor promotions, and workshop throughput.',
        });
      } else if (salesGrowth <= th.sales_drop_warn) {
        healthScore -= 8;
        warnings.push({
          code: 'sales_drop',
          level: 'orange',
          title: 'Revenue Drop Alert',
          description: `Revenue fell ${(Math.abs(salesGrowth) * 100).toFixed(1)}% compared to previous period.`,
          action: 'Launch customer re-engagement WhatsApp promotions.',
        });
      }
    }

    // Rule 7: Expense Growth vs Revenue Growth
    if (prevRevenue > 0 && prevExpenses > 0) {
      if (expGrowth - salesGrowth > th.expense_growth) {
        healthScore -= 8;
        warnings.push({
          code: 'exp_outpacing',
          level: 'orange',
          title: 'Expense Outpacing Revenue',
          description: `Expenses grew by ${(expGrowth * 100).toFixed(1)}% while sales grew by ${(salesGrowth * 100).toFixed(1)}% (spread: ${((expGrowth - salesGrowth) * 100).toFixed(1)}%).`,
          action: 'Freeze non-essential purchases and audit vendor price increases.',
        });
      }
    }

    // Rule 8: Single Expense Category Dominance (Operating Expenses only)
    const categoryTotals: Record<string, number> = {};
    for (const exp of pExpenses.filter((e) => e.category !== 'Staff Salary')) {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    }
    if (operatingExpenses > 0) {
      for (const [cat, amt] of Object.entries(categoryTotals)) {
        if (amt / operatingExpenses > 0.4 && cat !== 'Rent') {
          healthScore -= 8;
          warnings.push({
            code: 'category_dominance',
            level: 'orange',
            title: `Dominant Expense: ${cat}`,
            description: `${cat} represents ${((amt / operatingExpenses) * 100).toFixed(1)}% of all operating expenses in this period.`,
            action: `Analyze ${cat} itemized receipts to detect supplier overcharges or internal waste.`,
          });
          break;
        }
      }
    }

    // Rule 9: Over-limit Customers
    if (overLimitCustomers.length > 0) {
      healthScore -= 20;
      warnings.push({
        code: 'customers_over_limit',
        level: 'red',
        title: 'Customer Accounts Exceeding Credit Limits',
        description: `${overLimitCustomers.length} customer account(s) exceed credit ceiling: ${overLimitCustomers.join(', ')}.`,
        action: 'Lock credit billing for these accounts until outstanding invoices are settled.',
      });
    }

    // Rule 10: Credit Exposure
    if (revenue > 0 && customerBalancesDue / revenue > 0.5) {
      healthScore -= 8;
      warnings.push({
        code: 'credit_exposure',
        level: 'orange',
        title: 'High Overall Credit Exposure',
        description: `Total customer debt (${customerBalancesDue.toFixed(2)}) exceeds 50% of this period's gross revenue.`,
        action: 'Incentivize early settlement with 2% prompt-pay discounts.',
      });
    }

    healthScore = Math.max(0, Math.min(100, healthScore));

    // Daily breakdown for charts
    const dailyMap: Record<string, { date: string; revenue: number; expenses: number; vehicles: number }> = {};
    let cur = new Date(startD);
    while (cur <= endD) {
      const dStr = getLocalDateString(cur);
      dailyMap[dStr] = { date: dStr, revenue: 0, expenses: 0, vehicles: 0 };
      cur.setDate(cur.getDate() + 1);
    }

    for (const j of pJobs) {
      if (dailyMap[j.entry_date]) {
        dailyMap[j.entry_date].revenue += j.total;
        dailyMap[j.entry_date].vehicles += 1;
      }
    }

    // 1. Operating and logged expenses (including any staff salary payouts) for that day
    for (const e of pExpenses) {
      if (dailyMap[e.entry_date]) {
        dailyMap[e.entry_date].expenses += e.amount;
      }
    }

    // 2. For dates where no explicit Staff Salary payout was recorded in expenses, add daily earned commission & wages
    const staffSalaryPaidDates = new Set(
      pExpenses.filter((e) => e.category === 'Staff Salary').map((e) => e.entry_date)
    );

    for (const j of pJobs) {
      if (!staffSalaryPaidDates.has(j.entry_date) && dailyMap[j.entry_date]) {
        const staff = companyStaff.find((s) => s.id === j.staff_id);
        if (staff && staff.pay_type === 'commission') {
          const commAmt = j.commission_amount !== undefined
            ? j.commission_amount
            : (j.price * (j.commission_rate ?? (Number(staff.pay_rate) || 0))) / 100;
          dailyMap[j.entry_date].expenses += commAmt;
        }
      }
    }

    for (const staff of companyStaff) {
      if (staff.pay_type === 'daily') {
        const atts = this.attendance.filter(
          (a) => a.staff_id === staff.id && a.entry_date >= startDate && a.entry_date <= endDate && a.status === 'present'
        );
        for (const att of atts) {
          if (!staffSalaryPaidDates.has(att.entry_date) && dailyMap[att.entry_date]) {
            const wage = att.daily_rate !== undefined
              ? att.daily_rate
              : (Number(staff.pay_rate) || 0);
            dailyMap[att.entry_date].expenses += wage;
          }
        }
      }
    }

    // Clean rounding for charts
    for (const d of Object.values(dailyMap)) {
      d.revenue = Math.round(d.revenue * 100) / 100;
      d.expenses = Math.round(d.expenses * 100) / 100;
    }

    const dailyBreakdown = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    // Category breakdown
    const byCategory = Object.entries(categoryTotals).map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
      percentage: operatingExpenses > 0 ? Math.round((amount / operatingExpenses) * 1000) / 10 : 0,
    }));

    // Work type breakdown
    const workTypeTotals: Record<string, { count: number; total: number }> = {};
    for (const j of pJobs) {
      if (!workTypeTotals[j.work_type]) {
        workTypeTotals[j.work_type] = { count: 0, total: 0 };
      }
      workTypeTotals[j.work_type].count += 1;
      workTypeTotals[j.work_type].total += j.total;
    }

    const byWorkType = Object.entries(workTypeTotals).map(([work_type, d]) => ({
      work_type,
      count: d.count,
      total: Math.round(d.total * 100) / 100,
    }));

    const unpaidVehicles = pJobs
      .filter((j) => !j.is_paid)
      .map((j) => {
        const st = this.profiles.find((p) => p.id === j.staff_id);
        return {
          id: j.id,
          entry_date: j.entry_date,
          plate: j.plate,
          mobile: j.mobile,
          work_type: j.work_type,
          vehicle_type: j.vehicle_type,
          total: j.total,
          staff_name: st?.full_name || 'Staff',
        };
      });

    const vehicleTypeTotals: Record<string, { count: number; total: number }> = {};
    for (const j of pJobs) {
      if (!vehicleTypeTotals[j.vehicle_type]) {
        vehicleTypeTotals[j.vehicle_type] = { count: 0, total: 0 };
      }
      vehicleTypeTotals[j.vehicle_type].count += 1;
      vehicleTypeTotals[j.vehicle_type].total += j.total;
    }
    const salesByVehicleType = Object.entries(vehicleTypeTotals).map(([vehicle_type, d]) => ({
      vehicle_type,
      count: d.count,
      total: Math.round(d.total * 100) / 100,
      percent: revenue > 0 ? Math.round((d.total / revenue) * 1000) / 10 : 0,
    }));

    const salesByWorkType = byWorkType.map((b) => ({
      ...b,
      percent: revenue > 0 ? Math.round((b.total / revenue) * 1000) / 10 : 0,
    }));

    const pnlCategories = byCategory.map((c) => ({
      category: c.category,
      amount: c.amount,
      percent_of_revenue: revenue > 0 ? Math.round((c.amount / revenue) * 1000) / 10 : 0,
      percent_of_expenses: operatingExpenses > 0 ? Math.round((c.amount / operatingExpenses) * 1000) / 10 : 0,
    }));

    const dailyChart = dailyBreakdown.map((d) => ({
      date: d.date,
      revenue: d.revenue,
      expenses: d.expenses,
    }));

    const customerAccounts = custAccounts.map((c) => ({
      id: c.id,
      name: c.name,
      mobile: c.mobile,
      credit_limit: c.credit_limit,
      current_balance: c.current_balance || 0,
      status: (c.status || 'ok') as 'ok' | 'near_limit' | 'over_limit',
    }));

    const periodVariableCost = operatingExpenses + totalSalary;
    const periodTotalCost = periodFixedCost + periodVariableCost;

    return {
      kpis: {
        vehicles_count: totalVehicles,
        revenue: Math.round(revenue * 100) / 100,
        base_amount: Math.round(baseAmount * 100) / 100,
        extra_amount: Math.round(extraAmount * 100) / 100,
        avg_per_vehicle: totalVehicles > 0 ? Math.round((revenue / totalVehicles) * 100) / 100 : 0,
        collected: Math.round(collected * 100) / 100,
        unpaid: Math.round(unpaid * 100) / 100,
        customer_balances_due: Math.round(customerBalancesDue * 100) / 100,
        expenses: Math.round(operatingExpenses * 100) / 100,
        total_salary: Math.round(totalSalary * 100) / 100,
        total_advances: Math.round(totalAdvances * 100) / 100,
        net_profit: Math.round(netProfit * 100) / 100,
        cash_profit: Math.round(cashProfit * 100) / 100,
        net_margin: netMargin,
      },
      previous_comparison: {
        prev_start_date: prevStartStr,
        prev_end_date: prevEndStr,
        prev_revenue: Math.round(prevRevenue * 100) / 100,
        prev_expenses: Math.round(prevExpenses * 100) / 100,
        prev_salary: Math.round(prevSalary * 100) / 100,
        prev_net_profit: Math.round(prevNet * 100) / 100,
        prev_vehicles_count: prevVehicles,
        sales_growth_pct: Math.round(salesGrowth * 1000) / 10,
        expense_growth_pct: Math.round(expGrowth * 1000) / 10,
      },
      health: {
        score: healthScore,
        status: healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'fair' : 'at_risk',
        warnings,
      },
      daily_chart: dailyChart,
      pnl_categories: pnlCategories,
      staff_payroll: staffPayroll,
      sales_by_work_type: salesByWorkType,
      sales_by_vehicle_type: salesByVehicleType,
      unpaid_vehicles: unpaidVehicles,
      customer_accounts: customerAccounts,
      fixed_costs: {
        monthly_rent: monthlyRent,
        monthly_other: monthlyOther,
        weekly_other: weeklyOther,
        daily_other: dailyOther,
        period_fixed_cost: periodFixedCost,
        period_variable_cost: periodVariableCost,
        period_total_cost: periodTotalCost,
      }
    };
  }

  // Cross-Company Superadmin Report
  public getSuperAdminReport(startDate: string, endDate: string) {
    const list: any[] = [];
    let grandRevenue = 0;
    let grandVehicles = 0;
    let grandExpenses = 0;
    let grandProfit = 0;

    for (const comp of this.companies) {
      try {
        const rep = this.getCompanyReport(startDate, endDate, comp.id);
        grandRevenue += rep.kpis.revenue;
        grandVehicles += rep.kpis.vehicles_count;
        grandExpenses += rep.kpis.expenses + rep.kpis.total_salary;
        grandProfit += rep.kpis.net_profit;

        list.push({
          company_id: comp.id,
          code: comp.code,
          name: comp.name,
          valid_until: comp.valid_until,
          active: comp.active,
          revenue: rep.kpis.revenue,
          vehicles: rep.kpis.vehicles_count,
          expenses: rep.kpis.expenses,
          payroll: rep.kpis.total_salary,
          net_profit: rep.kpis.net_profit,
          health_score: rep.health.score,
          health_status: rep.health.status,
          warnings_count: rep.health.warnings.length,
        });
      } catch (e) {
        // Skip
      }
    }

    return {
      period: { start_date: startDate, end_date: endDate },
      companies: list,
      totals: {
        companies_count: this.companies.length,
        active_count: this.companies.filter((c) => c.active).length,
        revenue: Math.round(grandRevenue * 100) / 100,
        vehicles: grandVehicles,
        expenses: Math.round(grandExpenses * 100) / 100,
        net_profit: Math.round(grandProfit * 100) / 100,
      },
    };
  }

  // ==========================================
  // INVENTORY METHODS (Phase 2)
  // ==========================================

  public getInventoryItems(companyId?: string): InventoryItem[] {
    const cid = companyId || this.getEffectiveCompanyId();
    if (!cid) return [];
    return this.inventoryItems.filter((i) => i.company_id === cid).sort((a, b) => a.name.localeCompare(b.name));
  }

  public getInventoryLogs(companyId?: string): InventoryLog[] {
    const cid = companyId || this.getEffectiveCompanyId();
    if (!cid) return [];
    
    // Add item_name for UI joins
    return this.inventoryLogs
      .filter((l) => l.company_id === cid)
      .map(l => ({
        ...l,
        item_name: this.inventoryItems.find(i => i.id === l.item_id)?.name || 'Unknown Item'
      }))
      .sort((a, b) => new Date(b.created_at || b.entry_date).getTime() - new Date(a.created_at || a.entry_date).getTime());
  }

  public async addInventoryItem(payload: { name: string; unit: string; current_stock: number; expected_washes: number; sku?: string }): Promise<{ success: boolean; error?: string; item_id?: string }> {
    const cid = this.getEffectiveCompanyId();
    if (!cid) return { success: false, error: 'No active company' };

    const newItem: InventoryItem = {
      id: crypto.randomUUID(),
      company_id: cid,
      name: payload.name,
      unit: payload.unit,
      current_stock: payload.current_stock,
      expected_washes: payload.expected_washes,
      sku: payload.sku,
      created_at: new Date().toISOString(),
    };

    this.inventoryItems.push(newItem);
    this.logAudit('inventory_items', cid, 'INSERT', null, newItem);

    if (supabase) {
      const { error } = await supabase.from('inventory_items').insert(newItem);
      if (error) {
        // Rollback
        this.inventoryItems = this.inventoryItems.filter(i => i.id !== newItem.id);
        return { success: false, error: error.message };
      }
    }
    return { success: true, item_id: newItem.id };
  }

  public async updateInventoryItem(id: string, payload: Partial<InventoryItem>): Promise<{ success: boolean; error?: string }> {
    const idx = this.inventoryItems.findIndex(i => i.id === id);
    if (idx === -1) return { success: false, error: 'Item not found' };

    const current = this.inventoryItems[idx];
    const updated = { ...current, ...payload };
    this.inventoryItems[idx] = updated;

    this.logAudit('inventory_items', current.company_id, 'UPDATE', current, updated);

    if (supabase) {
      const { error } = await supabase.from('inventory_items').update(payload).eq('id', id);
      if (error) {
        this.inventoryItems[idx] = current;
        return { success: false, error: error.message };
      }
    }
    return { success: true };
  }

  public async deleteInventoryItem(id: string): Promise<{ success: boolean; error?: string }> {
    const idx = this.inventoryItems.findIndex(i => i.id === id);
    if (idx === -1) return { success: false, error: 'Item not found' };

    const item = this.inventoryItems[idx];
    this.inventoryItems = this.inventoryItems.filter(i => i.id !== id);

    this.logAudit('inventory_items', item.company_id, 'DELETE', item, null);

    if (supabase) {
      const { error } = await supabase.from('inventory_items').delete().eq('id', id);
      if (error) {
        // Rollback
        this.inventoryItems.splice(idx, 0, item);
        return { success: false, error: error.message };
      }
    }
    return { success: true };
  }

  public async addInventoryLog(payload: { item_id: string; action_type: 'add_stock' | 'start_batch' | 'empty_batch' | 'write_off'; quantity: number; note?: string; total_cost?: number; entry_date?: string }): Promise<{ success: boolean; error?: string }> {
    const cid = this.getEffectiveCompanyId();
    if (!cid) return { success: false, error: 'No active company' };
    const username = this.currentSession?.user.username || 'unknown';

    const newLog: InventoryLog = {
      id: crypto.randomUUID(),
      company_id: cid,
      item_id: payload.item_id,
      action_type: payload.action_type,
      quantity: payload.quantity,
      total_cost: payload.total_cost,
      entry_date: payload.entry_date || getLocalDateString(new Date()),
      note: payload.note || null,
      created_by: username,
      created_at: new Date().toISOString(),
    };

    // Calculate new stock mathematically based on action
    const itemIdx = this.inventoryItems.findIndex(i => i.id === payload.item_id);
    if (itemIdx === -1) return { success: false, error: 'Item not found' };
    const item = this.inventoryItems[itemIdx];
    
    const prevStock = item.current_stock;
    let newStock = prevStock;
    
    if (payload.action_type === 'add_stock') {
      newStock += payload.quantity;
    } else if (payload.action_type === 'start_batch' || payload.action_type === 'write_off') {
      newStock -= payload.quantity;
    }
    // 'empty_batch' doesn't deduct stock, it just marks an active batch as finished.

    this.inventoryLogs.unshift(newLog);
    const updatedItem = { ...item, current_stock: newStock };
    this.inventoryItems[itemIdx] = updatedItem;

    if (supabase) {
      const { error: logErr } = await supabase.from('inventory_logs').insert(newLog);
      if (logErr) {
        this.inventoryLogs = this.inventoryLogs.filter(l => l.id !== newLog.id);
        this.inventoryItems[itemIdx] = item; // Rollback stock
        return { success: false, error: logErr.message };
      }
      
      const { error: itemErr } = await supabase.from('inventory_items').update({ current_stock: newStock }).eq('id', item.id);
      if (itemErr) console.error("Failed to update item stock on server:", itemErr);
    }
    return { success: true };
  }

  public getActiveBatches(companyId?: string) {
    const cid = companyId || this.getEffectiveCompanyId();
    if (!cid) return [];
    
    const items = this.getInventoryItems(cid);
    const logs = this.getInventoryLogs(cid); // already sorted by date desc
    const activeBatches = [];

    for (const item of items) {
      if (!item.expected_washes || item.expected_washes <= 0) continue; // Only process items that are consumables

      // Find the most recent start_batch
      const itemLogs = logs.filter(l => l.item_id === item.id);
      const lastStart = itemLogs.find(l => l.action_type === 'start_batch');
      
      if (lastStart) {
        // Did we empty it AFTER we started it?
        const lastEmpty = itemLogs.find(l => l.action_type === 'empty_batch');
        const startDate = new Date(lastStart.created_at || lastStart.entry_date).getTime();
        const emptyDate = lastEmpty ? new Date(lastEmpty.created_at || lastEmpty.entry_date).getTime() : 0;

        if (startDate > emptyDate || !lastEmpty) {
          // This batch is currently active in the wash bay!
          // Calculate vehicles washed since startDate
          const jobsSince = this.jobs.filter(j => j.company_id === cid && new Date(j.created_at || j.entry_date).getTime() >= startDate);
          const washedCount = jobsSince.length;
          
          const expectedTotal = lastStart.quantity * item.expected_washes;
          const remainingPct = Math.max(0, 100 - (washedCount / expectedTotal) * 100);

          activeBatches.push({
            item,
            startLog: lastStart,
            washedCount,
            expectedTotal,
            remainingPct
          });
        }
      }
    }
    
    return activeBatches;
  }

  // --- Phase 3: Fixed Expenses Methods ---
  public getFixedExpenses(companyId?: string): FixedExpense[] {
    const cid = companyId || this.getEffectiveCompanyId();
    if (!cid) return [];
    return this.fixedExpenses.filter(e => e.company_id === cid);
  }

  public async addFixedExpense(payload: { name: string; amount: number; frequency: 'monthly' | 'weekly' | 'daily' }): Promise<{ success: boolean; error?: string }> {
    const cid = this.getEffectiveCompanyId();
    if (!cid) return { success: false, error: 'No active company' };

    const exp: FixedExpense = {
      id: generateUUID(),
      company_id: cid,
      ...payload,
      created_at: new Date().toISOString()
    };

    this.fixedExpenses = [exp, ...this.fixedExpenses];
    this.logAudit('fixed_expenses', cid, 'INSERT', null, exp);

    if (supabase) {
      const { error } = await supabase.from('fixed_expenses').insert(exp);
      if (error) {
        this.fixedExpenses = this.fixedExpenses.filter(e => e.id !== exp.id);
        return { success: false, error: error.message };
      }
    }
    return { success: true };
  }

  public async deleteFixedExpense(id: string): Promise<{ success: boolean; error?: string }> {
    const idx = this.fixedExpenses.findIndex(e => e.id === id);
    if (idx === -1) return { success: false, error: 'Not found' };

    const exp = this.fixedExpenses[idx];
    this.fixedExpenses = this.fixedExpenses.filter(e => e.id !== id);
    this.logAudit('fixed_expenses', exp.company_id, 'DELETE', exp, null);

    if (supabase) {
      const { error } = await supabase.from('fixed_expenses').delete().eq('id', id);
      if (error) {
        this.fixedExpenses.splice(idx, 0, exp);
        return { success: false, error: error.message };
      }
    }
    return { success: true };
  }
}

export const dataProvider = new DataProvider();
