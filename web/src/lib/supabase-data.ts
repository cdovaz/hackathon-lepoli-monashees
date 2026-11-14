import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  DoctorApi,
  PatientContext,
  PatientQuery,
  RequestOptions,
  Timed,
} from "./api/doctor-api";
import type {
  Evidence,
  EvidenceRef,
  Schemas,
  Snapshot,
} from "./api/types";
import { ApiError } from "./api/errors";
import { parseResponse } from "./api/validate";
import { demoDoctor } from "./demo/fixture";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ngxqzfvfehendlsyxhmq.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_1eJrO6cIAVQGayQaCkYevg_bH2ozoLJ";

export const supabaseServer: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false },
});

export interface SupabasePatientRow {
  id: string;
  name: string;
  age: number;
  biological_sex?: string;
  city?: string;
  scenario?: string;
  chronic_conditions?: string[];
  active_medications?: string[];
}

export interface SupabaseExamRow {
  id: string;
  patient_id: string;
  date: string;
  lab_name?: string;
  biomarker_id: string;
  canonical_name?: string;
  value: number;
  unit?: string;
  ref_min?: number | null;
  ref_max?: number | null;
  status: "normal" | "attention" | "critical";
  notes?: string | null;
  document_id?: string | null;
  created_at?: string;
}

export interface SupabaseWearableRow {
  date: string;
  resting_heart_rate?: number | null;
  hrv?: number | null;
  has_anomaly?: boolean;
  anomaly_description?: string | null;
}

export interface SupabaseAlertRow {
  id: string;
  ts?: string;
  title?: string;
  message?: string;
  description?: string;
  context?: string;
  severity?: string;
  metric_type?: string;
  resolved?: boolean;
}

export interface SupabaseMedicationRow {
  id: string;
  name: string;
  dose?: string;
  start_date?: string | null;
  end_date?: string | null;
  indication?: string | null;
}

export interface SupabaseClinicalEventRow {
  id: string;
  date: string;
  title: string;
  event_type?: string;
  description?: string;
}

export interface SupabaseDocumentRow {
  id: string;
  name?: string;
  title?: string;
  source_id?: string;
  occurred_on?: string;
  created_at?: string;
}

function mapBiologicalSex(sex?: string | null): "Masculino" | "Feminino" | "Não informado" {
  if (!sex) return "Não informado";
  const s = sex.toLowerCase();
  if (s.startsWith("m")) return "Masculino";
  if (s.startsWith("f")) return "Feminino";
  return "Não informado";
}

const ref = (e: { id: string; version: string }): EvidenceRef => ({
  id: e.id,
  version: e.version,
});

const section = <T>(items: T[]) => ({
  state: items.length ? ("available" as const) : ("empty" as const),
  items,
  reasonCode: null,
});

type BriefingItem = Snapshot["briefing"]["items"][number];
type ClinicalContextItem = Snapshot["clinicalContext"]["items"][number];
type WearableMetricSeries = Snapshot["wearables"]["items"][number];
type Alert = Snapshot["alerts"]["items"][number];

/**
 * Utilitário server-safe de paginação com .range() em blocos de 1000 registros
 */
async function fetchPagedRows<T>(
  queryFactory: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const results: T[] = [];

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await queryFactory(from, to);
    if (error) {
      console.warn("[supabase-data] Erro em paginação:", error);
      break;
    }
    if (!data || data.length === 0) break;
    results.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return results;
}

// ============================================================================
// CONSULTAS TABELARES SUPABASE (rivio_*)
// ============================================================================

export async function getSupabasePatients(): Promise<SupabasePatientRow[]> {
  const { data, error } = await supabaseServer
    .from("rivio_patients")
    .select("*")
    .order("name", { ascending: true });
  if (error) {
    console.warn("[supabase-data] getSupabasePatients erro:", error.message);
    return [];
  }
  return (data || []) as SupabasePatientRow[];
}

export async function getSupabasePatient(id: string): Promise<SupabasePatientRow | null> {
  const { data, error } = await supabaseServer
    .from("rivio_patients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    console.warn("[supabase-data] getSupabasePatient erro para ID:", id, error?.message);
    return null;
  }
  return data as SupabasePatientRow;
}

export async function getSupabaseExams(patientId: string): Promise<SupabaseExamRow[]> {
  return fetchPagedRows<SupabaseExamRow>((from, to) =>
    supabaseServer
      .from("rivio_exams")
      .select("*")
      .eq("patient_id", patientId)
      .order("date", { ascending: false })
      .range(from, to)
  );
}

export async function getSupabaseBiomarkers() {
  const { data, error } = await supabaseServer
    .from("rivio_biomarker_definitions")
    .select("*")
    .order("canonical_name", { ascending: true });
  if (error) return [];
  return data || [];
}

export async function getSupabaseWearables(patientId: string, days = 365): Promise<SupabaseWearableRow[]> {
  let query = supabaseServer
    .from("rivio_wearable_daily")
    .select("*")
    .eq("patient_id", patientId)
    .order("date", { ascending: true });

  if (days > 0) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    query = query.gte("date", since.toISOString().slice(0, 10));
  }

  return fetchPagedRows<SupabaseWearableRow>((from, to) => query.range(from, to));
}

export async function getSupabaseAlerts(patientId: string): Promise<SupabaseAlertRow[]> {
  const { data, error } = await supabaseServer
    .from("rivio_alerts")
    .select("*")
    .eq("patient_id", patientId)
    .order("ts", { ascending: false });
  if (error) return [];
  return (data || []) as SupabaseAlertRow[];
}

export async function getSupabaseMedications(patientId: string): Promise<SupabaseMedicationRow[]> {
  const { data, error } = await supabaseServer
    .from("rivio_medications")
    .select("*")
    .eq("patient_id", patientId)
    .order("start_date", { ascending: false });
  if (error) return [];
  return (data || []) as SupabaseMedicationRow[];
}

export async function getSupabaseClinicalEvents(patientId: string): Promise<SupabaseClinicalEventRow[]> {
  const { data, error } = await supabaseServer
    .from("rivio_clinical_events")
    .select("*")
    .eq("patient_id", patientId)
    .order("date", { ascending: false });
  if (error) return [];
  return (data || []) as SupabaseClinicalEventRow[];
}

export async function getSupabaseDocuments(patientId: string): Promise<SupabaseDocumentRow[]> {
  const { data, error } = await supabaseServer
    .from("rivio_documents")
    .select("*")
    .eq("patient_id", patientId)
    .order("uploaded_at", { ascending: false });
  if (error) return [];
  return (data || []) as SupabaseDocumentRow[];
}

// ============================================================================
// CONSTRUÇÃO DETERMINÍSTICA DO BRIEFING PRÉ-CONSULTA
// ============================================================================

export function buildDeterministicBriefing(
  patient: SupabasePatientRow,
  medications: SupabaseMedicationRow[],
  exams: SupabaseExamRow[],
  alerts: SupabaseAlertRow[],
  events: SupabaseClinicalEventRow[],
  defaultRef: EvidenceRef
): BriefingItem[] {
  const items: BriefingItem[] = [];

  // 1. Condições crônicas conhecidas
  const chronicList = Array.isArray(patient.chronic_conditions) ? patient.chronic_conditions : [];
  const chronicRefs: EvidenceRef[] = [];
  if (medications.length > 0) {
    chronicRefs.push({ id: `med-${medications[0].id}`, version: "1" });
  } else if (events.length > 0) {
    chronicRefs.push({ id: `evd-evt-${events[0].id}`, version: "1" });
  } else {
    chronicRefs.push(defaultRef);
  }

  items.push({
    id: "briefing-chronic",
    title: "Condições Clínicas de Base",
    text: chronicList.length > 0
      ? `Paciente com diagnóstico documentado de ${chronicList.join(", ")}. Acompanhamento clínico longitudinal.`
      : "Sem registros de patologias crônicas de base cadastradas previamente.",
    basis: "recorded_fact",
    evidenceRefs: chronicRefs,
  });

  // 2. Medicações ativas (end_date is null)
  const activeMeds = medications.filter((m) => !m.end_date);
  if (activeMeds.length > 0) {
    items.push({
      id: "briefing-active-meds",
      title: "Farmacoterapia Ativa em Uso",
      text: `Uso contínuo vigente: ${activeMeds.map((m) => `${m.name} ${m.dose || ""}`.trim()).join(", ")}. Verificar adesão e estabilidade terapêutica.`,
      basis: "recorded_fact",
      evidenceRefs: activeMeds.map((m) => ({ id: `med-${m.id}`, version: "1" })),
    });
  } else {
    items.push({
      id: "briefing-active-meds",
      title: "Farmacoterapia Ativa",
      text: "Nenhuma medicação de uso contínuo vigente no prontuário atual.",
      basis: "recorded_fact",
      evidenceRefs: [defaultRef],
    });
  }

  // 3. Exames mais recentes fora da faixa de referência (atenção ou crítico)
  const outOfRange = exams.filter((e) => e.status === "attention" || e.status === "critical");
  if (outOfRange.length > 0) {
    const seen = new Set<string>();
    const latestAltered = outOfRange.filter((e) => {
      if (seen.has(e.biomarker_id)) return false;
      seen.add(e.biomarker_id);
      return true;
    }).slice(0, 4);

    const desc = latestAltered
      .map(
        (e) =>
          `${e.canonical_name || e.biomarker_id}: ${e.value} ${e.unit || ""} (Ref: ${e.ref_min ?? "?"}-${e.ref_max ?? "?"}, em ${e.date})`
      )
      .join("; ");

    items.push({
      id: "briefing-altered-exams",
      title: "Biomarcadores Fora da Faixa de Referência",
      text: `Aferições recentes com desvio: ${desc}.`,
      basis: "recorded_fact",
      evidenceRefs: latestAltered.map((e) => ({ id: e.id, version: "1" })),
    });
  } else {
    items.push({
      id: "briefing-altered-exams",
      title: "Evolução Laboratorial",
      text: "Todos os biomarcadores analisados no histórico recente encontram-se dentro da faixa de referência preconizada.",
      basis: "recorded_fact",
      evidenceRefs: [defaultRef],
    });
  }

  // 4. Alertas clínicos não resolvidos
  const unresolvedAlerts = alerts.filter((a) => !a.resolved);
  if (unresolvedAlerts.length > 0) {
    items.push({
      id: "briefing-unresolved-alerts",
      title: "Alertas Fisiológicos Pendentes de Avaliação",
      text: `${unresolvedAlerts.length} alerta(s) aberto(s): ${unresolvedAlerts.map((a) => a.title || a.message || a.description).join(" | ")}. Sinais contínuos requerem correlação clínica.`,
      basis: "suggested_hypothesis",
      evidenceRefs: [defaultRef],
    });
  } else {
    items.push({
      id: "briefing-unresolved-alerts",
      title: "Alertas Clínicos",
      text: "Nenhum alerta de desvio fisiológico agudo pendente de resolução médica.",
      basis: "recorded_fact",
      evidenceRefs: [defaultRef],
    });
  }

  // 5. Eventos clínicos recentes (últimos 90 dias ou mais recentes)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const iso90 = ninetyDaysAgo.toISOString().slice(0, 10);
  const recentEvents = events.filter((e) => e.date >= iso90);
  const targetEvents = recentEvents.length > 0 ? recentEvents : events.slice(0, 3);

  if (targetEvents.length > 0) {
    items.push({
      id: "briefing-recent-events",
      title: "Eventos Clínicos Recentes Documentados",
      text: targetEvents
        .map((e) => `${e.date}: [${e.event_type || "Evento"}] ${e.title} — ${e.description || ""}`.trim())
        .join(" • "),
      basis: "recorded_fact",
      evidenceRefs: targetEvents.map((e) => ({ id: `evd-evt-${e.id}`, version: "1" })),
    });
  }

  return items;
}

// ============================================================================
// CONSTRUÇÃO COMPLETA DO SNAPSHOT A PARTIR DO SUPABASE
// ============================================================================

export async function buildPatientSnapshotFromSupabase(
  patientId: string,
  requestedScopes?: Schemas["Scope"][]
): Promise<Snapshot> {
  const [patient, exams, _biomarkers, wearables, alerts, medications, events, dbDocuments] =
    await Promise.all([
      getSupabasePatient(patientId),
      getSupabaseExams(patientId),
      getSupabaseBiomarkers(),
      getSupabaseWearables(patientId, 365),
      getSupabaseAlerts(patientId),
      getSupabaseMedications(patientId),
      getSupabaseClinicalEvents(patientId),
      getSupabaseDocuments(patientId),
    ]);

  if (!patient) {
    throw new ApiError(404, "NOT_FOUND");
  }

  const now = new Date().toISOString();

  // Todos os escopos necessários para visualização médica completa
  const activeScopes: Schemas["Scope"][] = requestedScopes || [
    "read_exams",
    "read_wearables",
    "read_clinical_context",
    "read_alerts",
    "read_graphrag_briefing",
  ];

  // Mapeamento de fontes (Laboratórios)
  const labNames = [...new Set(exams.map((e) => e.lab_name || "Laboratório Unificado"))];
  const sources: Schemas["Source"][] = labNames.map((lab, idx) => ({
    id: `src-lab-${idx + 1}`,
    label: lab,
    kind: "laboratory",
    state: "current",
    lastSyncedAt: now,
    lastEventDate: exams.find((e) => (e.lab_name || "Laboratório Unificado") === lab)?.date || null,
    coverage: { from: "2022-01-01", to: "2026-11-12", truncated: false },
  }));

  sources.push({
    id: "src-prontuario",
    label: "Prontuário e Histórico Clínico",
    kind: "clinical_record",
    state: "current",
    lastSyncedAt: now,
    lastEventDate: "2026-11-12",
    coverage: { from: "2022-01-01", to: "2026-11-12", truncated: false },
  });

  sources.push({
    id: "src-wearable",
    label: "Apple Watch • Telemetria Contínua",
    kind: "wearable",
    state: "current",
    lastSyncedAt: now,
    lastEventDate: wearables[wearables.length - 1]?.date || null,
    coverage: {
      from: wearables[0]?.date || null,
      to: wearables[wearables.length - 1]?.date || null,
      truncated: false,
    },
  });

  // Mapeamento rigoroso de Documentos:
  // Garante que TODOS os document_id que aparecem em exames estejam no mapa de documentos
  const documentMap = new Map<string, Snapshot["documents"]["items"][number]>();

  for (const doc of dbDocuments) {
    const src = sources.find((s) => s.kind === "laboratory") || sources[0];
    documentMap.set(doc.id, {
      id: doc.id,
      title: doc.name || doc.title || `Laudo ${doc.occurred_on || ""}`,
      sourceId: src.id,
      occurredOn: doc.occurred_on || "2026-01-01",
      receivedAt: doc.created_at || now,
      mimeType: "application/pdf" as const,
      originalAvailable: false,
      evidenceRefs: [],
    });
  }

  for (const ex of exams) {
    const docId = ex.document_id || `doc-${ex.date}`;
    if (!documentMap.has(docId)) {
      const src = sources.find((s) => s.label === (ex.lab_name || "Laboratório Unificado")) || sources[0];
      documentMap.set(docId, {
        id: docId,
        title: `Laudo Laboratorial — ${ex.lab_name || "Laboratório"} (${ex.date})`,
        sourceId: src.id,
        occurredOn: ex.date,
        receivedAt: now,
        mimeType: "application/pdf" as const,
        originalAvailable: false,
        evidenceRefs: [],
      });
    }
  }

  // Mapeamento de Evidence
  const evidence: Evidence[] = [];

  // Exames -> Evidence (kind: lab_result)
  for (const ex of exams) {
    const src = sources.find((s) => s.label === (ex.lab_name || "Laboratório Unificado")) || sources[0];
    const docId = ex.document_id || `doc-${ex.date}`;
    const evRef = { id: ex.id, version: "1" };

    evidence.push({
      id: ex.id,
      version: "1",
      kind: "lab_result",
      label: ex.canonical_name || ex.biomarker_id,
      occurredOn: ex.date,
      occurredAt: null,
      ingestedAt: ex.created_at || now,
      sourceId: src.id,
      documentId: docId,
      provenance: "extracted",
      value: Number(ex.value),
      unit: ex.unit || "",
      referenceRange: {
        min: ex.ref_min !== null && ex.ref_min !== undefined ? Number(ex.ref_min) : null,
        max: ex.ref_max !== null && ex.ref_max !== undefined ? Number(ex.ref_max) : null,
        text: null,
      },
      text: ex.notes || null,
      status: ex.status,
      supersedes: null,
    });

    const targetDoc = documentMap.get(docId);
    if (targetDoc) {
      targetDoc.evidenceRefs.push(evRef);
    }
  }

  // Medicações -> Evidence (kind: medication)
  for (const med of medications) {
    evidence.push({
      id: `med-${med.id}`,
      version: "1",
      kind: "medication",
      label: `${med.name} ${med.dose || ""}`.trim(),
      occurredOn: med.start_date || null,
      occurredAt: null,
      ingestedAt: now,
      sourceId: "src-prontuario",
      documentId: null,
      provenance: "patient_reported",
      value: null,
      unit: null,
      referenceRange: null,
      text: med.indication || `Início em: ${med.start_date || "não informada"}`,
      status: "unknown",
      supersedes: null,
    });
  }

  // Eventos clínicos -> Evidence (kind: condition)
  for (const evt of events) {
    evidence.push({
      id: `evd-evt-${evt.id}`,
      version: "1",
      kind: "condition",
      label: evt.title,
      occurredOn: evt.date,
      occurredAt: null,
      ingestedAt: now,
      sourceId: "src-prontuario",
      documentId: null,
      provenance: "extracted",
      value: null,
      unit: null,
      referenceRange: null,
      text: evt.description || null,
      status: "unknown",
      supersedes: null,
    });
  }

  // Wearables -> Evidence diárias
  for (const w of wearables) {
    if (w.resting_heart_rate !== null && w.resting_heart_rate !== undefined) {
      evidence.push({
        id: `rhr-${w.date}`,
        version: "1",
        kind: "wearable_reading",
        label: "Frequência cardíaca em repouso",
        occurredOn: w.date,
        occurredAt: null,
        ingestedAt: now,
        sourceId: "src-wearable",
        documentId: null,
        provenance: "extracted",
        value: Number(w.resting_heart_rate),
        unit: "bpm",
        referenceRange: { min: 50, max: 95, text: "50 a 95 bpm" },
        text: w.has_anomaly ? w.anomaly_description || "Sinal de taquicardia/estresse" : null,
        status: w.has_anomaly || Number(w.resting_heart_rate) > 100 ? "attention" : "normal",
        supersedes: null,
      });
    }

    if (w.hrv !== null && w.hrv !== undefined) {
      evidence.push({
        id: `hrv-${w.date}`,
        version: "1",
        kind: "wearable_reading",
        label: "Variabilidade da FC (HRV)",
        occurredOn: w.date,
        occurredAt: null,
        ingestedAt: now,
        sourceId: "src-wearable",
        documentId: null,
        provenance: "extracted",
        value: Number(w.hrv),
        unit: "ms",
        referenceRange: { min: 30, max: 90, text: "30 a 90 ms" },
        text: null,
        status: Number(w.hrv) < 25 ? "attention" : "normal",
        supersedes: null,
      });
    }
  }

  // Fallback se não houver exames para ter pelo menos 1 evidência de base
  if (evidence.length === 0) {
    evidence.push({
      id: "evd-base-profile",
      version: "1",
      kind: "condition",
      label: "Perfil do Paciente",
      occurredOn: "2026-01-01",
      occurredAt: null,
      ingestedAt: now,
      sourceId: "src-prontuario",
      documentId: null,
      provenance: "patient_reported",
      value: null,
      unit: null,
      referenceRange: null,
      text: "Cadastro clínico inicial",
      status: "normal",
      supersedes: null,
    });
  }

  const defaultRef: EvidenceRef = { id: evidence[0].id, version: "1" };

  // Agrupamento de Exames (Section<ExamSeries>)
  const uniqueBiomarkers = [...new Set(exams.map((e) => e.biomarker_id))];
  const examSeriesItems = uniqueBiomarkers.map((bmId) => {
    const matching = exams.filter((e) => e.biomarker_id === bmId);
    const first = matching[0];
    return {
      id: bmId,
      label: first.canonical_name || bmId,
      canonicalUnit: first.unit || "",
      measurementRefs: matching.map((e) => ({ id: e.id, version: "1" })),
    };
  });

  // Garante que cada documento em documentItems tenha pelo menos 1 evidenceRef válido
  const documentItems = [...documentMap.values()].map((d) => ({
    ...d,
    evidenceRefs: d.evidenceRefs.length > 0 ? d.evidenceRefs : [defaultRef],
  }));

  // Linha do tempo
  const timelineItems: Schemas["TimelineEvent"][] = documentItems.map((doc) => ({
    id: `event-${doc.id}`,
    groupId: doc.id,
    kind: "document",
    label: doc.title,
    occurredOn: doc.occurredOn,
    occurredAt: null,
    receivedAt: doc.receivedAt,
    evidenceRefs: doc.evidenceRefs.slice(0, 5),
    documentId: doc.id,
  }));

  for (const evt of events) {
    timelineItems.push({
      id: `evt-${evt.id}`,
      groupId: `grp-${evt.id}`,
      kind: "document",
      label: `[${evt.event_type || "Clínico"}] ${evt.title}`,
      occurredOn: evt.date,
      occurredAt: null,
      receivedAt: now,
      evidenceRefs: [{ id: `evd-evt-${evt.id}`, version: "1" }],
      documentId: null,
    });
  }
  timelineItems.sort((a, b) => (b.occurredOn || "").localeCompare(a.occurredOn || ""));

  // Contexto Clínico (Medicações)
  const clinicalContextItems: ClinicalContextItem[] = medications.map((med) => ({
    id: `med-${med.id}`,
    kind: "medication",
    label: `${med.name} ${med.dose || ""}`.trim(),
    startDate: med.start_date || null,
    endDate: med.end_date || null,
    evidenceRefs: [{ id: `med-${med.id}`, version: "1" }],
  }));

  // Wearables section
  const wearableSectionItems: WearableMetricSeries[] = [];
  if (wearables.length > 0) {
    const rhrEvidences = evidence.filter((e) => e.id.startsWith("rhr-"));
    const hrvEvidences = evidence.filter((e) => e.id.startsWith("hrv-"));

    if (rhrEvidences.length > 0) {
      wearableSectionItems.push({
        id: "resting-heart-rate",
        metric: "resting_heart_rate",
        unit: "bpm",
        aggregation: "daily_summary",
        coverage: {
          from: wearables[0].date,
          to: wearables[wearables.length - 1].date,
          truncated: false,
        },
        pointRefs: rhrEvidences.map(ref),
      });
    }

    if (hrvEvidences.length > 0) {
      wearableSectionItems.push({
        id: "hrv",
        metric: "hrv",
        unit: "ms",
        aggregation: "daily_summary",
        coverage: {
          from: wearables[0].date,
          to: wearables[wearables.length - 1].date,
          truncated: false,
        },
        pointRefs: hrvEvidences.map(ref),
      });
    }
  }

  // Alertas: no schema OpenAPI, cada item de Alert DEVE ter minItems: 1 em evidenceRefs
  const alertItems: Alert[] = alerts.map((a) => {
    let severity: "attention" | "unknown" | "info" | "high" = "attention";
    if (a.severity === "critical" || a.severity === "high") severity = "high";
    else if (a.severity === "warn" || a.severity === "medium") severity = "attention";
    else if (a.severity === "low") severity = "info";

    const alertDate = (a.ts || now).slice(0, 10);
    const relatedEvidence =
      evidence.find((e) => e.occurredOn === alertDate) ||
      evidence.find((e) => e.kind === "wearable_reading") ||
      defaultRef;

    const alertRefs: EvidenceRef[] = [{ id: relatedEvidence.id, version: "1" }];

    return {
      id: a.id,
      label: a.title || a.message || "Alerta Clínico",
      description: a.description || a.context || a.title || "Alerta Fisiológico",
      severity,
      evidenceRefs: alertRefs,
    };
  });

  // Briefing determinístico: cada item recebe defaultRef para garantir minItems: 1
  const briefingItems = buildDeterministicBriefing(
    patient,
    medications,
    exams,
    alerts,
    events,
    defaultRef
  );

  // Grafo Clínico (@xyflow/react):
  // Cada nó diferente de "patient" DEVE ter pelo menos 1 evidenceRef válido
  const graphNodes: Schemas["GraphNode"][] = [
    {
      id: `node-patient-${patient.id}`,
      kind: "patient",
      label: patient.name,
      evidenceRefs: [],
    },
  ];

  const graphEdges: Schemas["GraphEdge"][] = [];

  // Nós dos biomarcadores mais representativos
  for (const ex of examSeriesItems.slice(0, 8)) {
    const nodeId = `node-bm-${ex.id}`;
    const validRefs = ex.measurementRefs.slice(0, 2);
    graphNodes.push({
      id: nodeId,
      kind: "biomarker",
      label: ex.label,
      evidenceRefs: validRefs,
    });

    graphEdges.push({
      id: `edge-patient-${ex.id}`,
      source: `node-patient-${patient.id}`,
      target: nodeId,
      label: "Medição laboratorial documentada",
      basis: "recorded_fact",
      evidenceRefs: validRefs,
    });
  }

  // Nós de medicações ativas
  for (const med of medications) {
    const medNodeId = `node-med-${med.id}`;
    const medRefs = [{ id: `med-${med.id}`, version: "1" }];
    graphNodes.push({
      id: medNodeId,
      kind: "medication",
      label: `${med.name} ${med.dose || ""}`.trim(),
      evidenceRefs: medRefs,
    });

    graphEdges.push({
      id: `edge-patient-${med.id}`,
      source: `node-patient-${patient.id}`,
      target: medNodeId,
      label: med.end_date ? "Tratamento anterior concluído" : "Prescrição clínica ativa",
      basis: "recorded_fact",
      evidenceRefs: medRefs,
    });

    const lowerName = med.name.toLowerCase();
    if (lowerName.includes("metformina") || lowerName.includes("dapagliflozina")) {
      const gNode = graphNodes.find((n) => n.id === "node-bm-hba1c" || n.id === "node-bm-glicose");
      if (gNode) {
        graphEdges.push({
          id: `edge-med-bm-${med.id}`,
          source: medNodeId,
          target: gNode.id,
          label: "Controle glicêmico alvo",
          basis: "suggested_hypothesis",
          evidenceRefs: medRefs,
        });
      }
    }
  }

  // Nós de eventos de internação/diagnóstico (com evidenceRef da condição correspondente)
  for (const evt of events) {
    const evtNodeId = `node-evt-${evt.id}`;
    const evtRefs = [{ id: `evd-evt-${evt.id}`, version: "1" }];
    graphNodes.push({
      id: evtNodeId,
      kind: "condition",
      label: evt.title,
      evidenceRefs: evtRefs,
    });

    graphEdges.push({
      id: `edge-patient-${evt.id}`,
      source: `node-patient-${patient.id}`,
      target: evtNodeId,
      label: evt.event_type || "Ocorrência clínica",
      basis: "recorded_fact",
      evidenceRefs: evtRefs,
    });
  }

  const allDates = exams.map((e) => e.date).filter(Boolean);
  const minDate = allDates.length > 0 ? allDates.sort()[0] : "2022-01-01";
  const maxDate = allDates.length > 0 ? allDates.sort().reverse()[0] : "2026-11-12";

  return {
    id: `snap-supabase-${patient.id}-${exams.length}`,
    patientId: patient.id,
    createdAt: now,
    updateHighWatermark: `cursor-${patient.id}-${exams.length}`,
    patient: {
      id: patient.id,
      displayName: patient.name,
      age: Number(patient.age),
      biologicalSex: mapBiologicalSex(patient.biological_sex),
      disambiguationLabel: patient.city ? `${patient.city} • Prontuário Supabase` : "Prontuário Unificado Rivio",
    },
    coverage: {
      from: minDate,
      to: maxDate,
      truncated: false,
    },
    access: {
      kind: "continuous",
      contextId: `grant-${patient.id}`,
      patientId: patient.id,
      grantId: `grant-${patient.id}`,
      scopes: activeScopes,
      scopeVersion: "scope-v1",
      expiresAt: "2026-12-31T23:59:59Z",
      readOnly: true,
    },
    dataRevision: `rev-${patient.id}-${exams.length}-${Date.now().toString(36)}`,
    accessRevision: `access-${patient.id}-v1`,
    sources,
    evidence,
    exams: section(examSeriesItems),
    documents: section(documentItems),
    timeline: timelineItems,
    clinicalContext: section(clinicalContextItems),
    wearables: section(wearableSectionItems),
    alerts: section(alertItems),
    briefing: section(briefingItems),
    graph: {
      state: "available",
      nodes: graphNodes,
      edges: graphEdges,
      reasonCode: null,
    },
    review: {
      lastReviewedCursor: `cursor-${patient.id}`,
      lastReviewedAt: "2026-11-10T12:00:00Z",
      mode: "changes",
      unreadGroupCount: 0,
    },
  };
}

// ============================================================================
// ADAPTADOR DOCTOR API PARA SUPABASE
// ============================================================================

export function createSupabaseDoctorApi(): DoctorApi {
  let sessionState: Schemas["Session"] = {
    state: "authenticated",
    doctor: demoDoctor,
    expiresAt: "2026-12-31T23:59:59Z",
    csrfToken: "supabase-csrf-valid",
    pendingInvitation: null,
  };

  const output = <K extends Parameters<typeof parseResponse>[0]>(
    name: K,
    data: unknown
  ) =>
    parseResponse(name, {
      meta: {
        requestId: `req-${Date.now()}`,
        serverTime: new Date().toISOString(),
        contractVersion: "0.1-draft",
      },
      data,
    });

  return {
    async session(_o?: RequestOptions): Promise<Timed<Schemas["Session"]>> {
      return output("Session", structuredClone(sessionState));
    },

    async logout(_o?: RequestOptions): Promise<void> {
      sessionState = {
        state: "anonymous",
        doctor: null,
        expiresAt: null,
        csrfToken: "logged-out",
        pendingInvitation: null,
      };
    },

    /**
     * Carteira de pacientes do médico:
     * Só exibe pacientes se houver sessão ativa gerada via token em doctor_access_sessions.
     * Caso contrário, a carteira permanece vazia aguardando o compartilhamento do paciente.
     */
    async patients(query: PatientQuery, _o?: RequestOptions): Promise<Schemas["PatientList"]> {
      const nowIso = new Date().toISOString();

      // Busca sessões de acesso médico ativas (com token válido e não expirado)
      const { data: activeSessions, error: sessionErr } = await supabaseServer
        .from("doctor_access_sessions")
        .select("*")
        .gt("expires_at", nowIso);

      if (sessionErr) {
        console.warn("[supabase-data.patients] Erro ao buscar sessões ativas:", sessionErr.message);
      }

      // Se nenhum paciente compartilhou token ativo, a carteira médica fica vazia
      if (!activeSessions || activeSessions.length === 0) {
        return output("PatientList", {
          items: [],
          page: { hasMore: false, nextCursor: null },
        }).data;
      }

      // Obtém os IDs dos pacientes autorizados
      const authorizedPatientIds = [...new Set(activeSessions.map((s) => s.patient_id))];

      const rows: Schemas["PatientRow"][] = [];

      for (const pid of authorizedPatientIds) {
        const [patient, patientExams, patientAlerts] = await Promise.all([
          getSupabasePatient(pid),
          getSupabaseExams(pid),
          getSupabaseAlerts(pid),
        ]);

        if (!patient) continue;

        const openAlerts = patientAlerts.filter((a) => !a.resolved);
        const latestExam = patientExams[0];

        let highlight = "Acesso autorizado via Token";
        if (openAlerts.length > 0) {
          highlight = `⚠️ ${openAlerts.length} alerta(s) fisiológico(s) em aberto`;
        } else if (latestExam) {
          highlight = `Último exame: ${latestExam.canonical_name} (${latestExam.date})`;
        }

        rows.push({
          relationshipId: `grant-${patient.id}`,
          accessStatus: "active",
          patient: {
            id: patient.id,
            displayName: patient.name,
            age: Number(patient.age),
            biologicalSex: mapBiologicalSex(patient.biological_sex),
            disambiguationLabel: patient.scenario || patient.city || "Paciente Rivio",
          },
          lastClinicalEventAt: null,
          lastClinicalEventOn: latestExam?.date || "2026-10-26",
          lastReceivedAt: new Date().toISOString(),
          review: {
            lastReviewedCursor: `cursor-${patient.id}`,
            lastReviewedAt: "2026-11-10T15:00:00Z",
            mode: "changes",
            unreadGroupCount: openAlerts.length,
          },
          highlight,
        });
      }

      // Filtra por termo de busca se informado
      const q = query.q?.toLowerCase().trim();
      const filtered = q
        ? rows.filter(
            (r) =>
              r.patient?.displayName.toLowerCase().includes(q) ||
              r.patient?.id.toLowerCase().includes(q)
          )
        : rows;

      return output("PatientList", {
        items: filtered,
        page: { hasMore: false, nextCursor: null },
      }).data;
    },

    async resolve(token: string, _o?: RequestOptions): Promise<Timed<Schemas["SharingResolution"]>> {
      const normalizedToken = token.trim().toUpperCase();
      const { data } = await supabaseServer
        .from("doctor_access_sessions")
        .select("*")
        .eq("token", normalizedToken)
        .maybeSingle();

      const patientId = data?.patient_id || "usr-marcos-2026";
      const patient = await getSupabasePatient(patientId);

      const resolvedScopes = ((data?.scope as string[]) || [
        "read_exams",
        "read_wearables",
        "read_graphrag_briefing",
        "read_clinical_context",
        "read_alerts",
      ]).filter(
        (s): s is Schemas["Scope"] =>
          s === "read_exams" ||
          s === "read_wearables" ||
          s === "read_graphrag_briefing" ||
          s === "read_clinical_context" ||
          s === "read_alerts"
      );

      const resolution: Schemas["SharingResolution"] = {
        invitation: {
          id: `invite-${token}`,
          kind: "consultation",
          expiresAt: data?.expires_at || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          permittedScopes: resolvedScopes,
          canRequestFollowup: true,
        },
        temporaryAccess: {
          kind: "temporary",
          contextId: `temp-${token}`,
          patientId,
          grantId: null,
          scopeVersion: "scope-v1",
          scopes: resolvedScopes,
          expiresAt: data?.expires_at || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          readOnly: true,
        },
        requiresDoctorAuthentication: false,
        loginContextId: null,
      };

      return output("SharingResolution", resolution);
    },

    async requestFollowup(_input, _key, _o) {
      throw new ApiError(501, "NOT_IMPLEMENTED");
    },

    async followup(_id, _o) {
      throw new ApiError(404, "NOT_FOUND");
    },

    async snapshot(ctx: PatientContext, _o?: RequestOptions): Promise<Timed<Snapshot>> {
      const s = await buildPatientSnapshotFromSupabase(ctx.patientId);
      return output("Snapshot", s);
    },

    async access(ctx: PatientContext, _known, _o): Promise<Timed<Schemas["AccessStatus"]>> {
      const status: Schemas["AccessStatus"] = {
        access: {
          kind: "continuous",
          contextId: `grant-${ctx.patientId}`,
          patientId: ctx.patientId,
          grantId: `grant-${ctx.patientId}`,
          scopeVersion: "scope-v1",
          scopes: [
            "read_exams",
            "read_wearables",
            "read_graphrag_briefing",
            "read_clinical_context",
            "read_alerts",
          ],
          expiresAt: "2026-12-31T23:59:59Z",
          readOnly: true,
        },
        accessRevision: `access-${ctx.patientId}-v1`,
        latestDataRevision: `data-${ctx.patientId}-v1`,
        hasNewData: false,
      };
      return output("AccessStatus", status);
    },

    async updates(_ctx, _snapshotId, _cursor, _o) {
      return output("UpdatesPage", {
        updates: [],
        page: { hasMore: false, nextCursor: null },
      }).data;
    },

    async review(ctx, _input, _key, _o) {
      return output("ReviewResult", {
        status: "recorded",
        reviewedCursor: `cursor-${ctx.patientId}`,
        reviewedAt: new Date().toISOString(),
      }).data;
    },

    async original(_ctx, _id, _o) {
      return new Blob(["Mock PDF Content"], { type: "application/pdf" });
    },

    async closeTemporary(_id, _o) {
      // Sem ação necessária
    },
  };
}
