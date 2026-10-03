# Garage ERP (Car Wash · Painting · Mechanical Workshops)

> A modern, multi-tenant SaaS ERP web application built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **Supabase (PostgreSQL, RLS, Edge Functions)**. Designed mobile-first for workshop cashiers and enterprise owners, featuring bilingual English & Arabic (with full RTL support), dark/light mode, and an automated 10-rule business health diagnostic engine.

---

## 🚀 Key Features

1. **Multi-Tenant SaaS with Hard Database-Enforced Subscription Lock:**
   - Super Admin and Super Staff sell subscriptions to automotive workshops.
   - When a company's `valid_until` date passes or it is deactivated, **all read/write services stop automatically via Row Level Security (RLS)** in PostgreSQL.
   - Super Admin and Super Staff bypass the lock to assist workshops and extend subscriptions.
   - Automatic 7-day and 1-day pre-expiry warning banners.

2. **3-Field Authentication (Company ID + Username + Password):**
   - No confusing emails: Users log in with their workshop's **Company ID** (e.g. `ALNOOR`), **Username**, and **Password**.
   - Platform Super Admins and Super Staff use Company ID `ADMIN`.
   - Seamlessly mapped to Supabase Auth synthetic emails: `lower(username) || '@' || lower(company_code) || '.erp.local'`.
   - In-memory rate limiting against brute force attempts.

3. **Time-Zone & Role-Based Permissions Matrix:**
   - Enforced both in UI and PostgreSQL RLS:
     - **Staff**: Can only add and edit vehicles, expenses, advances, and attendance for **today** (in company timezone, default `Asia/Dubai`). Cannot delete entries. Cannot view reports.
     - **Manager**: Same as staff, plus can **delete today's entries**. Cannot delete past days. Cannot view reports.
     - **Accountant**: Can add/edit today's entries. Can delete expenses/advances on the same day. **Can view financial and payroll reports**.
     - **Owner**: Can add, edit, and delete entries on **any date**. Manages users, rates, passwords, catalog, thresholds, and views full audit logs and reports.
     - **Super Admin & Super Staff**: Universal access across all companies, can switch tenants, bypass expiry lock, and inspect cross-company financials.

4. **Rapid Mobile-First Cashier Vehicle Register:**
   - Single-hand mobile cashier keypad interface.
   - Quick pills for services (*Wash, Polish, Painting, Mechanical, Oil change, AC service, Detailing*) and vehicles (*Sedan, SUV, Pickup, Van, Bike*).
   - Real-time customer credit limit calculation: Immediately warns staff with a bold alert if a vehicle will push a customer over credit limit.
   - Walk-in Paid / Unpaid toggle with oldest-first unpaid vehicle tracking.

5. **Customer Credit Accounts & Printable Statements:**
   - Automatic running ledger: `Balance = sum(jobs.total) - sum(customer_payments)`.
   - Account badges: **OK**, **Near Limit (≥80%)**, and **OVER LIMIT – Call**.
   - Full/partial payment receipt modal.
   - Clean printable customer statement with debit, credit, and running balance.

6. **Automated Staff Payroll & Advances:**
   - **Commission**: `sum(jobs.price) * rate%` (**price only; extra polishing/detailing amount is excluded**).
   - **Daily Wage**: `rate * number of Present days` in period (paid even if 0 vehicles were serviced; leave is unpaid).
   - **Monthly Salary**: `(rate / 30) * period_days`.
   - **Salary Advances**: Automatically deducted from that staff member's balance to pay in reports.

7. **Business Health Score (0–100) & 10 Diagnostic Warning Rules:**
   - Real-time diagnostic scorecard with color indicator (80+ Healthy, 60–79 Fair, <60 At Risk).
   - Plain-language diagnoses and recommended corrective actions for owners.
   - Evaluates:
     1. Net margin loss or thin margin (<15%).
     2. Staff cost overruns (>40% or >50% of revenue).
     3. Operating expense spikes (>20% or >30% of revenue).
     4. Uncollected revenue ratio (>10% or >25% of revenue).
     5. High salary advance ratio (>15% of total payroll).
     6. Revenue drop vs previous period (down ≥10% or ≥25%).
     7. Expenses outpacing revenue growth by >10 points.
     8. Single expense category dominance (>40% of total expenses).
     9. Over-limit credit customers (lists specific customer names).
     10. Excessive credit exposure (>50% of period revenue).

8. **Exports & Reporting:**
   - CSV export and formatted multi-sheet Excel (XLSX) export using `xlsx`.
   - Print-friendly layout for paper reports and invoices.
   - Interactive charts using `recharts`.

---

## 📁 Repository Structure

```text
├── src/
│   ├── app/
│   │   ├── api/                      # Next.js API route equivalents for Edge Functions
│   │   │   ├── auth/login/route.ts
│   │   │   ├── company/create/route.ts
│   │   │   ├── company/subscription/route.ts
│   │   │   ├── company/delete/route.ts
│   │   │   ├── user/create/route.ts
│   │   │   ├── user/reset-password/route.ts
│   │   │   ├── superstaff/route.ts
│   │   │   └── reports/route.ts
│   │   ├── globals.css               # Tailwind tokens, glassmorphism, print CSS
│   │   ├── layout.tsx                # App router layout with PWA and fonts
│   │   └── page.tsx                  # Dynamic screen router & expiry enforcement
│   ├── components/
│   │   ├── Header.tsx                # Sticky acting banner, user badges, theme & language
│   │   ├── Navigation.tsx            # Role-aware desktop tabs & mobile bottom bar
│   │   ├── ExpiryLockScreen.tsx      # Database-enforced subscription expired screen
│   │   └── screens/
│   │       ├── LoginScreen.tsx       # 3-field login with quick demo presets
│   │       ├── VehiclesScreen.tsx    # Fast mobile daily cashier entry
│   │       ├── CustomersScreen.tsx   # Credit accounts & printable statements
│   │       ├── ExpensesScreen.tsx    # Daily & monthly operating expenses
│   │       ├── AdvancesScreen.tsx    # Staff salary advances tracking
│   │       ├── AttendanceScreen.tsx  # Daily roster & attendance marking
│   │       ├── TeamScreen.tsx        # User roster, catalog settings, thresholds & audit log
│   │       ├── ReportsScreen.tsx     # Financial P&L, Health score, charts & exports
│   │       └── AdminScreen.tsx       # Super Admin multi-company management
│   ├── context/
│   │   └── AppContext.tsx            # Global state (auth, language, theme, toasts)
│   ├── lib/
│   │   ├── data-provider.ts          # Unified business logic & permission engine
│   │   ├── mock-data.ts              # Seed accounts and transactions
│   │   ├── supabase.ts               # Supabase client wrapper & rate limiting
│   │   ├── i18n.ts                   # English & Arabic RTL dictionary
│   │   └── export.ts                 # CSV / XLSX / Print export utilities
│   └── types/
│       └── database.ts               # TypeScript schemas matching Postgres
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql    # Tables, enums, constraints, indexes
│   │   ├── 002_rls_and_helpers.sql   # Security Definer functions & RLS policies
│   │   ├── 003_audit_and_triggers.sql# Immutability triggers & audit log triggers
│   │   ├── 004_report_rpcs.sql       # Financial RPC with 10 health score rules
│   │   └── 005_seed_data.sql         # Seed Super Admin, Super Staff & Demo Workshop
│   └── functions/
│       ├── create-company/index.ts   # Edge function: create company & owner
│       ├── create-user/index.ts      # Edge function: create staff with synthetic email
│       ├── reset-password/index.ts   # Edge function: admin password reset
│       ├── set-subscription/index.ts # Edge function: +30 days, custom date, suspend
│       ├── create-superstaff/index.ts# Edge function: superadmin creates superstaff
│       ├── delete-company/index.ts   # Edge function: superadmin deletes company
│       └── daily-cron/index.ts       # Edge function: 7-day and 1-day expiry checker
├── scripts/
│   └── test-runner.js                # Automated test suite verifying all 12 criteria
├── public/
│   ├── manifest.json                 # Installable PWA manifest
│   └── sw.js                         # Service worker for offline asset caching
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

---

## 🛠️ Quick Start & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Test Suite
To verify the 12 acceptance criteria (tenant isolation, commission on price only, attendance rules, subscription lock, and report math):
```bash
npm test
```

### 3. Launch Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔑 Demo Login Accounts

You can test any role directly from the login screen using the quick demo preset buttons:

| Role | Company ID | Username | Password | Notes |
|---|---|---|---|---|
| **Super Admin** | `ADMIN` | `admin` | `admin1234` | Full SaaS control, manages companies & super staff |
| **Super Staff** | `ADMIN` | `superstaff` | `staff1234` | Multi-company switcher, universal edit/delete rights |
| **Owner** | `ALNOOR` | `tariq` | `owner1234` | Full workshop control, any date edits, team & reports |
| **Manager** | `ALNOOR` | `khalid` | `manager1234` | Daily ops, can delete today's vehicles, no reports |
| **Accountant** | `ALNOOR` | `sara` | `account1234` | Daily financial entries & full reports access |
| **Technician (Comm)** | `ALNOOR` | `rashid` | `staff1234` | 35% commission on base job price only |
| **Detailer (Daily)** | `ALNOOR` | `imran` | `staff1234` | 120 AED/day for Present attendance |
| **Expired Company** | `EXPIRED` | `salem` | `owner1234` | Demonstrates the database-enforced lock screen |

---

## 🗄️ Database Setup (Supabase Deployment)

1. Create a new Supabase project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase Dashboard.
3. Run the migrations sequentially from `supabase/migrations/`:
   - `001_initial_schema.sql`
   - `002_rls_and_helpers.sql`
   - `003_audit_and_triggers.sql`
   - `004_report_rpcs.sql`
   - `005_seed_data.sql`
4. Set your environment variables in `.env.local` or Vercel:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Server/Edge Function only!
   ```
5. Deploy Edge Functions with the Supabase CLI:
   ```bash
   supabase functions deploy create-company
   supabase functions deploy create-user
   supabase functions deploy reset-password
   supabase functions deploy set-subscription
   supabase functions deploy create-superstaff
   supabase functions deploy delete-company
   supabase functions deploy daily-cron
   ```

---

## 🔒 Security & Assumptions

1. **Synthetic Email Mapping:**
   - Formula: `lower(username) || '@' || lower(company_code) || '.erp.local'`.
   - Avoids third-party email deliverability dependencies. Usernames are constrained to `[a-z0-9._-]`.
2. **Service Role Key Isolation:**
   - The `SUPABASE_SERVICE_ROLE_KEY` is **never exposed to the browser client**; it is used exclusively in Edge Functions and server actions to provision users and bypass tenant boundaries safely.
3. **Database-Level Subscription Lock:**
   - The `company_live(company_id)` function checks `active = true` and `valid_until >= (now() at time zone timezone)::date`. Every query by a company user is filtered through this RLS predicate, guaranteeing zero unauthorized data leakage when expired.
4. **Commission Base Calculation:**
   - Commission is computed solely on `jobs.price`. Additional amounts (polishing, ceramic coating add-ons) are treated as company materials/extra revenue and excluded from commission.
5. **Auditing:**
   - Every write by a platform role (`superadmin` / `superstaff`) inside a tenant's database is automatically captured with their user ID in `audit_log`, providing workshop owners complete visibility.
