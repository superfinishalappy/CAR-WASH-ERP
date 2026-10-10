-- =================================================================================
-- Migration: Daily Cash Adjustments
-- Allows users to manually add "Extra Cash" or "Past Debts Collected" 
-- directly to a specific day's cash drawer without complex auto-calculations.
-- =================================================================================

CREATE TABLE IF NOT EXISTS public.daily_cash_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  note text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_cash_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view adjustments in their company" ON public.daily_cash_adjustments
  FOR SELECT USING (
    company_id = public.auth_company() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin', 'superstaff'))
  );

CREATE POLICY "Users can insert adjustments in their company" ON public.daily_cash_adjustments
  FOR INSERT WITH CHECK (
    company_id = public.auth_company() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin', 'superstaff'))
  );

CREATE POLICY "Users can update adjustments in their company" ON public.daily_cash_adjustments
  FOR UPDATE USING (
    company_id = public.auth_company() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin', 'superstaff'))
  );

CREATE POLICY "Users can delete adjustments in their company" ON public.daily_cash_adjustments
  FOR DELETE USING (
    company_id = public.auth_company() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('superadmin', 'superstaff'))
  );
