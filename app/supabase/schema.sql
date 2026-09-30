create extension if not exists pgcrypto;

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
  email text,
  -- Company-controlled settings: which consent methods drivers see, and document template text.
  consent_methods text[] not null default array['link', 'signature', 'audio', 'paper_photo'],
  estimate_notes text not null default '',
  invoice_notes text not null default '',
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
  name text not null default 'Standard rates',
  description text not null default '',
  base_tow_cents integer not null default 12500,
  km_rate_cents integer not null default 450,
  winch_cents integer not null default 7500,
  after_hours_cents integer not null default 4000,
  storage_per_day_cents integer not null default 4500,
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

-- Company-defined workflows. The company chooses which steps are required before the tow;
-- the app enforces that configuration and never decides which legal rules apply.
create table if not exists workflows (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  letter text not null,
  name text not null,
  description text not null default '',
  require_reference boolean not null default false,
  reference_label text not null default 'Requester reference',
  require_estimate boolean not null default true,
  require_consent boolean not null default true,
  require_destination boolean not null default true,
  rate_card_id uuid references rate_cards(id),
  created_at timestamptz not null default now(),
  check (not require_consent or require_estimate)
);

-- "Who requested this tow?" options, each mapped by the company to one of its workflows.
create table if not exists request_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  label text not null,
  workflow_id uuid not null references workflows(id),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- Versioned consent wording. Consent records keep the version and the exact text shown.
create table if not exists consent_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  version integer not null,
  heading text not null,
  body text not null,
  accept_label text not null,
  effective_date date not null,
  updated_by text not null,
  created_at timestamptz not null default now(),
  unique(company_id, version)
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
  contact_name text,
  contact_reference text,
  -- Snapshot of the company workflow when the request was recorded; later config changes don't alter it.
  workflow_snapshot jsonb,
  notes text not null default '',
  status job_status_type not null default 'new',
  pickup_location text,
  destination_location text,
  destination_confirmed_by text,
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
  template_version integer not null,
  wording_heading text not null,
  wording text not null,
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
  from_location text not null,
  to_location text not null,
  requested_by text not null,
  changed_at timestamptz not null,
  note text not null default '',
  owner_notified_via text,
  owner_notified_at timestamptz,
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
