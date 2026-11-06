-- =====================================================================
-- Tricycle Upholstery & Steel Works — Inventory & Job Order System
-- supabase/schema.sql  (idempotent: safe to re-run in the SQL editor)
--
-- Security model
--  * Every table has RLS enabled with NO policies and all table privileges
--    revoked from anon/authenticated  => the public API key can never read
--    or write a table directly.
--  * All access goes through SECURITY DEFINER RPC functions. After a PIN is
--    verified, verify_pin() returns a random session token (only its SHA-256
--    is stored). Every other RPC takes that token and re-checks role in SQL.
--  * PINs and security answers are hashed + salted with pgcrypto
--    crypt(..., gen_salt('bf')). Plaintext is never stored or returned.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                   uuid primary key default gen_random_uuid(),
  full_name            text not null,
  nickname             text not null unique,
  role                 text not null check (role in ('owner','admin','clerk')),
  pin_hash             text not null,
  security_question    text not null,
  security_answer_hash text not null,
  failed_attempts      int  not null default 0,
  locked_until         timestamptz,
  created_at           timestamptz not null default now()
);

create table if not exists public.app_sessions (
  token_hash text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_sessions_profile on public.app_sessions(profile_id);
create index if not exists idx_sessions_expires on public.app_sessions(expires_at);

create table if not exists public.suppliers (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null unique,
  contact_number     text not null default '',
  supplied_materials text[] not null default '{}',
  created_at         timestamptz not null default now()
);

create table if not exists public.materials (
  id              uuid primary key default gen_random_uuid(),
  category        text not null check (category in
                    ('Leather','Charol','Plywood','Wood/Lumber','Foam','Aluminum','Hardware/Consumables')),
  name            text not null,
  type            text not null default '',
  unit            text not null check (unit in ('Meters','Pcs','Roll','Box')),
  current_stock   numeric(12,2) not null default 0 check (current_stock >= 0),
  low_stock_level numeric(12,2) not null default 0 check (low_stock_level >= 0),
  unit_price      numeric(12,2) not null default 0 check (unit_price >= 0),
  supplier_id     uuid references public.suppliers(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (name, type)
);
create index if not exists idx_materials_supplier on public.materials(supplier_id);
create index if not exists idx_materials_category on public.materials(category);

create table if not exists public.services (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  variant    text not null default '',
  base_price numeric(12,2) not null check (base_price >= 0),
  is_addon   boolean not null default false,
  created_at timestamptz not null default now(),
  unique (name, variant)
);

create sequence if not exists public.job_order_seq start 1001;

create table if not exists public.job_orders (
  id              uuid primary key default gen_random_uuid(),
  job_no          bigint not null default nextval('public.job_order_seq'),
  customer_name   text not null,
  contact_details text not null default '',
  status          text not null default 'Pending'
                    check (status in ('Pending','In Progress','Ready for Pickup','Completed')),
  notes           text not null default '',
  total           numeric(12,2) not null default 0,
  created_by      uuid references public.profiles(id) on delete set null,
  created_by_name text not null default '',
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);
create index if not exists idx_jobs_status on public.job_orders(status);
create index if not exists idx_jobs_completed on public.job_orders(completed_at);
create index if not exists idx_jobs_created on public.job_orders(created_at desc);

create table if not exists public.job_order_items (
  id           uuid primary key default gen_random_uuid(),
  job_order_id uuid not null references public.job_orders(id) on delete cascade,
  kind         text not null check (kind in ('service','addon','custom')),
  name         text not null,
  description  text not null default '',
  unit_price   numeric(12,2) not null check (unit_price >= 0),
  quantity     numeric(12,2) not null default 1 check (quantity > 0)
);
create index if not exists idx_job_items_job on public.job_order_items(job_order_id);

create table if not exists public.job_order_materials (
  id             uuid primary key default gen_random_uuid(),
  job_order_id   uuid not null references public.job_orders(id) on delete cascade,
  material_id    uuid references public.materials(id) on delete set null,
  material_label text not null,
  quantity       numeric(12,2) not null check (quantity > 0)
);
create index if not exists idx_job_mats_job on public.job_order_materials(job_order_id);

-- Immutable audit trail (no FKs on purpose: rows must survive user/material removal)
create table if not exists public.audit_log (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  material_id    uuid,
  material_label text not null,
  action         text not null check (action in
                   ('stock_in','stock_out_usage','stock_out_wastage','job_deduction','adjustment','material_created')),
  quantity_delta numeric(12,2) not null,
  balance_after  numeric(12,2) not null,
  notes          text not null default '',
  job_order_id   uuid,
  user_id        uuid,
  user_name      text not null,
  user_role      text not null
);
create index if not exists idx_audit_created on public.audit_log(created_at desc);
create index if not exists idx_audit_action on public.audit_log(action);
create index if not exists idx_audit_material on public.audit_log(material_id);

create or replace function public.audit_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'AUDIT_IMMUTABLE: audit log entries cannot be edited or deleted';
end $$;

drop trigger if exists trg_audit_no_change on public.audit_log;
create trigger trg_audit_no_change before update or delete on public.audit_log
  for each row execute function public.audit_immutable();
drop trigger if exists trg_audit_no_truncate on public.audit_log;
create trigger trg_audit_no_truncate before truncate on public.audit_log
  for each statement execute function public.audit_immutable();

-- ---------------------------------------------------------------------
-- Row Level Security: enabled, no policies, no direct privileges
-- ---------------------------------------------------------------------
alter table public.profiles             enable row level security;
alter table public.app_sessions         enable row level security;
alter table public.suppliers            enable row level security;
alter table public.materials            enable row level security;
alter table public.services             enable row level security;
alter table public.job_orders           enable row level security;
alter table public.job_order_items      enable row level security;
alter table public.job_order_materials  enable row level security;
alter table public.audit_log            enable row level security;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- ---------------------------------------------------------------------
-- Internal helpers (not callable by API roles)
-- ---------------------------------------------------------------------
create or replace function public._auth(p_token text, p_roles text[] default null)
returns public.profiles
language plpgsql security definer set search_path = public, extensions as $$
declare v public.profiles;
begin
  select p.* into v
    from app_sessions s join profiles p on p.id = s.profile_id
   where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
     and s.expires_at > now();
  if not found then raise exception 'UNAUTHENTICATED'; end if;
  if p_roles is not null and not (v.role = any (p_roles)) then
    raise exception 'FORBIDDEN';
  end if;
  return v;
end $$;

create or replace function public._register_failure(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare f int;
begin
  update profiles set failed_attempts = failed_attempts + 1
   where id = p_id returning failed_attempts into f;
  if f >= 5 then
    update profiles set failed_attempts = 0, locked_until = now() + interval '60 seconds'
     where id = p_id;
    return 0;
  end if;
  return 5 - f;
end $$;

create or replace function public._log(
  u public.profiles, p_mid uuid, p_label text, p_action text,
  p_delta numeric, p_balance numeric, p_notes text, p_job uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log(material_id, material_label, action, quantity_delta, balance_after,
                        notes, job_order_id, user_id, user_name, user_role)
  values (p_mid, p_label, p_action, p_delta, p_balance, coalesce(p_notes, ''), p_job,
          u.id, u.nickname, u.role);
end $$;

revoke all on function public._auth(text, text[]) from public, anon, authenticated;
revoke all on function public._register_failure(uuid) from public, anon, authenticated;
revoke all on function public._log(public.profiles, uuid, text, text, numeric, numeric, text, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Authentication RPCs
-- ---------------------------------------------------------------------
-- Profile picker data: no secrets.
create or replace function public.list_profiles() returns jsonb
language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'nickname', nickname, 'full_name', full_name, 'role', role)
         order by case role when 'owner' then 0 when 'admin' then 1 else 2 end, nickname), '[]'::jsonb)
  from profiles;
$$;

create or replace function public.verify_pin(p_profile_id uuid, p_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v profiles; tok text; rem int;
begin
  select * into v from profiles where id = p_profile_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;

  if v.locked_until is not null and v.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'LOCKED',
      'retry_after', ceil(extract(epoch from (v.locked_until - now())))::int);
  end if;

  if p_pin is not null and v.pin_hash = crypt(p_pin, v.pin_hash) then
    update profiles set failed_attempts = 0, locked_until = null where id = v.id;
    delete from app_sessions where expires_at < now();
    tok := encode(gen_random_bytes(32), 'hex');
    insert into app_sessions(token_hash, profile_id, expires_at)
    values (encode(digest(tok, 'sha256'), 'hex'), v.id, now() + interval '8 hours');
    return jsonb_build_object('ok', true, 'token', tok, 'id', v.id,
      'nickname', v.nickname, 'full_name', v.full_name, 'role', v.role);
  end if;

  rem := _register_failure(v.id);
  if rem = 0 then
    return jsonb_build_object('ok', false, 'error', 'LOCKED', 'retry_after', 60);
  end if;
  return jsonb_build_object('ok', false, 'error', 'WRONG_PIN', 'remaining', rem);
end $$;

create or replace function public.me(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u profiles;
begin
  u := _auth(p_token);
  return jsonb_build_object('id', u.id, 'nickname', u.nickname, 'full_name', u.full_name,
                            'role', u.role, 'security_question', u.security_question);
end $$;

create or replace function public.logout(p_token text) returns void
language sql security definer set search_path = public, extensions as $$
  delete from app_sessions where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

create or replace function public.get_security_question(p_profile_id uuid) returns text
language sql security definer set search_path = public as $$
  select security_question from profiles where id = p_profile_id;
$$;

-- Forgot PIN: verify the security answer, then set a new PIN.
create or replace function public.reset_pin_with_answer(
  p_profile_id uuid, p_answer text, p_new_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v profiles; rem int;
begin
  if p_new_pin is null or p_new_pin !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_PIN');
  end if;
  select * into v from profiles where id = p_profile_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;

  if v.locked_until is not null and v.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'LOCKED',
      'retry_after', ceil(extract(epoch from (v.locked_until - now())))::int);
  end if;

  if v.security_answer_hash = crypt(lower(trim(coalesce(p_answer, ''))), v.security_answer_hash) then
    update profiles
       set pin_hash = crypt(p_new_pin, gen_salt('bf')), failed_attempts = 0, locked_until = null
     where id = v.id;
    delete from app_sessions where profile_id = v.id;
    return jsonb_build_object('ok', true);
  end if;

  rem := _register_failure(v.id);
  if rem = 0 then
    return jsonb_build_object('ok', false, 'error', 'LOCKED', 'retry_after', 60);
  end if;
  return jsonb_build_object('ok', false, 'error', 'WRONG_ANSWER', 'remaining', rem);
end $$;

create or replace function public.change_pin(p_token text, p_current text, p_new text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u profiles; rem int;
begin
  u := _auth(p_token);
  if p_new is null or p_new !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'error', 'INVALID_PIN');
  end if;
  if u.locked_until is not null and u.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'LOCKED');
  end if;
  if p_current is null or u.pin_hash <> crypt(p_current, u.pin_hash) then
    rem := _register_failure(u.id);
    return jsonb_build_object('ok', false, 'error', case when rem = 0 then 'LOCKED' else 'WRONG_PIN' end);
  end if;
  update profiles set pin_hash = crypt(p_new, gen_salt('bf')), failed_attempts = 0 where id = u.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.change_security_question(
  p_token text, p_current_pin text, p_question text, p_answer text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u profiles; rem int;
begin
  u := _auth(p_token);
  if coalesce(trim(p_question), '') = '' or coalesce(trim(p_answer), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Question and answer are required');
  end if;
  if u.locked_until is not null and u.locked_until > now() then
    return jsonb_build_object('ok', false, 'error', 'LOCKED');
  end if;
  if p_current_pin is null or u.pin_hash <> crypt(p_current_pin, u.pin_hash) then
    rem := _register_failure(u.id);
    return jsonb_build_object('ok', false, 'error', case when rem = 0 then 'LOCKED' else 'WRONG_PIN' end);
  end if;
  update profiles
     set security_question = trim(p_question),
         security_answer_hash = crypt(lower(trim(p_answer)), gen_salt('bf')),
         failed_attempts = 0
   where id = u.id;
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------
-- User management (owner/admin; only owner can delete)
-- ---------------------------------------------------------------------
create or replace function public.list_users(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u profiles;
begin
  u := _auth(p_token, array['owner','admin']);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'full_name', full_name, 'nickname', nickname, 'role', role, 'created_at', created_at)
      order by case role when 'owner' then 0 when 'admin' then 1 else 2 end, nickname)
    from profiles), '[]'::jsonb);
end $$;

create or replace function public.create_profile(
  p_token text, p_full_name text, p_nickname text, p_role text,
  p_pin text, p_question text, p_answer text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u profiles; nid uuid;
begin
  u := _auth(p_token, array['owner','admin']);
  if p_role not in ('admin','clerk') then raise exception 'Role must be Admin or Inventory Clerk'; end if;
  if coalesce(trim(p_full_name), '') = '' or coalesce(trim(p_nickname), '') = '' then
    raise exception 'Full name and nickname are required';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then raise exception 'PIN must be exactly 4 digits'; end if;
  if coalesce(trim(p_question), '') = '' or coalesce(trim(p_answer), '') = '' then
    raise exception 'Security question and answer are required';
  end if;
  begin
    insert into profiles(full_name, nickname, role, pin_hash, security_question, security_answer_hash)
    values (trim(p_full_name), trim(p_nickname), p_role,
            crypt(p_pin, gen_salt('bf')), trim(p_question),
            crypt(lower(trim(p_answer)), gen_salt('bf')))
    returning id into nid;
  exception when unique_violation then
    raise exception 'That nickname is already in use';
  end;
  return jsonb_build_object('id', nid);
end $$;

create or replace function public.delete_profile(p_token text, p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare u profiles; t profiles;
begin
  u := _auth(p_token, array['owner']);
  select * into t from profiles where id = p_id;
  if not found then raise exception 'User not found'; end if;
  if t.id = u.id or t.role = 'owner' then raise exception 'The owner profile cannot be deleted'; end if;
  delete from profiles where id = p_id;
end $$;

-- Owner can reset anyone; Admin can reset Clerk PINs.
create or replace function public.admin_reset_pin(p_token text, p_target uuid, p_new_pin text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare u profiles; t profiles;
begin
  u := _auth(p_token, array['owner','admin']);
  if p_new_pin is null or p_new_pin !~ '^[0-9]{4}$' then raise exception 'PIN must be exactly 4 digits'; end if;
  select * into t from profiles where id = p_target;
  if not found then raise exception 'User not found'; end if;
  if u.role = 'admin' and t.role <> 'clerk' then
    raise exception 'FORBIDDEN: admins can only reset Inventory Clerk PINs';
  end if;
  update profiles
     set pin_hash = crypt(p_new_pin, gen_salt('bf')), failed_attempts = 0, locked_until = null
   where id = t.id;
  delete from app_sessions where profile_id = t.id;
end $$;

-- ---------------------------------------------------------------------
-- Materials & stock (clerks see quantities only — price is nulled in SQL)
-- ---------------------------------------------------------------------
create or replace function public.list_materials(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u profiles;
begin
  u := _auth(p_token);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id, 'category', m.category, 'name', m.name, 'type', m.type, 'unit', m.unit,
      'current_stock', m.current_stock, 'low_stock_level', m.low_stock_level,
      'unit_price', case when u.role = 'clerk' then null else m.unit_price end,
      'supplier_id', m.supplier_id, 'supplier_name', s.name, 'supplier_phone', s.contact_number)
      order by m.category, m.name, m.type)
    from materials m left join suppliers s on s.id = m.supplier_id), '[]'::jsonb);
end $$;

-- Any role may register a new material (FR-022). Clerks cannot set price/opening stock.
create or replace function public.create_material(
  p_token text, p_category text, p_name text, p_type text, p_unit text,
  p_low numeric, p_supplier uuid, p_price numeric default 0, p_stock numeric default 0) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u profiles; m materials; price numeric; stock numeric;
begin
  u := _auth(p_token);
  if coalesce(trim(p_name), '') = '' then raise exception 'Material name is required'; end if;
  price := case when u.role = 'clerk' then 0 else greatest(coalesce(p_price, 0), 0) end;
  stock := case when u.role = 'clerk' then 0 else greatest(coalesce(p_stock, 0), 0) end;
  begin
    insert into materials(category, name, type, unit, current_stock, low_stock_level, unit_price, supplier_id)
    values (p_category, trim(p_name), trim(coalesce(p_type, '')), p_unit, stock,
            greatest(coalesce(p_low, 0), 0), price, p_supplier)
    returning * into m;
  exception when unique_violation then
    raise exception 'That material and type already exist';
  end;
  perform _log(u, m.id, trim(m.name || ' ' || m.type), 'material_created', stock, stock, 'New material registered', null);
  return jsonb_build_object('id', m.id);
end $$;

-- Edits metadata only; stock changes go through stock_transaction / stock_adjust.
create or replace function public.update_material(
  p_token text, p_id uuid, p_category text, p_name text, p_type text, p_unit text,
  p_low numeric, p_price numeric, p_supplier uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare u profiles;
begin
  u := _auth(p_token, array['owner','admin']);
  begin
    update materials
       set category = p_category, name = trim(p_name), type = trim(coalesce(p_type, '')), unit = p_unit,
           low_stock_level = greatest(coalesce(p_low, 0), 0),
           unit_price = greatest(coalesce(p_price, 0), 0), supplier_id = p_supplier
     where id = p_id;
  exception when unique_violation then
    raise exception 'That material and type already exist';
  end;
  if not found then raise exception 'Material not found'; end if;
end $$;

-- Atomic stock in/out. The row lock serialises concurrent transactions so
-- stock can never go negative (NFR-004).
create or replace function public.stock_transaction(
  p_token text, p_material_id uuid, p_kind text, p_qty numeric,
  p_reason text default null, p_notes text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u profiles; m materials; d numeric; act text;
begin
  u := _auth(p_token);
  if p_kind not in ('in', 'out') then raise exception 'Invalid transaction type'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Quantity must be greater than zero'; end if;

  select * into m from materials where id = p_material_id for update;
  if not found then raise exception 'Material not found'; end if;

  d := case when p_kind = 'in' then p_qty else -p_qty end;
  if m.current_stock + d < 0 then
    raise exception 'INSUFFICIENT_STOCK: only % % available', m.current_stock, m.unit;
  end if;

  update materials set current_stock = current_stock + d where id = m.id returning * into m;
  act := case when p_kind = 'in' then 'stock_in'
              when p_reason = 'wastage' then 'stock_out_wastage'
              else 'stock_out_usage' end;
  perform _log(u, m.id, trim(m.name || ' ' || m.type), act, d, m.current_stock, p_notes, null);
  return jsonb_build_object('balance', m.current_stock);
end $$;

-- Admin adjustment (signed delta, reason required).
create or replace function public.stock_adjust(
  p_token text, p_material_id uuid, p_delta numeric, p_reason text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u profiles; m materials;
begin
  u := _auth(p_token, array['owner','admin']);
  if p_delta is null or p_delta = 0 then raise exception 'Adjustment cannot be zero'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required for adjustments'; end if;

  select * into m from materials where id = p_material_id for update;
  if not found then raise exception 'Material not found'; end if;
  if m.current_stock + p_delta < 0 then
    raise exception 'INSUFFICIENT_STOCK: adjustment would make stock negative (% % on hand)', m.current_stock, m.unit;
  end if;

  update materials set current_stock = current_stock + p_delta where id = m.id returning * into m;
  perform _log(u, m.id, trim(m.name || ' ' || m.type), 'adjustment', p_delta, m.current_stock, p_reason, null);
  return jsonb_build_object('balance', m.current_stock);
end $$;

-- ---------------------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------------------
create or replace function public.list_suppliers(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u profiles;
begin
  u := _auth(p_token);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'contact_number', s.contact_number,
      'supplied_materials', to_jsonb(s.supplied_materials),
      'items', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', m.id, 'name', m.name, 'type', m.type, 'unit', m.unit,
                  'current_stock', m.current_stock, 'low_stock_level', m.low_stock_level)
                  order by m.name, m.type), '[]'::jsonb)
                from materials m where m.supplier_id = s.id))
      order by s.name)
    from suppliers s), '[]'::jsonb);
end $$;

create or replace function public.upsert_supplier(
  p_token text, p_id uuid, p_name text, p_contact text, p_supplied text[]) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u profiles; sid uuid;
begin
  u := _auth(p_token, array['owner','admin']);
  if coalesce(trim(p_name), '') = '' then raise exception 'Supplier name is required'; end if;
  begin
    if p_id is null then
      insert into suppliers(name, contact_number, supplied_materials)
      values (trim(p_name), trim(coalesce(p_contact, '')), coalesce(p_supplied, '{}'))
      returning id into sid;
    else
      update suppliers set name = trim(p_name), contact_number = trim(coalesce(p_contact, '')),
             supplied_materials = coalesce(p_supplied, '{}')
       where id = p_id returning id into sid;
      if sid is null then raise exception 'Supplier not found'; end if;
    end if;
  exception when unique_violation then
    raise exception 'A supplier with that name already exists';
  end;
  return jsonb_build_object('id', sid);
end $$;

create or replace function public.delete_supplier(p_token text, p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare u profiles;
begin
  u := _auth(p_token, array['owner','admin']);
  delete from suppliers where id = p_id;  -- linked materials keep existing (supplier_id set null)
end $$;

-- ---------------------------------------------------------------------
-- Service & product catalog
-- ---------------------------------------------------------------------
create or replace function public.list_services(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u profiles;
begin
  u := _auth(p_token, array['owner','admin']);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'variant', variant, 'base_price', base_price, 'is_addon', is_addon)
      order by is_addon, base_price desc, name)
    from services), '[]'::jsonb);
end $$;

create or replace function public.upsert_service(
  p_token text, p_id uuid, p_name text, p_variant text, p_price numeric, p_addon boolean) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u profiles; sid uuid;
begin
  u := _auth(p_token, array['owner','admin']);
  if coalesce(trim(p_name), '') = '' then raise exception 'Service name is required'; end if;
  if p_price is null or p_price < 0 then raise exception 'Enter a valid price'; end if;
  begin
    if p_id is null then
      insert into services(name, variant, base_price, is_addon)
      values (trim(p_name), trim(coalesce(p_variant, '')), p_price, coalesce(p_addon, false))
      returning id into sid;
    else
      update services set name = trim(p_name), variant = trim(coalesce(p_variant, '')),
             base_price = p_price, is_addon = coalesce(p_addon, false)
       where id = p_id returning id into sid;
      if sid is null then raise exception 'Service not found'; end if;
    end if;
  exception when unique_violation then
    raise exception 'That service and variant already exist';
  end;
  return jsonb_build_object('id', sid);
end $$;

create or replace function public.delete_service(p_token text, p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare u profiles;
begin
  u := _auth(p_token, array['owner','admin']);
  delete from services where id = p_id;
end $$;

-- ---------------------------------------------------------------------
-- Job orders (all-or-nothing: materials are deducted atomically)
-- p_payload = { customer_name, contact_details, status, notes,
--               items:[{kind,name,description,unit_price,quantity}],
--               materials:[{material_id, quantity}] }
-- ---------------------------------------------------------------------
create or replace function public.create_job_order(p_token text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  u profiles; jid uuid; jno bigint; st text; v_total numeric := 0;
  it jsonb; mt jsonb; m materials; q numeric; price numeric; iq numeric;
begin
  u := _auth(p_token, array['owner','admin']);
  st := coalesce(p_payload->>'status', 'Pending');
  if st not in ('Pending','In Progress','Ready for Pickup','Completed') then
    raise exception 'Invalid status';
  end if;
  if coalesce(trim(p_payload->>'customer_name'), '') = '' then
    raise exception 'Customer name is required';
  end if;
  if jsonb_array_length(coalesce(p_payload->'items', '[]'::jsonb)) = 0 then
    raise exception 'Add at least one service or line item';
  end if;

  insert into job_orders(customer_name, contact_details, status, notes,
                         created_by, created_by_name, completed_at)
  values (trim(p_payload->>'customer_name'), trim(coalesce(p_payload->>'contact_details', '')), st,
          trim(coalesce(p_payload->>'notes', '')), u.id, u.nickname,
          case when st = 'Completed' then now() end)
  returning id, job_no into jid, jno;

  for it in select value from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb)) loop
    if coalesce(trim(it->>'name'), '') = '' then raise exception 'Every line item needs a name'; end if;
    price := coalesce((it->>'unit_price')::numeric, 0);
    iq := coalesce((it->>'quantity')::numeric, 1);
    if price < 0 or iq <= 0 then raise exception 'Invalid price or quantity on a line item'; end if;
    insert into job_order_items(job_order_id, kind, name, description, unit_price, quantity)
    values (jid, case when it->>'kind' in ('service','addon','custom') then it->>'kind' else 'custom' end,
            trim(it->>'name'), trim(coalesce(it->>'description', '')), price, iq);
    v_total := v_total + price * iq;
  end loop;

  -- lock materials in a stable order to avoid deadlocks
  for mt in select value from jsonb_array_elements(coalesce(p_payload->'materials', '[]'::jsonb)) order by value->>'material_id' loop
    q := (mt->>'quantity')::numeric;
    if q is null or q <= 0 then raise exception 'Material quantity must be greater than zero'; end if;
    select * into m from materials where id = (mt->>'material_id')::uuid for update;
    if not found then raise exception 'Material not found'; end if;
    if m.current_stock < q then
      raise exception 'INSUFFICIENT_STOCK: % has only % % available', trim(m.name || ' ' || m.type), m.current_stock, m.unit;
    end if;
    update materials set current_stock = current_stock - q where id = m.id returning * into m;
    insert into job_order_materials(job_order_id, material_id, material_label, quantity)
    values (jid, m.id, trim(m.name || ' ' || m.type), q);
    perform _log(u, m.id, trim(m.name || ' ' || m.type), 'job_deduction', -q, m.current_stock,
                 'Job Order #' || jno || ' — ' || trim(p_payload->>'customer_name'), jid);
  end loop;

  update job_orders set total = v_total where id = jid;
  return jsonb_build_object('id', jid, 'job_no', jno);
end $$;

create or replace function public.update_job_status(p_token text, p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare u profiles;
begin
  u := _auth(p_token, array['owner','admin']);
  if p_status not in ('Pending','In Progress','Ready for Pickup','Completed') then
    raise exception 'Invalid status';
  end if;
  update job_orders
     set status = p_status,
         completed_at = case when p_status = 'Completed' then coalesce(completed_at, now()) else null end
   where id = p_id;
  if not found then raise exception 'Job order not found'; end if;
end $$;

create or replace function public.list_job_orders(p_token text, p_status text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u profiles;
begin
  u := _auth(p_token, array['owner','admin']);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', j.id, 'job_no', j.job_no, 'customer_name', j.customer_name,
      'contact_details', j.contact_details, 'status', j.status, 'notes', j.notes,
      'total', j.total, 'created_by_name', j.created_by_name,
      'created_at', j.created_at, 'completed_at', j.completed_at,
      'items', (select coalesce(jsonb_agg(jsonb_build_object(
                  'kind', i.kind, 'name', i.name, 'description', i.description,
                  'unit_price', i.unit_price, 'quantity', i.quantity)), '[]'::jsonb)
                from job_order_items i where i.job_order_id = j.id),
      'materials', (select coalesce(jsonb_agg(jsonb_build_object(
                  'label', x.material_label, 'quantity', x.quantity)), '[]'::jsonb)
                from job_order_materials x where x.job_order_id = j.id))
      order by j.created_at desc)
    from job_orders j
    where p_status is null or j.status = p_status), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------
-- Dashboard, audit trail, reports (owner/admin only)
-- ---------------------------------------------------------------------
create or replace function public.dashboard(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u profiles;
begin
  u := _auth(p_token, array['owner','admin']);
  return jsonb_build_object(
    'inventory_value', (select coalesce(sum(current_stock * unit_price), 0) from materials),
    'low_stock_count', (select count(*) from materials where current_stock <= low_stock_level),
    'active_jobs',     (select count(*) from job_orders where status <> 'Completed'),
    'monthly_revenue', (select coalesce(sum(total), 0) from job_orders
                         where status = 'Completed'
                           and date_trunc('month', completed_at at time zone 'Asia/Manila')
                             = date_trunc('month', now() at time zone 'Asia/Manila')),
    'low_stock', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', m.id, 'name', m.name, 'type', m.type, 'unit', m.unit,
                    'current_stock', m.current_stock, 'low_stock_level', m.low_stock_level,
                    'supplier_name', s.name, 'supplier_phone', s.contact_number)
                    order by (m.current_stock / nullif(m.low_stock_level, 0)), m.name), '[]'::jsonb)
                  from materials m left join suppliers s on s.id = m.supplier_id
                  where m.current_stock <= m.low_stock_level),
    'recent', (select coalesce(jsonb_agg(to_jsonb(a) order by a.id desc), '[]'::jsonb)
                 from (select id, created_at, material_label, action, quantity_delta,
                              notes, user_name, user_role
                         from audit_log order by id desc limit 10) a)
  );
end $$;

create or replace function public.audit_list(
  p_token text, p_action text default null, p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u profiles;
begin
  u := _auth(p_token, array['owner','admin']);
  return jsonb_build_object(
    'total', (select count(*) from audit_log where p_action is null or action = p_action),
    'rows', (select coalesce(jsonb_agg(to_jsonb(a) order by a.id desc), '[]'::jsonb)
               from (select * from audit_log
                      where p_action is null or action = p_action
                      order by id desc
                      limit greatest(p_limit, 1) offset greatest(p_offset, 0)) a));
end $$;

create or replace function public.report(p_token text, p_from date, p_to date) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare u profiles;
begin
  u := _auth(p_token, array['owner','admin']);
  return jsonb_build_object(
    'total_revenue', (select coalesce(sum(total), 0) from job_orders
                       where status = 'Completed'
                         and (completed_at at time zone 'Asia/Manila')::date between p_from and p_to),
    'job_count', (select count(*) from job_orders
                   where status = 'Completed'
                     and (completed_at at time zone 'Asia/Manila')::date between p_from and p_to),
    'jobs', (select coalesce(jsonb_agg(jsonb_build_object(
                'job_no', j.job_no, 'customer_name', j.customer_name, 'total', j.total,
                'completed_at', j.completed_at) order by j.completed_at desc), '[]'::jsonb)
               from job_orders j
              where j.status = 'Completed'
                and (j.completed_at at time zone 'Asia/Manila')::date between p_from and p_to),
    'top_materials', (select coalesce(jsonb_agg(jsonb_build_object(
                'material', t.label, 'quantity', t.qty) order by t.qty desc), '[]'::jsonb)
               from (select material_label as label, sum(-quantity_delta) as qty
                       from audit_log
                      where quantity_delta < 0
                        and action in ('job_deduction', 'stock_out_usage')
                        and (created_at at time zone 'Asia/Manila')::date between p_from and p_to
                      group by material_label
                      order by qty desc limit 10) t)
  );
end $$;

-- ---------------------------------------------------------------------
-- Seed data (re-runnable: ON CONFLICT DO NOTHING)
-- Default PIN 1234 · Security question "What is the shop city?" · Answer "Bulacan"
-- (answers are normalised with lower(trim()) before hashing)
-- ---------------------------------------------------------------------
insert into public.profiles (full_name, nickname, role, pin_hash, security_question, security_answer_hash)
select v.full_name, v.nickname, v.role,
       extensions.crypt('1234', extensions.gen_salt('bf')),
       'What is the shop city?',
       extensions.crypt('bulacan', extensions.gen_salt('bf'))
from (values
  ('Roberto Delos Santos', 'Sir Roberto', 'owner'),
  ('Admin Member 1', 'Member 1', 'admin'),
  ('Admin Member 2', 'Member 2', 'admin'),
  ('Admin Member 3', 'Member 3', 'admin'),
  ('Admin Member 4', 'Member 4', 'admin'),
  ('Admin Member 5', 'Member 5', 'admin'),
  ('Professor',      'Member 6', 'admin'),
  ('Renelou Delos Santos', 'Renelou', 'clerk')
) as v(full_name, nickname, role)
on conflict (nickname) do nothing;

insert into public.suppliers (name, contact_number, supplied_materials) values
  ('KMCB Trading',      '09424855026', array['Leather','Charol','Foam','Aluminum Molding','Thread','Staples']),
  ('Triple J Hardware', '09753694918', array['Good Lumber','Plywood','Stick','Wood Materials'])
on conflict (name) do nothing;

insert into public.materials (category, name, type, unit, current_stock, low_stock_level, unit_price, supplier_id)
select v.category, v.name, v.type, v.unit, v.stock, v.low, v.price,
       (select id from public.suppliers where name = v.supplier)
from (values
  ('Leather',              'Leather',           'Design 12',                           'Meters',  3, 5,  105.00, 'KMCB Trading'),
  ('Charol',               'Charol',            'Black',                               'Meters', 30, 10,  75.00, 'KMCB Trading'),
  ('Charol',               'Charol',            'White',                               'Meters',  9, 10,  75.00, 'KMCB Trading'),
  ('Charol',               'Charol',            'Blue, Violet, Yellow, Pink, Cream',   'Meters',  3, 5,   75.00, 'KMCB Trading'),
  ('Plywood',              'Plywood (Flywood)', '1/4',                                 'Pcs',    12, 5,  120.00, 'Triple J Hardware'),
  ('Wood/Lumber',          'Stick',             '1/2 x 6',                             'Pcs',    30, 10,  15.00, 'Triple J Hardware'),
  ('Wood/Lumber',          'Good Lumber',       '1 x 1/2',                             'Pcs',    12, 5,  175.00, 'Triple J Hardware'),
  ('Foam',                 'Foam',              '1" and 2"',                           'Pcs',     6, 5,  250.00, 'KMCB Trading'),
  ('Aluminum',             'Aluminum Molding',  'Standard',                            'Pcs',    12, 5,   85.00, 'KMCB Trading'),
  ('Hardware/Consumables', 'Thread',            'Standard',                            'Roll',    1, 2,   50.00, 'KMCB Trading'),
  ('Hardware/Consumables', 'Tacker',            'Heavy Duty',                          'Pcs',     2, 1,  350.00, 'KMCB Trading'),
  ('Hardware/Consumables', 'Staples',           'Standard',                            'Box',     5, 2,   65.00, 'KMCB Trading')
) as v(category, name, type, unit, stock, low, price, supplier)
on conflict (name, type) do nothing;

insert into public.services (name, variant, base_price, is_addon) values
  ('Tricycle',                                       'Standard',     2500.00, false),
  ('Trike Sidecar Only',                             'Standard',     1800.00, false),
  ('Driver Shade',                                   'Standard',     1200.00, false),
  ('Cargo Tricycle (Kolong)',                        'Standard',     3000.00, false),
  ('Tricycle Seat w/ Backrest (Upuan w/ sandalan)',  'Standard',     1200.00, false),
  ('Trapal (1 Set)',                                 'Complete Set', 1200.00, false),
  ('Trapal (Side)',                                  'Side Only',     400.00, false),
  ('Trapal (Front)',                                 'Front Only',    500.00, false),
  ('Trapal (Gutter)',                                'Gutter Only',   300.00, false),
  ('Custom Design Addition',                         'Per Design',    300.00, true)
on conflict (name, variant) do nothing;
