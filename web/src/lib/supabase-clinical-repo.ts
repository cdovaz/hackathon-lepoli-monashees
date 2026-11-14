import { supabase, isSupabaseConfigured } from './supabase';
import type { Snapshot, Evidence, EvidenceRef, Schemas } from './api/types';
import { createFixture, DEMO_TIME } from './demo/fixture';
import { ClinicalDataProcessor } from './clinical/processor';
import { HypothesisEngine } from './clinical/hypothesis-engine';

export interface PatientRecord {
  id: string;
  display_name: string;
  age: number;
  biological_sex: string;
  blood_type: string;
  allergies: string[];
  chronic_conditions: string[];
}

export interface LabMeasurementRecord {
  id: string;
  patient_id: string;
  biomarker_id: string;
  occurred_on: string;
  value: number;
  unit: string;
  ref_min: number | null;
  ref_max: number | null;
  status: 'normal' | 'attention' | 'critical' | 'unknown';
  notes?: string;
  biomarker?: { canonical_name: string };
  source_id?: string;
  document_id?: string;
}

export interface ClinicalGraphNodeRecord {
  id: string;
  kind: string;
  label: string;
  properties: Record<string, unknown>;
}

export interface ClinicalGraphEdgeRecord {
  id: string;
  source_node_id: string;
  target_node_id: string;
  relationship: string;
  label: string;
  basis: string;
  properties: Record<string, unknown>;
}

export const supabaseClinicalRepo = {
  /**
   * Busca o perfil do paciente no Supabase
   */
  async getPatient(patientId = 'usr-dan-2026'): Promise<PatientRecord | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .maybeSingle();

      if (error || !data) return null;
      return data as PatientRecord;
    } catch {
      return null;
    }
  },

  /**
   * Recupera a série temporal de exames laboratoriais do paciente
   */
  async getLabMeasurements(patientId = 'usr-dan-2026'): Promise<LabMeasurementRecord[]> {
    if (!isSupabaseConfigured) return [];
    try {
      const { data, error } = await supabase
        .from('lab_measurements')
        .select('*, biomarker:biomarkers(canonical_name)')
        .eq('patient_id', patientId)
        .order('occurred_on', { ascending: true });

      if (error || !data) return [];
      return data as LabMeasurementRecord[];
    } catch {
      return [];
    }
  },

  /**
   * Recupera o Grafo de Conhecimento Clínico (Nós e Arestas)
   */
  async getClinicalGraph(patientId = 'usr-dan-2026'): Promise<{
    nodes: ClinicalGraphNodeRecord[];
    edges: ClinicalGraphEdgeRecord[];
  }> {
    try {
      const [nodesRes, edgesRes] = await Promise.all([
        supabase.from('clinical_graph_nodes').select('*').eq('patient_id', patientId),
        supabase.from('clinical_graph_edges').select('*').eq('patient_id', patientId),
      ]);

      return {
        nodes: (nodesRes.data || []) as ClinicalGraphNodeRecord[],
        edges: (edgesRes.data || []) as ClinicalGraphEdgeRecord[],
      };
    } catch {
      return { nodes: [], edges: [] };
    }
  },

  /**
   * Valida o token alfanumérico de 6 dígitos gerado pelo paciente
   * Verifica expiração (TTL de 15 minutos), revogação ativa e integridade do consentimento
   */
  async resolveDoctorToken(token: string) {
    if (!isSupabaseConfigured) return null;
    const cleanToken = token.trim().toUpperCase();

    const { data, error } = await supabase
      .from('doctor_access_sessions')
      .select('*, patient:patients(*)')
      .eq('token', cleanToken)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      throw new Error(
        `Token "${cleanToken}" não encontrado no banco de dados. Verifique o código de 6 dígitos gerado no aplicativo do paciente.`
      );
    }

    if (!data.active || data.revoked_at) {
      throw new Error(
        `Acesso revogado: O paciente revogou este token no aplicativo móvel em ${new Date(data.revoked_at || data.created_at).toLocaleTimeString('pt-BR')}.`
      );
    }

    const expiresTime = new Date(data.expires_at).getTime();
    if (expiresTime < Date.now()) {
      throw new Error(
        `Token expirado: A validade de 15 minutos foi atingida às ${new Date(data.expires_at).toLocaleTimeString('pt-BR')}. Solicite ao paciente que gere um novo código.`
      );
    }

    return data;
  },

  /**
   * Constrói ou enriquece o Snapshot do paciente diretamente com os dados do Supabase
   * Executa processamento de dados e motor de hipóteses em tempo real
   */
  async fetchSupabaseSnapshot(patientId = 'usr-dan-2026'): Promise<Snapshot | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const [patient, measurements, graphData, alertsRes, wearablesRes, sourcesRes, docsRes] = await Promise.all([
        this.getPatient(patientId),
        this.getLabMeasurements(patientId),
        this.getClinicalGraph(patientId),
        supabase.from('clinical_alerts').select('*').eq('patient_id', patientId),
        supabase.from('wearable_time_series').select('*').eq('patient_id', patientId).order('recorded_at', { ascending: true }),
        supabase.from('data_sources').select('*'),
        supabase.from('clinical_documents').select('*').eq('patient_id', patientId).order('occurred_on', { ascending: false }),
      ]);

      // Se não há dados do paciente no Supabase, usa fallback seguro
      if (!patient && measurements.length === 0) {
        return null;
      }

      // Base com fallback para estrutura padrão
      const baseSnapshot = createFixture('active-initial');

      // 1. Atualiza dados do paciente
      if (patient) {
        baseSnapshot.patient.displayName = patient.display_name;
        baseSnapshot.patient.age = patient.age;
        baseSnapshot.patient.biologicalSex = (patient.biological_sex === 'Masculino' || patient.biological_sex === 'Feminino' ? patient.biological_sex : 'Não informado') as Snapshot['patient']['biologicalSex'];
      }

      // 2. Converte medições laboratoriais e wearables do Supabase para evidence do Snapshot
      const newEvidence: Evidence[] = [];

      if (measurements.length > 0) {
        const labEvidence: Evidence[] = measurements.map((m) => ({
          id: m.id,
          version: '1',
          kind: 'lab_result',
          label: m.biomarker?.canonical_name || m.biomarker_id,
          occurredOn: m.occurred_on,
          occurredAt: null,
          ingestedAt: DEMO_TIME,
          sourceId: m.source_id || 'src-fleury',
          documentId: m.document_id || `doc-${m.occurred_on}`,
          provenance: 'extracted',
          value: Number(m.value),
          unit: m.unit,
          referenceRange: {
            min: m.ref_min !== null ? Number(m.ref_min) : null,
            max: m.ref_max !== null ? Number(m.ref_max) : null,
            text: null,
          },
          text: null,
          status: m.status as Evidence['status'],
          supersedes: null,
        }));
        newEvidence.push(...labEvidence);

        // Reagrupa por biomarcador
        const distinctBiomarkers = Array.from(new Set(measurements.map((m) => m.biomarker_id)));
        baseSnapshot.exams.items = distinctBiomarkers.map((bioId) => {
          const sample = measurements.find((m) => m.biomarker_id === bioId)!;
          return {
            id: bioId,
            label: sample.biomarker?.canonical_name || bioId,
            canonicalUnit: sample.unit,
            measurementRefs: labEvidence
              .filter((e) => measurements.some((m) => m.id === e.id && m.biomarker_id === bioId))
              .map((e): EvidenceRef => ({ id: e.id, version: e.version })),
          };
        });
        baseSnapshot.exams.state = 'available';
      }

      // 3. Adiciona sinais de wearables do Supabase como evidências contínuas
      if (wearablesRes.data && wearablesRes.data.length > 0) {
        const wearableEvidence: Evidence[] = (wearablesRes.data as Array<Record<string, unknown>>).map((w) => ({
          id: `wea-${String(w.id)}`,
          version: '1',
          kind: 'wearable_event',
          label:
            w.metric_type === 'heart_rate'
              ? 'Frequência Cardíaca'
              : w.metric_type === 'hrv'
              ? 'Variabilidade Cardíaca (HRV)'
              : 'Sono Profundo',
          occurredOn: String(w.recorded_at).split('T')[0],
          occurredAt: String(w.recorded_at),
          ingestedAt: DEMO_TIME,
          sourceId: String(w.source_id || 'src-apple-watch'),
          documentId: null,
          provenance: 'extracted',
          value: Number(w.value),
          unit: w.unit ? String(w.unit) : null,
          referenceRange: null,
          text: null,
          status: (w.metadata as Record<string, unknown> | null)?.anomaly ? 'critical' : 'normal',
          supersedes: null,
        }));
        newEvidence.push(...wearableEvidence);
      }

      if (newEvidence.length > 0) {
        baseSnapshot.evidence = newEvidence;
      }

      // ======================================================================
      // 4. Executa Processamento Clínico Longitudinal e Motor de Hipóteses
      // ======================================================================
      const trajectories = ClinicalDataProcessor.processLabTrajectories(measurements);
      const wearableAnalysis = ClinicalDataProcessor.processWearables(wearablesRes.data || []);
      const hypotheses = HypothesisEngine.generateHypotheses({
        patientId,
        patientName: patient?.display_name,
        trajectories,
        wearables: wearableAnalysis,
        symptoms: patient?.chronic_conditions || ['Hipotireoidismo Subclínico'],
        medications: ['Levotiroxina 50mcg'],
      });

      // Dispara persistência assíncrona das hipóteses geradas no Supabase
      void HypothesisEngine.persistHypothesesToDatabase(patientId, hypotheses);

      // 5. Atualiza Nós e Arestas do Grafo Clínico do Supabase (com hipóteses integradas)
      const graphNodes = [...graphData.nodes];
      const graphEdges = [...graphData.edges];

      // Adiciona nós das hipóteses geradas
      for (const hyp of hypotheses) {
        for (const n of hyp.graphNodes) {
          if (!graphNodes.some((existing) => existing.id === n.id)) {
            graphNodes.push({
              id: n.id,
              kind: n.kind,
              label: n.label,
              properties: n.properties,
            });
          }
        }
        for (const e of hyp.graphEdges) {
          if (!graphEdges.some((existing) => existing.id === e.id)) {
            graphEdges.push({
              id: e.id,
              source_node_id: e.sourceNodeId,
              target_node_id: e.targetNodeId,
              relationship: e.relationship,
              label: e.label,
              basis: e.basis,
              properties: { confidence: e.confidence },
            });
          }
        }
      }

      if (graphNodes.length > 0) {
        baseSnapshot.graph.nodes = graphNodes.map((n) => ({
          id: n.id,
          kind: n.kind as Snapshot['graph']['nodes'][number]['kind'],
          label: n.label,
          evidenceRefs: [],
        }));

        baseSnapshot.graph.edges = graphEdges.map((e) => ({
          id: e.id,
          source: e.source_node_id,
          target: e.target_node_id,
          label: e.label,
          basis: (e.basis || 'clinical_inference') as Snapshot['graph']['edges'][number]['basis'],
          evidenceRefs: [],
        }));
        baseSnapshot.graph.state = 'available';
      }

      // 6. Atualiza Achados do Briefing Clínico de 30s com as Hipóteses Dinâmicas
      const briefingFindings = hypotheses.map((hyp) => {
        // Encontra evidências correspondentes já presentes no Snapshot
        const matchedEvidenceRefs: EvidenceRef[] = newEvidence
          .filter((ev) => hyp.evidenceIds.some((eid) => ev.id.includes(eid) || eid.includes(ev.id)))
          .slice(0, 3)
          .map((ev) => ({ id: ev.id, version: ev.version }));

        return {
          id: hyp.id,
          title: hyp.title,
          text: hyp.clinicalRationale,
          basis: hyp.basis as Snapshot['briefing']['items'][number]['basis'],
          evidenceRefs: matchedEvidenceRefs,
        };
      });

      // Se houver alertas pré-existentes adicionais que não foram cobertos, acrescenta
      if (alertsRes.data && alertsRes.data.length > 0) {
        for (const alt of alertsRes.data) {
          if (!briefingFindings.some((b) => b.id === alt.id)) {
            briefingFindings.push({
              id: alt.id,
              title: alt.title,
              text: alt.clinical_hypothesis || alt.description,
              basis: 'recorded_fact',
              evidenceRefs: [],
            });
          }
        }
      }

      if (briefingFindings.length > 0) {
        baseSnapshot.briefing.items = briefingFindings;
        baseSnapshot.briefing.state = 'available';
      }

      // 7. Atualiza Fontes Conectadas do Supabase
      if (sourcesRes.data && sourcesRes.data.length > 0) {
        baseSnapshot.sources = (sourcesRes.data as Array<Record<string, unknown>>).map((s) => ({
          id: String(s.id),
          label: String(s.label),
          kind: (s.kind === 'laboratory' || s.kind === 'wearable' || s.kind === 'patient' ? s.kind : 'laboratory') as Schemas['Source']['kind'],
          state: (s.state === 'connected' ? 'current' : s.state === 'stale' ? 'stale' : 'current') as Schemas['Source']['state'],
          lastSyncedAt: String(s.last_synced_at || DEMO_TIME),
          lastEventDate: s.coverage_to ? String(s.coverage_to) : null,
          coverage: {
            from: String(s.coverage_from || '2022-03-15'),
            to: String(s.coverage_to || '2026-11-11'),
            truncated: false,
          },
        }));
      }

      // 8. Atualiza Lista de Documentos Ingeridos
      if (docsRes.data && docsRes.data.length > 0) {
        baseSnapshot.documents.items = (docsRes.data as Array<Record<string, unknown>>).map((doc) => ({
          id: String(doc.id),
          title: String(doc.title),
          sourceId: String(doc.source_id || 'src-fleury'),
          occurredOn: String(doc.occurred_on),
          receivedAt: String(doc.received_at || DEMO_TIME),
          mimeType: (doc.mime_type === 'image/jpeg' || doc.mime_type === 'image/png' ? doc.mime_type : 'application/pdf') as Snapshot['documents']['items'][number]['mimeType'],
          originalAvailable: true,
          evidenceRefs: [],
        }));
        baseSnapshot.documents.state = 'available';
      }

      return baseSnapshot;
    } catch (err) {
      console.warn('[Supabase Clinical Repo] Erro ao carregar snapshot real:', err);
      return null;
    }
  },
};
