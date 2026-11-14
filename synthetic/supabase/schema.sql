-- Schema do Hub de Saúde Rivio (dados sintéticos). Execute no SQL Editor do Supabase ANTES do seed.sql.
create table if not exists rivio_biomarker_definitions (
  id text primary key, canonical_name text not null, category text not null, unit text not null,
  ref_min numeric not null, ref_max numeric not null, description text
);

create table if not exists rivio_patients (
  id text primary key, name text not null, email text, age int, biological_sex text,
  birth_date date, city text, height_cm int, weight_kg numeric, blood_type text, scenario text,
  chronic_conditions text[] default '{}', active_medications text[] default '{}'
);

create table if not exists rivio_documents (
  id text primary key, patient_id text references rivio_patients(id) on delete cascade, name text, uri text,
  size int, mime_type text, uploaded_at timestamptz, extracted_count int, status text
);

create table if not exists rivio_exams (
  id text primary key, patient_id text not null references rivio_patients(id) on delete cascade,
  date date not null, lab_name text, biomarker_id text references rivio_biomarker_definitions(id),
  canonical_name text, value numeric not null, unit text, ref_min numeric, ref_max numeric,
  status text check (status in ('normal','attention','critical')), notes text,
  document_id text references rivio_documents(id) on delete set null
);
create index if not exists exams_patient_bio_date on rivio_exams (patient_id, biomarker_id, date);

create table if not exists rivio_wearable_daily (
  patient_id text not null references rivio_patients(id) on delete cascade, date date not null,
  resting_hr int, max_hr int, min_hr int, hrv numeric, sleep_hours numeric, deep_sleep_hours numeric,
  rem_sleep_hours numeric, spo2 numeric, steps int,
  primary key (patient_id, date)
);

create table if not exists rivio_heart_rate_samples (
  patient_id text not null references rivio_patients(id) on delete cascade, ts timestamptz not null, bpm int not null,
  primary key (patient_id, ts)
);

create table if not exists rivio_alerts (
  id text primary key, patient_id text not null references rivio_patients(id) on delete cascade, ts timestamptz,
  title text, description text, severity text check (severity in ('low','medium','high')), metric_type text,
  value_detected text, baseline_value text, clinical_context text, resolved boolean
);

create table if not exists rivio_medications (
  id text primary key, patient_id text not null references rivio_patients(id) on delete cascade,
  name text, dose text, start_date date, end_date date, indication text
);

create table if not exists rivio_clinical_events (
  id text primary key, patient_id text not null references rivio_patients(id) on delete cascade,
  date date, type text, title text, description text, source text
);
create index if not exists events_patient_date on rivio_clinical_events (patient_id, date);

-- RLS ligado: sem policies, só a service_role acessa. Adicione policies de paciente/médico depois.
alter table rivio_biomarker_definitions enable row level security;
alter table rivio_patients enable row level security;
alter table rivio_documents enable row level security;
alter table rivio_exams enable row level security;
alter table rivio_wearable_daily enable row level security;
alter table rivio_heart_rate_samples enable row level security;
alter table rivio_alerts enable row level security;
alter table rivio_medications enable row level security;
alter table rivio_clinical_events enable row level security;

