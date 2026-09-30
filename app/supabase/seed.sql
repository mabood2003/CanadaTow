-- Demo company (fictional): Summit Towing Ltd. Mirrors src/lib/seed.ts.
insert into companies (id, name, address, phone, email, gst_number, estimate_notes, invoice_notes)
values (
  '11111111-1111-4111-8111-111111111111',
  'Summit Towing Ltd.',
  'Bay 4, 1250 Summit Industrial Way SE, Calgary, AB T2C 0A1',
  '(403) 555-0148',
  'dispatch@summittowing.example',
  '123456789 RT0001',
  'This estimate covers today''s tow. Your final charges will be shown on an itemized invoice before you pay. Questions? Call Summit dispatch at (403) 555-0148 — we''re happy to explain any charge.',
  'Payment accepted by debit, credit card or e-transfer. Thank you for choosing Summit Towing.'
)
on conflict (id) do nothing;

insert into users (company_id, email, role, name)
values
  ('11111111-1111-4111-8111-111111111111', 'dana@summittowing.example', 'owner', 'Dana Whitford'),
  ('11111111-1111-4111-8111-111111111111', 'terry@summittowing.example', 'driver', 'Terry Boyd'),
  ('11111111-1111-4111-8111-111111111111', 'mike@summittowing.example', 'driver', 'Mike Chen')
on conflict (email) do nothing;

insert into rate_cards (id, company_id, name, description, base_tow_cents, km_rate_cents, winch_cents, after_hours_cents, storage_per_day_cents)
values
  ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-111111111111', 'Standard rates', 'Customer-requested and general tows.', 12500, 450, 7500, 4000, 4500),
  ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-111111111111', 'Motor club / insurer preset', 'Preset contract rates for club- and insurer-dispatched calls (sample).', 9500, 300, 6000, 0, 4000)
on conflict (id) do nothing;

insert into storage_yards (company_id, name, address, hours)
values ('11111111-1111-4111-8111-111111111111', 'Summit yard', 'Bay 4, 1250 Summit Industrial Way SE, Calgary', 'Mon–Sat 8am–6pm · after-hours release by appointment')
on conflict do nothing;

insert into workflows (id, company_id, letter, name, description, require_reference, reference_label, require_estimate, require_consent, require_destination, rate_card_id)
values
  ('33333333-3333-4333-8333-00000000000a', '11111111-1111-4111-8111-111111111111', 'A', 'Customer-Requested Tow', 'Customer receives Summit''s estimate and completes Summit''s consent step before the tow.', false, 'Requester reference', true, true, true, '22222222-2222-4222-8222-000000000001'),
  ('33333333-3333-4333-8333-00000000000b', '11111111-1111-4111-8111-111111111111', 'B', 'Motor Club / Insurer Dispatch', 'Preset contract rates. Record the dispatch reference; the customer may be remote.', true, 'Dispatch reference', true, true, true, '22222222-2222-4222-8222-000000000002'),
  ('33333333-3333-4333-8333-00000000000c', '11111111-1111-4111-8111-111111111111', 'C', 'Police-Directed Tow', 'Record the officer and file number. Invoice the owner at release.', true, 'Police file number', false, false, true, '22222222-2222-4222-8222-000000000001'),
  ('33333333-3333-4333-8333-00000000000d', '11111111-1111-4111-8111-111111111111', 'D', 'Private-Property Tow', 'Record the property representative and authorization. Invoice the owner at release.', true, 'Property authorization', false, false, true, '22222222-2222-4222-8222-000000000001')
on conflict (id) do nothing;

insert into request_types (company_id, label, workflow_id)
values
  ('11111111-1111-4111-8111-111111111111', 'Vehicle owner / customer', '33333333-3333-4333-8333-00000000000a'),
  ('11111111-1111-4111-8111-111111111111', 'Owner''s representative', '33333333-3333-4333-8333-00000000000a'),
  ('11111111-1111-4111-8111-111111111111', 'Motor club / roadside assistance', '33333333-3333-4333-8333-00000000000b'),
  ('11111111-1111-4111-8111-111111111111', 'Insurance company', '33333333-3333-4333-8333-00000000000b'),
  ('11111111-1111-4111-8111-111111111111', 'Police / law enforcement', '33333333-3333-4333-8333-00000000000c'),
  ('11111111-1111-4111-8111-111111111111', 'Municipality / government', '33333333-3333-4333-8333-00000000000c'),
  ('11111111-1111-4111-8111-111111111111', 'Private-property owner', '33333333-3333-4333-8333-00000000000d'),
  ('11111111-1111-4111-8111-111111111111', 'Other', '33333333-3333-4333-8333-00000000000a')
on conflict do nothing;

insert into consent_templates (company_id, version, heading, body, accept_label, effective_date, updated_by)
values
  ('11111111-1111-4111-8111-111111111111', 1, 'Tow authorization', 'I authorize {company} to tow my vehicle ({vehicle}) to {destination}.', 'I authorize', '2026-01-12', 'Dana Whitford'),
  ('11111111-1111-4111-8111-111111111111', 2, '{company} — Tow authorization', 'I, {customer}, have received estimate #{estimate} for {total} and authorize {company} to tow {vehicle} to {destination}. Storage is {storage} per day if the vehicle is stored at our yard.', 'I authorize this tow', '2026-04-01', 'Dana Whitford'),
  ('11111111-1111-4111-8111-111111111111', 3, '{company} — Authorization / Consent', 'I, {customer}, am the {relationship} of the vehicle described above ({vehicle}). I have received {company}''s written estimate #{estimate} for {total}, and I authorize {company} to tow this vehicle to {destination}.

I understand that storage is charged at {storage} per day if the vehicle is stored at the {company} yard, and that I will receive an itemized invoice before paying.', 'I authorize this tow', '2026-09-08', 'Dana Whitford')
on conflict do nothing;
