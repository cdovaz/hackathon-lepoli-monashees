-- ============================================================================
-- HUB DE SAÚDE PESSOAL (DESAFIO RIVIO) - BANCO DE DADOS SUPABASE
-- ARQUITETURA HÍBRIDA: KNOWLEDGE GRAPH + TIME-SERIES + HNSW VECTOR SEARCH
-- ============================================================================

-- 1. Habilitar extensão pgvector para Busca Semântica HNSW e Entity Resolution
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================================
-- TABELA 1: PACIENTES (Identity & Perfil Clínico Geral)
-- ============================================================================
CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    email TEXT UNIQUE,
    age INT,
    biological_sex TEXT CHECK (biological_sex IN ('Masculino', 'Feminino', 'Outro')),
    blood_type VARCHAR(5),
    allergies TEXT[] DEFAULT ARRAY[]::TEXT[],
    chronic_conditions TEXT[] DEFAULT ARRAY[]::TEXT[],
    emergency_contact JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABELA 2: FONTES DE DADOS E INTEGRAÇÕES (Laboratórios, Wearables e Hospitais)
-- ============================================================================
CREATE TABLE IF NOT EXISTS data_sources (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('laboratory', 'wearable', 'hospital', 'clinic', 'manual')),
    state TEXT NOT NULL DEFAULT 'connected' CHECK (state IN ('connected', 'stale', 'disconnected')),
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    coverage_from DATE,
    coverage_to DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABELA 3: DOCUMENTOS E LAUDOS DIGITAIS INGERIDOS (PDFs e Fotos de Exames)
-- ============================================================================
CREATE TABLE IF NOT EXISTS clinical_documents (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    source_id TEXT REFERENCES data_sources(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    occurred_on DATE NOT NULL,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    mime_type TEXT DEFAULT 'application/pdf',
    storage_path TEXT,
    file_size_bytes BIGINT,
    status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('uploaded', 'processing', 'processed', 'error')),
    extracted_count INT DEFAULT 0,
    raw_metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_docs_patient ON clinical_documents(patient_id, occurred_on DESC);

-- ============================================================================
-- TABELA 4: DICIONÁRIO CANÔNICO DE BIOMARCADORES (Entity Resolution & HNSW)
-- ============================================================================
CREATE TABLE IF NOT EXISTS biomarkers (
    id TEXT PRIMARY KEY,
    canonical_name TEXT NOT NULL,
    category TEXT NOT NULL,
    canonical_unit TEXT NOT NULL,
    standard_ref_min NUMERIC,
    standard_ref_max NUMERIC,
    description TEXT,
    synonyms TEXT[] DEFAULT ARRAY[]::TEXT[],
    embedding vector(384), -- Vetor para padronização semântica (Entity Resolution)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice vetorial HNSW para entity resolution em milissegundos
CREATE INDEX IF NOT EXISTS idx_biomarkers_hnsw 
ON biomarkers USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- TABELA 5: SÉRIE TEMPORAL DE EXAMES LABORATORIAIS (Evolução Numérica ao Longo dos Anos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS lab_measurements (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    biomarker_id TEXT NOT NULL REFERENCES biomarkers(id) ON DELETE CASCADE,
    document_id TEXT REFERENCES clinical_documents(id) ON DELETE SET NULL,
    source_id TEXT REFERENCES data_sources(id) ON DELETE SET NULL,
    occurred_on DATE NOT NULL,
    value NUMERIC NOT NULL,
    unit TEXT NOT NULL,
    ref_min NUMERIC,
    ref_max NUMERIC,
    ref_text TEXT,
    status TEXT NOT NULL CHECK (status IN ('normal', 'attention', 'critical', 'unknown')),
    notes TEXT,
    ingested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_patient_biomarker ON lab_measurements(patient_id, biomarker_id, occurred_on ASC);
CREATE INDEX IF NOT EXISTS idx_lab_occurred ON lab_measurements(occurred_on DESC);

-- ============================================================================
-- TABELA 6: SÉRIE TEMPORAL DE DISPOSITIVOS VESTÍVEIS / WEARABLES (Tempo Real)
-- ============================================================================
CREATE TABLE IF NOT EXISTS wearable_time_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    source_id TEXT REFERENCES data_sources(id) ON DELETE SET NULL,
    source_device TEXT NOT NULL,
    metric_type TEXT NOT NULL CHECK (metric_type IN (
        'heart_rate', 'hrv', 'spo2', 'respiratory_rate', 
        'sleep_deep', 'sleep_rem', 'sleep_score', 'steps', 'active_calories'
    )),
    value NUMERIC NOT NULL,
    unit TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Desduplicação e idempotência exigidas no README.md
    CONSTRAINT uq_wearable_sample UNIQUE (patient_id, metric_type, recorded_at, source_device)
);

CREATE INDEX IF NOT EXISTS idx_wearables_patient_metric ON wearable_time_series(patient_id, metric_type, recorded_at DESC);

-- ============================================================================
-- TABELA 7: ANOMALIAS E ALERTAS CLÍNICOS DETECTADOS PELO WORKER
-- ============================================================================
CREATE TABLE IF NOT EXISTS clinical_alerts (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('wearable_anomaly', 'lab_critical', 'drug_interaction', 'trend_warning')),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    description TEXT NOT NULL,
    clinical_hypothesis TEXT,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    evidence_refs JSONB DEFAULT '[]'::JSONB,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_patient ON clinical_alerts(patient_id, detected_at DESC);

-- ============================================================================
-- TABELA 8: GRAFO DE CONHECIMENTO CLÍNICO - NÓS (Hybrid GraphRAG)
-- ============================================================================
CREATE TABLE IF NOT EXISTS clinical_graph_nodes (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN (
        'patient', 'biomarker', 'lab_result', 'symptom', 
        'medication', 'condition', 'wearable_alert', 'consultation'
    )),
    label TEXT NOT NULL,
    properties JSONB DEFAULT '{}'::JSONB,
    embedding vector(384), -- Embedding para busca semântica GraphRAG
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_graph_nodes_patient ON clinical_graph_nodes(patient_id, kind);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_hnsw 
ON clinical_graph_nodes USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- TABELA 9: GRAFO DE CONHECIMENTO CLÍNICO - ARESTAS (Relacionamentos de Causa/Efeito)
-- ============================================================================
CREATE TABLE IF NOT EXISTS clinical_graph_edges (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    source_node_id TEXT NOT NULL REFERENCES clinical_graph_nodes(id) ON DELETE CASCADE,
    target_node_id TEXT NOT NULL REFERENCES clinical_graph_nodes(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL, -- ex: 'MEDIU', 'TOMA', 'CORRELACIONADO_COM', 'APRESENTA', 'INDICA'
    label TEXT NOT NULL,
    basis TEXT NOT NULL DEFAULT 'recorded_fact' CHECK (basis IN ('recorded_fact', 'clinical_inference', 'temporal_correlation')),
    properties JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON clinical_graph_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON clinical_graph_edges(target_node_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_patient ON clinical_graph_edges(patient_id);

-- ============================================================================
-- TABELA 10: SESSÕES DE ACESSO MÉDICO / CONSENTIMENTO OPEN HEALTH (Tokens 6 dígitos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS doctor_access_sessions (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    token VARCHAR(10) NOT NULL UNIQUE,
    active BOOLEAN DEFAULT TRUE,
    scope TEXT[] NOT NULL DEFAULT ARRAY['read_exams', 'read_wearables', 'read_graphrag_briefing']::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    access_url TEXT,
    doctor_crm TEXT,
    doctor_name TEXT,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_doctor_sessions_token ON doctor_access_sessions(token) WHERE active = TRUE;

-- ============================================================================
-- VIEWS CONSOLIDADAS PARA GRAPHRAG E BRIEFINGS CLÍNICOS
-- ============================================================================
CREATE OR REPLACE VIEW view_patient_clinical_summary AS
SELECT 
    p.id AS patient_id,
    p.display_name,
    p.age,
    p.biological_sex,
    COUNT(DISTINCT d.id) AS total_documents,
    COUNT(DISTINCT lm.id) AS total_lab_measurements,
    COUNT(DISTINCT a.id) FILTER (WHERE a.resolved = FALSE) AS active_alerts_count,
    MAX(lm.occurred_on) AS latest_exam_date
FROM patients p
LEFT JOIN clinical_documents d ON d.patient_id = p.id
LEFT JOIN lab_measurements lm ON lm.patient_id = p.id
LEFT JOIN clinical_alerts a ON a.patient_id = p.id
GROUP BY p.id, p.display_name, p.age, p.biological_sex;

-- ============================================================================
-- FUNÇÃO RPC: BUSCA SEMÂNTICA GRAPHRAG VIA HNSW
-- ============================================================================
CREATE OR REPLACE FUNCTION match_clinical_nodes(
    query_embedding vector(384),
    p_patient_id TEXT,
    match_threshold FLOAT DEFAULT 0.65,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id TEXT,
    kind TEXT,
    label TEXT,
    properties JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        n.id,
        n.kind,
        n.label,
        n.properties,
        1 - (n.embedding <=> query_embedding) AS similarity
    FROM clinical_graph_nodes n
    WHERE n.patient_id = p_patient_id
      AND (n.embedding <=> query_embedding) < (1 - match_threshold)
    ORDER BY n.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;
