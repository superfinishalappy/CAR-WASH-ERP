-- Ensure tables exist
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text NOT NULL,
  current_stock numeric DEFAULT 0,
  expected_washes numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  item_id uuid REFERENCES inventory_items(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  quantity numeric NOT NULL,
  entry_date date NOT NULL,
  note text,
  created_by text,
  created_at timestamptz DEFAULT now()
);

-- Ensure RLS is enabled
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Enable all for users based on company_id" ON inventory_items;
DROP POLICY IF EXISTS "Enable all for users based on company_id" ON inventory_logs;
DROP POLICY IF EXISTS "inventory_items_company_policy" ON inventory_items;
DROP POLICY IF EXISTS "inventory_logs_company_policy" ON inventory_logs;

-- Recreate Policies (Company Isolation)
CREATE POLICY "inventory_items_company_policy" ON inventory_items 
  FOR ALL USING (company_id = public.auth_company() OR public.is_platform());

CREATE POLICY "inventory_logs_company_policy" ON inventory_logs 
  FOR ALL USING (company_id = public.auth_company() OR public.is_platform());
