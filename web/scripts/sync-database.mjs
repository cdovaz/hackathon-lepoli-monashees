/**
 * Script de Sincronização Integral do Banco de Dados Supabase (Rivio Health Hub).
 * Unifica os 2 schemas (rivio_* + arquitetura clínica/grafo/sessões), popula vetores HNSW (vector(384)),
 * cria o bucket `clinical-documents` no Supabase Storage com laudos PDF reais e semeia a camada
 * de observabilidade de transições e episódios institucionais.
 *
 * Uso: cd web && node --env-file=.env.local scripts/sync-database.mjs
 */
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
const syntheticDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'synthetic', 'data');

const CLINICAL_CLUSTERS = [
  { dims: [0,1,2,3,4,5,6,7], terms: ['glicose','glicemia','hba1c','glicada','diabetes','metformina','insulina','acucar','metabolismo','jejum'] },
  { dims: [8,9,10,11,12,13,14,15], terms: ['colesterol','ldl','hdl','triglicerideos','triglicerides','lipidios','dislipidemia','aterogenica','estatins','rosuvastatina','atorvastatina'] },
  { dims: [16,17,18,19,20,21,22,23], terms: ['ferritina','ferro','hemoglobina','hematocrito','eritrocitos','anemia','fadiga','cansaco','fraqueza','hematologia','pancitopenia','plaquetas','leucocitos'] },
  { dims: [24,25,26,27,28,29,30,31], terms: ['tsh','t4','tireoide','hipotireoidismo','levotiroxina','hormonio','metabolico'] },
  { dims: [32,33,34,35,36,37,38,39], terms: ['coracao','cardiaco','bpm','frequencia','taquicardia','arritmia','batimentos','pulso','hrv','variabilidade','wearable','relogio','apple watch'] },
  { dims: [40,41,42,43,44,45,46,47], terms: ['sono','dormir','noturno','noturna','profundo','rem','insonia','repouso','recuperacao','prontidao'] },
  { dims: [48,49,50,51,52,53,54,55], terms: ['spo2','oxigenio','saturacao','respiratorio','dispneia','falta de ar','h1n1','influenza','febre','tosse','pulmao','oseltamivir'] },
  { dims: [56,57,58,59,60,61,62,63], terms: ['figado','hepatico','tgo','tgp','ast','alt','ggt','bilirrubina','albumina','esplenomegalia','leishmaniose','anfotericina'] },
  { dims: [64,65,66,67,68,69,70,71], terms: ['rim','renal','creatinina','ureia','tfg','filtracao','acido urico','nefrologia'] },
  { dims: [72,73,74,75,76,77,78,79], terms: ['inflamacao','pcr','proteina c reativa','vhs','infeccao','alerta','anomalia','critico','atencao'] },
  { dims: [80,81,82,83,84,85,86,87], terms: ['vitamina','vitamina d','b12','nutricional','suplemento','colecalciferol','sodio','potassio','calcio','magnesio'] },
  { dims: [88,89,90,91,92,93,94,95], terms: ['exame','laudo','laboratorio','fleury','dasa','zoppi','sabin','resultado','historico','resumo','geral'] },
];

function computeEmbedding384(text) {
  const vec = new Array(384).fill(0);
  const norm = String(text || 'contexto clinico')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const cluster of CLINICAL_CLUSTERS) {
    let score = 0;
    for (const term of cluster.terms) {
      if (norm.includes(term)) score += 1.5;
    }
    if (score > 0) {
      for (let i = 0; i < cluster.dims.length; i++) {
        vec[cluster.dims[i]] += score * (1 - i * 0.04);
      }
    }
  }
  const tokens = norm.split(' ').filter(Boolean);
  for (const token of tokens) {
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) {
      h ^= token.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    vec[96 + (Math.abs(h) % 288)] += 0.6;
    vec[96 + (Math.abs(h >> 8) % 288)] += 0.35;
  }
  for (let i = 0; i < 16; i++) vec[i] += 0.08;
  let mag = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0)) || 1;
  return `[${vec.map((v) => Number((v / mag).toFixed(6))).join(',')}]`;
}

async function upsertBatch(table, rows, onConflict = 'id') {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += 400) {
    const chunk = rows.slice(i, i + 400);
    const { error } = await sb.from(table).upsert(chunk, { onConflict });
    if (error) {
      throw new Error(`Erro em ${table}: ${error.message}`);
    }
  }
  console.log(`  [OK] ${table}: ${rows.length} registros sincronizados.`);
}

// 1. Sincronizar Fontes de Dados (data_sources)
console.log('1. Sincronizando data_sources...');
await upsertBatch('data_sources', [
  { id: 'src-fleury', label: 'Fleury Medicina e Saúde', kind: 'laboratory', state: 'connected', last_synced_at: '2026-11-14T08:00:00Z', coverage_from: '2022-01-01', coverage_to: '2026-11-14' },
  { id: 'src-dasa', label: 'Dasa / Alta Excelência Diagnóstica', kind: 'laboratory', state: 'connected', last_synced_at: '2026-11-14T07:45:00Z', coverage_from: '2023-01-01', coverage_to: '2026-11-14' },
  { id: 'src-zoppi', label: 'Laboratório Salomão Zoppi', kind: 'laboratory', state: 'connected', last_synced_at: '2026-11-13T18:30:00Z', coverage_from: '2023-01-01', coverage_to: '2026-11-14' },
  { id: 'src-sabin', label: 'Sabin Medicina Diagnóstica', kind: 'laboratory', state: 'connected', last_synced_at: '2026-11-14T06:15:00Z', coverage_from: '2024-01-01', coverage_to: '2026-11-14' },
  { id: 'src-hc', label: 'Hospital das Clínicas / Sírio-Libanês', kind: 'hospital', state: 'connected', last_synced_at: '2026-11-14T08:10:00Z', coverage_from: '2025-01-01', coverage_to: '2026-11-14' },
  { id: 'src-apple-watch', label: 'Apple Watch Series 9 (HealthKit)', kind: 'wearable', state: 'connected', last_synced_at: new Date().toISOString(), coverage_from: '2025-11-01', coverage_to: '2026-11-14' },
]);

// 2. Sincronizar Biomarcadores nos dois schemas (rivio_biomarker_definitions + biomarkers com vector(384))
console.log('2. Sincronizando biomarcadores e embeddings HNSW...');
const rawDefs = JSON.parse(readFileSync(join(syntheticDir, 'biomarker_definitions.json'), 'utf8'));
await upsertBatch(
  'rivio_biomarker_definitions',
  rawDefs.map((b) => ({
    id: b.id,
    canonical_name: b.canonicalName,
    category: b.category,
    unit: b.unit,
    ref_min: b.refMin,
    ref_max: b.refMax,
    description: b.description,
  }))
);

await upsertBatch(
  'biomarkers',
  rawDefs.map((b) => ({
    id: b.id,
    canonical_name: b.canonicalName,
    category: b.category,
    canonical_unit: b.unit,
    standard_ref_min: b.refMin,
    standard_ref_max: b.refMax,
    description: b.description,
    synonyms: [b.canonicalName, b.id, b.category],
    embedding: computeEmbedding384(`${b.canonicalName} ${b.category} ${b.description}`),
  }))
);

// 3. Sincronizar Daniel Vaz (usr-dan-2026) no schema rivio_* para unificar com os 4 sintéticos
console.log('3. Sincronizando Daniel Vaz (usr-dan-2026) em rivio_*...');
await upsertBatch('rivio_patients', [
  {
    id: 'usr-dan-2026',
    name: 'Daniel Vaz',
    email: 'daniel.vaz@exemplo.com.br',
    age: 32,
    biological_sex: 'Masculino',
    birth_date: '1994-04-12',
    city: 'São Paulo, SP',
    height_cm: 178,
    weight_kg: 76.5,
    blood_type: 'A+',
    scenario: 'Deficiência de Ferritina, Dislipidemia Progressiva e Hipotireoidismo Subclínico',
    chronic_conditions: ['Hipotireoidismo Subclínico', 'Dislipidemia Leve'],
    active_medications: ['Levotiroxina 50mcg (1x ao dia em jejum)', 'Colecalciferol (Vitamina D3) 2.000 UI'],
  },
]);

await upsertBatch('rivio_documents', [
  { id: 'doc-fleury-2025', patient_id: 'usr-dan-2026', name: 'Laudo Completo Fleury — Outubro/2025.pdf', uri: 'documents/usr-dan-2026/doc-fleury-2025.pdf', size: 482000, mime_type: 'application/pdf', uploaded_at: '2026-11-11T14:30:00Z', extracted_count: 4, status: 'processed' },
  { id: 'doc-dasa-2024', patient_id: 'usr-dan-2026', name: 'Checkup Laboratorial Dasa / Alta — Agosto/2024.pdf', uri: 'documents/usr-dan-2026/doc-dasa-2024.pdf', size: 320000, mime_type: 'application/pdf', uploaded_at: '2026-11-11T14:30:00Z', extracted_count: 4, status: 'processed' },
  { id: 'doc-zoppi-2023', patient_id: 'usr-dan-2026', name: 'Exame de Sangue Salomão Zoppi — Maio/2023.pdf', uri: 'documents/usr-dan-2026/doc-zoppi-2023.pdf', size: 1420000, mime_type: 'application/pdf', uploaded_at: '2026-11-11T14:30:00Z', extracted_count: 4, status: 'processed' },
  { id: 'doc-fleury-2022', patient_id: 'usr-dan-2026', name: 'Checkup Periódico Fleury — Março/2022.pdf', uri: 'documents/usr-dan-2026/doc-fleury-2022.pdf', size: 390000, mime_type: 'application/pdf', uploaded_at: '2026-11-11T14:30:00Z', extracted_count: 4, status: 'processed' },
]);

await upsertBatch('rivio_exams', [
  { id: 'ex-glic-2022', patient_id: 'usr-dan-2026', date: '2022-03-15', lab_name: 'Fleury Medicina e Saúde', biomarker_id: 'glicose', canonical_name: 'Glicemia de Jejum', value: 84, unit: 'mg/dL', ref_min: 70, ref_max: 99, status: 'normal', notes: 'Glicemia normal em jejum.', document_id: 'doc-fleury-2022' },
  { id: 'ex-glic-2023', patient_id: 'usr-dan-2026', date: '2023-05-20', lab_name: 'Laboratório Salomão Zoppi', biomarker_id: 'glicose', canonical_name: 'Glicemia de Jejum', value: 89, unit: 'mg/dL', ref_min: 70, ref_max: 99, status: 'normal', notes: 'Parâmetros normais.', document_id: 'doc-zoppi-2023' },
  { id: 'ex-glic-2024', patient_id: 'usr-dan-2026', date: '2024-08-10', lab_name: 'Dasa / Alta Excelência Diagnóstica', biomarker_id: 'glicose', canonical_name: 'Glicemia de Jejum', value: 94, unit: 'mg/dL', ref_min: 70, ref_max: 99, status: 'normal', notes: 'Próximo do limite superior.', document_id: 'doc-dasa-2024' },
  { id: 'ex-glic-2025', patient_id: 'usr-dan-2026', date: '2025-10-18', lab_name: 'Fleury Medicina e Saúde', biomarker_id: 'glicose', canonical_name: 'Glicemia de Jejum', value: 104, unit: 'mg/dL', ref_min: 70, ref_max: 99, status: 'attention', notes: 'Discretamente acima da faixa de referência.', document_id: 'doc-fleury-2025' },
  { id: 'ex-ldl-2022', patient_id: 'usr-dan-2026', date: '2022-03-15', lab_name: 'Fleury Medicina e Saúde', biomarker_id: 'ldl', canonical_name: 'Colesterol LDL', value: 112, unit: 'mg/dL', ref_min: 0, ref_max: 130, status: 'normal', notes: 'Dentro do alvo terapêutico.', document_id: 'doc-fleury-2022' },
  { id: 'ex-ldl-2023', patient_id: 'usr-dan-2026', date: '2023-05-20', lab_name: 'Laboratório Salomão Zoppi', biomarker_id: 'ldl', canonical_name: 'Colesterol LDL', value: 128, unit: 'mg/dL', ref_min: 0, ref_max: 130, status: 'normal', notes: 'Normal com tendência de subida.', document_id: 'doc-zoppi-2023' },
  { id: 'ex-ldl-2024', patient_id: 'usr-dan-2026', date: '2024-08-10', lab_name: 'Dasa / Alta Excelência Diagnóstica', biomarker_id: 'ldl', canonical_name: 'Colesterol LDL', value: 142, unit: 'mg/dL', ref_min: 0, ref_max: 130, status: 'attention', notes: 'Acima da meta recomendada.', document_id: 'doc-dasa-2024' },
  { id: 'ex-ldl-2025', patient_id: 'usr-dan-2026', date: '2025-10-18', lab_name: 'Fleury Medicina e Saúde', biomarker_id: 'ldl', canonical_name: 'Colesterol LDL', value: 156, unit: 'mg/dL', ref_min: 0, ref_max: 130, status: 'critical', notes: 'Elevação sustentada nos últimos 3 anos.', document_id: 'doc-fleury-2025' },
  { id: 'ex-fer-2022', patient_id: 'usr-dan-2026', date: '2022-03-15', lab_name: 'Fleury Medicina e Saúde', biomarker_id: 'ferritina', canonical_name: 'Ferritina Sérica', value: 85, unit: 'ng/mL', ref_min: 30, ref_max: 400, status: 'normal', notes: 'Estoque de ferro adequado.', document_id: 'doc-fleury-2022' },
  { id: 'ex-fer-2023', patient_id: 'usr-dan-2026', date: '2023-05-20', lab_name: 'Laboratório Salomão Zoppi', biomarker_id: 'ferritina', canonical_name: 'Ferritina Sérica', value: 58, unit: 'ng/mL', ref_min: 30, ref_max: 400, status: 'normal', notes: 'Reserva de ferro normal.', document_id: 'doc-zoppi-2023' },
  { id: 'ex-fer-2024', patient_id: 'usr-dan-2026', date: '2024-08-10', lab_name: 'Dasa / Alta Excelência Diagnóstica', biomarker_id: 'ferritina', canonical_name: 'Ferritina Sérica', value: 34, unit: 'ng/mL', ref_min: 30, ref_max: 400, status: 'normal', notes: 'Próximo ao limite inferior.', document_id: 'doc-dasa-2024' },
  { id: 'ex-fer-2025', patient_id: 'usr-dan-2026', date: '2025-10-18', lab_name: 'Fleury Medicina e Saúde', biomarker_id: 'ferritina', canonical_name: 'Ferritina Sérica', value: 22, unit: 'ng/mL', ref_min: 30, ref_max: 400, status: 'attention', notes: 'Abaixo da referência de 30 ng/mL.', document_id: 'doc-fleury-2025' },
  { id: 'ex-tsh-2022', patient_id: 'usr-dan-2026', date: '2022-03-15', lab_name: 'Fleury Medicina e Saúde', biomarker_id: 'tsh', canonical_name: 'TSH Ultra-sensível', value: 1.8, unit: 'mUI/L', ref_min: 0.4, ref_max: 4.5, status: 'normal', notes: 'Função tireoidiana normal.', document_id: 'doc-fleury-2022' },
  { id: 'ex-tsh-2023', patient_id: 'usr-dan-2026', date: '2023-05-20', lab_name: 'Laboratório Salomão Zoppi', biomarker_id: 'tsh', canonical_name: 'TSH Ultra-sensível', value: 2.6, unit: 'mUI/L', ref_min: 0.4, ref_max: 4.5, status: 'normal', notes: 'Valores estáveis.', document_id: 'doc-zoppi-2023' },
  { id: 'ex-tsh-2024', patient_id: 'usr-dan-2026', date: '2024-08-10', lab_name: 'Dasa / Alta Excelência Diagnóstica', biomarker_id: 'tsh', canonical_name: 'TSH Ultra-sensível', value: 3.4, unit: 'mUI/L', ref_min: 0.4, ref_max: 4.5, status: 'normal', notes: 'Tendência de elevação subclínica.', document_id: 'doc-dasa-2024' },
  { id: 'ex-tsh-2025', patient_id: 'usr-dan-2026', date: '2025-10-18', lab_name: 'Fleury Medicina e Saúde', biomarker_id: 'tsh', canonical_name: 'TSH Ultra-sensível', value: 4.2, unit: 'mUI/L', ref_min: 0.4, ref_max: 4.5, status: 'normal', notes: 'Próximo ao teto da normalidade.', document_id: 'doc-fleury-2025' },
]);

const danWearables = [];
for (let i = 29; i >= 0; i--) {
  const d = new Date('2026-11-11T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - i);
  const dateStr = d.toISOString().slice(0, 10);
  const isSpike = dateStr === '2026-11-11';
  danWearables.push({
    patient_id: 'usr-dan-2026',
    date: dateStr,
    resting_hr: isSpike ? 78 : 62 + (i % 5),
    max_hr: isSpike ? 118 : 98 + (i % 12),
    min_hr: 54 + (i % 4),
    hrv: isSpike ? 28 : 56 + (i % 9),
    sleep_hours: isSpike ? 5.4 : 7.2 + ((i % 3) * 0.3),
    deep_sleep_hours: isSpike ? 0.5 : 1.4,
    rem_sleep_hours: isSpike ? 1.1 : 1.8,
    spo2: isSpike ? 96 : 98,
    steps: 6800 + (i * 150),
  });
}
await upsertBatch('rivio_wearable_daily', danWearables, 'patient_id,date');

await upsertBatch('rivio_alerts', [
  { id: 'alert-dan-ferritina', patient_id: 'usr-dan-2026', ts: '2025-10-18T18:00:00Z', title: 'Deficiência de Ferritina com Sintoma de Fadiga', description: 'Ferritina caiu para 22 ng/mL (ref: 30-400 ng/mL) no laudo mais recente.', severity: 'medium', metric_type: 'ferritina', value_detected: '22 ng/mL', baseline_value: '85 ng/mL', clinical_context: 'Queda progressiva nos últimos 3 anos correlacionada com fadiga matinal.', resolved: false },
  { id: 'alert-dan-taqui', patient_id: 'usr-dan-2026', ts: '2026-11-11T03:42:00Z', title: 'Taquicardia em Repouso durante o Sono', description: 'Frequência cardíaca atingiu 118 bpm às 03:42 da madrugada sem esforço.', severity: 'high', metric_type: 'heart_rate', value_detected: '118 bpm', baseline_value: '63 bpm', clinical_context: 'Acompanhado de queda de HRV (28 ms) e sono profundo reduzido (32 min).', resolved: false },
]);

await upsertBatch('rivio_medications', [
  { id: 'med-dan-levo', patient_id: 'usr-dan-2026', name: 'Levotiroxina Sódica', dose: '50 mcg (1x ao dia em jejum)', start_date: '2024-09-01', end_date: null, indication: 'Hipotireoidismo Subclínico' },
  { id: 'med-dan-vitd', patient_id: 'usr-dan-2026', name: 'Colecalciferol (Vitamina D3)', dose: '2.000 UI/dia', start_date: '2025-02-10', end_date: null, indication: 'Suplementação nutricional' },
]);

await upsertBatch('rivio_clinical_events', [
  { id: 'ev-dan-fadiga', patient_id: 'usr-dan-2026', date: '2026-11-08', type: 'symptom', title: 'Relato de fadiga matinal persistente', description: 'Paciente refere cansaço ao despertar e queda de disposição à tarde.', source: 'patient' },
  { id: 'ev-dan-palpitacao', patient_id: 'usr-dan-2026', date: '2026-11-11', type: 'symptom', title: 'Despertar noturno com palpitação leve', description: 'Coincide com pico de 118 bpm capturado pelo Apple Watch às 03:42.', source: 'wearable' },
]);

// 4. Sincronizar os 4 pacientes sintéticos para a tabela `patients`, `clinical_documents`, `lab_measurements`, `clinical_alerts` e `clinical_graph_nodes/edges`
console.log('4. Sincronizando os 4 pacientes sintéticos para o schema clínico e grafo HNSW...');

const emergencyContactsByPatient = {
  'usr-marcos-2026': { name: 'Patrícia Oliveira', relationship: 'Esposa', phone: '(11) 99123-4501', allergies: ['Sulfonamidas'] },
  'usr-camila-2026': { name: 'Lucas Ferreira', relationship: 'Cônjuge', phone: '(21) 98841-2209', allergies: ['Nenhuma alergia medicamentosa conhecida'] },
  'usr-antonio-2026': { name: 'Beatriz Mendes', relationship: 'Filha', phone: '(31) 99712-8834', allergies: ['Penicilina', 'AINES'] },
  'usr-rafael-2026': { name: 'Fernanda Costa', relationship: 'Irmã', phone: '(41) 99604-1190', allergies: ['Dipirona'] },
};

const patientFiles = readdirSync(syntheticDir).filter((f) => f.startsWith('usr-'));
const allPatientProfiles = [];

for (const f of patientFiles) {
  const p = JSON.parse(readFileSync(join(syntheticDir, f), 'utf8'));
  allPatientProfiles.push(p);
  const id = p.profile.id;
  const ec = emergencyContactsByPatient[id] || { name: 'Contato Familiar', relationship: 'Familiar', phone: '(11) 99999-0000', allergies: [] };

  await upsertBatch('patients', [
    {
      id,
      display_name: p.profile.name,
      email: p.profile.email,
      age: p.profile.age,
      biological_sex: p.profile.biologicalSex,
      blood_type: p.profile.bloodType,
      allergies: ec.allergies,
      chronic_conditions: p.profile.chronicConditions || [],
      emergency_contact: {
        name: ec.name,
        relationship: ec.relationship,
        phone: ec.phone,
        city: p.profile.city,
        birthDate: p.profile.birthDate,
        heightCm: p.profile.heightCm,
        weightKg: p.profile.weightKg,
        scenario: p.profile.scenario,
      },
    },
  ]);

  // Sincronizar documentos em clinical_documents
  const docs = (p.documents || []).map((d) => ({
    id: d.id,
    patient_id: id,
    source_id: d.name.toLowerCase().includes('fleury') ? 'src-fleury' : d.name.toLowerCase().includes('dasa') ? 'src-dasa' : 'src-sabin',
    title: d.name,
    occurred_on: (d.uploadedAt || '2026-10-01').slice(0, 10),
    received_at: d.uploadedAt || '2026-10-01T12:00:00Z',
    mime_type: d.mimeType || 'application/pdf',
    storage_path: `documents/${id}/${d.id}.pdf`,
    file_size_bytes: d.size || 250000,
    status: 'processed',
    extracted_count: d.extractedCount || 4,
    raw_metadata: { syncedFrom: 'rivio_documents', originalUri: d.uri },
  }));
  await upsertBatch('clinical_documents', docs);

  // Sincronizar exames em lab_measurements
  const labs = (p.exams || []).map((e) => ({
    id: e.id,
    patient_id: id,
    biomarker_id: e.biomarkerId,
    document_id: e.documentId || null,
    source_id: e.labName?.toLowerCase().includes('fleury') ? 'src-fleury' : e.labName?.toLowerCase().includes('dasa') ? 'src-dasa' : 'src-sabin',
    occurred_on: e.date,
    value: e.value,
    unit: e.unit,
    ref_min: e.refMin,
    ref_max: e.refMax,
    status: e.status,
    notes: e.notes || null,
  }));
  await upsertBatch('lab_measurements', labs);

  // Sincronizar alertas em clinical_alerts
  const alerts = (p.alerts || []).map((a) => ({
    id: a.id,
    patient_id: id,
    title: a.title,
    category: a.metricType === 'heart_rate' || a.metricType === 'spo2' || a.metricType === 'hrv' ? 'wearable_anomaly' : 'lab_critical',
    severity: a.severity === 'high' ? 'critical' : a.severity === 'medium' ? 'warning' : 'info',
    description: a.description,
    clinical_hypothesis: a.clinicalContext || a.description,
    detected_at: a.timestamp,
    evidence_refs: JSON.stringify([{ id: a.id, label: a.valueDetected }]),
    resolved: Boolean(a.resolved),
  }));
  await upsertBatch('clinical_alerts', alerts);

  // Construir Nós e Arestas do Grafo Clínico (clinical_graph_nodes + clinical_graph_edges) com Embeddings 384d
  const nodes = [];
  const edges = [];
  const patientNodeId = `node-${id}`;
  nodes.push({
    id: patientNodeId,
    patient_id: id,
    kind: 'patient',
    label: `${p.profile.name} (${p.profile.age}a, ${p.profile.biologicalSex})`,
    properties: { age: p.profile.age, blood_type: p.profile.bloodType, scenario: p.profile.scenario },
    embedding: computeEmbedding384(`${p.profile.name} ${p.profile.scenario} ${(p.profile.chronicConditions || []).join(' ')}`),
  });

  // Condições crônicas
  for (let idx = 0; idx < (p.profile.chronicConditions || []).length; idx++) {
    const cond = p.profile.chronicConditions[idx];
    const condNodeId = `node-${id}-cond-${idx}`;
    nodes.push({
      id: condNodeId,
      patient_id: id,
      kind: 'condition',
      label: `Condição: ${cond}`,
      properties: { status: 'active', condition: cond },
      embedding: computeEmbedding384(`Condicao diagnostico ${cond}`),
    });
    edges.push({
      id: `edge-${id}-cond-${idx}`,
      patient_id: id,
      source_node_id: patientNodeId,
      target_node_id: condNodeId,
      relationship: 'APRESENTA',
      label: `Diagnóstico registrado: ${cond}`,
      basis: 'recorded_fact',
      properties: {},
    });
  }

  // Medicações
  for (const m of p.medications || []) {
    const medNodeId = `node-${m.id}`;
    nodes.push({
      id: medNodeId,
      patient_id: id,
      kind: 'medication',
      label: `Medicamento: ${m.name} (${m.dose})`,
      properties: { dose: m.dose, startDate: m.startDate, endDate: m.endDate, indication: m.indication },
      embedding: computeEmbedding384(`Medicamento prescricao ${m.name} ${m.dose} ${m.indication || ''}`),
    });
    edges.push({
      id: `edge-${id}-${m.id}`,
      patient_id: id,
      source_node_id: patientNodeId,
      target_node_id: medNodeId,
      relationship: 'TOMA',
      label: `Uso de ${m.name} (${m.dose}) para ${m.indication || 'controle clínico'}`,
      basis: 'recorded_fact',
      properties: { since: m.startDate },
    });
  }

  // Último exame de cada biomarcador
  const latestByBio = new Map();
  for (const e of p.exams || []) {
    const prev = latestByBio.get(e.biomarkerId);
    if (!prev || e.date >= prev.date) latestByBio.set(e.biomarkerId, e);
  }
  for (const [bioId, e] of latestByBio.entries()) {
    const bioNodeId = `node-${id}-bio-${bioId}`;
    nodes.push({
      id: bioNodeId,
      patient_id: id,
      kind: 'biomarker',
      label: `${e.canonicalName}: ${e.value} ${e.unit} (${e.status})`,
      properties: { biomarkerId: bioId, value: e.value, unit: e.unit, date: e.date, status: e.status, refMin: e.refMin, refMax: e.refMax, examId: e.id },
      embedding: computeEmbedding384(`Exame biomarcador ${e.canonicalName} ${bioId} ${e.value} ${e.unit} status ${e.status} ${e.notes || ''}`),
    });
    edges.push({
      id: `edge-${id}-bio-${bioId}`,
      patient_id: id,
      source_node_id: patientNodeId,
      target_node_id: bioNodeId,
      relationship: 'MEDIU',
      label: `${e.labName} registrou ${e.canonicalName}: ${e.value} ${e.unit} em ${e.date}`,
      basis: 'recorded_fact',
      properties: { examDate: e.date, status: e.status },
    });
  }

  // Alertas
  for (const a of p.alerts || []) {
    const alertNodeId = `node-${a.id}`;
    nodes.push({
      id: alertNodeId,
      patient_id: id,
      kind: 'wearable_alert',
      label: `Alerta: ${a.title} (${a.valueDetected})`,
      properties: { severity: a.severity, metricType: a.metricType, valueDetected: a.valueDetected, timestamp: a.timestamp, clinicalContext: a.clinicalContext },
      embedding: computeEmbedding384(`Alerta anomalia wearable ${a.title} ${a.description} ${a.clinicalContext || ''} ${a.valueDetected}`),
    });
    edges.push({
      id: `edge-${id}-${a.id}`,
      patient_id: id,
      source_node_id: patientNodeId,
      target_node_id: alertNodeId,
      relationship: 'CORRELACIONADO_COM',
      label: a.clinicalContext || a.description,
      basis: 'temporal_correlation',
      properties: { timestamp: a.timestamp },
    });
  }

  // Eventos clínicos / sintomas
  for (const ev of (p.events || []).slice(0, 8)) {
    const evNodeId = `node-${ev.id}`;
    nodes.push({
      id: evNodeId,
      patient_id: id,
      kind: ev.type === 'symptom' ? 'symptom' : 'lab_result',
      label: `${ev.title} (${ev.date})`,
      properties: { date: ev.date, type: ev.type, description: ev.description, source: ev.source },
      embedding: computeEmbedding384(`Evento clinico sintoma ${ev.title} ${ev.description} ${ev.date}`),
    });
    edges.push({
      id: `edge-${id}-${ev.id}`,
      patient_id: id,
      source_node_id: patientNodeId,
      target_node_id: evNodeId,
      relationship: 'APRESENTA',
      label: `${ev.title}: ${ev.description}`,
      basis: 'recorded_fact',
      properties: { date: ev.date },
    });
  }

  await upsertBatch('clinical_graph_nodes', nodes);
  await upsertBatch('clinical_graph_edges', edges);
}

// 5. Atualizar embeddings dos nós de usr-dan-2026 para que match_clinical_nodes funcione também para Daniel Vaz
console.log('5. Atualizando embeddings 384d para os nós de usr-dan-2026...');
const { data: danNodes } = await sb.from('clinical_graph_nodes').select('*').eq('patient_id', 'usr-dan-2026');
if (danNodes?.length) {
  for (const n of danNodes) {
    await sb
      .from('clinical_graph_nodes')
      .update({ embedding: computeEmbedding384(`${n.label} ${JSON.stringify(n.properties || {})}`) })
      .eq('id', n.id);
  }
  console.log(`  [OK] Embeddings atualizados para ${danNodes.length} nós de usr-dan-2026.`);
}

// 6. Criar e popular o bucket `clinical-documents` no Supabase Storage com PDFs reais
console.log('6. Configurando Supabase Storage bucket `clinical-documents`...');
const { data: buckets } = await sb.storage.listBuckets();
if (!buckets?.some((b) => b.name === 'clinical-documents')) {
  const { error: bErr } = await sb.storage.createBucket('clinical-documents', {
    public: true,
    fileSizeLimit: 10485760,
  });
  if (bErr) console.warn('Aviso ao criar bucket:', bErr.message);
  else console.log('  [OK] Bucket `clinical-documents` criado com sucesso.');
} else {
  console.log('  [OK] Bucket `clinical-documents` já existe.');
}

function makeSimplePdf(title, patientName, patientId, dateStr, lines) {
  const clean = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[()\\]/g, '');
  const allLines = [
    'RIVIO HEALTH HUB - LAUDO LABORATORIAL ORIGINAL CUSTODIADO',
    `Documento: ${clean(title)}`,
    `Paciente: ${clean(patientName)} (${clean(patientId)})`,
    `Data de Referencia: ${clean(dateStr)}`,
    '--------------------------------------------------------------------',
    ...lines.map((l) => clean(l)),
    '--------------------------------------------------------------------',
    'Documento verificado e armazenado no Supabase Storage (clinical-documents)',
  ];
  const ops = allLines.map((l, idx) => `BT /F1 11 Tf 45 ${755 - idx * 18} Td (${l}) Tj ET`).join('\n') + '\n';
  const objs = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${ops.length} >>\nstream\n${ops}endstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ];
  let pdf = '%PDF-1.4\n';
  const offs = [0];
  for (const o of objs) {
    offs.push(pdf.length);
    pdf += o;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i++) pdf += `${String(offs[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

const { data: allDocs } = await sb.from('rivio_documents').select('*');
const { data: allExams } = await sb.from('rivio_exams').select('*');
const { data: allRivioPatients } = await sb.from('rivio_patients').select('id, name');
const patientNameMap = new Map((allRivioPatients || []).map((p) => [p.id, p.name]));

let uploadedPdfs = 0;
for (const doc of allDocs || []) {
  const docExams = (allExams || []).filter((e) => e.document_id === doc.id);
  const examLines = docExams.length
    ? docExams.map((e) => `- ${e.canonical_name}: ${e.value} ${e.unit} [Ref: ${e.ref_min}-${e.ref_max}] (${e.status})`)
    : ['- Laudo laboratorial consolidado no historico clinico do paciente.'];
  const pdfBuf = makeSimplePdf(
    doc.name,
    patientNameMap.get(doc.patient_id) || doc.patient_id,
    doc.patient_id,
    (doc.uploaded_at || '2026-10-01').slice(0, 10),
    examLines
  );
  const path = `${doc.patient_id}/${doc.id}.pdf`;
  const { error: upErr } = await sb.storage.from('clinical-documents').upload(path, pdfBuf, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (!upErr) uploadedPdfs++;
}
console.log(`  [OK] ${uploadedPdfs} arquivos PDF reais enviados ao Supabase Storage (clinical-documents).`);

// 7. Sincronizar Sessões de Acesso Médico (doctor_access_sessions) para todos os 5 pacientes
console.log('7. Sincronizando sessões de acesso médico (doctor_access_sessions)...');
const futureExpires = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
await upsertBatch('doctor_access_sessions', [
  {
    id: 'sess-marcos-active',
    patient_id: 'usr-marcos-2026',
    token: 'MRC206',
    active: true,
    scope: ['read_exams', 'read_wearables', 'read_clinical_context', 'read_alerts', 'read_graphrag_briefing'],
    created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    expires_at: futureExpires,
    access_url: 'http://localhost:3000/doctor/consultation/MRC206',
    doctor_crm: '123456-SP',
    doctor_name: 'Dra. Helena Costa',
    revoked_at: null,
  },
  {
    id: 'sess-antonio-active',
    patient_id: 'usr-antonio-2026',
    token: 'ANT512',
    active: true,
    scope: ['read_exams', 'read_wearables', 'read_clinical_context', 'read_alerts', 'read_graphrag_briefing'],
    created_at: new Date(Date.now() - 7200 * 1000).toISOString(),
    expires_at: futureExpires,
    access_url: 'http://localhost:3000/doctor/consultation/ANT512',
    doctor_crm: '123456-SP',
    doctor_name: 'Dra. Helena Costa',
    revoked_at: null,
  },
  {
    id: 'sess-rafael-active',
    patient_id: 'usr-rafael-2026',
    token: 'RAF903',
    active: true,
    scope: ['read_exams', 'read_wearables', 'read_clinical_context', 'read_alerts', 'read_graphrag_briefing'],
    created_at: new Date(Date.now() - 5400 * 1000).toISOString(),
    expires_at: futureExpires,
    access_url: 'http://localhost:3000/doctor/consultation/RAF903',
    doctor_crm: '654321-SP',
    doctor_name: 'Dr. Roberto Silva',
    revoked_at: null,
  },
  {
    id: 'sess-camila-active',
    patient_id: 'usr-camila-2026',
    token: 'CAM104',
    active: true,
    scope: ['read_exams', 'read_wearables', 'read_clinical_context', 'read_alerts', 'read_graphrag_briefing'],
    created_at: new Date(Date.now() - 1800 * 1000).toISOString(),
    expires_at: futureExpires,
    access_url: 'http://localhost:3000/doctor/consultation/CAM104',
    doctor_crm: '123456-SP',
    doctor_name: 'Dra. Helena Costa',
    revoked_at: null,
  },
  {
    id: 'sess-dan-token-6d',
    patient_id: 'usr-dan-2026',
    token: 'RIV849',
    active: true,
    scope: ['read_exams', 'read_wearables', 'read_clinical_context', 'read_alerts', 'read_graphrag_briefing'],
    created_at: new Date(Date.now() - 900 * 1000).toISOString(),
    expires_at: futureExpires,
    access_url: 'http://localhost:3000/doctor/consultation/RIV849',
    doctor_crm: '123456-SP',
    doctor_name: 'Dr. Roberto Silva',
    revoked_at: null,
  },
]);

// 8. Semear registros iniciais de Observabilidade de Transições, Episódios Institucionais e Pedidos de Vínculo
console.log('8. Semeando trilha de observabilidade de transições e episódios institucionais...');
const now = Date.now();
const initialObservabilityNodes = [
  {
    id: 'obs-evt-seed-1',
    patient_id: 'usr-marcos-2026',
    kind: 'consultation',
    label: 'AUDIT:token_created',
    properties: {
      recordType: 'audit_event',
      eventType: 'token_created',
      actorRole: 'patient',
      actorId: 'usr-marcos-2026',
      actorName: 'Marcos Oliveira',
      recipientId: 'token:MRC206',
      recipientName: 'Convite Efêmero Open Health (MRC206)',
      institutionName: 'Cofre Pessoal Rivio',
      scopes: ['read_exams', 'read_wearables', 'read_clinical_context', 'read_alerts', 'read_graphrag_briefing'],
      decision: 'allowed',
      accessRevision: 'rev-acc-marcos-1',
      dataRevision: 'rev-dat-marcos-1',
      summary: 'Paciente emitiu token temporário MRC206 com 5 categorias de escopo autorizadas.',
      occurredAt: new Date(now - 55 * 60 * 1000).toISOString(),
    },
  },
  {
    id: 'obs-evt-seed-2',
    patient_id: 'usr-marcos-2026',
    kind: 'consultation',
    label: 'AUDIT:token_resolved',
    properties: {
      recordType: 'audit_event',
      eventType: 'token_resolved',
      actorRole: 'doctor',
      actorId: 'doctor-demo-1',
      actorName: 'Dra. Helena Costa (CRM 123456-SP)',
      recipientId: 'doctor-demo-1',
      recipientName: 'Dra. Helena Costa',
      institutionName: 'Hospital Sírio-Libanês',
      scopes: ['read_exams', 'read_wearables', 'read_clinical_context', 'read_alerts', 'read_graphrag_briefing'],
      decision: 'allowed',
      accessRevision: 'rev-acc-marcos-1',
      dataRevision: 'rev-dat-marcos-1',
      summary: 'Token MRC206 validado e vinculado ao atendimento assistencial da Dra. Helena Costa.',
      occurredAt: new Date(now - 50 * 60 * 1000).toISOString(),
    },
  },
  {
    id: 'obs-evt-seed-3',
    patient_id: 'usr-antonio-2026',
    kind: 'consultation',
    label: 'AUDIT:episode_prepared',
    properties: {
      recordType: 'audit_event',
      eventType: 'episode_prepared',
      actorRole: 'institution_system',
      actorId: 'inst-sirio-libanes',
      actorName: 'Conector Assistencial · Hospital Sírio-Libanês',
      recipientId: 'inst-sirio-libanes',
      recipientName: 'Hospital Sírio-Libanês',
      institutionName: 'Hospital Sírio-Libanês',
      episodeId: 'ep-sirio-antonio-001',
      attendanceRef: 'ATD-2026-8841',
      scopes: ['read_exams', 'read_wearables', 'read_clinical_context', 'read_alerts', 'read_graphrag_briefing'],
      decision: 'allowed',
      accessRevision: 'rev-acc-antonio-1',
      dataRevision: 'rev-dat-antonio-1',
      summary: 'Pacote clínico qualificado preparado no episódio ep-sirio-antonio-001 (TTL de cache: 15 min).',
      occurredAt: new Date(now - 25 * 60 * 1000).toISOString(),
    },
  },
  {
    id: 'obs-evt-seed-4',
    patient_id: 'usr-antonio-2026',
    kind: 'consultation',
    label: 'AUDIT:receipt_confirmed',
    properties: {
      recordType: 'audit_event',
      eventType: 'receipt_confirmed',
      actorRole: 'institution_system',
      actorId: 'inst-sirio-libanes',
      actorName: 'Consumidor Homologado · Hospital Sírio-Libanês',
      recipientId: 'inst-sirio-libanes',
      recipientName: 'Hospital Sírio-Libanês',
      institutionName: 'Hospital Sírio-Libanês',
      episodeId: 'ep-sirio-antonio-001',
      attendanceRef: 'ATD-2026-8841',
      billingEventId: 'bill-ep-sirio-antonio-001',
      scopes: ['read_exams', 'read_wearables', 'read_clinical_context', 'read_alerts', 'read_graphrag_briefing'],
      decision: 'allowed',
      accessRevision: 'rev-acc-antonio-1',
      dataRevision: 'rev-dat-antonio-1',
      summary: 'Recebimento do pacote clínico confirmado via recibo opaco. 1 unidade cobrável registrada de forma idempotente.',
      occurredAt: new Date(now - 24 * 60 * 1000).toISOString(),
    },
  },
  {
    id: 'obs-ep-seed-1',
    patient_id: 'usr-antonio-2026',
    kind: 'consultation',
    label: 'EPISODE:ep-sirio-antonio-001',
    properties: {
      recordType: 'institutional_episode',
      episodeId: 'ep-sirio-antonio-001',
      institutionId: 'inst-sirio-libanes',
      institutionName: 'Hospital Sírio-Libanês',
      patientId: 'usr-antonio-2026',
      patientName: 'Antônio Carlos Mendes',
      attendanceRef: 'ATD-2026-8841',
      purpose: 'Avaliação Infectológica e Hematológica Pós-Internação',
      professionalName: 'Dra. Helena Costa',
      professionalId: 'CRM 123456-SP',
      idempotencyKey: 'idem-sirio-antonio-8841',
      packageId: 'pkg-antonio-v1',
      packageStatus: 'ready',
      deliveryStatus: 'confirmed',
      qualified: true,
      receiptToken: 'rcpt_opaque_antonio_8841_9f2a',
      scopes: ['read_exams', 'read_wearables', 'read_clinical_context', 'read_alerts', 'read_graphrag_briefing'],
      sourcesIncluded: ['Fleury Medicina e Saúde', 'Dasa / Alta Excelência Diagnóstica', 'Apple Watch Series 9 (HealthKit)'],
      evidenceCount: 38,
      accessRevision: 'rev-acc-antonio-1',
      dataRevision: 'rev-dat-antonio-1',
      obtainedAt: new Date(now - 8 * 60 * 1000).toISOString(),
      cacheExpiresAt: new Date(now + 7 * 60 * 1000).toISOString(),
      confirmedAt: new Date(now - 7 * 60 * 1000).toISOString(),
      billingEventId: 'bill-ep-sirio-antonio-001',
      readCount: 3,
    },
  },
  {
    id: 'obs-ep-seed-2',
    patient_id: 'usr-rafael-2026',
    kind: 'consultation',
    label: 'EPISODE:ep-dasa-rafael-002',
    properties: {
      recordType: 'institutional_episode',
      episodeId: 'ep-dasa-rafael-002',
      institutionId: 'inst-alta-dasa',
      institutionName: 'Alta Excelência Diagnóstica (Dasa)',
      patientId: 'usr-rafael-2026',
      patientName: 'Rafael Souza',
      attendanceRef: 'ATD-2026-9102',
      purpose: 'Pronto-Atendimento Respiratório — Monitoramento SpO2 H1N1',
      professionalName: 'Dr. Roberto Silva',
      professionalId: 'CRM 654321-SP',
      idempotencyKey: 'idem-dasa-rafael-9102',
      packageId: 'pkg-rafael-v1',
      packageStatus: 'ready',
      deliveryStatus: 'unconfirmed',
      qualified: true,
      receiptToken: 'rcpt_opaque_rafael_9102_4c8b',
      scopes: ['read_exams', 'read_wearables', 'read_clinical_context', 'read_alerts', 'read_graphrag_briefing'],
      sourcesIncluded: ['Sabin Medicina Diagnóstica', 'Apple Watch Series 9 (HealthKit)'],
      evidenceCount: 24,
      accessRevision: 'rev-acc-rafael-1',
      dataRevision: 'rev-dat-rafael-1',
      obtainedAt: new Date(now - 4 * 60 * 1000).toISOString(),
      cacheExpiresAt: new Date(now + 11 * 60 * 1000).toISOString(),
      confirmedAt: null,
      billingEventId: null,
      readCount: 1,
    },
  },
  {
    id: 'obs-fup-seed-1',
    patient_id: 'usr-marcos-2026',
    kind: 'consultation',
    label: 'FOLLOWUP:fup-marcos-001',
    properties: {
      recordType: 'followup_request',
      id: 'fup-marcos-001',
      invitationId: 'MRC206',
      patientId: 'usr-marcos-2026',
      patientName: 'Marcos Oliveira',
      doctorId: 'doctor-demo-1',
      doctorName: 'Dra. Helena Costa',
      doctorCrm: 'CRM 123456-SP',
      institutionName: 'Hospital Sírio-Libanês',
      status: 'pending_patient_approval',
      requestedScopes: ['read_exams', 'read_wearables', 'read_clinical_context', 'read_alerts', 'read_graphrag_briefing'],
      requestedDuration: { mode: 'until', expiresAt: futureExpires },
      createdAt: new Date(now - 20 * 60 * 1000).toISOString(),
      decidedAt: null,
      grantId: null,
    },
  },
];

await upsertBatch('clinical_graph_nodes', initialObservabilityNodes);
console.log('=== SINCRONIZAÇÃO COMPLETA DO BANCO DE DADOS CONCLUÍDA COM SUCESSO! ===');
