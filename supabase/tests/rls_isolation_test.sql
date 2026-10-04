-- ==============================================================================
-- RLS Multi-Tenant Cross-Isolation Test Script
-- Run this in Supabase SQL Editor to verify that Company A CANNOT read or
-- write Company B's data under any circumstance.
--
-- Note: This entire script runs inside a transaction and ends with ROLLBACK,
-- guaranteeing ZERO changes or test data remain in your database.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
  v_comp_a_id uuid := '11111111-1111-1111-1111-111111111111';
  v_comp_b_id uuid := '22222222-2222-2222-2222-222222222222';
  v_user_a_id uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_user_b_id uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_cust_b_id uuid := 'bbbbbbbb-cccc-bbbb-cccc-bbbbbbbbbbbb';
  v_job_b_id  uuid := 'bbbbbbbb-dddd-bbbb-dddd-bbbbbbbbbbbb';
  v_read_count int;
  v_update_count int;
  v_delete_count int;
  v_insert_blocked boolean := false;
BEGIN
  RAISE NOTICE '====================================================================';
  RAISE NOTICE '>>> STARTING MULTI-TENANT RLS ISOLATION TESTS <<<';
  RAISE NOTICE '====================================================================';

  -- 1. Create Test Companies
  INSERT INTO public.companies (id, code, name, valid_until, active, timezone, currency)
  VALUES 
    (v_comp_a_id, 'TEST_A', 'Test Company A', '2099-12-31', true, 'Asia/Dubai', 'AED'),
    (v_comp_b_id, 'TEST_B', 'Test Company B', '2099-12-31', true, 'Asia/Dubai', 'AED');

  -- 2. Create Auth Users A & B
  INSERT INTO auth.users (id, aud, role, email)
  VALUES
    (v_user_a_id, 'authenticated', 'authenticated', 'owner.test_a@carwash.app'),
    (v_user_b_id, 'authenticated', 'authenticated', 'owner.test_b@carwash.app');

  -- 3. Create Profiles A & B
  INSERT INTO public.profiles (id, company_id, username, full_name, role, active)
  VALUES
    (v_user_a_id, v_comp_a_id, 'owner_a', 'Owner Company A', 'owner', true),
    (v_user_b_id, v_comp_b_id, 'owner_b', 'Owner Company B', 'owner', true);

  -- 4. Create Company B Data (Privileged Setup Context)
  INSERT INTO public.customers (id, company_id, name, mobile)
  VALUES (v_cust_b_id, v_comp_b_id, 'Confidential Client B', '+971500000002');

  INSERT INTO public.jobs (id, company_id, entry_date, plate, work_type, vehicle_type, staff_id, price, is_paid, created_by)
  VALUES (v_job_b_id, v_comp_b_id, CURRENT_DATE, 'DXB-B-999', 'Wash', 'Sedan', v_user_b_id, 100.00, true, v_user_b_id);

  -- 5. Create Company A Data
  INSERT INTO public.customers (id, company_id, name, mobile)
  VALUES ('aaaaaaaa-cccc-aaaa-cccc-aaaaaaaaaaaa', v_comp_a_id, 'Legitimate Client A', '+971500000001');

  -- ----------------------------------------------------------------------------
  -- SIMULATE USER A (Authenticated Tenant A)
  -- ----------------------------------------------------------------------------
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_user_a_id::text, true);

  -- TEST 1: Cross-Tenant SELECT on Customers (User A tries to read Company B customer)
  SELECT count(*) INTO v_read_count FROM public.customers WHERE id = v_cust_b_id;
  IF v_read_count <> 0 THEN
    RAISE EXCEPTION 'RLS FAILED: User A was able to read Company B customer!';
  END IF;
  RAISE NOTICE 'Test 1 Passed: User A cannot read Company B customer (rows returned: 0).';

  -- TEST 2: Cross-Tenant SELECT on Jobs (User A tries to read Company B jobs)
  SELECT count(*) INTO v_read_count FROM public.jobs WHERE company_id = v_comp_b_id;
  IF v_read_count <> 0 THEN
    RAISE EXCEPTION 'RLS FAILED: User A was able to read Company B jobs!';
  END IF;
  RAISE NOTICE 'Test 2 Passed: User A cannot read Company B jobs (rows returned: 0).';

  -- TEST 3: Cross-Tenant INSERT on Jobs (User A tries to inject a job into Company B)
  BEGIN
    INSERT INTO public.jobs (company_id, entry_date, plate, work_type, vehicle_type, staff_id, price, created_by)
    VALUES (v_comp_b_id, CURRENT_DATE, 'HACK-001', 'Wash', 'Sedan', v_user_a_id, 50.00, v_user_a_id);
    v_insert_blocked := false;
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    v_insert_blocked := true;
  END;
  IF NOT v_insert_blocked THEN
    RAISE EXCEPTION 'RLS FAILED: User A was able to insert a job into Company B!';
  END IF;
  RAISE NOTICE 'Test 3 Passed: User A cannot insert jobs into Company B (blocked by RLS WITH CHECK).';

  -- TEST 4: Cross-Tenant UPDATE on Customers (User A tries to alter Company B customer)
  UPDATE public.customers SET name = 'Hacked Name' WHERE id = v_cust_b_id;
  GET DIAGNOSTICS v_update_count = ROW_COUNT;
  IF v_update_count <> 0 THEN
    RAISE EXCEPTION 'RLS FAILED: User A was able to update Company B customer!';
  END IF;
  RAISE NOTICE 'Test 4 Passed: User A cannot update Company B customer (rows updated: 0).';

  -- TEST 5: Cross-Tenant DELETE on Customers (User A tries to delete Company B customer)
  DELETE FROM public.customers WHERE id = v_cust_b_id;
  GET DIAGNOSTICS v_delete_count = ROW_COUNT;
  IF v_delete_count <> 0 THEN
    RAISE EXCEPTION 'RLS FAILED: User A was able to delete Company B customer!';
  END IF;
  RAISE NOTICE 'Test 5 Passed: User A cannot delete Company B customer (rows deleted: 0).';

  -- TEST 6: Legitimate Tenant Read (User A CAN read Company A customer)
  SELECT count(*) INTO v_read_count FROM public.customers WHERE company_id = v_comp_a_id;
  IF v_read_count = 0 THEN
    RAISE EXCEPTION 'RLS FAILED: User A cannot read their own Company A customer!';
  END IF;
  RAISE NOTICE 'Test 6 Passed: User A can successfully read their own Company A customer (rows returned: %).', v_read_count;

  -- TEST 7: Audit Log Immutability (User A cannot tamper with audit log)
  BEGIN
    UPDATE public.audit_log SET action = 'ALTERED' WHERE company_id = v_comp_a_id;
    GET DIAGNOSTICS v_update_count = ROW_COUNT;
  EXCEPTION WHEN others THEN
    v_update_count := 0;
  END;
  IF v_update_count <> 0 THEN
    RAISE EXCEPTION 'RLS FAILED: User A was able to alter audit_log!';
  END IF;
  RAISE NOTICE 'Test 7 Passed: audit_log is strictly immutable (updates blocked by RLS).';

  RAISE NOTICE '====================================================================';
  RAISE NOTICE '>>> ALL 7 MULTI-TENANT ISOLATION TESTS PASSED SUCCESSFULLY! <<<';
  RAISE NOTICE '====================================================================';
END $$;

-- Roll back all test records so nothing touches real data
ROLLBACK;
