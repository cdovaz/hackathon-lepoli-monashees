import { supabase } from '../lib/supabase';
import {
  UserProfile,
  ExamMeasurement,
  BiomarkerDefinition,
  WearableDailyReading,
  HeartRateSample,
  AnomalyAlert,
  Medication,
  ClinicalEvent,
  UploadedDocument,
  BiomarkerCategory,
  BiologicalSex,
} from '../types';
import {
  cleanCpf,
  findSyntheticPatientIdByCpf,
  SYNTHETIC_PATIENTS_CPFS,
} from '../lib/cpf';

/**
 * Utilitário de paginação que consome o Supabase em blocos de 1000 registros (.range),
 * garantindo cobertura integral além do limite padrão de 1000 linhas da API.
 */
async function fetchPaged<T>(
  queryBuilderFactory: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const results: T[] = [];

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await queryBuilderFactory(from, to);
    if (error) {
      console.warn('[supabaseRepo] Erro em paginação:', error.message);
      break;
    }
    if (!data || data.length === 0) {
      break;
    }
    results.push(...data);
    if (data.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  return results;
}

// ============================================================================
// MAPPERS (snake_case -> camelCase)
// ============================================================================

function mapPatient(row: any): UserProfile {
  return {
    id: row.id,
    name: row.name || 'Paciente Rivio',
    email: row.email || '',
    cpf: row.cpf || SYNTHETIC_PATIENTS_CPFS[row.id]?.formatted || undefined,
    age: Number(row.age) || 0,
    biologicalSex: (row.biological_sex as BiologicalSex) || 'Masculino',
    birthDate: row.birth_date || undefined,
    city: row.city || undefined,
    heightCm: row.height_cm ? Number(row.height_cm) : undefined,
    weightKg: row.weight_kg ? Number(row.weight_kg) : undefined,
    bloodType: row.blood_type || undefined,
    scenario: row.scenario || undefined,
    chronicConditions: Array.isArray(row.chronic_conditions) ? row.chronic_conditions : [],
    activeMedications: Array.isArray(row.active_medications) ? row.active_medications : [],
    avatarUrl: undefined,
  };
}

function mapBiomarkerDefinition(row: any): BiomarkerDefinition {
  return {
    id: row.id,
    canonicalName: row.canonical_name || row.id,
    category: (row.category as BiomarkerCategory) || 'Glicêmico',
    unit: row.unit || '',
    refMin: Number(row.ref_min) || 0,
    refMax: Number(row.ref_max) || 0,
    description: row.description || '',
  };
}

function mapExam(row: any): ExamMeasurement {
  return {
    id: row.id,
    date: row.date,
    labName: row.lab_name || 'Laboratório Integrado',
    biomarkerId: row.biomarker_id || '',
    canonicalName: row.canonical_name || row.biomarker_id || 'Biomarcador',
    value: Number(row.value),
    unit: row.unit || '',
    refMin: row.ref_min !== null && row.ref_min !== undefined ? Number(row.ref_min) : 0,
    refMax: row.ref_max !== null && row.ref_max !== undefined ? Number(row.ref_max) : 100,
    status: (row.status as 'normal' | 'attention' | 'critical') || 'normal',
    notes: row.notes || undefined,
    documentId: row.document_id || undefined,
  };
}

function mapWearableDaily(row: any): WearableDailyReading {
  return {
    date: row.date,
    restingHeartRate: row.resting_hr !== null && row.resting_hr !== undefined ? Number(row.resting_hr) : 0,
    maxHeartRate: row.max_hr !== null && row.max_hr !== undefined ? Number(row.max_hr) : 0,
    minHeartRate: row.min_hr !== null && row.min_hr !== undefined ? Number(row.min_hr) : 0,
    hrv: row.hrv !== null && row.hrv !== undefined ? Number(row.hrv) : 0,
    sleepHours: row.sleep_hours !== null && row.sleep_hours !== undefined ? Number(row.sleep_hours) : 0,
    deepSleepHours: row.deep_sleep_hours !== null && row.deep_sleep_hours !== undefined ? Number(row.deep_sleep_hours) : 0,
    remSleepHours: row.rem_sleep_hours !== null && row.rem_sleep_hours !== undefined ? Number(row.rem_sleep_hours) : 0,
    spo2: row.spo2 !== null && row.spo2 !== undefined ? Number(row.spo2) : 0,
    steps: row.steps !== null && row.steps !== undefined ? Number(row.steps) : 0,
  };
}

function mapHeartRateSample(row: any): HeartRateSample {
  return {
    id: row.id,
    patientId: row.patient_id,
    ts: row.ts,
    bpm: Number(row.bpm),
    activityContext: row.activity_context,
  };
}

function mapAlert(row: any): AnomalyAlert {
  return {
    id: row.id,
    timestamp: row.ts || new Date().toISOString(),
    title: row.title || 'Alerta Clínico',
    message: row.title || row.description || 'Alerta Clínico',
    description: row.description || '',
    context: row.clinical_context || row.description || '',
    severity: (row.severity as 'low' | 'medium' | 'high' | 'critical') || 'medium',
    metricType: (row.metric_type as any) || 'heart_rate',
    valueDetected: row.value_detected || '',
    baselineValue: row.baseline_value || '',
    clinicalContext: row.clinical_context || '',
    resolved: Boolean(row.resolved),
  };
}

function mapMedication(row: any): Medication {
  return {
    id: row.id,
    patientId: row.patient_id,
    name: row.name || 'Medicamento',
    dosage: row.dose || row.dosage || '',
    route: row.route,
    frequency: row.frequency,
    startDate: row.start_date || '',
    endDate: row.end_date || null,
    indication: row.indication || undefined,
    prescribedBy: row.prescribed_by || undefined,
  };
}

function mapClinicalEvent(row: any): ClinicalEvent {
  return {
    id: row.id,
    patientId: row.patient_id,
    date: row.date || '',
    eventType: row.event_type || row.type || 'evento',
    title: row.title || 'Evento Clínico',
    description: row.description || '',
    severity: row.severity,
    facility: row.facility,
  };
}

function mapDocument(row: any): UploadedDocument {
  return {
    id: row.id,
    name: row.name || 'Laudo Digital',
    uri: row.uri || '',
    size: row.size ? Number(row.size) : undefined,
    mimeType: row.mime_type || 'application/pdf',
    uploadedAt: row.uploaded_at ? new Date(row.uploaded_at).toLocaleDateString('pt-BR') : '',
    extractedCount: row.extracted_count ? Number(row.extracted_count) : 0,
    status: (row.status as any) || 'processed',
  };
}

// ============================================================================
// CONSULTAS REPOSITÓRIO (SELECT ONLY - RLS COMPLIANT)
// ============================================================================

export const supabaseRepo = {
  /**
   * Lista todos os pacientes sintéticos da tabela rivio_patients
   */
  async listPatients(): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from('rivio_patients')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.warn('[supabaseRepo.listPatients] Erro:', error.message);
      return [];
    }

    return (data || []).map(mapPatient);
  },

  /**
   * Obtém os dados completos de um paciente pelo ID
   */
  async getPatient(id: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('rivio_patients')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      console.warn('[supabaseRepo.getPatient] Erro ao buscar paciente:', id, error?.message);
      return null;
    }

    return mapPatient(data);
  },

  /**
   * Obtém os dados de um paciente pelo CPF (indexador principal)
   */
  async getPatientByCpf(cpfInput: string): Promise<UserProfile | null> {
    const syntheticId = findSyntheticPatientIdByCpf(cpfInput);
    if (syntheticId) {
      return this.getPatient(syntheticId);
    }
    const clean = cleanCpf(cpfInput);
    if (!clean) return null;

    try {
      const { data } = await supabase
        .from('rivio_patients')
        .select('*')
        .or(`id.eq.usr-${clean},id.eq.${clean}`)
        .maybeSingle();

      if (data) {
        return mapPatient(data);
      }
    } catch {
      // Ignora erro de query
    }

    return null;
  },

  /**
   * Obtém a série temporal completa de exames do paciente (paginada por range de 1000)
   */
  async getExams(id: string): Promise<ExamMeasurement[]> {
    const rows = await fetchPaged<any>((from, to) =>
      Promise.resolve(
        supabase
          .from('rivio_exams')
          .select('*')
          .eq('patient_id', id)
          .order('date', { ascending: false })
          .range(from, to)
      )
    );

    return rows.map(mapExam);
  },

  /**
   * Carrega o dicionário completo de definições de biomarcadores
   */
  async getBiomarkerDefinitions(): Promise<Record<string, BiomarkerDefinition>> {
    const { data, error } = await supabase
      .from('rivio_biomarker_definitions')
      .select('*')
      .order('canonical_name', { ascending: true });

    if (error || !data) {
      console.warn('[supabaseRepo.getBiomarkerDefinitions] Erro:', error?.message);
      return {};
    }

    const dict: Record<string, BiomarkerDefinition> = {};
    for (const row of data) {
      dict[row.id] = mapBiomarkerDefinition(row);
    }
    return dict;
  },

  /**
   * Obtém a série diária de wearables (Apple Watch) com suporte a paginação e filtro por dias
   */
  async getWearables(id: string, days?: number): Promise<WearableDailyReading[]> {
    let query = supabase
      .from('rivio_wearable_daily')
      .select('*')
      .eq('patient_id', id)
      .order('date', { ascending: true });

    if (days && days > 0) {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);
      const isoSince = sinceDate.toISOString().split('T')[0];
      query = query.gte('date', isoSince);
    }

    const rows = await fetchPaged<any>((from, to) => Promise.resolve(query.range(from, to)));
    return rows.map(mapWearableDaily);
  },

  /**
   * Obtém amostras de frequência cardíaca horária do paciente
   */
  async getHeartRateSamples(id: string, days = 60): Promise<HeartRateSample[]> {
    let query = supabase
      .from('rivio_heart_rate_samples')
      .select('*')
      .eq('patient_id', id)
      .order('ts', { ascending: true });

    if (days && days > 0) {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);
      query = query.gte('ts', sinceDate.toISOString());
    }

    const rows = await fetchPaged<any>((from, to) => Promise.resolve(query.range(from, to)));
    return rows.map(mapHeartRateSample);
  },

  /**
   * Obtém os alertas clínicos detectados para o paciente
   */
  async getAlerts(id: string): Promise<AnomalyAlert[]> {
    const { data, error } = await supabase
      .from('rivio_alerts')
      .select('*')
      .eq('patient_id', id)
      .order('ts', { ascending: false });

    if (error || !data) {
      console.warn('[supabaseRepo.getAlerts] Erro:', error?.message);
      return [];
    }

    return data.map(mapAlert);
  },

  /**
   * Obtém o histórico e prescrições ativas de medicações do paciente
   */
  async getMedications(id: string): Promise<Medication[]> {
    const { data, error } = await supabase
      .from('rivio_medications')
      .select('*')
      .eq('patient_id', id)
      .order('start_date', { ascending: false });

    if (error || !data) {
      console.warn('[supabaseRepo.getMedications] Erro:', error?.message);
      return [];
    }

    return data.map(mapMedication);
  },

  /**
   * Obtém eventos clínicos (internações, sintomas, consultas, diagnósticos)
   */
  async getEvents(id: string): Promise<ClinicalEvent[]> {
    const { data, error } = await supabase
      .from('rivio_clinical_events')
      .select('*')
      .eq('patient_id', id)
      .order('date', { ascending: false });

    if (error || !data) {
      console.warn('[supabaseRepo.getEvents] Erro:', error?.message);
      return [];
    }

    return data.map(mapClinicalEvent);
  },

  /**
   * Obtém os laudos e documentos digitalizados do paciente
   */
  async getDocuments(id: string): Promise<UploadedDocument[]> {
    const { data, error } = await supabase
      .from('rivio_documents')
      .select('*')
      .eq('patient_id', id)
      .order('uploaded_at', { ascending: false });

    if (error || !data) {
      console.warn('[supabaseRepo.getDocuments] Erro:', error?.message);
      return [];
    }

    return data.map(mapDocument);
  },
};
