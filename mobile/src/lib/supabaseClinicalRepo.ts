import { supabase, isSupabaseConfigured } from './supabase';
import {
  UserProfile,
  ExamMeasurement,
  UploadedDocument,
  WearableDailyReading,
  AnomalyAlert,
  DoctorAccessSession,
  BiomarkerDefinition,
} from '../types';
import {
  cleanCpf,
  formatCpf,
  isValidCpf,
  findSyntheticPatientIdByCpf,
  SYNTHETIC_PATIENTS_CPFS,
} from './cpf';
import { supabaseRepo } from '../data/supabaseRepo';

export const supabaseClinicalRepo = {
  /**
   * Autentica o paciente via CPF (indexador principal) ou E-mail e Senha
   */
  async signInPatient(
    identifier: string,
    pass: string
  ): Promise<{ user: UserProfile; error?: string } | { user: null; error: string }> {
    const raw = identifier.trim();
    const clean = cleanCpf(raw);

    // 1. Verifica se o identificador digitado é o CPF de um dos pacientes sintéticos da Rivio
    const syntheticId = findSyntheticPatientIdByCpf(raw);
    if (syntheticId) {
      const patient = await supabaseRepo.getPatient(syntheticId);
      if (patient) {
        return { user: patient };
      }
    }

    // 2. Se o identificador for um CPF de 11 dígitos, busca pelo ID indexado no Supabase
    if (clean.length === 11) {
      const indexedPatientId = `usr-${clean}`;
      try {
        const patient = await supabaseRepo.getPatient(indexedPatientId);
        if (patient) {
          return { user: patient };
        }
      } catch {
        // Prossegue para busca em tabela patients
      }
    }

    if (!isSupabaseConfigured) {
      return {
        user: {
          id: clean.length === 11 ? `usr-${clean}` : 'usr-dan-2026',
          name: 'Daniel Vaz',
          cpf: clean.length === 11 ? formatCpf(clean) : '123.456.789-09',
          email: raw.includes('@') ? raw : `${clean || 'daniel'}@paciente.rivio.app`,
          age: 32,
          biologicalSex: 'Masculino',
          chronicConditions: ['Acompanhamento Preventivo'],
          activeMedications: [],
        },
      };
    }

    try {
      const cleanEmail = raw.toLowerCase();

      // 3. Tenta autenticação nativa do Supabase Auth se for email
      if (cleanEmail.includes('@') && pass) {
        try {
          const { error: authError } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: pass,
          });
          if (authError) {
            console.log('[Supabase Auth] Fallback para verificação em tabela patients:', authError.message);
          }
        } catch {
          // Prossegue
        }
      }

      // 4. Busca paciente na tabela patients correspondente (por id usr-cpf, id raw ou email)
      const orFilter = clean.length === 11
        ? `id.eq.usr-${clean},id.eq.${clean},email.eq.${cleanEmail}`
        : `email.eq.${cleanEmail},id.eq.usr-dan-2026`;

      const { data: patientData } = await supabase
        .from('patients')
        .select('*')
        .or(orFilter)
        .maybeSingle();

      if (patientData) {
        return {
          user: {
            id: patientData.id,
            name: patientData.display_name || 'Paciente Rivio',
            email: patientData.email || cleanEmail,
            cpf: clean.length === 11 ? formatCpf(clean) : undefined,
            age: patientData.age || 32,
            biologicalSex: (patientData.biological_sex as any) || 'Masculino',
            chronicConditions: patientData.chronic_conditions || ['Acompanhamento Preventivo'],
            activeMedications: [],
          },
        };
      }

      // 5. Se não encontrou, busca na tabela rivio_patients
      const { data: rivioData } = await supabase
        .from('rivio_patients')
        .select('*')
        .or(clean.length === 11 ? `id.eq.usr-${clean},id.eq.${clean}` : `email.eq.${cleanEmail}`)
        .maybeSingle();

      if (rivioData) {
        return {
          user: {
            id: rivioData.id,
            name: rivioData.name,
            email: rivioData.email || cleanEmail,
            cpf: clean.length === 11 ? formatCpf(clean) : undefined,
            age: rivioData.age || 30,
            biologicalSex: (rivioData.biological_sex as any) || 'Masculino',
            chronicConditions: rivioData.chronic_conditions || [],
            activeMedications: rivioData.active_medications || [],
          },
        };
      }

      return { user: null, error: 'Paciente não encontrado com o CPF informado.' };
    } catch (err: any) {
      return { user: null, error: err?.message || 'Falha ao conectar com o serviço de autenticação.' };
    }
  },

  /**
   * Cadastra novo paciente no Supabase com CPF como indexador principal
   */
  async signUpPatient(params: {
    name: string;
    cpf: string;
    email?: string;
    password?: string;
    age?: number;
    biologicalSex?: 'Masculino' | 'Feminino';
    city?: string;
  }): Promise<{ user: UserProfile; error?: string } | { user: null; error: string }> {
    const clean = cleanCpf(params.cpf);
    if (!clean || clean.length !== 11) {
      return { user: null, error: 'CPF deve conter exatamente 11 dígitos numéricos.' };
    }

    if (!isValidCpf(clean)) {
      return { user: null, error: 'CPF inválido. Verifique os dígitos verificadores informados.' };
    }

    // O CPF limpo é o indexador principal único do paciente
    const patientId = `usr-${clean}`;
    const formattedCpfValue = formatCpf(clean);
    const resolvedEmail = params.email?.trim().toLowerCase() || `${clean}@paciente.rivio.app`;

    const newUserProfile: UserProfile = {
      id: patientId,
      name: params.name.trim(),
      email: resolvedEmail,
      cpf: formattedCpfValue,
      age: params.age || 35,
      biologicalSex: params.biologicalSex || 'Masculino',
      city: params.city || 'São Paulo, SP',
      scenario: 'Novo Paciente Cadastrado • Prontuário Indexado por CPF',
      chronicConditions: [],
      activeMedications: [],
    };

    if (!isSupabaseConfigured) {
      return { user: newUserProfile };
    }

    try {
      // 1. Cria usuário diretamente no Supabase Auth nativo (na nuvem)
      try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: resolvedEmail,
          password: params.password && params.password.length >= 6 ? params.password : 'Rivio2026!',
          options: {
            data: {
              name: params.name.trim(),
              cpf: formattedCpfValue,
              patientId,
            },
          },
        });
        if (authError) {
          console.log('[signUpPatient] Supabase Auth status:', authError.message);
        } else if (authData?.user) {
          console.log('[signUpPatient] Usuário registrado no Supabase Auth:', authData.user.id);
        }
      } catch (authErr: any) {
        console.log('[signUpPatient] Supabase Auth aviso:', authErr?.message);
      }

      // 2. Persiste diretamente na tabela rivio_patients do Supabase
      const { data, error } = await supabase
        .from('rivio_patients')
        .insert({
          id: patientId,
          name: params.name.trim(),
          email: resolvedEmail,
          age: params.age || 35,
          biological_sex: params.biologicalSex || 'Masculino',
          city: params.city || 'São Paulo, SP',
          scenario: 'Novo Paciente Cadastrado • Indexado por CPF',
        })
        .select()
        .single();

      if (!error && data) {
        return {
          user: {
            id: data.id,
            name: data.name,
            email: data.email,
            cpf: formattedCpfValue,
            age: data.age || 35,
            biologicalSex: (data.biological_sex as any) || 'Masculino',
            chronicConditions: [],
            activeMedications: [],
          },
        };
      }

      if (error) {
        console.log('[signUpPatient] Tabela rivio_patients (política RLS):', error.message);
      }

      return { user: newUserProfile };
    } catch (err: any) {
      console.warn('[signUpPatient] Exceção na inserção Supabase:', err?.message);
      return { user: newUserProfile };
    }
  },

  /**
   * Encerra a sessão do paciente
   */
  async signOutPatient() {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignora erro de rede
      }
    }
  },

  /**
   * Busca os dados do paciente Daniel Vaz
   */
  async getPatientProfile(patientId = 'usr-dan-2026'): Promise<UserProfile | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.id,
        name: data.display_name || 'Daniel Vaz',
        email: data.email || 'daniel.vaz@exemplo.com.br',
        age: data.age || 32,
        biologicalSex: (data.biological_sex as 'Masculino' | 'Feminino') || 'Masculino',
        chronicConditions: data.chronic_conditions || ['Hipotireoidismo Subclínico'],
        activeMedications: ['Levotiroxina 50mcg'],
      };
    } catch {
      return null;
    }
  },

  /**
   * Busca a série histórica de exames laboratoriais
   */
  async getLabMeasurements(patientId = 'usr-dan-2026'): Promise<ExamMeasurement[] | null> {
    try {
      const { data, error } = await supabase
        .from('lab_measurements')
        .select('*, biomarker:biomarkers(canonical_name), source:data_sources(label)')
        .eq('patient_id', patientId)
        .order('occurred_on', { ascending: false });

      if (error || !data || data.length === 0) return null;

      return data.map((item: any) => ({
        id: item.id,
        date: item.occurred_on,
        labName: item.source?.label || 'Laboratório Integrado',
        biomarkerId: item.biomarker_id,
        canonicalName: item.biomarker?.canonical_name || item.biomarker_id,
        value: Number(item.value),
        unit: item.unit,
        refMin: Number(item.ref_min ?? 0),
        refMax: Number(item.ref_max ?? 100),
        status: (item.status as 'normal' | 'attention' | 'critical') || 'normal',
        notes: item.notes || undefined,
        documentId: item.document_id || undefined,
      }));
    } catch {
      return null;
    }
  },

  /**
   * Busca os documentos e laudos ingeridos
   */
  async getClinicalDocuments(patientId = 'usr-dan-2026'): Promise<UploadedDocument[] | null> {
    try {
      const { data, error } = await supabase
        .from('clinical_documents')
        .select('*')
        .eq('patient_id', patientId)
        .order('occurred_on', { ascending: false });

      if (error || !data || data.length === 0) return null;

      return data.map((doc: any) => ({
        id: doc.id,
        name: doc.title,
        uri: doc.storage_path || `file:///data/${doc.id}.pdf`,
        size: Number(doc.file_size_bytes || 350000),
        mimeType: doc.mime_type || 'application/pdf',
        uploadedAt: doc.occurred_on,
        extractedCount: Number(doc.extracted_count || 3),
        status: (doc.status === 'processed' ? 'processed' : 'processing') as 'processed' | 'processing' | 'error',
      }));
    } catch {
      return null;
    }
  },

  /**
   * Busca os alertas clínicos e anomalias
   */
  async getClinicalAlerts(patientId = 'usr-dan-2026'): Promise<AnomalyAlert[] | null> {
    try {
      const { data, error } = await supabase
        .from('clinical_alerts')
        .select('*')
        .eq('patient_id', patientId)
        .order('detected_at', { ascending: false });

      if (error || !data || data.length === 0) return null;

      return data.map((alt: any) => ({
        id: alt.id,
        timestamp: alt.detected_at,
        title: alt.title,
        description: alt.description,
        severity: (alt.severity === 'critical' ? 'high' : alt.severity === 'warning' ? 'medium' : 'low') as 'low' | 'medium' | 'high',
        metricType: (alt.category === 'wearable_anomaly' ? 'heart_rate' : 'hrv') as 'heart_rate' | 'hrv' | 'sleep' | 'spo2',
        valueDetected: 'Detectado no histórico',
        baselineValue: 'Padrão basal',
        clinicalContext: alt.clinical_hypothesis || '',
        resolved: Boolean(alt.resolved),
      }));
    } catch {
      return null;
    }
  },

  /**
   * Busca as séries temporais de wearables do Supabase (tabela wearable_time_series)
   */
  async getWearables(patientId = 'usr-dan-2026'): Promise<WearableDailyReading[] | null> {
    try {
      const { data, error } = await supabase
        .from('wearable_time_series')
        .select('*')
        .eq('patient_id', patientId)
        .order('recorded_at', { ascending: true });

      if (error || !data || data.length === 0) return null;

      const byDay: Record<string, { hr: number[]; hrv: number[]; sleepDeep: number; sleepScore: number }> = {};
      for (const item of data) {
        const day = item.recorded_at.split('T')[0];
        if (!byDay[day]) {
          byDay[day] = { hr: [], hrv: [], sleepDeep: 85, sleepScore: 80 };
        }
        if (item.metric_type === 'heart_rate') {
          byDay[day].hr.push(Number(item.value));
        } else if (item.metric_type === 'hrv') {
          byDay[day].hrv.push(Number(item.value));
        } else if (item.metric_type === 'sleep_deep') {
          byDay[day].sleepDeep = Number(item.value);
        } else if (item.metric_type === 'sleep_score') {
          byDay[day].sleepScore = Number(item.value);
        }
      }

      const days = Object.keys(byDay).sort();
      return days.map((day) => {
        const d = byDay[day];
        const restingHr = d.hr.length ? Math.round(d.hr.reduce((a, b) => a + b, 0) / d.hr.length) : 64;
        const maxHr = d.hr.length ? Math.max(...d.hr) : 95;
        const hrv = d.hrv.length ? Math.round(d.hrv[d.hrv.length - 1]) : 58;
        const deepH = Number((d.sleepDeep / 60).toFixed(1));
        const totalH = Number((7.0 + (d.sleepScore > 75 ? 0.4 : -1.8)).toFixed(1));
        const remH = Number((totalH * 0.22).toFixed(1));

        return {
          date: day,
          restingHeartRate: restingHr,
          maxHeartRate: maxHr,
          minHeartRate: Math.max(48, restingHr - 8),
          hrv,
          sleepHours: totalH,
          deepSleepHours: deepH,
          remSleepHours: remH,
          steps: 8400,
          spo2: 98,
        };
      });
    } catch {
      return null;
    }
  },

  /**
   * Busca o dicionário de biomarcadores da tabela biomarkers
   */
  async getBiomarkers(): Promise<Record<string, BiomarkerDefinition> | null> {
    try {
      const { data, error } = await supabase.from('biomarkers').select('*');
      if (error || !data || data.length === 0) return null;

      const dict: Record<string, BiomarkerDefinition> = {};
      for (const b of data) {
        dict[b.id] = {
          id: b.id,
          canonicalName: b.canonical_name,
          category: (b.category === 'Lipídios' ? 'Lipídico' : b.category === 'Tireoide' ? 'Hormonal' : b.category === 'Hematologia' ? 'Hematológico' : 'Glicêmico') as any,
          unit: b.canonical_unit,
          refMin: Number(b.standard_ref_min ?? 0),
          refMax: Number(b.standard_ref_max ?? 100),
          description: b.description || '',
        };
      }
      return dict;
    } catch {
      return null;
    }
  },

  /**
   * Busca a sessão ativa do token médico
   */
  async getActiveDoctorSession(patientId = 'usr-dan-2026'): Promise<DoctorAccessSession | null> {
    try {
      const { data, error } = await supabase
        .from('doctor_access_sessions')
        .select('*')
        .eq('patient_id', patientId)
        .eq('active', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.id,
        token: data.token,
        createdAt: data.created_at,
        expiresAt: data.expires_at,
        accessUrl: data.access_url || `https://lepoli-health.app/doctor/consultation/${data.token}`,
        active: Boolean(data.active),
        scope: data.scope || ['read_exams', 'read_wearables', 'read_graphrag_briefing'],
      };
    } catch {
      return null;
    }
  },

  /**
   * Salva uma nova sessão de token no Supabase
   */
  async registerDoctorSession(params: {
    patientId: string;
    token: string;
    expiresAt: string;
    scope?: string[];
  }) {
    try {
      const { data, error } = await supabase
        .from('doctor_access_sessions')
        .upsert({
          id: `sess-${Date.now()}`,
          patient_id: params.patientId,
          token: params.token.toUpperCase(),
          active: true,
          scope: params.scope || ['read_exams', 'read_wearables', 'read_graphrag_briefing'],
          expires_at: params.expiresAt,
          access_url: `https://lepoli-health.app/doctor/consultation/${params.token.toUpperCase()}`,
        })
        .select()
        .single();

      if (error) {
        console.warn('[Supabase Mobile] Falha ao registrar sessão:', error.message);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  },

  /**
   * Revoga a sessão de acesso médico imediatamente (Open Health / LGPD)
   */
  async revokeDoctorSession(sessionId?: string, patientId = 'usr-dan-2026') {
    try {
      let query = supabase
        .from('doctor_access_sessions')
        .update({
          active: false,
          revoked_at: new Date().toISOString(),
        })
        .eq('patient_id', patientId);

      if (sessionId) {
        query = query.eq('id', sessionId);
      }

      const { error } = await query;
      if (error) {
        console.warn('[Supabase Mobile] Falha ao revogar sessão:', error.message);
      }
    } catch {
      // Ignora erro em modo offline
    }
  },

  /**
   * Recupera a trilha de auditoria completa de acessos de médicos ao prontuário
   */
  async getDoctorAccessAudit(patientId = 'usr-dan-2026') {
    try {
      const { data, error } = await supabase
        .from('doctor_access_sessions')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error || !data) return [];
      return data;
    } catch {
      return [];
    }
  },

  /**
   * Salva um documento/laudo clínico no Supabase
   */
  async saveClinicalDocument(doc: {
    id: string;
    title: string;
    occurredOn: string;
    mimeType: string;
    storagePath?: string;
    fileSizeBytes?: number;
    extractedCount: number;
    patientId?: string;
  }) {
    try {
      const { error } = await supabase.from('clinical_documents').insert({
        id: doc.id,
        patient_id: doc.patientId || 'usr-dan-2026',
        source_id: 'src-fleury',
        title: doc.title,
        occurred_on: doc.occurredOn,
        mime_type: doc.mimeType,
        storage_path: doc.storagePath || `documents/usr-dan-2026/${doc.id}`,
        file_size_bytes: doc.fileSizeBytes || 350000,
        status: 'processed',
        extracted_count: doc.extractedCount,
      });
      if (error) console.warn('[Supabase Mobile] Erro ao salvar documento:', error.message);
    } catch {
      // Ignora erro em modo offline
    }
  },

  /**
   * Insere um exame extraído no Supabase
   */
  async insertLabMeasurement(exam: ExamMeasurement, patientId = 'usr-dan-2026') {
    try {
      const { error } = await supabase.from('lab_measurements').insert({
        id: exam.id,
        patient_id: patientId,
        biomarker_id: exam.biomarkerId,
        document_id: exam.documentId || null,
        occurred_on: exam.date,
        value: exam.value,
        unit: exam.unit,
        ref_min: exam.refMin,
        ref_max: exam.refMax,
        status: exam.status,
        notes: exam.notes || null,
      });
      if (error) {
        console.warn('[Supabase Mobile] Falha ao inserir exame:', error.message);
      }
    } catch {
      // Ignora erro de rede silenciosamente mantendo local
    }
  },

  /**
   * Persiste anomalia de wearable (taquicardia 114 BPM) e alerta clínico no Supabase
   * Dispara broadcast automático via Supabase Realtime para o Cockpit do Médico
   */
  async insertWearableAnomaly(params?: {
    patientId?: string;
    heartRate?: number;
    title?: string;
    description?: string;
    hypothesis?: string;
  }) {
    const pId = params?.patientId || 'usr-dan-2026';
    const bpm = params?.heartRate || 114;
    const now = new Date().toISOString();

    try {
      // 1. Grava na série temporal de wearables
      await supabase.from('wearable_time_series').insert({
        patient_id: pId,
        source_id: 'src-apple-watch',
        source_device: 'Apple Watch Ultra 2',
        metric_type: 'heart_rate',
        value: bpm,
        unit: 'bpm',
        recorded_at: now,
        metadata: {
          context: 'sleep_spike',
          anomaly: true,
          trigger: 'mobile_live_simulation',
        },
      });

      // 2. Grava o alerta clínico
      const alertId = `alert-tachy-${Date.now()}`;
      await supabase.from('clinical_alerts').insert({
        id: alertId,
        patient_id: pId,
        title: params?.title || 'Taquicardia em Repouso durante o Sono',
        category: 'wearable_anomaly',
        severity: 'critical',
        description:
          params?.description ||
          `Frequência cardíaca disparou para ${bpm} bpm durante o sono com queda de 62% no HRV.`,
        clinical_hypothesis:
          params?.hypothesis ||
          'Taquicardia reflexa noturna potencialmente associada à depleção de Ferritina (22 ng/mL).',
        detected_at: now,
        evidence_refs: [{ id: 'src-apple-watch', type: 'heart_rate', value: bpm }],
        resolved: false,
      });
    } catch {
      // Ignora erro de rede
    }
  },
};
