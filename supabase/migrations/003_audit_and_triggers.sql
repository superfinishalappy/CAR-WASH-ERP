-- Migration 003: Audit log triggers and date/company lock trigger
-- Enforces:
-- 1. Non-owners cannot alter entry_date or company_id on updates
-- 2. Audit log trigger captures every insert, update, and delete with user_id and old/new json data

-- 1. Date and Company immutability trigger for non-owners/platform
create or replace function public.trg_prevent_entry_date_company_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Platform and Owner are allowed to modify entry_date
  if public.is_platform() or public.auth_role() = 'owner' then
    -- Company_id must still never be altered across tenants
    if old.company_id is distinct from new.company_id then
      raise exception 'Cross-tenant migration of records is prohibited';
    end if;
    return new;
  end if;

  -- Non-owners cannot change entry_date
  if old.entry_date is distinct from new.entry_date then
    raise exception 'Permission denied: non-owners cannot alter entry_date';
  end if;

  -- Non-owners cannot change company_id
  if old.company_id is distinct from new.company_id then
    raise exception 'Permission denied: company_id is immutable';
  end if;

  return new;
end;
$$;

-- Apply immutability trigger on business tables
drop trigger if exists trg_lock_jobs on jobs;
create trigger trg_lock_jobs
before update on jobs
for each row execute function trg_prevent_entry_date_company_change();

drop trigger if exists trg_lock_expenses on expenses;
create trigger trg_lock_expenses
before update on expenses
for each row execute function trg_prevent_entry_date_company_change();

drop trigger if exists trg_lock_advances on advances;
create trigger trg_lock_advances
before update on advances
for each row execute function trg_prevent_entry_date_company_change();

drop trigger if exists trg_lock_attendance on attendance;
create trigger trg_lock_attendance
before update on attendance
for each row execute function trg_prevent_entry_date_company_change();

drop trigger if exists trg_lock_customer_payments on customer_payments;
create trigger trg_lock_customer_payments
before update on customer_payments
for each row execute function trg_prevent_entry_date_company_change();

-- 2. Generic Audit Log Trigger
create or replace function public.trg_audit_log_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  rid uuid;
  old_rec jsonb := null;
  new_rec jsonb := null;
  actor uuid;
begin
  actor := auth.uid();

  if tg_op = 'INSERT' then
    new_rec := to_jsonb(new);
    cid := (new_rec->>'company_id')::uuid;
    rid := (new_rec->>'id')::uuid;
  elsif tg_op = 'UPDATE' then
    old_rec := to_jsonb(old);
    new_rec := to_jsonb(new);
    cid := (new_rec->>'company_id')::uuid;
    rid := (new_rec->>'id')::uuid;
  elsif tg_op = 'DELETE' then
    old_rec := to_jsonb(old);
    cid := (old_rec->>'company_id')::uuid;
    rid := (old_rec->>'id')::uuid;
  end if;

  insert into public.audit_log (
    company_id,
    table_name,
    row_id,
    action,
    old_data,
    new_data,
    user_id,
    at
  ) values (
    cid,
    tg_table_name,
    rid,
    tg_op,
    old_rec,
    new_rec,
    actor,
    now()
  );

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

-- Apply audit log triggers to business tables
drop trigger if exists trg_audit_companies on companies;
create trigger trg_audit_companies
after insert or update or delete on companies
for each row execute function trg_audit_log_record();

drop trigger if exists trg_audit_profiles on profiles;
create trigger trg_audit_profiles
after insert or update or delete on profiles
for each row execute function trg_audit_log_record();

drop trigger if exists trg_audit_customers on customers;
create trigger trg_audit_customers
after insert or update or delete on customers
for each row execute function trg_audit_log_record();

drop trigger if exists trg_audit_jobs on jobs;
create trigger trg_audit_jobs
after insert or update or delete on jobs
for each row execute function trg_audit_log_record();

drop trigger if exists trg_audit_expenses on expenses;
create trigger trg_audit_expenses
after insert or update or delete on expenses
for each row execute function trg_audit_log_record();

drop trigger if exists trg_audit_advances on advances;
create trigger trg_audit_advances
after insert or update or delete on advances
for each row execute function trg_audit_log_record();

drop trigger if exists trg_audit_attendance on attendance;
create trigger trg_audit_attendance
after insert or update or delete on attendance
for each row execute function trg_audit_log_record();

drop trigger if exists trg_audit_customer_payments on customer_payments;
create trigger trg_audit_customer_payments
after insert or update or delete on customer_payments
for each row execute function trg_audit_log_record();
