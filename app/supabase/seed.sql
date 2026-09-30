insert into companies (id, name, address, phone, gst_number, logo)
values (
  '11111111-1111-4111-8111-111111111111',
  'Alberta Recovery Towing',
  '127 7 Ave SW, Calgary, AB',
  '+1 (403) 555-0148',
  'GST 123456789RT0001',
  'ART'
)
on conflict (id) do nothing;

insert into users (company_id, email, role, name)
values (
  '11111111-1111-4111-8111-111111111111',
  'owner@albertarecovery.ca',
  'owner',
  'Operations Manager'
), (
  '11111111-1111-4111-8111-111111111111',
  'ava@albertarecovery.ca',
  'driver',
  'Ava Thompson'
)
on conflict (email) do nothing;

insert into rate_cards (company_id, name, hook_up_cents, km_rate_cents, winch_cents, after_hours_cents, storage_per_day_cents)
values (
  '11111111-1111-4111-8111-111111111111',
  'Standard Alberta Tow Rate',
  17500,
  350,
  9000,
  7000,
  3500
)
on conflict do nothing;

insert into storage_yards (company_id, name, address, hours)
values (
  '11111111-1111-4111-8111-111111111111',
  'Downtown Yard',
  '200 10 Ave SW, Calgary, AB',
  '24/7'
)
on conflict do nothing;

insert into request_types (company_id, label, workflow, legal_status)
values
  ('11111111-1111-4111-8111-111111111111', 'Vehicle owner/customer', 'consumer', 'confirmed'),
  ('11111111-1111-4111-8111-111111111111', 'Owner''s representative', 'to_confirm', 'to_be_confirmed'),
  ('11111111-1111-4111-8111-111111111111', 'Motor club / roadside assistance', 'to_confirm', 'to_be_confirmed'),
  ('11111111-1111-4111-8111-111111111111', 'Insurance company', 'to_confirm', 'to_be_confirmed'),
  ('11111111-1111-4111-8111-111111111111', 'Police', 'exempt', 'confirmed'),
  ('11111111-1111-4111-8111-111111111111', 'Municipality/government', 'exempt', 'confirmed'),
  ('11111111-1111-4111-8111-111111111111', 'Private-property owner', 'to_confirm', 'to_be_confirmed'),
  ('11111111-1111-4111-8111-111111111111', 'Other', 'to_confirm', 'to_be_confirmed')
on conflict do nothing;

insert into customers (company_id, name, phone, email)
values (
  '11111111-1111-4111-8111-111111111111',
  'Jamie Clarke',
  '(403) 555-0192',
  'jamie@example.com'
), (
  '11111111-1111-4111-8111-111111111111',
  'A. Langford',
  '(403) 555-0791',
  'alangford@example.com'
)
on conflict do nothing;

insert into vehicles (company_id, plate, province, make, model, year, colour)
values (
  '11111111-1111-4111-8111-111111111111',
  'ABC 123',
  'AB',
  'Toyota',
  'Corolla',
  2021,
  'White'
), (
  '11111111-1111-4111-8111-111111111111',
  'XYZ 781',
  'AB',
  'Honda',
  'Civic',
  2019,
  'Blue'
)
on conflict do nothing;
