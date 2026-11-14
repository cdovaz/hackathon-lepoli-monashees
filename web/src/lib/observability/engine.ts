import { supabase, supabaseAdmin } from '@/lib/supabase';

const db = () => supabaseAdmin || supabase;

export type TransitionEventType =
  | 'token_created'
  | 'token_resolved'
  | 'scope_updated'
  | 'token_revoked'
  | 'temporary_closed'
  | 'snapshot_read'
  | 'original_document_viewed'
  | 'review_completed'
  | 'followup_requested'
  | 'grant_approved'
  | 'grant_rejected'
  | 'document_uploaded'
  | 'document_deleted'
  | 'exam_added'
  | 'exam_deleted'
  | 'wearable_anomaly_injected'
  | 'wearable_anomaly_reset'
  | 'episode_prepared'
  | 'episode_read'
  | 'receipt_confirmed'
  | 'source_state_changed';

export type ActorRole = 'patient' | 'doctor' | 'institution_system' | 'team_ops';
export type TransitionDecision = 'allowed' | 'denied' | 'revoked' | 'partial';

export interface TransitionAuditEvent {
  id: string;
  patientId: string;
  patientName?: string;
  eventType: TransitionEventType;
  actorRole: ActorRole;
  actorId: string;
  actorName: string;
  recipientId: string;
  recipientName: string;
  institutionName: string;
  episodeId?: string | null;
  attendanceRef?: string | null;
  billingEventId?: string | null;
  scopes: string[];
  decision: TransitionDecision;
  accessRevision: string;
  dataRevision: string;
  summary: string;
  occurredAt: string;
}

export interface InstitutionalEpisode {
  episodeId: string;
  institutionId: string;
  institutionName: string;
  patientId: string;
  patientName: string;
  attendanceRef: string;
  purpose: string;
  professionalName: string;
  professionalId: string;
  idempotencyKey: string;
  packageId: string;
  packageStatus: 'preparing' | 'ready' | 'partial' | 'blocked' | 'unavailable';
  deliveryStatus: 'unconfirmed' | 'confirmed' | 'revoked_before_confirmation';
  qualified: boolean;
  receiptToken: string;
  scopes: string[];
  sourcesIncluded: string[];
  evidenceCount: number;
  accessRevision: string;
  dataRevision: string;
  obtainedAt: string;
  cacheExpiresAt: string;
  confirmedAt: string | null;
  billingEventId: string | null;
  readCount: number;
}

export interface UsageEventRecord {
  id: string;
  episodeId: string;
  institutionId: string;
  institutionName: string;
  patientId: string;
  action: 'prepareContext' | 'readContext' | 'confirmReceipt' | 'revocationBlock';
  outcome: 'success' | 'partial_free' | 'denied_revoked' | 'idempotent_replay' | 'cache_expired';
  billable: boolean;
  packageId: string;
  occurredAt: string;
}

export interface BillingEventRecord {
  id: string;
  episodeId: string;
  institutionId: string;
  institutionName: string;
  patientId: string;
  attendanceRef: string;
  purpose: string;
  packageId: string;
  contractRef: string;
  unitPriceBrl: number;
  status: 'recorded' | 'reconciled';
  confirmedAt: string;
}

export interface FollowupRequestRecord {
  id: string;
  invitationId: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  doctorCrm: string;
  institutionName: string;
  status: 'pending_patient_approval' | 'approved' | 'rejected' | 'revoked' | 'expired';
  requestedScopes: string[];
  requestedDuration: { mode: 'until' | 'indefinite'; expiresAt: string | null };
  createdAt: string;
  decidedAt: string | null;
  grantId: string | null;
}

export interface DoctorReviewRecord {
  id: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  snapshotId: string;
  lastReviewedCursor: string;
  lastReviewedAt: string;
}

export interface DataSourceRecord {
  id: string;
  label: string;
  kind: 'laboratory' | 'wearable' | 'hospital' | 'clinic' | 'manual';
  state: 'connected' | 'stale' | 'disconnected';
  lastSyncedAt: string;
  coverageFrom: string | null;
  coverageTo: string | null;
}

// Cache em memória sincronizado com o banco para resiliência em testes unitários sem rede
const memoryEvents = new Map<string, TransitionAuditEvent>();
const memoryEpisodes = new Map<string, InstitutionalEpisode>();
const memoryUsage = new Map<string, UsageEventRecord>();
const memoryBilling = new Map<string, BillingEventRecord>();
const memoryFollowups = new Map<string, FollowupRequestRecord>();
const memoryReviews = new Map<string, DoctorReviewRecord>();

const PATIENT_NAMES: Record<string, string> = {
  'usr-marcos-2026': 'Marcos Oliveira',
  'usr-camila-2026': 'Camila Ferreira',
  'usr-antonio-2026': 'Antônio Carlos Mendes',
  'usr-rafael-2026': 'Rafael Souza',
  'usr-dan-2026': 'Daniel Vaz',
};

export function resolvePatientName(patientId: string): string {
  return PATIENT_NAMES[patientId] || patientId;
}

/**
 * Registra um evento imutável de transição de dados no Supabase (`clinical_graph_nodes` kind='consultation')
 * sem nunca armazenar valores clínicos sensíveis ou laudos.
 */
export async function recordTransitionEvent(
  input: Omit<TransitionAuditEvent, 'id' | 'occurredAt'> & { id?: string; occurredAt?: string }
): Promise<TransitionAuditEvent> {
  const id = input.id || `obs-evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const occurredAt = input.occurredAt || new Date().toISOString();
  const event: TransitionAuditEvent = {
    ...input,
    id,
    patientName: input.patientName || resolvePatientName(input.patientId),
    occurredAt,
  };

  memoryEvents.set(id, event);

  try {
    await db()
      .from('clinical_graph_nodes')
      .upsert(
        {
          id,
          patient_id: event.patientId,
          kind: 'consultation',
          label: `AUDIT:${event.eventType}`,
          properties: {
            recordType: 'audit_event',
            ...event,
          },
          created_at: occurredAt,
        },
        { onConflict: 'id' }
      );
  } catch {
    // Mantido no memoryEvents se offline
  }

  return event;
}

export async function listTransitionEvents(filters?: {
  patientId?: string;
  actorRole?: string;
  eventType?: string;
  decision?: string;
  limit?: number;
}): Promise<TransitionAuditEvent[]> {
  try {
    let query = db()
      .from('clinical_graph_nodes')
      .select('id, patient_id, label, properties, created_at')
      .eq('kind', 'consultation')
      .like('label', 'AUDIT:%')
      .order('created_at', { ascending: false })
      .limit(filters?.limit || 100);

    if (filters?.patientId) {
      query = query.eq('patient_id', filters.patientId);
    }

    const { data } = await query;
    for (const row of data || []) {
      const p = (row.properties || {}) as Record<string, unknown>;
      if (p.recordType === 'audit_event') {
        const evt: TransitionAuditEvent = {
          id: row.id,
          patientId: row.patient_id,
          patientName: String(p.patientName || resolvePatientName(row.patient_id)),
          eventType: (p.eventType as TransitionEventType) || 'snapshot_read',
          actorRole: (p.actorRole as ActorRole) || 'doctor',
          actorId: String(p.actorId || 'system'),
          actorName: String(p.actorName || 'Sistema'),
          recipientId: String(p.recipientId || 'system'),
          recipientName: String(p.recipientName || 'Destinatário'),
          institutionName: String(p.institutionName || 'Hub Rivio'),
          episodeId: p.episodeId ? String(p.episodeId) : null,
          attendanceRef: p.attendanceRef ? String(p.attendanceRef) : null,
          billingEventId: p.billingEventId ? String(p.billingEventId) : null,
          scopes: Array.isArray(p.scopes) ? (p.scopes as string[]) : [],
          decision: (p.decision as TransitionDecision) || 'allowed',
          accessRevision: String(p.accessRevision || 'rev-acc-1'),
          dataRevision: String(p.dataRevision || 'rev-dat-1'),
          summary: String(p.summary || row.label),
          occurredAt: String(p.occurredAt || row.created_at || new Date().toISOString()),
        };
        memoryEvents.set(evt.id, evt);
      }
    }
  } catch {
    // Fallback para cache em memória
  }

  let items = Array.from(memoryEvents.values());
  if (filters?.patientId) items = items.filter((e) => e.patientId === filters.patientId);
  if (filters?.actorRole && filters.actorRole !== 'all') items = items.filter((e) => e.actorRole === filters.actorRole);
  if (filters?.eventType && filters.eventType !== 'all') items = items.filter((e) => e.eventType === filters.eventType);
  if (filters?.decision && filters.decision !== 'all') items = items.filter((e) => e.decision === filters.decision);

  return items.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export async function listInstitutionalEpisodes(patientId?: string): Promise<InstitutionalEpisode[]> {
  try {
    let query = db()
      .from('clinical_graph_nodes')
      .select('id, patient_id, label, properties, created_at')
      .eq('kind', 'consultation')
      .like('label', 'EPISODE:%')
      .order('created_at', { ascending: false });

    if (patientId) query = query.eq('patient_id', patientId);
    const { data } = await query;
    for (const row of data || []) {
      const p = (row.properties || {}) as Record<string, unknown>;
      if (p.recordType === 'institutional_episode' && p.episodeId) {
        const ep = p as unknown as InstitutionalEpisode;
        memoryEpisodes.set(ep.episodeId, ep);
      }
    }
  } catch {
    // Fallback
  }

  let list = Array.from(memoryEpisodes.values());
  if (patientId) list = list.filter((e) => e.patientId === patientId);
  return list.sort((a, b) => b.obtainedAt.localeCompare(a.obtainedAt));
}

async function saveInstitutionalEpisode(ep: InstitutionalEpisode): Promise<void> {
  memoryEpisodes.set(ep.episodeId, ep);
  try {
    await db()
      .from('clinical_graph_nodes')
      .upsert(
        {
          id: `obs-ep-${ep.episodeId}`,
          patient_id: ep.patientId,
          kind: 'consultation',
          label: `EPISODE:${ep.episodeId}`,
          properties: {
            recordType: 'institutional_episode',
            ...ep,
          },
          created_at: ep.obtainedAt,
        },
        { onConflict: 'id' }
      );
  } catch {
    // Fallback
  }
}

export async function listDataSources(): Promise<DataSourceRecord[]> {
  try {
    const { data } = await db().from('data_sources').select('*').order('id');
    if (data?.length) {
      return data.map((d) => ({
        id: d.id,
        label: d.label,
        kind: d.kind,
        state: d.state,
        lastSyncedAt: d.last_synced_at,
        coverageFrom: d.coverage_from,
        coverageTo: d.coverage_to,
      }));
    }
  } catch {
    // Fallback
  }
  return [
    { id: 'src-fleury', label: 'Fleury Medicina e Saúde', kind: 'laboratory', state: 'connected', lastSyncedAt: new Date().toISOString(), coverageFrom: '2022-01-01', coverageTo: '2026-11-14' },
    { id: 'src-dasa', label: 'Dasa / Alta Excelência Diagnóstica', kind: 'laboratory', state: 'connected', lastSyncedAt: new Date().toISOString(), coverageFrom: '2023-01-01', coverageTo: '2026-11-14' },
    { id: 'src-apple-watch', label: 'Apple Watch Series 9 (HealthKit)', kind: 'wearable', state: 'connected', lastSyncedAt: new Date().toISOString(), coverageFrom: '2025-11-01', coverageTo: '2026-11-14' },
  ];
}

export async function updateDataSourceState(
  sourceId: string,
  newState: 'connected' | 'stale' | 'disconnected',
  actorName = 'Equipe de Operações Institucionais'
): Promise<DataSourceRecord | null> {
  const now = new Date().toISOString();
  try {
    const { data, error } = await db()
      .from('data_sources')
      .update({ state: newState, last_synced_at: now })
      .eq('id', sourceId)
      .select('*')
      .maybeSingle();

    if (!error && data) {
      await recordTransitionEvent({
        patientId: 'usr-marcos-2026',
        eventType: 'source_state_changed',
        actorRole: 'team_ops',
        actorId: 'team-ops-1',
        actorName,
        recipientId: sourceId,
        recipientName: data.label,
        institutionName: 'Governança de Conectores Rivio',
        scopes: [],
        decision: newState === 'disconnected' ? 'partial' : 'allowed',
        accessRevision: `rev-src-${Date.now()}`,
        dataRevision: `rev-dat-${Date.now()}`,
        summary: `Conector ${data.label} (${sourceId}) alterado para o estado '${newState}'.`,
      });
      return {
        id: data.id,
        label: data.label,
        kind: data.kind,
        state: data.state,
        lastSyncedAt: data.last_synced_at,
        coverageFrom: data.coverage_from,
        coverageTo: data.coverage_to,
      };
    }
  } catch {
    // Fallback
  }
  return null;
}

/**
 * Operação 1 do Módulo Profundo Institucional: `prepareContext`
 * Valida autorização ativa do paciente, verifica conectores, cria ou reutiliza episódio idempotente
 * por (institutionId, patientId, attendanceRef, purpose), define TTL fixo de 15 minutos e emite recibo opaco.
 */
export async function prepareInstitutionalContext(input: {
  institutionId: string;
  institutionName: string;
  patientId: string;
  attendanceRef: string;
  purpose: string;
  professionalName: string;
  professionalId: string;
  idempotencyKey: string;
  requestedScopes?: string[];
}): Promise<{
  episode: InstitutionalEpisode;
  usageEvent: UsageEventRecord;
  reused: boolean;
}> {
  await listInstitutionalEpisodes(input.patientId);

  // 1. Verificar se o paciente possui sessão ativa autorizada no Supabase
  let activeSession: { token: string; active: boolean; scope: string[]; expires_at: string; revoked_at: string | null } | null = null;
  try {
    const { data } = await db()
      .from('doctor_access_sessions')
      .select('token, active, scope, expires_at, revoked_at')
      .eq('patient_id', input.patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) activeSession = data;
  } catch {
    // Fallback
  }

  const isAuthorized =
    activeSession === null
      ? true
      : Boolean(activeSession.active && !activeSession.revoked_at && new Date(activeSession.expires_at).getTime() > Date.now());

  const grantedScopes =
    activeSession?.scope && Array.isArray(activeSession.scope) && activeSession.scope.length > 0
      ? activeSession.scope
      : input.requestedScopes || ['read_exams', 'read_wearables', 'read_clinical_context', 'read_alerts', 'read_graphrag_briefing'];

  // 2. Checar se já existe episódio para a tupla única (institutionId, patientId, attendanceRef, purpose) ou idempotencyKey
  const existing = Array.from(memoryEpisodes.values()).find(
    (e) =>
      e.idempotencyKey === input.idempotencyKey ||
      (e.institutionId === input.institutionId &&
        e.patientId === input.patientId &&
        e.attendanceRef === input.attendanceRef &&
        e.purpose === input.purpose)
  );

  const now = Date.now();
  const sources = await listDataSources();
  const hasDisconnectedLab = sources.some((s) => s.kind === 'laboratory' && s.state === 'disconnected');
  const connectedSourceLabels = sources.filter((s) => s.state !== 'disconnected').map((s) => s.label);

  if (!isAuthorized) {
    const blockedId = existing?.episodeId || `ep-${input.institutionId.slice(0, 8)}-${Date.now().toString(36)}`;
    const blockedEp: InstitutionalEpisode = {
      episodeId: blockedId,
      institutionId: input.institutionId,
      institutionName: input.institutionName,
      patientId: input.patientId,
      patientName: resolvePatientName(input.patientId),
      attendanceRef: input.attendanceRef,
      purpose: input.purpose,
      professionalName: input.professionalName,
      professionalId: input.professionalId,
      idempotencyKey: input.idempotencyKey,
      packageId: `pkg-blocked-${Date.now().toString(36)}`,
      packageStatus: 'blocked',
      deliveryStatus: 'revoked_before_confirmation',
      qualified: false,
      receiptToken: '',
      scopes: [],
      sourcesIncluded: [],
      evidenceCount: 0,
      accessRevision: `rev-acc-revoked`,
      dataRevision: `rev-dat-0`,
      obtainedAt: new Date(now).toISOString(),
      cacheExpiresAt: new Date(now).toISOString(),
      confirmedAt: null,
      billingEventId: null,
      readCount: 0,
    };
    await saveInstitutionalEpisode(blockedEp);
    const usage: UsageEventRecord = {
      id: `use-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      episodeId: blockedEp.episodeId,
      institutionId: input.institutionId,
      institutionName: input.institutionName,
      patientId: input.patientId,
      action: 'prepareContext',
      outcome: 'denied_revoked',
      billable: false,
      packageId: blockedEp.packageId,
      occurredAt: new Date(now).toISOString(),
    };
    memoryUsage.set(usage.id, usage);

    await recordTransitionEvent({
      patientId: input.patientId,
      eventType: 'episode_prepared',
      actorRole: 'institution_system',
      actorId: input.institutionId,
      actorName: `${input.professionalName} · ${input.institutionName}`,
      recipientId: input.institutionId,
      recipientName: input.institutionName,
      institutionName: input.institutionName,
      episodeId: blockedEp.episodeId,
      attendanceRef: input.attendanceRef,
      scopes: [],
      decision: 'revoked',
      accessRevision: blockedEp.accessRevision,
      dataRevision: blockedEp.dataRevision,
      summary: `Preparação bloqueada para atendimento ${input.attendanceRef}: consentimento revogado ou inativo pelo paciente. Zero cobrança gerada.`,
    });

    return { episode: blockedEp, usageEvent: usage, reused: false };
  }

  // Se o episódio já existe e o cache de 15 minutos ainda é válido, retorna de forma idempotente sem criar novo episódio!
  if (existing && new Date(existing.cacheExpiresAt).getTime() > now && existing.packageStatus !== 'blocked') {
    const usage: UsageEventRecord = {
      id: `use-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      episodeId: existing.episodeId,
      institutionId: existing.institutionId,
      institutionName: existing.institutionName,
      patientId: existing.patientId,
      action: 'prepareContext',
      outcome: 'idempotent_replay',
      billable: false,
      packageId: existing.packageId,
      occurredAt: new Date(now).toISOString(),
    };
    memoryUsage.set(usage.id, usage);
    return { episode: existing, usageEvent: usage, reused: true };
  }

  const episodeId = existing?.episodeId || `ep-${input.institutionId.replace(/^inst-/, '')}-${input.attendanceRef.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const isPartial = hasDisconnectedLab || grantedScopes.length === 0;
  const qualified = !isPartial && grantedScopes.includes('read_exams');

  const episode: InstitutionalEpisode = {
    episodeId,
    institutionId: input.institutionId,
    institutionName: input.institutionName,
    patientId: input.patientId,
    patientName: resolvePatientName(input.patientId),
    attendanceRef: input.attendanceRef,
    purpose: input.purpose,
    professionalName: input.professionalName,
    professionalId: input.professionalId,
    idempotencyKey: input.idempotencyKey,
    packageId: `pkg-${input.patientId.slice(4, 10)}-${Date.now().toString(36)}`,
    packageStatus: isPartial ? 'partial' : 'ready',
    deliveryStatus: existing?.deliveryStatus === 'confirmed' ? 'confirmed' : 'unconfirmed',
    qualified,
    receiptToken: existing?.receiptToken || `rcpt_opaque_${episodeId}_${Math.random().toString(36).slice(2, 8)}`,
    scopes: grantedScopes,
    sourcesIncluded: connectedSourceLabels,
    evidenceCount: isPartial ? 8 : 32,
    accessRevision: `rev-acc-${grantedScopes.length}-${activeSession?.token || 'grant'}`,
    dataRevision: `rev-dat-${new Date(now).toISOString().slice(0, 10)}`,
    obtainedAt: new Date(now).toISOString(),
    // Regra de Residência (docs/institutional-data-residency.md): TTL fixo de 15 minutos
    cacheExpiresAt: new Date(now + 15 * 60 * 1000).toISOString(),
    confirmedAt: existing?.confirmedAt || null,
    billingEventId: existing?.billingEventId || null,
    readCount: (existing?.readCount || 0) + 1,
  };

  await saveInstitutionalEpisode(episode);

  const usage: UsageEventRecord = {
    id: `use-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    episodeId: episode.episodeId,
    institutionId: episode.institutionId,
    institutionName: episode.institutionName,
    patientId: episode.patientId,
    action: 'prepareContext',
    outcome: isPartial ? 'partial_free' : 'success',
    billable: false,
    packageId: episode.packageId,
    occurredAt: new Date(now).toISOString(),
  };
  memoryUsage.set(usage.id, usage);

  await recordTransitionEvent({
    patientId: episode.patientId,
    eventType: 'episode_prepared',
    actorRole: 'institution_system',
    actorId: episode.institutionId,
    actorName: `${episode.professionalName} · ${episode.institutionName}`,
    recipientId: episode.institutionId,
    recipientName: episode.institutionName,
    institutionName: episode.institutionName,
    episodeId: episode.episodeId,
    attendanceRef: episode.attendanceRef,
    scopes: episode.scopes,
    decision: isPartial ? 'partial' : 'allowed',
    accessRevision: episode.accessRevision,
    dataRevision: episode.dataRevision,
    summary: isPartial
      ? `Pacote parcial preparado (${episode.episodeId}) — fonte offline ou escopo restrito. Entrega gratuita (não elegível para cobrança).`
      : `Pacote clínico qualificado preparado (${episode.episodeId}) com TTL de cache de 15 min e recibo opaco emitido.`,
  });

  return { episode, usageEvent: usage, reused: false };
}

/**
 * Operação 2 do Módulo Profundo Institucional: `readContext`
 * Revalida autorização atual e TTL de 15 minutos. Nunca estende o TTL do cache e nunca gera cobrança.
 */
export async function readInstitutionalContext(episodeId: string): Promise<{
  episode: InstitutionalEpisode | null;
  usageEvent: UsageEventRecord | null;
  allowed: boolean;
  reason?: string;
}> {
  await listInstitutionalEpisodes();
  const ep = memoryEpisodes.get(episodeId);
  if (!ep) return { episode: null, usageEvent: null, allowed: false, reason: 'EPISODE_NOT_FOUND' };

  // Revalidar sessão ativa do paciente
  let isRevoked = false;
  try {
    const { data } = await db()
      .from('doctor_access_sessions')
      .select('active, revoked_at, expires_at')
      .eq('patient_id', ep.patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data && (!data.active || data.revoked_at || new Date(data.expires_at).getTime() <= Date.now())) {
      isRevoked = true;
    }
  } catch {
    // Fallback
  }

  const now = Date.now();
  if (isRevoked) {
    ep.packageStatus = 'blocked';
    if (ep.deliveryStatus !== 'confirmed') {
      ep.deliveryStatus = 'revoked_before_confirmation';
    }
    await saveInstitutionalEpisode(ep);
    const usage: UsageEventRecord = {
      id: `use-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      episodeId: ep.episodeId,
      institutionId: ep.institutionId,
      institutionName: ep.institutionName,
      patientId: ep.patientId,
      action: 'readContext',
      outcome: 'denied_revoked',
      billable: false,
      packageId: ep.packageId,
      occurredAt: new Date(now).toISOString(),
    };
    memoryUsage.set(usage.id, usage);

    await recordTransitionEvent({
      patientId: ep.patientId,
      eventType: 'episode_read',
      actorRole: 'institution_system',
      actorId: ep.institutionId,
      actorName: ep.institutionName,
      recipientId: ep.institutionId,
      recipientName: ep.institutionName,
      institutionName: ep.institutionName,
      episodeId: ep.episodeId,
      attendanceRef: ep.attendanceRef,
      scopes: [],
      decision: 'revoked',
      accessRevision: 'rev-acc-revoked',
      dataRevision: ep.dataRevision,
      summary: `Leitura de pacote bloqueada no episódio ${ep.episodeId}: paciente revogou a autorização. Cache institucional invalidado.`,
    });

    return { episode: ep, usageEvent: usage, allowed: false, reason: 'ACCESS_REVOKED' };
  }

  if (new Date(ep.cacheExpiresAt).getTime() <= now) {
    const usage: UsageEventRecord = {
      id: `use-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      episodeId: ep.episodeId,
      institutionId: ep.institutionId,
      institutionName: ep.institutionName,
      patientId: ep.patientId,
      action: 'readContext',
      outcome: 'cache_expired',
      billable: false,
      packageId: ep.packageId,
      occurredAt: new Date(now).toISOString(),
    };
    memoryUsage.set(usage.id, usage);
    return { episode: ep, usageEvent: usage, allowed: false, reason: 'CACHE_TTL_EXPIRED' };
  }

  // Nota: Ler o contexto incrementa readCount mas NÃO altera cacheExpiresAt nem cria cobrança!
  ep.readCount += 1;
  await saveInstitutionalEpisode(ep);

  const usage: UsageEventRecord = {
    id: `use-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    episodeId: ep.episodeId,
    institutionId: ep.institutionId,
    institutionName: ep.institutionName,
    patientId: ep.patientId,
    action: 'readContext',
    outcome: 'success',
    billable: false,
    packageId: ep.packageId,
    occurredAt: new Date(now).toISOString(),
  };
  memoryUsage.set(usage.id, usage);

  await recordTransitionEvent({
    patientId: ep.patientId,
    eventType: 'episode_read',
    actorRole: 'institution_system',
    actorId: ep.institutionId,
    actorName: `${ep.professionalName} · ${ep.institutionName}`,
    recipientId: ep.institutionId,
    recipientName: ep.institutionName,
    institutionName: ep.institutionName,
    episodeId: ep.episodeId,
    attendanceRef: ep.attendanceRef,
    scopes: ep.scopes,
    decision: 'allowed',
    accessRevision: ep.accessRevision,
    dataRevision: ep.dataRevision,
    summary: `Releitura autorizada (#${ep.readCount}) do pacote ${ep.packageId} dentro do TTL de 15 min. Custo adicional: R$ 0,00.`,
  });

  return { episode: ep, usageEvent: usage, allowed: true };
}

/**
 * Operação 3 do Módulo Profundo Institucional: `confirmReceipt`
 * Confirma o recebimento do pacote clínico via recibo opaco (`receiptToken`) e registra
 * NO MÁXIMO 1 evento de cobrança por episódio (idempotente). Se revogado antes ou se parcial, não cobra.
 */
export async function confirmInstitutionalReceipt(input: {
  episodeId: string;
  receiptToken: string;
}): Promise<{
  episode: InstitutionalEpisode | null;
  billingEvent: BillingEventRecord | null;
  usageEvent: UsageEventRecord | null;
  idempotentReplay: boolean;
  errorCode?: string;
}> {
  await listInstitutionalEpisodes();
  const ep = memoryEpisodes.get(input.episodeId);
  if (!ep) {
    return { episode: null, billingEvent: null, usageEvent: null, idempotentReplay: false, errorCode: 'EPISODE_NOT_FOUND' };
  }

  if (ep.receiptToken !== input.receiptToken) {
    return { episode: ep, billingEvent: null, usageEvent: null, idempotentReplay: false, errorCode: 'INVALID_RECEIPT_TOKEN' };
  }

  const now = new Date().toISOString();

  // Se já foi confirmado antes, retorna o mesmo BillingEvent de maneira idempotente sem cobrar segunda unidade!
  if (ep.deliveryStatus === 'confirmed' && ep.billingEventId) {
    const existingBill =
      memoryBilling.get(ep.billingEventId) ||
      ({
        id: ep.billingEventId,
        episodeId: ep.episodeId,
        institutionId: ep.institutionId,
        institutionName: ep.institutionName,
        patientId: ep.patientId,
        attendanceRef: ep.attendanceRef,
        purpose: ep.purpose,
        packageId: ep.packageId,
        contractRef: 'CTR-B2B-2026-01',
        unitPriceBrl: 18.5,
        status: 'recorded',
        confirmedAt: ep.confirmedAt || now,
      } satisfies BillingEventRecord);
    memoryBilling.set(existingBill.id, existingBill);

    const usage: UsageEventRecord = {
      id: `use-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      episodeId: ep.episodeId,
      institutionId: ep.institutionId,
      institutionName: ep.institutionName,
      patientId: ep.patientId,
      action: 'confirmReceipt',
      outcome: 'idempotent_replay',
      billable: false,
      packageId: ep.packageId,
      occurredAt: now,
    };
    memoryUsage.set(usage.id, usage);

    return { episode: ep, billingEvent: existingBill, usageEvent: usage, idempotentReplay: true };
  }

  // Checar se o paciente revogou o acesso antes da confirmação
  let isRevoked = ep.packageStatus === 'blocked' || ep.deliveryStatus === 'revoked_before_confirmation';
  try {
    const { data } = await db()
      .from('doctor_access_sessions')
      .select('active, revoked_at, expires_at')
      .eq('patient_id', ep.patientId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data && (!data.active || data.revoked_at || new Date(data.expires_at).getTime() <= Date.now())) {
      isRevoked = true;
    }
  } catch {
    // Fallback
  }

  if (isRevoked) {
    ep.packageStatus = 'blocked';
    ep.deliveryStatus = 'revoked_before_confirmation';
    await saveInstitutionalEpisode(ep);
    const usage: UsageEventRecord = {
      id: `use-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      episodeId: ep.episodeId,
      institutionId: ep.institutionId,
      institutionName: ep.institutionName,
      patientId: ep.patientId,
      action: 'confirmReceipt',
      outcome: 'denied_revoked',
      billable: false,
      packageId: ep.packageId,
      occurredAt: now,
    };
    memoryUsage.set(usage.id, usage);
    return { episode: ep, billingEvent: null, usageEvent: usage, idempotentReplay: false, errorCode: 'REVOKED_BEFORE_CONFIRMATION' };
  }

  // Pacotes parciais não qualificam para cobrança (entrega parcial gratuita)
  if (!ep.qualified || ep.packageStatus !== 'ready') {
    const usage: UsageEventRecord = {
      id: `use-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      episodeId: ep.episodeId,
      institutionId: ep.institutionId,
      institutionName: ep.institutionName,
      patientId: ep.patientId,
      action: 'confirmReceipt',
      outcome: 'partial_free',
      billable: false,
      packageId: ep.packageId,
      occurredAt: now,
    };
    memoryUsage.set(usage.id, usage);
    return { episode: ep, billingEvent: null, usageEvent: usage, idempotentReplay: false, errorCode: 'PACKAGE_PARTIAL_NOT_BILLABLE' };
  }

  const billingId = `bill-${ep.episodeId}`;
  const billing: BillingEventRecord = {
    id: billingId,
    episodeId: ep.episodeId,
    institutionId: ep.institutionId,
    institutionName: ep.institutionName,
    patientId: ep.patientId,
    attendanceRef: ep.attendanceRef,
    purpose: ep.purpose,
    packageId: ep.packageId,
    contractRef: 'CTR-B2B-2026-01',
    unitPriceBrl: 18.5,
    status: 'recorded',
    confirmedAt: now,
  };
  memoryBilling.set(billingId, billing);

  ep.deliveryStatus = 'confirmed';
  ep.confirmedAt = now;
  ep.billingEventId = billingId;
  await saveInstitutionalEpisode(ep);

  const usage: UsageEventRecord = {
    id: `use-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    episodeId: ep.episodeId,
    institutionId: ep.institutionId,
    institutionName: ep.institutionName,
    patientId: ep.patientId,
    action: 'confirmReceipt',
    outcome: 'success',
    billable: true,
    packageId: ep.packageId,
    occurredAt: now,
  };
  memoryUsage.set(usage.id, usage);

  await recordTransitionEvent({
    patientId: ep.patientId,
    eventType: 'receipt_confirmed',
    actorRole: 'institution_system',
    actorId: ep.institutionId,
    actorName: `Consumidor Homologado · ${ep.institutionName}`,
    recipientId: ep.institutionId,
    recipientName: ep.institutionName,
    institutionName: ep.institutionName,
    episodeId: ep.episodeId,
    attendanceRef: ep.attendanceRef,
    billingEventId: billingId,
    scopes: ep.scopes,
    decision: 'allowed',
    accessRevision: ep.accessRevision,
    dataRevision: ep.dataRevision,
    summary: `Recibo opaco ${input.receiptToken} confirmado no episódio ${ep.episodeId}. 1 unidade cobrável (${billingId}) consolidada.`,
  });

  return { episode: ep, billingEvent: billing, usageEvent: usage, idempotentReplay: false };
}

/**
 * Gestão de Solicitações de Acompanhamento Contínuo (Follow-up Requests & Grants)
 */
export async function listFollowupRequests(patientId?: string): Promise<FollowupRequestRecord[]> {
  try {
    let query = db()
      .from('clinical_graph_nodes')
      .select('id, patient_id, label, properties, created_at')
      .eq('kind', 'consultation')
      .like('label', 'FOLLOWUP:%')
      .order('created_at', { ascending: false });

    if (patientId) query = query.eq('patient_id', patientId);
    const { data } = await query;
    for (const row of data || []) {
      const p = (row.properties || {}) as Record<string, unknown>;
      if (p.recordType === 'followup_request' && p.id) {
        const fup = p as unknown as FollowupRequestRecord;
        memoryFollowups.set(fup.id, fup);
      }
    }
  } catch {
    // Fallback
  }

  let list = Array.from(memoryFollowups.values());
  if (patientId) list = list.filter((f) => f.patientId === patientId);
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createFollowupRequestInDb(input: {
  invitationId: string;
  patientId?: string;
  doctorId?: string;
  doctorName?: string;
  doctorCrm?: string;
  institutionName?: string;
  requestedScopes: string[];
  requestedDuration: { mode: 'until' | 'indefinite'; expiresAt: string | null };
}): Promise<FollowupRequestRecord> {
  // Resolver patientId a partir do invitationId/token se necessário
  let patientId = input.patientId || 'usr-marcos-2026';
  try {
    const { data: sess } = await db()
      .from('doctor_access_sessions')
      .select('patient_id')
      .eq('token', input.invitationId)
      .maybeSingle();
    if (sess?.patient_id) patientId = sess.patient_id;
  } catch {
    // Fallback
  }

  const id = `fup-${patientId.slice(4, 10)}-${Date.now().toString(36)}`;
  const now = new Date().toISOString();
  const record: FollowupRequestRecord = {
    id,
    invitationId: input.invitationId,
    patientId,
    patientName: resolvePatientName(patientId),
    doctorId: input.doctorId || 'doctor-demo-1',
    doctorName: input.doctorName || 'Dra. Helena Costa',
    doctorCrm: input.doctorCrm || 'CRM 123456-SP',
    institutionName: input.institutionName || 'Hospital Sírio-Libanês',
    status: 'pending_patient_approval',
    requestedScopes: input.requestedScopes,
    requestedDuration: input.requestedDuration,
    createdAt: now,
    decidedAt: null,
    grantId: null,
  };

  memoryFollowups.set(id, record);

  try {
    await db()
      .from('clinical_graph_nodes')
      .upsert(
        {
          id: `obs-fup-${id}`,
          patient_id: patientId,
          kind: 'consultation',
          label: `FOLLOWUP:${id}`,
          properties: {
            recordType: 'followup_request',
            ...record,
          },
          created_at: now,
        },
        { onConflict: 'id' }
      );
  } catch {
    // Fallback
  }

  await recordTransitionEvent({
    patientId,
    eventType: 'followup_requested',
    actorRole: 'doctor',
    actorId: record.doctorId,
    actorName: `${record.doctorName} (${record.doctorCrm})`,
    recipientId: patientId,
    recipientName: record.patientName,
    institutionName: record.institutionName,
    scopes: record.requestedScopes,
    decision: 'allowed',
    accessRevision: `rev-fup-${id}`,
    dataRevision: `rev-dat-1`,
    summary: `Solicitação de vínculo contínuo enviada para aprovação do paciente (${record.requestedScopes.length} escopos).`,
  });

  return record;
}

export async function decideFollowupRequestInDb(
  requestId: string,
  decision: 'approved' | 'rejected' | 'revoked'
): Promise<FollowupRequestRecord | null> {
  await listFollowupRequests();
  const record = memoryFollowups.get(requestId);
  if (!record) return null;

  const now = new Date().toISOString();
  record.status = decision;
  record.decidedAt = now;
  if (decision === 'approved') {
    record.grantId = `grant-${record.patientId.slice(4, 10)}-${Date.now().toString(36)}`;
  }

  memoryFollowups.set(record.id, record);

  try {
    await db()
      .from('clinical_graph_nodes')
      .upsert(
        {
          id: `obs-fup-${record.id}`,
          patient_id: record.patientId,
          kind: 'consultation',
          label: `FOLLOWUP:${record.id}`,
          properties: {
            recordType: 'followup_request',
            ...record,
          },
          created_at: record.createdAt,
        },
        { onConflict: 'id' }
      );

    if (decision === 'approved') {
      const expiresAt =
        record.requestedDuration.expiresAt ||
        new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();
      await db()
        .from('doctor_access_sessions')
        .upsert(
          {
            id: record.grantId!,
            patient_id: record.patientId,
            token: `GRT${Math.floor(100 + Math.random() * 900)}`,
            active: true,
            scope: record.requestedScopes,
            created_at: now,
            expires_at: expiresAt,
            access_url: `grant://${record.grantId}`,
            doctor_crm: record.doctorCrm,
            doctor_name: record.doctorName,
            revoked_at: null,
          },
          { onConflict: 'id' }
        );
    }
  } catch {
    // Fallback
  }

  await recordTransitionEvent({
    patientId: record.patientId,
    eventType: decision === 'approved' ? 'grant_approved' : 'grant_rejected',
    actorRole: 'patient',
    actorId: record.patientId,
    actorName: record.patientName,
    recipientId: record.doctorId,
    recipientName: `${record.doctorName} (${record.doctorCrm})`,
    institutionName: record.institutionName,
    scopes: record.requestedScopes,
    decision: decision === 'approved' ? 'allowed' : 'denied',
    accessRevision: `rev-grant-${Date.now()}`,
    dataRevision: `rev-dat-1`,
    summary:
      decision === 'approved'
        ? `Paciente aprovou vínculo contínuo (${record.grantId}) para ${record.doctorName}.`
        : `Paciente recusou/revogou solicitação de vínculo contínuo de ${record.doctorName}.`,
  });

  return record;
}

/**
 * Persistência de Revisão de Novidades do Médico (Review Cursor)
 */
export async function recordDoctorReviewInDb(input: {
  patientId: string;
  doctorId?: string;
  doctorName?: string;
  snapshotId: string;
  reviewToken: string;
}): Promise<DoctorReviewRecord> {
  const id = `rev-${input.patientId}-${input.doctorId || 'doctor-demo-1'}`;
  const now = new Date().toISOString();
  const record: DoctorReviewRecord = {
    id,
    patientId: input.patientId,
    doctorId: input.doctorId || 'doctor-demo-1',
    doctorName: input.doctorName || 'Dra. Helena Costa',
    snapshotId: input.snapshotId,
    lastReviewedCursor: input.reviewToken,
    lastReviewedAt: now,
  };
  memoryReviews.set(id, record);

  try {
    await db()
      .from('clinical_graph_nodes')
      .upsert(
        {
          id: `obs-${id}`,
          patient_id: input.patientId,
          kind: 'consultation',
          label: `REVIEW:${id}`,
          properties: {
            recordType: 'doctor_review',
            ...record,
          },
          created_at: now,
        },
        { onConflict: 'id' }
      );
  } catch {
    // Fallback
  }

  await recordTransitionEvent({
    patientId: input.patientId,
    eventType: 'review_completed',
    actorRole: 'doctor',
    actorId: record.doctorId,
    actorName: record.doctorName,
    recipientId: input.patientId,
    recipientName: resolvePatientName(input.patientId),
    institutionName: 'Espaço do Médico Rivio',
    scopes: ['read_exams', 'read_wearables', 'read_clinical_context'],
    decision: 'allowed',
    accessRevision: 'rev-acc-current',
    dataRevision: input.reviewToken,
    summary: `Médico concluiu revisão longitudinal do snapshot ${input.snapshotId} (cursor: ${input.reviewToken}).`,
  });

  return record;
}

export async function getDoctorReviewFromDb(
  patientId: string,
  doctorId = 'doctor-demo-1'
): Promise<DoctorReviewRecord | null> {
  const id = `rev-${patientId}-${doctorId}`;
  try {
    const { data } = await db()
      .from('clinical_graph_nodes')
      .select('properties')
      .eq('id', `obs-${id}`)
      .maybeSingle();
    if (data?.properties) {
      const rec = data.properties as unknown as DoctorReviewRecord;
      memoryReviews.set(id, rec);
      return rec;
    }
  } catch {
    // Fallback
  }
  return memoryReviews.get(id) || null;
}

export async function getObservabilityDashboardState(patientId?: string) {
  const [events, episodes, followups, sources] = await Promise.all([
    listTransitionEvents({ patientId, limit: 100 }),
    listInstitutionalEpisodes(patientId),
    listFollowupRequests(patientId),
    listDataSources(),
  ]);

  let activeSessions: Array<Record<string, unknown>> = [];
  try {
    let q = db().from('doctor_access_sessions').select('*').order('created_at', { ascending: false }).limit(50);
    if (patientId) q = q.eq('patient_id', patientId);
    const { data } = await q;
    activeSessions = data || [];
  } catch {
    // Fallback
  }

  // Reconstruir listas de usageEvents e billingEvents a partir dos episódios e eventos
  for (const ep of episodes) {
    if (ep.billingEventId && !memoryBilling.has(ep.billingEventId)) {
      memoryBilling.set(ep.billingEventId, {
        id: ep.billingEventId,
        episodeId: ep.episodeId,
        institutionId: ep.institutionId,
        institutionName: ep.institutionName,
        patientId: ep.patientId,
        attendanceRef: ep.attendanceRef,
        purpose: ep.purpose,
        packageId: ep.packageId,
        contractRef: 'CTR-B2B-2026-01',
        unitPriceBrl: 18.5,
        status: 'recorded',
        confirmedAt: ep.confirmedAt || ep.obtainedAt,
      });
    }
    const baseUseId = `use-seed-${ep.episodeId}`;
    if (!memoryUsage.has(baseUseId)) {
      memoryUsage.set(baseUseId, {
        id: baseUseId,
        episodeId: ep.episodeId,
        institutionId: ep.institutionId,
        institutionName: ep.institutionName,
        patientId: ep.patientId,
        action: ep.deliveryStatus === 'confirmed' ? 'confirmReceipt' : 'prepareContext',
        outcome: ep.packageStatus === 'ready' ? 'success' : 'partial_free',
        billable: ep.deliveryStatus === 'confirmed',
        packageId: ep.packageId,
        occurredAt: ep.confirmedAt || ep.obtainedAt,
      });
    }
  }

  const usageEvents = Array.from(memoryUsage.values()).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const billingEvents = Array.from(memoryBilling.values()).sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt));

  const totalReads = episodes.reduce((acc, e) => acc + (e.readCount || 1), 0);
  const nonBilledOperations = Math.max(0, totalReads + usageEvents.length - billingEvents.length);

  return {
    events,
    episodes,
    usageEvents,
    billingEvents,
    followups,
    sources,
    activeSessions,
    metrics: {
      totalTransitions: events.length,
      activeTokensCount: activeSessions.filter(
        (s) => s.active && !s.revoked_at && new Date(String(s.expires_at)).getTime() > Date.now()
      ).length,
      revokedTokensCount: activeSessions.filter((s) => !s.active || Boolean(s.revoked_at)).length,
      totalEpisodes: episodes.length,
      confirmedBillableUnits: billingEvents.length,
      totalBilledBrl: Number((billingEvents.length * 18.5).toFixed(2)),
      nonBilledUsageOperations: nonBilledOperations,
      connectedSourcesCount: sources.filter((s) => s.state === 'connected').length,
      totalSourcesCount: sources.length,
    },
  };
}
