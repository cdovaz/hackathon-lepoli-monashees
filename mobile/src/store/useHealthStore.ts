import { create } from 'zustand';
import {
  AnomalyAlert,
  BiomarkerDefinition,
  ChatMessage,
  DoctorAccessSession,
  ExamMeasurement,
  UploadedDocument,
  UserProfile,
  WearableDailyReading,
  HeartRateSample,
  Medication,
  ClinicalEvent,
} from '../types';
import {
  BIOMARKER_DEFINITIONS,
  generateBaselineWearables,
  INITIAL_EXAMS,
  INITIAL_USER,
} from '../data/seedData';
import { supabaseRepo } from '../data/supabaseRepo';
import { supabaseClinicalRepo } from '../lib/supabaseClinicalRepo';
import {
  cleanCpf,
  formatCpf,
  isValidCpf,
  SYNTHETIC_PATIENTS_CPFS,
} from '../lib/cpf';

const DEFAULT_PATIENTS: UserProfile[] = [
  {
    id: 'usr-marcos-2026',
    name: 'Marcos Oliveira',
    email: 'marcos.oliveira@exemplo.com',
    cpf: '123.456.789-09',
    age: 58,
    biologicalSex: 'Masculino',
    city: 'São Paulo/SP',
    scenario: 'Diabetes Tipo 2 — em tratamento com Metformina e Dapagliflozina, queda de HbA1c de 8,9% para 6,7%',
    chronicConditions: ['Diabetes Mellitus Tipo 2', 'Hipertensão Arterial'],
    activeMedications: ['Metformina 850mg', 'Dapagliflozina 10mg', 'Atorvastatina 20mg'],
  },
  {
    id: 'usr-camila-2026',
    name: 'Camila Santos',
    email: 'camila.santos@exemplo.com',
    cpf: '234.567.890-92',
    age: 29,
    biologicalSex: 'Feminino',
    city: 'Curitiba/PR',
    scenario: 'Saudável — rotina preventiva, biomarcadores na meta, sem alertas clínicos',
    chronicConditions: [],
    activeMedications: ['Vitamina D 2.000 UI'],
  },
  {
    id: 'usr-antonio-2026',
    name: 'Antônio Silva',
    email: 'antonio.silva@exemplo.com',
    cpf: '345.678.901-75',
    age: 47,
    biologicalSex: 'Masculino',
    city: 'Sobral/CE',
    scenario: 'Leishmaniose Visceral — pancitopenia (leucócitos 2.100, plaquetas 48k), ferritina 2.100 ng/mL, recuperado pós-terapia',
    chronicConditions: ['Leishmaniose Visceral (convalescente)'],
    activeMedications: [],
  },
  {
    id: 'usr-rafael-2026',
    name: 'Rafael Costa',
    email: 'rafael.costa@exemplo.com',
    cpf: '456.789.012-49',
    age: 35,
    biologicalSex: 'Masculino',
    city: 'Florianópolis/SC',
    scenario: 'Influenza H1N1 — episódio agudo com queda de SpO₂ (93%) e taquicardia em out/2026, tratado com Oseltamivir',
    chronicConditions: ['Asma intermitente leve'],
    activeMedications: ['Oseltamivir 75mg (ciclo concluído)'],
  },
];

interface HealthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  user: UserProfile;
  availablePatients: UserProfile[];
  biomarkers: Record<string, BiomarkerDefinition>;
  exams: ExamMeasurement[];
  uploadedDocuments: UploadedDocument[];
  wearables: WearableDailyReading[];
  heartRateSamples: HeartRateSample[];
  activeAlerts: AnomalyAlert[];
  medications: Medication[];
  clinicalEvents: ClinicalEvent[];
  chatMessages: ChatMessage[];
  doctorSession: DoctorAccessSession | null;
  isSimulatedAnomalyActive: boolean;

  // Actions
  loadAvailablePatients: () => Promise<void>;
  selectPatient: (patientId: string) => Promise<void>;
  login: (identifier: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  register: (
    nameOrParams:
      | string
      | {
          name: string;
          cpf: string;
          email?: string;
          pass?: string;
          password?: string;
          age?: number;
          biologicalSex?: 'Masculino' | 'Feminino';
          city?: string;
        },
    cpf?: string,
    email?: string,
    pass?: string
  ) => Promise<{ success: boolean; error?: string }>;
  loginDemo: () => void;
  logout: () => void;
  addExamMeasurement: (exam: Omit<ExamMeasurement, 'id'>) => void;
  removeExam: (id: string) => void;
  processExamDocumentMock: (docName: string) => Promise<ExamMeasurement[]>;
  registerUploadedDocument: (file: {
    name: string;
    uri: string;
    size?: number;
    mimeType?: string;
  }) => Promise<ExamMeasurement[]>;
  deleteUploadedDocument: (id: string) => void;
  injectWearableAnomalyScenario: () => void;
  resetWearableScenario: () => void;
  sendChatMessage: (userText: string) => Promise<void>;
  generateDoctorAccessSession: (customScope?: string[]) => DoctorAccessSession;
  revokeDoctorAccessSession: () => void;
  syncWithSupabase: (patientId?: string) => Promise<void>;
}

export const useHealthStore = create<HealthState>((set, get) => ({
  isAuthenticated: false, // Inicia na AuthScreen para permitir seleção imediata dos 4 pacientes
  isLoading: false,
  error: null,
  user: DEFAULT_PATIENTS[0],
  availablePatients: DEFAULT_PATIENTS,
  biomarkers: BIOMARKER_DEFINITIONS,
  exams: INITIAL_EXAMS,
  uploadedDocuments: [
    {
      id: 'doc-fleury-2025',
      name: 'Laudo_Completo_Fleury_Out2025.pdf',
      uri: 'file:///data/Laudo_Completo_Fleury_Out2025.pdf',
      size: 482000,
      mimeType: 'application/pdf',
      uploadedAt: '18/10/2025',
      extractedCount: 3,
      status: 'processed',
    },
  ],
  wearables: generateBaselineWearables(),
  heartRateSamples: [],
  activeAlerts: [],
  medications: [],
  clinicalEvents: [],
  isSimulatedAnomalyActive: false,
  doctorSession: null,
  chatMessages: [
    {
      id: 'msg-0',
      sender: 'assistant',
      text: 'Olá! Sou seu assistente do Hub de Saúde Pessoal Rivio. Como posso ajudar com seu prontuário hoje?',
      timestamp: 'Hoje, 09:15',
    },
  ],

  loadAvailablePatients: async () => {
    try {
      const list = await supabaseRepo.listPatients();
      if (list && list.length > 0) {
        set({ availablePatients: list });
      }
    } catch (err) {
      console.warn('[useHealthStore] Erro ao carregar lista de pacientes:', err);
    }
  },

  selectPatient: async (patientId: string) => {
    set({ isLoading: true, error: null });
    try {
      const [
        patient,
        exams,
        biomarkers,
        wearables,
        heartRateSamples,
        alerts,
        medications,
        clinicalEvents,
        documents,
      ] = await Promise.all([
        supabaseRepo.getPatient(patientId),
        supabaseRepo.getExams(patientId),
        supabaseRepo.getBiomarkerDefinitions(),
        supabaseRepo.getWearables(patientId),
        supabaseRepo.getHeartRateSamples(patientId, 60),
        supabaseRepo.getAlerts(patientId),
        supabaseRepo.getMedications(patientId),
        supabaseRepo.getEvents(patientId),
        supabaseRepo.getDocuments(patientId),
      ]);

      const resolvedPatient = patient || DEFAULT_PATIENTS.find((p) => p.id === patientId) || get().user;

      set({
        isAuthenticated: true,
        isLoading: false,
        error: null,
        user: resolvedPatient,
        exams: exams && exams.length > 0 ? exams : get().exams,
        biomarkers: biomarkers && Object.keys(biomarkers).length > 0 ? biomarkers : get().biomarkers,
        wearables: wearables && wearables.length > 0 ? wearables : get().wearables,
        heartRateSamples: heartRateSamples || [],
        activeAlerts: alerts || [],
        medications: medications || [],
        clinicalEvents: clinicalEvents || [],
        uploadedDocuments: documents && documents.length > 0 ? documents : get().uploadedDocuments,
        chatMessages: [
          {
            id: `msg-welcome-${Date.now()}`,
            sender: 'assistant',
            text: `Olá, ${resolvedPatient.name.split(' ')[0]}! Sou o assistente clínico Rivio. Seus dados de saúde e registros de wearables foram carregados diretamente do prontuário digital. Como posso te orientar hoje?`,
            timestamp: 'Agora',
          },
        ],
      });
    } catch (err: any) {
      console.warn('[useHealthStore.selectPatient] Falha na rede, aplicando fallback:', err);
      // Fallback para seed data caso rede falhe
      const fallbackPatient = DEFAULT_PATIENTS.find((p) => p.id === patientId) || get().user;
      set({
        isAuthenticated: true,
        isLoading: false,
        user: fallbackPatient,
        error: err?.message || 'Falha ao carregar dados do Supabase. Operando com dados locais.',
      });
    }
  },

  login: async (identifier: string, pass: string) => {
    try {
      const raw = identifier.trim();
      const clean = cleanCpf(raw);

      // 1. Verifica se bate com algum paciente dos DEFAULT_PATIENTS por CPF ou e-mail
      const matchedDefault = get().availablePatients.find((p) => {
        const pCleanCpf = cleanCpf(p.cpf);
        return (
          (clean.length === 11 && pCleanCpf === clean) ||
          p.email.toLowerCase() === raw.toLowerCase() ||
          p.id === raw
        );
      });

      if (matchedDefault) {
        set({
          isAuthenticated: true,
          user: matchedDefault,
        });
        await get().selectPatient(matchedDefault.id);
        return { success: true };
      }

      const res = await supabaseClinicalRepo.signInPatient(identifier, pass);
      if (res.error || !res.user) {
        return { success: false, error: res.error || 'Credenciais inválidas. Verifique seu CPF e senha.' };
      }

      // Adiciona aos pacientes disponíveis caso seja novo
      const currentList = get().availablePatients;
      if (!currentList.some((p) => p.id === res.user!.id)) {
        set({ availablePatients: [res.user!, ...currentList] });
      }

      set({
        isAuthenticated: true,
        user: res.user,
      });
      await get().selectPatient(res.user.id);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Falha ao realizar login.' };
    }
  },

  register: async (nameOrParams: any, cpf?: string, email?: string, pass?: string) => {
    try {
      let name = '';
      let cpfInput = '';
      let emailInput = '';
      let password = '';
      let age = 35;
      let biologicalSex: 'Masculino' | 'Feminino' = 'Masculino';
      let city = 'São Paulo, SP';

      if (typeof nameOrParams === 'object' && nameOrParams !== null) {
        name = nameOrParams.name || '';
        cpfInput = nameOrParams.cpf || '';
        emailInput = nameOrParams.email || '';
        password = nameOrParams.password || nameOrParams.pass || '';
        if (nameOrParams.age) age = Number(nameOrParams.age);
        if (nameOrParams.biologicalSex) biologicalSex = nameOrParams.biologicalSex;
        if (nameOrParams.city) city = nameOrParams.city;
      } else {
        name = String(nameOrParams || '');
        cpfInput = String(cpf || '');
        emailInput = String(email || '');
        password = String(pass || '');
      }

      const clean = cleanCpf(cpfInput);
      if (!clean || clean.length !== 11) {
        return { success: false, error: 'O CPF é obrigatório e deve conter 11 dígitos numéricos.' };
      }

      if (!isValidCpf(clean)) {
        return { success: false, error: 'CPF inválido. Verifique os dígitos verificadores informados.' };
      }

      // Verifica se já existe um paciente com esse CPF
      const existing = get().availablePatients.find((p) => cleanCpf(p.cpf) === clean);
      if (existing) {
        return { success: false, error: 'Este CPF já está cadastrado no sistema. Por favor, realize o login.' };
      }

      const res = await supabaseClinicalRepo.signUpPatient({
        name,
        cpf: clean,
        email: emailInput,
        password,
        age,
        biologicalSex,
        city,
      });

      if (res.error || !res.user) {
        return { success: false, error: res.error || 'Falha ao cadastrar paciente.' };
      }

      const newUser = res.user;

      // Atualiza estado global incluindo o novo paciente indexado pelo CPF
      set((state) => ({
        availablePatients: [newUser, ...state.availablePatients],
        user: newUser,
        isAuthenticated: true,
        exams: [],
        uploadedDocuments: [],
        activeAlerts: [],
        medications: [],
        clinicalEvents: [],
        chatMessages: [
          {
            id: `msg-welcome-${Date.now()}`,
            sender: 'assistant',
            text: `Olá, ${newUser.name.split(' ')[0]}! Sua conta foi criada com sucesso e indexada pelo CPF ${newUser.cpf}. Seu prontuário está pronto para receber laudos e dados de wearables.`,
            timestamp: 'Agora',
          },
        ],
      }));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erro durante o cadastro.' };
    }
  },

  loginDemo: () => {
    void get().selectPatient('usr-marcos-2026');
  },

  logout: () => {
    void supabaseClinicalRepo.signOutPatient();
    set({
      isAuthenticated: false,
      doctorSession: null,
      error: null,
    });
  },

  addExamMeasurement: (newExam) => {
    const examWithId: ExamMeasurement = {
      ...newExam,
      id: `ex-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    };
    set((state) => ({
      exams: [examWithId, ...state.exams],
    }));
    // Sincroniza em background com a tabela lab_measurements do Supabase
    void supabaseClinicalRepo.insertLabMeasurement(examWithId);
  },

  removeExam: (id: string) => {
    set((state) => ({
      exams: state.exams.filter((e) => e.id !== id),
    }));
  },

  processExamDocumentMock: async (docName: string) => {
    await new Promise((resolve) => setTimeout(resolve, 1600));

    const todayStr = new Date().toISOString().split('T')[0];
    const newItems: ExamMeasurement[] = [
      {
        id: `ex-gen-${Date.now()}-1`,
        date: todayStr,
        labName: 'Fleury Medicina e Saúde',
        biomarkerId: 'glicose',
        canonicalName: 'Glicemia de Jejum',
        value: 108,
        unit: 'mg/dL',
        refMin: 70,
        refMax: 99,
        status: 'attention',
        notes: `Identificado no documento: "${docName}".`,
      },
      {
        id: `ex-gen-${Date.now()}-2`,
        date: todayStr,
        labName: 'Fleury Medicina e Saúde',
        biomarkerId: 'hba1c',
        canonicalName: 'Hemoglobina Glicada (HbA1c)',
        value: 5.8,
        unit: '%',
        refMin: 4.0,
        refMax: 5.6,
        status: 'attention',
        notes: 'Extraído automaticamente com Structured JSON via Gemini.',
      },
    ];

    const newDoc: UploadedDocument = {
      id: `doc-${Date.now()}`,
      name: docName,
      uri: `file:///uploaded/${docName}`,
      size: 450000,
      mimeType: docName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
      uploadedAt: new Date().toLocaleDateString('pt-BR'),
      extractedCount: 2,
      status: 'processed',
    };

    set((state) => ({
      exams: [...newItems, ...state.exams],
      uploadedDocuments: [newDoc, ...state.uploadedDocuments],
    }));

    void supabaseClinicalRepo.saveClinicalDocument({
      id: newDoc.id,
      title: `Laudo Ingerido — ${docName}`,
      occurredOn: todayStr,
      mimeType: newDoc.mimeType || 'application/pdf',
      fileSizeBytes: newDoc.size,
      extractedCount: newItems.length,
    });
    for (const item of newItems) {
      void supabaseClinicalRepo.insertLabMeasurement(item);
    }

    return newItems;
  },

  registerUploadedDocument: async (file: {
    name: string;
    uri: string;
    size?: number;
    mimeType?: string;
  }) => {
    await new Promise((r) => setTimeout(r, 1800));

    const todayStr = new Date().toISOString().split('T')[0];
    const isImage = file.mimeType?.startsWith('image/') || file.name.endsWith('.jpg') || file.name.endsWith('.png');

    const newItems: ExamMeasurement[] = [
      {
        id: `ex-ocr-${Date.now()}-1`,
        date: todayStr,
        labName: 'Laboratório Sabin',
        biomarkerId: 'creatinina',
        canonicalName: 'Creatinina Sérica',
        value: 1.1,
        unit: 'mg/dL',
        refMin: 0.7,
        refMax: 1.3,
        status: 'normal',
        notes: `Extraído do arquivo: ${file.name} via OCR de Laudos`,
      },
      {
        id: `ex-ocr-${Date.now()}-2`,
        date: todayStr,
        labName: 'Laboratório Sabin',
        biomarkerId: 'tsh',
        canonicalName: 'TSH Ultra Sensível',
        value: 2.45,
        unit: 'μUI/mL',
        refMin: 0.4,
        refMax: 4.5,
        status: 'normal',
        notes: `Processado com Gemini 1.5 Pro Multimodal`,
      },
    ];

    const newDoc: UploadedDocument = {
      id: `doc-up-${Date.now()}`,
      name: file.name,
      uri: file.uri,
      size: file.size || 250000,
      mimeType: file.mimeType || (isImage ? 'image/jpeg' : 'application/pdf'),
      uploadedAt: new Date().toLocaleDateString('pt-BR'),
      extractedCount: 2,
      status: 'processed',
    };

    set((state) => ({
      uploadedDocuments: [newDoc, ...state.uploadedDocuments],
      exams: [...newItems, ...state.exams],
    }));

    void supabaseClinicalRepo.saveClinicalDocument({
      id: newDoc.id,
      title: `Laudo Ingerido — ${file.name}`,
      occurredOn: todayStr,
      mimeType: newDoc.mimeType || 'application/pdf',
      fileSizeBytes: newDoc.size,
      extractedCount: 2,
    });
    for (const item of newItems) {
      void supabaseClinicalRepo.insertLabMeasurement(item);
    }

    return newItems;
  },

  deleteUploadedDocument: (id: string) => {
    set((state) => ({
      uploadedDocuments: state.uploadedDocuments.filter((d) => d.id !== id),
    }));
  },

  injectWearableAnomalyScenario: () => {
    const today = new Date().toISOString().split('T')[0];
    const alert: AnomalyAlert = {
      id: `al-${Date.now()}`,
      timestamp: 'Hoje, há 45 min',
      type: 'arrhythmia',
      severity: 'critical',
      message: 'Taquicardia em repouso persistente (118 bpm durante 42 minutos).',
      context: 'Apple Watch detectou FC elevada sem aceleração motora correspondente.',
      resolved: false,
    };

    const abnormalToday: WearableDailyReading = {
      date: today,
      restingHeartRate: 112,
      hrv: 18,
      sleepHours: 4.5,
      deepSleepHours: 0.3,
      steps: 2150,
      readinessScore: 38,
      hasAnomaly: true,
      anomalyDescription: 'Taquicardia sustentada em repouso e queda acentuada do HRV.',
    };

    set((state) => ({
      isSimulatedAnomalyActive: true,
      activeAlerts: [alert, ...state.activeAlerts],
      wearables: state.wearables.map((w, idx) => (idx === state.wearables.length - 1 ? abnormalToday : w)),
    }));
  },

  resetWearableScenario: () => {
    set({
      isSimulatedAnomalyActive: false,
      wearables: generateBaselineWearables(),
      activeAlerts: [],
    });
  },

  sendChatMessage: async (userText: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: 'Agora',
    };

    set((state) => ({
      chatMessages: [...state.chatMessages, userMsg],
    }));

    await new Promise((r) => setTimeout(r, 900));

    const state = get();
    const query = userText.toLowerCase();

    let botResponse = '';
    const citedSources: { title: string; date: string; value: string; sourceType: 'lab_exam' | 'wearable' | 'clinical_graph' }[] = [];

    if (query.includes('glicose') || query.includes('hba1c') || query.includes('açúcar') || query.includes('diabetes')) {
      const gExams = state.exams.filter((e) => e.biomarkerId === 'glicose' || e.biomarkerId === 'hba1c');
      const latestHba1c = state.exams.find((e) => e.biomarkerId === 'hba1c');
      botResponse = `Analisando seu histórico: sua Hemoglobina Glicada (HbA1c) mais recente está em ${latestHba1c ? latestHba1c.value + '%' : 'faixa controlada'}, com histórico registrado. Seus valores refletem a adesão ao plano terapêutico.`;
      if (latestHba1c) {
        citedSources.push({
          title: 'Hemoglobina Glicada (HbA1c)',
          date: latestHba1c.date,
          value: `${latestHba1c.value}%`,
          sourceType: 'lab_exam',
        });
      }
    } else if (query.includes('coração') || query.includes('cardíac') || query.includes('batimento') || query.includes('alerta')) {
      const lastWearable = state.wearables[state.wearables.length - 1];
      botResponse = `Seu monitoramento cardíaco contínuo via Apple Watch registra FC de repouso atual em ${lastWearable?.restingHeartRate || 62} bpm e VFC de ${lastWearable?.hrv || 48} ms. ${state.activeAlerts.length > 0 ? 'Há alertas clínicos ativos necessitando atenção médica.' : 'Sinais vitais em ritmo estável.'}`;
      citedSources.push({
        title: 'Frequência Cardíaca de Repouso',
        date: lastWearable?.date || 'Hoje',
        value: `${lastWearable?.restingHeartRate || 62} bpm`,
        sourceType: 'wearable',
      });
    } else {
      botResponse = `Com base no prontuário de ${state.user.name}: você possui ${state.exams.length} aferições laboratoriais, ${state.medications.length} medicações e ${state.wearables.length} dias de monitoramento de sinais vitais contínuos. Posso analisar correlações específicas sobre biomarcadores ou dados de wearables.`;
      citedSources.push({
        title: 'Prontuário Unificado Rivio',
        date: 'Atualizado hoje',
        value: `${state.exams.length} exames • ${state.wearables.length} dias wearables`,
        sourceType: 'clinical_graph',
      });
    }

    const assistantMsg: ChatMessage = {
      id: `msg-ast-${Date.now()}`,
      sender: 'assistant',
      text: botResponse,
      timestamp: 'Agora',
      citedSources,
    };

    set((state) => ({
      chatMessages: [...state.chatMessages, assistantMsg],
    }));
  },

  generateDoctorAccessSession: (customScope?: string[]) => {
    const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let token = '';
    for (let i = 0; i < 6; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const currentPatientId = get().user.id || 'usr-marcos-2026';
    const scope = customScope || ['read_exams', 'read_wearables', 'read_graphrag_briefing'];

    const newSession: DoctorAccessSession = {
      id: `sess-${Date.now()}`,
      token,
      createdAt: new Date().toISOString(),
      expiresAt: expires,
      accessUrl: `https://lepoli-health.app/doctor/consultation/${token}`,
      active: true,
      scope,
    };

    set({ doctorSession: newSession });

    void supabaseClinicalRepo.registerDoctorSession({
      patientId: currentPatientId,
      token,
      expiresAt: expires,
      scope,
    });

    return newSession;
  },

  revokeDoctorAccessSession: () => {
    const current = get().doctorSession;
    const currentPatientId = get().user.id || 'usr-marcos-2026';
    if (current?.id) {
      void supabaseClinicalRepo.revokeDoctorSession(current.id, currentPatientId);
    }
    set({
      doctorSession: current ? { ...current, active: false } : null,
    });
  },

  syncWithSupabase: async (patientId?: string) => {
    const pid = patientId || get().user.id || 'usr-marcos-2026';
    await get().selectPatient(pid);
  },
}));

// Carrega os pacientes disponíveis na inicialização
void useHealthStore.getState().loadAvailablePatients();
