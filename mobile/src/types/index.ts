export type BiomarkerCategory =
  | 'Glicêmico'
  | 'Lipídico'
  | 'Hematológico'
  | 'Hormonal'
  | 'Renal'
  | 'Inflamatório'
  | 'Hepático'
  | 'Nutricional';

export type BiologicalSex = 'Masculino' | 'Feminino';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  cpf?: string;
  age: number;
  biologicalSex: BiologicalSex;
  birthDate?: string;
  city?: string;
  heightCm?: number;
  weightKg?: number;
  bloodType?: string;
  scenario?: string;
  chronicConditions: string[];
  activeMedications: string[];
  avatarUrl?: string;
}

export interface BiomarkerDefinition {
  id: string;
  canonicalName: string;
  category: BiomarkerCategory;
  unit: string;
  refMin: number;
  refMax: number;
  description: string;
}

export interface ExamMeasurement {
  id: string;
  date: string; // ISO date YYYY-MM-DD
  labName: string;
  biomarkerId: string;
  canonicalName: string;
  value: number;
  unit: string;
  refMin: number;
  refMax: number;
  status: 'normal' | 'attention' | 'critical';
  notes?: string;
  documentId?: string;
}

export interface UploadedDocument {
  id: string;
  name: string;
  uri: string;
  size?: number;
  mimeType?: string;
  uploadedAt: string;
  extractedCount: number;
  status: 'processed' | 'processing' | 'error';
}

export interface WearableDailyReading {
  date: string; // YYYY-MM-DD
  restingHeartRate: number; // BPM
  maxHeartRate?: number;
  minHeartRate?: number;
  hrv: number; // ms (Heart Rate Variability)
  sleepHours: number;
  deepSleepHours: number;
  remSleepHours?: number;
  spo2?: number; // %
  steps: number;
  readinessScore?: number;
  hasAnomaly?: boolean;
  anomalyDescription?: string;
}

export interface AnomalyAlert {
  id: string;
  timestamp: string;
  title?: string;
  message?: string;
  description?: string;
  context?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metricType?: 'heart_rate' | 'hrv' | 'sleep' | 'spo2' | string;
  type?: string;
  valueDetected?: string;
  baselineValue?: string;
  clinicalContext?: string;
  resolved: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  citedSources?: Array<{
    title: string;
    date: string;
    value?: string;
    sourceType: 'lab_exam' | 'wearable' | 'prescription' | 'clinical_graph';
  }>;
}

export interface DoctorAccessSession {
  id: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  accessUrl: string;
  active: boolean;
  scope: string[];
}

export interface HeartRateSample {
  id?: string;
  patientId?: string;
  ts: string; // ISO timestamp
  bpm: number;
  activityContext?: 'resting' | 'walking' | 'sleeping' | 'workout' | 'fever';
}

export interface Medication {
  id: string;
  patientId: string;
  name: string;
  dosage: string;
  route?: string;
  frequency?: string;
  startDate: string;
  endDate?: string | null;
  indication?: string;
  prescribedBy?: string;
}

export interface ClinicalEvent {
  id: string;
  patientId: string;
  date: string;
  title: string;
  eventType: string;
  description?: string;
  severity?: string;
  facility?: string;
}
