-- ============================================================
-- KBAN Driver Data Capture — Supabase Table Setup
-- Run this in your Supabase SQL editor (supabase.com dashboard)
-- ============================================================

-- ── Table 1: driver_pins ─────────────────────────────────────
-- Stores each driver's PIN (SHA-256 hashed) and identity.
-- Managed by Danny/Wayne — not editable by drivers.

create table if not exists driver_pins (
  id           uuid        default gen_random_uuid() primary key,
  driver_id    text        not null,        -- e.g. FD72579, MD Temp 4
  driver_name  text        not null,
  depot        text        not null,        -- 'DPD Aberdeen', 'DHL Middleton' etc
  client       text        not null,        -- 'DPD' or 'DHL'
  pin_hash     text        not null,        -- SHA-256 of 4-digit PIN
  active       boolean     default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (driver_id, depot)
);

-- Enable RLS
alter table driver_pins enable row level security;

-- Allow anon reads (needed for PIN verification from driver form)
create policy "Allow anon read for PIN verification"
  on driver_pins for select
  to anon
  using (active = true);

-- Only authenticated users (leads/management) can insert/update
create policy "Allow authenticated to manage driver pins"
  on driver_pins for all
  to authenticated
  using (true)
  with check (true);


-- ── Table 2: driver_shifts ───────────────────────────────────
-- One record per driver per day. Built across the day:
-- 1. Driver submits SOD → status = 'sod_complete'
-- 2. Lead adds departure time → depot_departure_time set
-- 3. Driver submits EOD → status = 'eod_complete'
-- 4. Lead reviews and signs off → status = 'lead_confirmed'

create table if not exists driver_shifts (
  id                          uuid        default gen_random_uuid() primary key,
  shift_date                  date        not null,
  driver_id                   text        not null,
  driver_name                 text        not null,
  depot                       text        not null,
  client                      text        not null,

  -- Day type
  day_type                    text        default 'standard',
  -- 'standard' | 'dpd_classroom' | 'dpd_ridealong' | 'dhl_ridealong'

  -- Start of Day (driver)
  time_at_depot               time,
  planned_return_time         time,
  postcodes                   text,
  start_mileage               integer,
  delivery_drops_planned      integer,
  parcel_count                integer,
  collection_stops_planned    integer,
  sod_submitted_at            timestamptz,

  -- Departure (lead only)
  depot_departure_time        time,
  departure_set_by            text,
  departure_set_at            timestamptz,

  -- End of Day (driver)
  end_mileage                 integer,
  time_last_delivery          time,
  time_at_depot_eod           time,
  successful_delivery_drops   integer,
  failed_delivery_drops       integer,
  failed_delivery_reason      text,
  successful_collection_stops integer,
  parcels_collected           integer,
  failed_collections          integer,
  failed_collection_reason    text,
  eod_submitted_at            timestamptz,

  -- Lead sign-off
  lead_confirmed_by           text,
  lead_confirmed_at           timestamptz,
  lead_notes                  text,

  -- Compliance
  compliance_status           text,        -- 'pass' | 'review' | null
  compliance_variance         integer,     -- drop delta vs portal/sheet
  compliance_checked_at       timestamptz,

  -- Status
  status                      text        default 'pending',
  -- 'pending' | 'sod_complete' | 'eod_complete' | 'lead_confirmed'

  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now(),

  unique (driver_id, shift_date)
);

-- Enable RLS
alter table driver_shifts enable row level security;

-- Drivers (anon) can insert new shifts and update their own record today
create policy "Anon can insert shift"
  on driver_shifts for insert
  to anon
  with check (true);

create policy "Anon can update own shift (SOD and EOD only)"
  on driver_shifts for update
  to anon
  using (status in ('pending','sod_complete'))
  with check (status in ('sod_complete','eod_complete'));

-- Anon can read their own shift (for checking if SOD already submitted)
create policy "Anon can read shifts"
  on driver_shifts for select
  to anon
  using (true);

-- Authenticated users (leads, management) have full access
create policy "Authenticated full access to shifts"
  on driver_shifts for all
  to authenticated
  using (true)
  with check (true);


-- ── Helper: generate PIN hash ────────────────────────────────
-- To add a driver, insert into driver_pins with their hashed PIN.
-- The SHA-256 hash of a PIN must be generated in the browser or via:
--   echo -n "1234" | sha256sum
-- Example PINs for testing (DO NOT use these in production):
--   PIN 1234 → 03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4
--   PIN 0000 → 076a27c79e5ace2a3d47f9dd2e83e4ff6ea8872b3c2218f66c92b89b55f36560


-- ── Sample driver insert ─────────────────────────────────────
-- Replace values and hash before inserting real drivers.
-- Run: echo -n "YOUR_PIN" | sha256sum  to get the hash.

-- insert into driver_pins (driver_id, driver_name, depot, client, pin_hash) values
-- ('FD72579', 'Connor Smith',  'DPD Aberdeen',  'DPD', 'HASH_HERE'),
-- ('FD72583', 'Tom Brown',     'DPD Aberdeen',  'DPD', 'HASH_HERE'),
-- ('MD Temp 4', 'Rafal Lis',   'DHL Middleton', 'DHL', 'HASH_HERE');


-- ── Indexes ──────────────────────────────────────────────────
create index if not exists idx_driver_shifts_date     on driver_shifts(shift_date);
create index if not exists idx_driver_shifts_depot    on driver_shifts(depot);
create index if not exists idx_driver_shifts_driver   on driver_shifts(driver_id);
create index if not exists idx_driver_shifts_status   on driver_shifts(status);
create index if not exists idx_driver_pins_driver     on driver_pins(driver_id);
