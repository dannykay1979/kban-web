-- ============================================================
-- KBAN Route Confirmations (FedEx Preston route rebalance)
-- Run once in the Supabase SQL editor.
-- Drivers never touch the table. They call two functions with their
-- personal token. Staff (signed in) read the table for the tracker.
-- ============================================================

create table if not exists route_confirmations (
  token         text        primary key,
  route         integer     not null,
  driver_name   text        not null,
  email         text,
  wave          text,
  area          text,
  sectors       jsonb       not null default '[]',
  return_by     date,
  opened_at     timestamptz,
  submitted_at  timestamptz,
  revisions     integer     not null default 0,
  acks          jsonb,
  load_plan     jsonb,
  notes         text,
  signed_name   text,
  created_at    timestamptz not null default now()
);

alter table route_confirmations enable row level security;

drop policy if exists "Staff manage route confirmations" on route_confirmations;
create policy "Staff manage route confirmations"
  on route_confirmations for all
  to authenticated
  using (true)
  with check (true);

-- No anon policy: anon cannot read or write the table directly.

create or replace function get_route_confirmation(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare r route_confirmations;
begin
  if p_token is null or length(p_token) < 16 then return null; end if;
  update route_confirmations
     set opened_at = coalesce(opened_at, now())
   where token = p_token
   returning * into r;
  if not found then return null; end if;
  return json_build_object(
    'route', r.route, 'driver_name', r.driver_name, 'wave', r.wave,
    'area', r.area, 'sectors', r.sectors, 'return_by', r.return_by,
    'submitted_at', r.submitted_at, 'acks', r.acks,
    'load_plan', r.load_plan, 'notes', r.notes, 'signed_name', r.signed_name
  );
end $$;

create or replace function submit_route_confirmation(
  p_token text, p_acks jsonb, p_load_plan jsonb, p_notes text, p_signed_name text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare r route_confirmations;
begin
  if p_token is null or length(p_token) < 16 then return json_build_object('ok', false, 'error', 'invalid'); end if;
  if coalesce(trim(p_signed_name), '') = '' then return json_build_object('ok', false, 'error', 'name'); end if;
  if p_acks is null or jsonb_array_length(p_acks) <> 3 then return json_build_object('ok', false, 'error', 'acks'); end if;
  if exists (select 1 from jsonb_array_elements(p_acks) a where a <> 'true'::jsonb) then
    return json_build_object('ok', false, 'error', 'acks');
  end if;
  if p_load_plan is null or jsonb_typeof(p_load_plan) <> 'array' then
    return json_build_object('ok', false, 'error', 'plan');
  end if;
  update route_confirmations
     set acks = p_acks,
         load_plan = p_load_plan,
         notes = left(coalesce(p_notes, ''), 1000),
         signed_name = left(trim(p_signed_name), 120),
         submitted_at = now(),
         opened_at = coalesce(opened_at, now()),
         revisions = revisions + 1
   where token = p_token
   returning * into r;
  if not found then return json_build_object('ok', false, 'error', 'invalid'); end if;
  return json_build_object('ok', true, 'submitted_at', r.submitted_at);
end $$;

revoke all on function get_route_confirmation(text) from public;
revoke all on function submit_route_confirmation(text, jsonb, jsonb, text, text) from public;
grant execute on function get_route_confirmation(text) to anon, authenticated;
grant execute on function submit_route_confirmation(text, jsonb, jsonb, text, text) to anon, authenticated;
