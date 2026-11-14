// Gerador de dados sintéticos (determinístico) — Hub de Saúde Rivio.
// Uso: node synthetic/generate.mjs
// Saída: synthetic/data/*.json  +  synthetic/supabase/seed.sql
// Formatos compatíveis com mobile/src/types/index.ts (ExamMeasurement, WearableDailyReading, AnomalyAlert...).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA = join(ROOT, 'data');
const SQLDIR = join(ROOT, 'supabase');
mkdirSync(DATA, { recursive: true });
mkdirSync(SQLDIR, { recursive: true });

const TODAY = '2026-11-12';
const DAYS = 365;
const HR_DAYS = 60;

// ---------- utilidades ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r) => {
  let u = 0, v = 0;
  while (!u) u = r();
  while (!v) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const addDays = (s, n) => {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const diff = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const rnd = (x, n = 0) => Number(x.toFixed(n));
const dow = (s) => new Date(s + 'T00:00:00Z').getUTCDay();

// ---------- biomarcadores ----------
// id: [nome, categoria, unidade, min, max, descrição, casas decimais]
const DEFS = {
  glicose: ['Glicemia de Jejum', 'Glicêmico', 'mg/dL', 70, 99, 'Nível de glicose plasmática em jejum de 8 a 12 horas.', 0],
  glicemia_capilar: ['Glicemia Capilar (jejum)', 'Glicêmico', 'mg/dL', 70, 99, 'Automonitoramento domiciliar em jejum com glicosímetro.', 0],
  hba1c: ['Hemoglobina Glicada (HbA1c)', 'Glicêmico', '%', 4.0, 5.6, 'Média ponderada da glicemia nos últimos 90 a 120 dias.', 1],
  ldl: ['Colesterol LDL (Fração Ruim)', 'Lipídico', 'mg/dL', 0, 130, 'Lipoproteína de baixa densidade associada ao risco aterosclerótico.', 0],
  hdl: ['Colesterol HDL (Fração Boa)', 'Lipídico', 'mg/dL', 40, 80, 'Lipoproteína protetora cardiovascular.', 0],
  triglicerides: ['Triglicérides', 'Lipídico', 'mg/dL', 0, 150, 'Gorduras de reserva energética e risco metabólico.', 0],
  ferritina: ['Ferritina Sérica', 'Hematológico', 'ng/mL', 30, 400, 'Principal proteína de reserva de ferro; também reagente de fase aguda.', 0],
  tsh: ['TSH Ultra Sensível', 'Hormonal', 'mUI/L', 0.4, 4.0, 'Hormônio tireoestimulante regulador da função da tireoide.', 2],
  creatinina: ['Creatinina Sérica', 'Renal', 'mg/dL', 0.7, 1.3, 'Marcador de filtração glomerular / função renal.', 2],
  microalbuminuria: ['Microalbuminúria', 'Renal', 'mg/g', 0, 30, 'Albumina urinária; marcador precoce de nefropatia diabética.', 0],
  hemoglobina: ['Hemoglobina', 'Hematológico', 'g/dL', 13.5, 17.5, 'Proteína transportadora de oxigênio nas hemácias.', 1],
  leucocitos: ['Leucócitos Totais', 'Hematológico', '/µL', 4000, 10000, 'Contagem total de glóbulos brancos.', 0],
  linfocitos: ['Linfócitos', 'Hematológico', '/µL', 1000, 4800, 'Contagem absoluta de linfócitos.', 0],
  plaquetas: ['Plaquetas', 'Hematológico', 'mil/µL', 150, 450, 'Contagem de plaquetas.', 0],
  pcr: ['Proteína C Reativa (PCR)', 'Inflamatório', 'mg/L', 0, 5, 'Marcador inflamatório de fase aguda.', 1],
  vhs: ['VHS', 'Inflamatório', 'mm/h', 0, 20, 'Velocidade de hemossedimentação.', 0],
  ldh: ['Desidrogenase Lática (LDH)', 'Inflamatório', 'U/L', 120, 250, 'Enzima de lesão tecidual / hemólise.', 0],
  ck: ['Creatinoquinase (CK)', 'Inflamatório', 'U/L', 30, 200, 'Enzima muscular; eleva-se em mialgia/rabdomiólise.', 0],
  ast: ['AST (TGO)', 'Hepático', 'U/L', 0, 40, 'Transaminase oxalacética.', 0],
  alt: ['ALT (TGP)', 'Hepático', 'U/L', 0, 41, 'Transaminase pirúvica.', 0],
  albumina: ['Albumina', 'Hepático', 'g/dL', 3.5, 5.2, 'Principal proteína plasmática.', 1],
  globulinas: ['Globulinas', 'Hepático', 'g/dL', 2.0, 3.5, 'Fração globulínica das proteínas séricas.', 1],
  vitd: ['Vitamina D (25-OH)', 'Nutricional', 'ng/mL', 30, 100, 'Reserva de vitamina D.', 0],
};
const SEX_REF = {
  creatinina: { Masculino: [0.7, 1.3], Feminino: [0.5, 1.1] },
  hemoglobina: { Masculino: [13.5, 17.5], Feminino: [12.0, 15.5] },
  ferritina: { Masculino: [30, 400], Feminino: [15, 150] },
};
const refFor = (id, sex) => SEX_REF[id]?.[sex] ?? [DEFS[id][3], DEFS[id][4]];
function statusOf(v, min, max) {
  if (v >= min && v <= max) return 'normal';
  const dist = v < min ? min - v : v - max;
  return dist <= 0.15 * (max - min) ? 'attention' : 'critical';
}

// ---------- construção do paciente ----------
function makePatient(profile, seed) {
  const r = rng(seed);
  const p = {
    profile,
    exams: [],
    documents: [],
    wearables: [],
    heartRateSamples: [],
    alerts: [],
    medications: [],
    events: [],
    _r: r,
  };
  return p;
}

function addPanel(p, date, lab, vals, note) {
  const sex = p.profile.biologicalSex;
  const file = `Laudo_${lab.split(/[ /]/)[0]}_${date}.pdf`;
  const hasDoc = !lab.startsWith('Automonitoramento');
  const docId = hasDoc ? `doc-${p.profile.id}-${date}` : undefined;
  let n = 0;
  for (const [id, raw] of Object.entries(vals)) {
    const def = DEFS[id];
    const [min, max] = refFor(id, sex);
    const value = rnd(raw, def[6]);
    p.exams.push({
      id: `ex-${p.profile.id}-${id}-${date}`,
      date,
      labName: lab,
      biomarkerId: id,
      canonicalName: def[0],
      value,
      unit: def[2],
      refMin: min,
      refMax: max,
      status: statusOf(value, min, max),
      ...(note ? { notes: note } : {}),
      ...(docId ? { documentId: docId } : {}),
    });
    n++;
  }
  if (!lab.startsWith('Automonitoramento')) {
    p.documents.push({
      id: docId,
      name: file,
      uri: `supabase://laudos/${p.profile.id}/${file}`,
      size: 180000 + Math.floor(p._r() * 420000),
      mimeType: 'application/pdf',
      uploadedAt: `${date}T18:00:00-03:00`,
      extractedCount: n,
      status: 'processed',
    });
  }
}

const noise = (p, v, pct) => v * (1 + gauss(p._r) * pct);

function addEvent(p, date, type, title, description, source = 'consulta') {
  p.events.push({ id: `ev-${p.profile.id}-${p.events.length + 1}`, date, type, title, description, source });
}
function addMed(p, name, dose, start, end, indication) {
  p.medications.push({ id: `med-${p.profile.id}-${p.medications.length + 1}`, name, dose, startDate: start, endDate: end, indication });
}

// ---------- wearables ----------
function genWearables(p, base, mod) {
  const start = addDays(TODAY, -(DAYS - 1));
  for (let i = 0; i < DAYS; i++) {
    const date = addDays(start, i);
    const m = { rhr: 0, hrv: 1, sleep: 0, deep: 1, spo2: 0, steps: 1, ...mod(date, i, p._r) };
    const weekend = [0, 6].includes(dow(date)) ? base.weekend ?? 1 : 1;
    const rhr = rnd(base.rhr + m.rhr + gauss(p._r) * 1.8);
    const hrv = Math.max(8, rnd(base.hrv * m.hrv * (1 + gauss(p._r) * 0.08)));
    const deep = clamp(rnd(base.deep * m.deep * (1 + gauss(p._r) * 0.1), 1), 0.3, 3);
    const rem = clamp(rnd(base.rem * (0.6 + 0.4 * m.deep) * (1 + gauss(p._r) * 0.1), 1), 0.3, 3);
    const sleep = rnd(Math.max(deep + rem + 2, base.sleep + m.sleep + gauss(p._r) * 0.4), 1);
    const steps = Math.max(150, Math.round(base.steps * m.steps * weekend * (1 + gauss(p._r) * 0.18)));
    p.wearables.push({
      date,
      restingHeartRate: rhr,
      maxHeartRate: Math.round(rhr + 28 + steps / 380 + Math.abs(gauss(p._r)) * 6),
      minHeartRate: Math.round(rhr - 7 - p._r() * 5),
      hrv,
      sleepHours: sleep,
      deepSleepHours: deep,
      remSleepHours: rem,
      spo2: rnd(clamp(base.spo2 + m.spo2 + gauss(p._r) * 0.4, 84, 99.5), 1),
      steps,
    });
  }
}

function genHeartRate(p) {
  const recent = p.wearables.slice(-HR_DAYS);
  for (const w of recent) {
    const act = clamp(w.steps / 8000, 0.1, 1.6);
    for (let h = 0; h < 24; h++) {
      const circ = -6 + 20 * (0.5 - 0.5 * Math.cos((2 * Math.PI * (h - 4)) / 24));
      const bump = [7, 8, 17, 18].includes(h) ? act * 9 : 0;
      const bpm = Math.round(clamp(w.restingHeartRate + circ + bump + gauss(p._r) * 3, w.minHeartRate - 2, w.maxHeartRate));
      p.heartRateSamples.push({ ts: `${w.date}T${String(h).padStart(2, '0')}:00:00-03:00`, bpm });
    }
  }
}

// ---------- alertas derivados dos wearables ----------
function genAlerts(p, context) {
  const base = p.wearables.slice(0, 60);
  const med = (k) => [...base.map((w) => w[k])].sort((a, b) => a - b)[Math.floor(base.length / 2)];
  const b = { rhr: med('restingHeartRate'), hrv: med('hrv'), spo2: med('spo2') };
  const flagged = p.wearables.map((w) => w.restingHeartRate >= b.rhr + 10 || w.hrv <= b.hrv * 0.65 || w.spo2 <= 94);
  let i = 0;
  while (i < flagged.length) {
    if (!flagged[i]) { i++; continue; }
    let j = i, last = i;
    while (j < flagged.length && j - last <= 1) { if (flagged[j]) last = j; j++; }
    const grp = p.wearables.slice(i, last + 1);
    const minSpo2 = Math.min(...grp.map((w) => w.spo2));
    const maxRhr = Math.max(...grp.map((w) => w.restingHeartRate));
    const minHrv = Math.min(...grp.map((w) => w.hrv));
    const sp = minSpo2 <= 94;
    const metricType = sp ? 'spo2' : maxRhr >= b.rhr + 10 ? 'heart_rate' : 'hrv';
    const severity = grp.length >= 5 || minSpo2 <= 93 ? 'high' : grp.length >= 3 ? 'medium' : 'low';
    p.alerts.push({
      id: `al-${p.profile.id}-${grp[0].date}`,
      timestamp: `${grp[0].date}T07:30:00-03:00`,
      title: sp ? 'Queda de saturação de oxigênio' : metricType === 'heart_rate' ? 'Taquicardia de repouso sustentada' : 'Queda acentuada de HRV',
      description: `${grp.length} dia(s) consecutivo(s) fora do padrão (${grp[0].date} a ${grp[grp.length - 1].date}).`,
      severity,
      metricType,
      valueDetected: sp ? `${minSpo2}% SpO2` : metricType === 'heart_rate' ? `${maxRhr} bpm` : `${minHrv} ms`,
      baselineValue: sp ? `${rnd(b.spo2, 1)}% SpO2` : metricType === 'heart_rate' ? `${b.rhr} bpm` : `${b.hrv} ms`,
      clinicalContext: context(grp[0].date),
      resolved: diff(grp[grp.length - 1].date, TODAY) > 2,
    });
    i = last + 1;
  }
}

// ---------- interpolação ----------
function interp(points, date) {
  if (date <= points[0][0]) return points[0][1];
  for (let k = 1; k < points.length; k++) {
    if (date <= points[k][0]) {
      const [d0, v0] = points[k - 1], [d1, v1] = points[k];
      return v0 + ((v1 - v0) * diff(d0, date)) / diff(d0, d1);
    }
  }
  return points[points.length - 1][1];
}

// =====================================================================
// 1) MARCOS OLIVEIRA — Diabetes tipo 2
// =====================================================================
function marcos() {
  const p = makePatient({
    id: 'usr-marcos-2026', name: 'Marcos Oliveira', email: 'marcos.oliveira@example.com', age: 58,
    biologicalSex: 'Masculino', birthDate: '1968-03-22', city: 'Belo Horizonte, MG', heightCm: 172, weightKg: 96.4,
    bloodType: 'O+', scenario: 'diabetes_tipo_2',
    chronicConditions: ['Diabetes mellitus tipo 2 (desde 11/2023)', 'Dislipidemia', 'Hipertensão arterial', 'Obesidade grau I'],
  }, 101);
  const dates = ['2023-11-14', '2024-02-20', '2024-05-22', '2024-08-27', '2024-11-19', '2025-02-25', '2025-05-27', '2025-08-26', '2025-11-18', '2026-02-24', '2026-05-26', '2026-08-25', '2026-11-03'];
  const a1c = [8.9, 8.1, 7.4, 7.2, 7.0, 7.6, 8.1, 8.3, 7.5, 7.1, 6.9, 6.8, 6.7];
  const ldl = [152, 138, 121, 112, 108, 118, 126, 129, 115, 106, 101, 98, 96];
  const hdl = [35, 36, 38, 40, 41, 39, 38, 38, 41, 43, 44, 45, 45];
  const tg = [268, 236, 205, 188, 176, 198, 214, 221, 190, 172, 160, 152, 148];
  const cr = [0.9, 0.9, 0.95, 0.95, 1.0, 1.0, 1.05, 1.05, 1.1, 1.1, 1.1, 1.15, 1.15];
  const mal = [18, 22, 26, 24, 28, 34, 41, 46, 38, 33, 29, 27, 25];
  const alt = [58, 52, 47, 44, 42, 45, 49, 51, 44, 40, 38, 36, 34];
  const ast = [41, 38, 36, 34, 33, 35, 37, 38, 34, 32, 31, 30, 29];
  const vitd = [19, 21, 26, 29, 30, 27, 25, 24, 28, 32, 34, 35, 36];
  const labs = ['Fleury Medicina e Saúde', 'Dasa / Alta Excelência', 'Hermes Pardini'];
  dates.forEach((d, k) => {
    addPanel(p, d, labs[k % 3], {
      glicose: 28.7 * a1c[k] - 46.7 + gauss(p._r) * 8,
      hba1c: a1c[k], ldl: ldl[k], hdl: hdl[k], triglicerides: tg[k], creatinina: cr[k],
      microalbuminuria: mal[k], alt: alt[k], ast: ast[k], vitd: vitd[k],
      ferritina: noise(p, 310, 0.06), tsh: noise(p, 2.9, 0.08),
    });
  });
  const a1cPts = dates.map((d, k) => [d, a1c[k]]);
  for (let w = 51; w >= 0; w--) {
    const d = addDays(TODAY, -w * 7 - 1);
    addPanel(p, d, 'Automonitoramento (glicosímetro)', { glicemia_capilar: 28.7 * interp(a1cPts, d) - 46.7 + gauss(p._r) * 14 });
  }
  genWearables(p, { rhr: 77, hrv: 27, sleep: 6.3, deep: 1.0, rem: 1.3, spo2: 96.3, steps: 5400, weekend: 0.85 }, (date, i) => {
    const t = i / 364;
    const infect = date >= '2026-03-10' && date <= '2026-03-14';
    return { rhr: -5 * t + (infect ? 12 : 0), hrv: 1 + 0.22 * t - (infect ? 0.4 : 0), steps: 0.85 + 0.55 * t - (infect ? 0.4 : 0), sleep: infect ? -0.8 : 0 };
  });
  genHeartRate(p);
  genAlerts(p, () => 'Paciente com DM2: taquicardia de repouso/queda de HRV pode refletir descompensação glicêmica, desidratação ou processo infeccioso. Correlacionar com glicemia capilar do período.');
  addMed(p, 'Metformina', '850 mg 12/12h', '2023-11-14', null, 'Diabetes tipo 2');
  addMed(p, 'Atorvastatina', '20 mg/noite', '2023-11-14', null, 'Dislipidemia');
  addMed(p, 'Glicazida MR', '60 mg/manhã', '2025-05-27', '2025-11-18', 'Diabetes tipo 2 (suspensa por hipoglicemias leves)');
  addMed(p, 'Dapagliflozina', '10 mg/manhã', '2025-08-26', null, 'Diabetes tipo 2 / proteção renal');
  addMed(p, 'Losartana', '50 mg/dia', '2025-08-26', null, 'Hipertensão e microalbuminúria');
  addMed(p, 'Ciprofloxacino', '500 mg 12/12h por 5 dias', '2026-03-10', '2026-03-14', 'Infecção urinária');
  addEvent(p, '2023-11-14', 'diagnostico', 'Diagnóstico de diabetes tipo 2', 'HbA1c 8,9% e glicemia de jejum >180 mg/dL. Início de metformina e atorvastatina.', 'consulta');
  addEvent(p, '2024-05-22', 'consulta', 'Acompanhamento nutricional', 'Perda de 6 kg. Plano alimentar de baixo índice glicêmico.', 'consulta');
  addEvent(p, '2025-02-25', 'sintoma', 'Adesão irregular ao tratamento', 'Paciente relata esquecimento da metformina e dieta irregular após viagem.', 'consulta');
  addEvent(p, '2025-08-26', 'consulta', 'Intensificação terapêutica', 'HbA1c 8,3% e microalbuminúria elevada: adicionada dapagliflozina e losartana.', 'consulta');
  addEvent(p, '2025-11-18', 'consulta', 'Glicazida suspensa', 'Episódios de hipoglicemia leve. Mantidos metformina + dapagliflozina.', 'consulta');
  addEvent(p, '2025-04-30', 'vacina', 'Vacina influenza 2025', 'Dose anual aplicada.', 'carteira');
  addEvent(p, '2026-02-24', 'exame_imagem', 'Fundo de olho', 'Sem sinais de retinopatia diabética.', 'oftalmologia');
  addEvent(p, '2026-03-10', 'sintoma', 'Infecção urinária', 'Disúria e febre baixa; urocultura positiva. Ciprofloxacino por 5 dias; wearable mostrou taquicardia de repouso.', 'pronto atendimento');
  addEvent(p, '2026-08-25', 'consulta', 'Meta atingida', 'HbA1c 6,8% (meta <7%). Orientado manter caminhadas diárias.', 'consulta');
  return p;
}

// =====================================================================
// 2) CAMILA ROCHA — mulher saudável
// =====================================================================
function camila() {
  const p = makePatient({
    id: 'usr-camila-2026', name: 'Camila Rocha', email: 'camila.rocha@example.com', age: 29,
    biologicalSex: 'Feminino', birthDate: '1997-08-09', city: 'São Paulo, SP', heightCm: 166, weightKg: 59.0,
    bloodType: 'A+', scenario: 'saudavel', chronicConditions: [],
  }, 202);
  const dates = ['2023-11-08', '2024-05-14', '2024-11-12', '2025-05-13', '2025-11-11', '2026-05-12', '2026-11-04'];
  dates.forEach((d, k) => addPanel(p, d, ['Fleury Medicina e Saúde', 'Dasa / Alta Excelência'][k % 2], {
    glicose: noise(p, 82, 0.04), hba1c: noise(p, 5.0, 0.02), ldl: noise(p, 88, 0.08), hdl: noise(p, 66, 0.06),
    triglicerides: noise(p, 72, 0.12), ferritina: noise(p, 46, 0.15), tsh: noise(p, 1.9, 0.15),
    creatinina: noise(p, 0.72, 0.05), hemoglobina: noise(p, 13.4, 0.025), leucocitos: noise(p, 6400, 0.08),
    plaquetas: noise(p, 270, 0.07), pcr: Math.abs(noise(p, 0.8, 0.3)), ast: noise(p, 21, 0.1), alt: noise(p, 17, 0.12),
    albumina: noise(p, 4.5, 0.02), vitd: noise(p, 38, 0.1),
  }));
  genWearables(p, { rhr: 58, hrv: 68, sleep: 7.6, deep: 1.9, rem: 1.9, spo2: 98.0, steps: 10200, weekend: 1.05 }, (date, i) => {
    const luteal = i % 28 >= 14;
    return luteal ? { rhr: 2.5, hrv: 0.92, sleep: -0.2 } : {};
  });
  genHeartRate(p);
  genAlerts(p, () => 'Variação fora do padrão em paciente saudável; recomenda-se observar contexto (estresse, sono, ciclo menstrual) antes de qualquer conduta.');
  addMed(p, 'Suplemento Vitamina D', '1000 UI/dia', '2023-11-08', null, 'Manutenção');
  addEvent(p, '2024-05-14', 'consulta', 'Check-up anual', 'Exames de rotina normais. Orientada manutenção de atividade física.', 'consulta');
  addEvent(p, '2025-10-20', 'vacina', 'Reforço COVID-19', 'Dose de reforço aplicada.', 'carteira');
  addEvent(p, '2026-04-20', 'vacina', 'Vacina influenza 2026', 'Dose anual aplicada.', 'carteira');
  addEvent(p, '2026-05-12', 'consulta', 'Check-up e consulta ginecológica', 'Papanicolau normal. Sem queixas.', 'consulta');
  addEvent(p, '2026-09-14', 'consulta', 'Meia maratona (21 km)', 'Prova concluída em 1h58; sem intercorrências.', 'atividade');
  return p;
}

// =====================================================================
// 3) ANTÔNIO RIBEIRO — Leishmaniose visceral (calazar)
// =====================================================================
function antonio() {
  const p = makePatient({
    id: 'usr-antonio-2026', name: 'Antônio Ribeiro Lima', email: 'antonio.lima@example.com', age: 47,
    biologicalSex: 'Masculino', birthDate: '1979-01-30', city: 'Teresina, PI', heightCm: 175, weightKg: 71.0,
    bloodType: 'B+', scenario: 'leishmaniose_visceral',
    chronicConditions: ['Leishmaniose visceral (calazar) — pós-tratamento, em seguimento'],
  }, 303);
  const base = (v) => ({
    glicose: noise(p, 88, 0.04), hemoglobina: noise(p, 15.0, 0.03), leucocitos: noise(p, 6800, 0.08), plaquetas: noise(p, 255, 0.08),
    linfocitos: noise(p, 2100, 0.1), pcr: 1.1, vhs: 8, ferritina: noise(p, 140, 0.15), albumina: 4.4, globulinas: 2.8,
    ast: 26, alt: 25, ldh: 190, creatinina: 0.95, ...v,
  });
  ['2024-04-09', '2025-04-08', '2026-04-14'].forEach((d) => addPanel(p, d, 'Laboratório Lacen/PI', base({})));
  const ill = [
    ['2026-07-28', 'Hospital Universitário UFPI', { hemoglobina: 9.1, leucocitos: 2100, plaquetas: 88, linfocitos: 900, pcr: 38, vhs: 92, ferritina: 1450, albumina: 3.0, globulinas: 4.6, ast: 78, alt: 64, ldh: 410, creatinina: 1.0 }],
    ['2026-08-10', 'Hospital Universitário UFPI', { hemoglobina: 8.2, leucocitos: 1800, plaquetas: 71, linfocitos: 800, pcr: 46, vhs: 110, ferritina: 2100, albumina: 2.7, globulinas: 5.1, ast: 96, alt: 81, ldh: 520, creatinina: 1.1 }],
    ['2026-08-18', 'Hospital Universitário UFPI', { hemoglobina: 9.4, leucocitos: 3200, plaquetas: 112, linfocitos: 1200, pcr: 20, vhs: 70, ferritina: 1280, albumina: 3.1, globulinas: 4.4, ast: 60, alt: 55, ldh: 340, creatinina: 1.3 }],
    ['2026-09-01', 'Laboratório Lacen/PI', { hemoglobina: 11.0, leucocitos: 4800, plaquetas: 168, linfocitos: 1700, pcr: 6, vhs: 38, ferritina: 640, albumina: 3.6, globulinas: 3.6, ast: 38, alt: 36, ldh: 250, creatinina: 1.2 }],
    ['2026-09-30', 'Laboratório Lacen/PI', { hemoglobina: 12.8, leucocitos: 6100, plaquetas: 230, linfocitos: 2000, pcr: 2.1, vhs: 16, ferritina: 210, albumina: 4.1, globulinas: 3.0, ast: 29, alt: 28, ldh: 205, creatinina: 1.0 }],
    ['2026-10-30', 'Laboratório Lacen/PI', { hemoglobina: 14.0, leucocitos: 6800, plaquetas: 255, linfocitos: 2100, pcr: 1.2, vhs: 9, ferritina: 120, albumina: 4.4, globulinas: 2.8, ast: 26, alt: 25, ldh: 190, creatinina: 0.95 }],
  ];
  ill.forEach(([d, lab, v]) => addPanel(p, d, lab, Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x * (1 + gauss(p._r) * 0.015)])),
    d <= '2026-08-10' ? 'Pancitopenia com hiperferritinemia e hipergamaglobulinemia' : undefined));
  genWearables(p, { rhr: 64, hrv: 50, sleep: 7.0, deep: 1.6, rem: 1.7, spo2: 97.8, steps: 7600, weekend: 0.95 }, (date, _i, r) => {
    let s = 0;
    if (date >= '2026-07-05' && date <= '2026-08-11') s = clamp(diff('2026-07-05', date) / 25, 0, 1);
    else if (date > '2026-08-11') s = clamp(1 - diff('2026-08-11', date) / 56, 0, 1);
    const fever = s > 0.6 && date <= '2026-08-11' && r() < 0.55 ? 8 : 0;
    return { rhr: 16 * s + fever * s, hrv: 1 - 0.42 * s, sleep: -1.6 * s, deep: 1 - 0.4 * s, spo2: -1.8 * s, steps: 1 - 0.7 * s };
  });
  genHeartRate(p);
  genAlerts(p, () => 'Padrão compatível com síndrome febril prolongada (taquicardia de repouso + HRV reduzida + sono fragmentado). Em área endêmica, considerar leishmaniose visceral; correlacionar com hemograma e ferritina.');
  addMed(p, 'Dipirona', '1 g se febre', '2026-07-12', '2026-08-10', 'Febre (sintomático)');
  addMed(p, 'Anfotericina B lipossomal', '3 mg/kg/dia IV', '2026-08-11', '2026-08-17', 'Leishmaniose visceral');
  addEvent(p, '2026-07-05', 'sintoma', 'Início de febre diária', 'Febre vespertina, sudorese noturna e astenia. Relógio mostra taquicardia de repouso e queda de HRV desde esta data.', 'wearable');
  addEvent(p, '2026-07-12', 'consulta', 'UPA — suspeita de dengue', 'NS1 negativo. Tratamento sintomático; sem melhora.', 'pronto atendimento');
  addEvent(p, '2026-07-28', 'exame', 'Hemograma: pancitopenia', 'Hb 9,1; leucócitos 2.100; plaquetas 88 mil. Encaminhado à infectologia.', 'laboratório');
  addEvent(p, '2026-08-04', 'exame_imagem', 'Ultrassom de abdome', 'Esplenomegalia (baço 18 cm) e hepatomegalia leve.', 'imagem');
  addEvent(p, '2026-08-10', 'diagnostico', 'Leishmaniose visceral confirmada', 'Teste rápido rK39 positivo e amastigotas no aspirado de medula óssea.', 'infectologia');
  addEvent(p, '2026-08-11', 'internacao', 'Internação e início de anfotericina B lipossomal', '3 mg/kg/dia por 7 dias com monitorização de função renal.', 'hospital');
  addEvent(p, '2026-08-19', 'internacao', 'Alta hospitalar', 'Afebril há 6 dias; creatinina 1,3 (monitorar).', 'hospital');
  addEvent(p, '2026-09-30', 'consulta', 'Retorno ambulatorial', 'Hemograma quase normalizado; baço em regressão.', 'infectologia');
  addEvent(p, '2026-10-30', 'consulta', 'Cura clínica inicial', 'Seguimento programado aos 6 e 12 meses para detectar recidiva.', 'infectologia');
  return p;
}

// =====================================================================
// 4) RAFAEL MENDES — H1N1
// =====================================================================
function rafael() {
  const p = makePatient({
    id: 'usr-rafael-2026', name: 'Rafael Mendes', email: 'rafael.mendes@example.com', age: 35,
    biologicalSex: 'Masculino', birthDate: '1991-05-17', city: 'Curitiba, PR', heightCm: 180, weightKg: 77.5,
    bloodType: 'AB+', scenario: 'h1n1', chronicConditions: ['Influenza A (H1N1)pdm09 — em recuperação'],
  }, 404);
  const base = (v) => ({
    glicose: noise(p, 86, 0.04), hemoglobina: 15.1, leucocitos: noise(p, 6900, 0.08), plaquetas: noise(p, 262, 0.07),
    linfocitos: noise(p, 2000, 0.1), pcr: 1.0, vhs: 8, ferritina: 150, ldh: 192, ck: 120, ast: 26, alt: 24, ...v,
  });
  ['2024-09-17', '2025-09-16'].forEach((d) => addPanel(p, d, 'Hermes Pardini', base({})));
  const ill = [
    ['2026-10-24', 'Hospital Marcelino Champagnat', { glicose: 118, leucocitos: 3300, plaquetas: 168, linfocitos: 780, pcr: 42, vhs: 34, ferritina: 310, ldh: 330, ck: 410, ast: 52, alt: 41 }],
    ['2026-10-27', 'Hospital Marcelino Champagnat', { glicose: 104, leucocitos: 3900, plaquetas: 181, linfocitos: 950, pcr: 64, vhs: 45, ferritina: 420, ldh: 368, ck: 520, ast: 61, alt: 48 }],
    ['2026-11-03', 'Hermes Pardini', { glicose: 92, leucocitos: 6100, plaquetas: 250, linfocitos: 1700, pcr: 11, vhs: 18, ferritina: 260, ldh: 230, ck: 190, ast: 34, alt: 32 }],
    ['2026-11-11', 'Hermes Pardini', { glicose: 88, leucocitos: 6900, plaquetas: 262, linfocitos: 2000, pcr: 2.2, vhs: 8, ferritina: 150, ldh: 192, ck: 120, ast: 26, alt: 24 }],
  ];
  ill.forEach(([d, lab, v]) => addPanel(p, d, lab, { hemoglobina: 15.1, ...v }, d <= '2026-10-27' ? 'Quadro viral agudo: leucopenia/linfopenia e elevação de PCR, LDH e CK' : undefined));
  genWearables(p, { rhr: 56, hrv: 64, sleep: 7.4, deep: 1.8, rem: 1.9, spo2: 98.0, steps: 10400, weekend: 1.1 }, (date) => {
    const d = diff('2026-10-21', date);
    let s = 0;
    if (d >= 0 && d <= 1) s = 0.5;
    else if (d >= 2 && d <= 5) s = 1;
    else if (d > 5) s = clamp(1 - (d - 5) / 16, 0, 1);
    return { rhr: 20 * s, hrv: 1 - 0.5 * s, sleep: -1.0 * s, deep: 1 - 0.3 * s, spo2: -3.5 * s, steps: 1 - 0.92 * s };
  });
  genHeartRate(p);
  genAlerts(p, () => 'Taquicardia de repouso, HRV reduzida e queda de SpO2 de início agudo compatíveis com quadro viral/respiratório. Recomenda-se avaliação médica se SpO2 persistir ≤ 94%.');
  addMed(p, 'Paracetamol', '750 mg se febre', '2026-10-21', '2026-10-27', 'Febre e mialgia');
  addMed(p, 'Oseltamivir', '75 mg 12/12h por 5 dias', '2026-10-24', '2026-10-28', 'Influenza A (H1N1)pdm09');
  addEvent(p, '2025-04-15', 'vacina', 'Vacina influenza 2025', 'Dose anual aplicada. Em 2026 ainda não vacinado.', 'carteira');
  addEvent(p, '2026-10-21', 'sintoma', 'Início súbito de febre e mialgia', 'Febre 39,2 °C, tosse seca, cefaleia e mialgia intensa. Colega de trabalho com síndrome gripal.', 'autorrelato');
  addEvent(p, '2026-10-24', 'diagnostico', 'Influenza A (H1N1)pdm09 confirmada', 'RT-PCR de swab nasofaríngeo positivo. Iniciado oseltamivir.', 'pronto atendimento');
  addEvent(p, '2026-10-26', 'sintoma', 'Queda de saturação', 'SpO2 domiciliar 93%; relógio confirma queda. Orientado retorno se piora.', 'wearable');
  addEvent(p, '2026-10-27', 'exame_imagem', 'Raio-X de tórax', 'Infiltrado intersticial discreto bibasal, sem consolidação. Mantido tratamento ambulatorial.', 'imagem');
  addEvent(p, '2026-11-03', 'consulta', 'Retorno — melhora clínica', 'Afebril há 5 dias; leucócitos normalizando.', 'consulta');
  addEvent(p, '2026-11-11', 'consulta', 'Alta médica', 'Exames normalizados. Retorno gradual aos treinos após 7 dias. Recomendada vacinação anual.', 'consulta');
  return p;
}

// ---------- montagem ----------
const patients = [marcos(), camila(), antonio(), rafael()];
for (const p of patients) {
  p.profile.activeMedications = p.medications.filter((m) => !m.endDate).map((m) => `${m.name} ${m.dose}`);
  delete p._r;
  p.exams.sort((a, b) => a.date.localeCompare(b.date));
  p.events.sort((a, b) => a.date.localeCompare(b.date));
  writeFileSync(join(DATA, `${p.profile.id}.json`), JSON.stringify(p, null, 2));
}
const biomarkerDefs = Object.entries(DEFS).map(([id, d]) => ({ id, canonicalName: d[0], category: d[1], unit: d[2], refMin: d[3], refMax: d[4], description: d[5] }));
writeFileSync(join(DATA, 'biomarker_definitions.json'), JSON.stringify(biomarkerDefs, null, 2));

// ---------- seed.sql ----------
const q = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) return v.length ? `ARRAY[${v.map(q).join(',')}]::text[]` : `'{}'::text[]`;
  return `'${String(v).replace(/'/g, "''")}'`;
};
function insert(table, cols, rows, conflict) {
  let out = '';
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((r) => `(${r.map(q).join(',')})`).join(',\n');
    out += `insert into ${table} (${cols.join(',')}) values\n${chunk}\non conflict ${conflict} do nothing;\n\n`;
  }
  return out;
}
let sql = '-- Gerado por synthetic/generate.mjs — não editar manualmente.\nbegin;\n\n';
sql += insert('rivio_biomarker_definitions', ['id', 'canonical_name', 'category', 'unit', 'ref_min', 'ref_max', 'description'],
  biomarkerDefs.map((b) => [b.id, b.canonicalName, b.category, b.unit, b.refMin, b.refMax, b.description]), '(id)');
sql += insert('rivio_patients', ['id', 'name', 'email', 'age', 'biological_sex', 'birth_date', 'city', 'height_cm', 'weight_kg', 'blood_type', 'scenario', 'chronic_conditions', 'active_medications'],
  patients.map(({ profile: x }) => [x.id, x.name, x.email, x.age, x.biologicalSex, x.birthDate, x.city, x.heightCm, x.weightKg, x.bloodType, x.scenario, x.chronicConditions, x.activeMedications]), '(id)');
for (const p of patients) {
  const id = p.profile.id;
  sql += insert('rivio_documents', ['id', 'patient_id', 'name', 'uri', 'size', 'mime_type', 'uploaded_at', 'extracted_count', 'status'],
    p.documents.map((d) => [d.id, id, d.name, d.uri, d.size, d.mimeType, d.uploadedAt, d.extractedCount, d.status]), '(id)');
  sql += insert('rivio_exams', ['id', 'patient_id', 'date', 'lab_name', 'biomarker_id', 'canonical_name', 'value', 'unit', 'ref_min', 'ref_max', 'status', 'notes', 'document_id'],
    p.exams.map((e) => [e.id, id, e.date, e.labName, e.biomarkerId, e.canonicalName, e.value, e.unit, e.refMin, e.refMax, e.status, e.notes ?? null, e.documentId ?? null]), '(id)');
  sql += insert('rivio_wearable_daily', ['patient_id', 'date', 'resting_hr', 'max_hr', 'min_hr', 'hrv', 'sleep_hours', 'deep_sleep_hours', 'rem_sleep_hours', 'spo2', 'steps'],
    p.wearables.map((w) => [id, w.date, w.restingHeartRate, w.maxHeartRate, w.minHeartRate, w.hrv, w.sleepHours, w.deepSleepHours, w.remSleepHours, w.spo2, w.steps]), '(patient_id,date)');
  sql += insert('rivio_heart_rate_samples', ['patient_id', 'ts', 'bpm'], p.heartRateSamples.map((h) => [id, h.ts, h.bpm]), '(patient_id,ts)');
  sql += insert('rivio_alerts', ['id', 'patient_id', 'ts', 'title', 'description', 'severity', 'metric_type', 'value_detected', 'baseline_value', 'clinical_context', 'resolved'],
    p.alerts.map((a) => [a.id, id, a.timestamp, a.title, a.description, a.severity, a.metricType, a.valueDetected, a.baselineValue, a.clinicalContext, a.resolved]), '(id)');
  sql += insert('rivio_medications', ['id', 'patient_id', 'name', 'dose', 'start_date', 'end_date', 'indication'],
    p.medications.map((m) => [m.id, id, m.name, m.dose, m.startDate, m.endDate, m.indication]), '(id)');
  sql += insert('rivio_clinical_events', ['id', 'patient_id', 'date', 'type', 'title', 'description', 'source'],
    p.events.map((e) => [e.id, id, e.date, e.type, e.title, e.description, e.source]), '(id)');
}
sql += 'commit;\n';
writeFileSync(join(SQLDIR, 'seed.sql'), sql);

for (const p of patients) {
  console.log(`${p.profile.name.padEnd(22)} exames=${p.exams.length} docs=${p.documents.length} wearables=${p.wearables.length} fc_horaria=${p.heartRateSamples.length} alertas=${p.alerts.length} meds=${p.medications.length} eventos=${p.events.length}`);
}


