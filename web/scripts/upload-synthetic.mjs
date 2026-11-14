// Envia os dados sintéticos (synthetic/data/*.json) para o Supabase.
// Pré-requisito: rodar synthetic/supabase/schema.sql no projeto.
// Uso (na pasta web): node --env-file=.env.local scripts/upload-synthetic.mjs
// Requer SUPABASE_SERVICE_ROLE_KEY (somente local, nunca commitar / nunca usar no cliente).
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no web/.env.local');
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'synthetic', 'data');

async function up(table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from(table).upsert(rows.slice(i, i + 500), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  ${table}: ${rows.length}`);
}

const defs = JSON.parse(readFileSync(join(dir, 'biomarker_definitions.json'), 'utf8'));
await up('rivio_biomarker_definitions', defs.map((b) => ({ id: b.id, canonical_name: b.canonicalName, category: b.category, unit: b.unit, ref_min: b.refMin, ref_max: b.refMax, description: b.description })), 'id');

for (const f of readdirSync(dir).filter((f) => f.startsWith('usr-'))) {
  const p = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const id = p.profile.id;
  console.log(p.profile.name);
  const x = p.profile;
  await up('rivio_patients', [{ id, name: x.name, email: x.email, age: x.age, biological_sex: x.biologicalSex, birth_date: x.birthDate, city: x.city, height_cm: x.heightCm, weight_kg: x.weightKg, blood_type: x.bloodType, scenario: x.scenario, chronic_conditions: x.chronicConditions, active_medications: x.activeMedications }], 'id');
  await up('rivio_documents', p.documents.map((d) => ({ id: d.id, patient_id: id, name: d.name, uri: d.uri, size: d.size, mime_type: d.mimeType, uploaded_at: d.uploadedAt, extracted_count: d.extractedCount, status: d.status })), 'id');
  await up('rivio_exams', p.exams.map((e) => ({ id: e.id, patient_id: id, date: e.date, lab_name: e.labName, biomarker_id: e.biomarkerId, canonical_name: e.canonicalName, value: e.value, unit: e.unit, ref_min: e.refMin, ref_max: e.refMax, status: e.status, notes: e.notes ?? null, document_id: e.documentId ?? null })), 'id');
  await up('rivio_wearable_daily', p.wearables.map((w) => ({ patient_id: id, date: w.date, resting_hr: w.restingHeartRate, max_hr: w.maxHeartRate, min_hr: w.minHeartRate, hrv: w.hrv, sleep_hours: w.sleepHours, deep_sleep_hours: w.deepSleepHours, rem_sleep_hours: w.remSleepHours, spo2: w.spo2, steps: w.steps })), 'patient_id,date');
  await up('rivio_heart_rate_samples', p.heartRateSamples.map((h) => ({ patient_id: id, ts: h.ts, bpm: h.bpm })), 'patient_id,ts');
  await up('rivio_alerts', p.alerts.map((a) => ({ id: a.id, patient_id: id, ts: a.timestamp, title: a.title, description: a.description, severity: a.severity, metric_type: a.metricType, value_detected: a.valueDetected, baseline_value: a.baselineValue, clinical_context: a.clinicalContext, resolved: a.resolved })), 'id');
  await up('rivio_medications', p.medications.map((m) => ({ id: m.id, patient_id: id, name: m.name, dose: m.dose, start_date: m.startDate, end_date: m.endDate, indication: m.indication })), 'id');
  await up('rivio_clinical_events', p.events.map((e) => ({ id: e.id, patient_id: id, date: e.date, type: e.type, title: e.title, description: e.description, source: e.source })), 'id');
}
console.log('Upload concluído.');

