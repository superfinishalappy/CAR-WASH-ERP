-- ==============================================================================
-- Migration 009: Allow Customer Vehicles to be Marked as Paid
-- Removes legacy constraint that blocked customer vehicles from being marked Paid
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/wzddoscnrcclgkmwedhd/sql
-- ==============================================================================

-- 1. Drop check constraint on public.jobs that forced is_paid = false for customer vehicles
alter table if exists public.jobs drop constraint if exists jobs_check;
alter table if exists public.jobs drop constraint if exists jobs_customer_id_check;

-- 2. Drop any existing function check triggers if any
do $$ begin
  if exists (
    select 1 from pg_constraint 
    where conrelid = 'public.jobs'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%customer_id%is_paid%'
  ) then
    execute (
      select 'alter table public.jobs drop constraint ' || quote_ident(conname)
      from pg_constraint 
      where conrelid = 'public.jobs'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%customer_id%is_paid%'
      limit 1
    );
  end if;
end $$;

-- 3. Confirm is_paid column is clean boolean
alter table if exists public.jobs alter column is_paid set default false;
