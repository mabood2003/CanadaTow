create extension if not exists pgcrypto;

create type workflow_type as enum ('consumer', 'exempt', 'to_confirm');
create type legal_status_type as enum ('confirmed', 'to_be_confirmed');
create type consent_method_type as enum ('link', 'signature', 'audio', 'paper_photo');
create type user_role_type as enum ('owner', 'driver');
create type job_status_type as enum ('new', 'estimate_sent', 'consent_captured', 'tow_in_progress', 'invoice_issued', 'complete', 'problem_state');

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  gst_number text,
  logo text,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  email text not null unique,
  role user_role_type not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists rate_cards (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null default 'Standard rate card',
  hook_up_cents integer not null default 17500,
  km_rate_cents integer not null default 350,
  winch_cents integer not null default 9000,
  after_hours_cents integer not null default 7000,
  storage_per_day_cents integer not null default 3500,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists storage_yards (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  address text not null,
  hours text,
  created_at timestamptz not null default now()
);

create table if not exists request_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  label text not null,
  workflow workflow_type not null,
  legal_status legal_status_type not null,
  created_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  plate text not null,
  province text not null,
  make text,
  model text,
  year integer,
  colour text,
  created_at timestamptz not null default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  request_type_id uuid not null references request_types(id),
  customer_id uuid references customers(id),
  vehicle_id uuid references vehicles(id),
  invited_by text,
  exempt_reason text,
  status job_status_type not null default 'new',
  pickup_location text,
  destination_location text,
  destination_confirmed boolean not null default false,
  pickup_at timestamptz,
  arrived_at timestamptz,
  secured_at timestamptz,
  departed_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists estimates (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  version integer not null default 1,
  public_token text not null unique,
  subtotal_cents integer not null default 0,
  gst_cents integer not null default 0,
  total_cents integer not null default 0,
  delivered_via text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique(job_id, version)
);

create table if not exists consents (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references estimates(id) on delete cascade,
  name text not null,
  relationship text not null,
  is_present boolean not null default true,
  method consent_method_type not null,
  consented_at timestamptz not null default now(),
  evidence_path text,
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  invoice_number text not null unique,
  subtotal_cents integer not null default 0,
  gst_cents integer not null default 0,
  total_cents integer not null default 0,
  issued_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  label text not null,
  quantity integer not null default 1,
  unit_price_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists destination_changes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  authorized_by text not null,
  reason text not null,
  notified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount_cents integer not null,
  method text not null default 'cash',
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,
  actor text not null,
  action text not null,
  details jsonb default '{}'::jsonb,
  device text not null,
  created_at timestamptz not null default now()
);

create table if not exists uploaded_files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,
  file_type text not null,
  path text not null,
  sha256 text,
  created_at timestamptz not null default now()
);

create index if not exists idx_jobs_company_status on jobs(company_id, status);
create index if not exists idx_audit_log_job_id on audit_log(job_id);
create index if not exists idx_estimates_public_token on estimates(public_token);
