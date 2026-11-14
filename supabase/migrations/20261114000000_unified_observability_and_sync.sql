-- ============================================================================
-- MIGRATION: UNIFICAÇÃO DOS SCHEMAS (RIVIO_* + ARQUITETURA CLÍNICA)
-- E CAMADA DE OBSERVABILIDADE DE TRANSIÇÕES E FLUXO INSTITUCIONAL
-- ============================================================================

-- 1. Políticas de Acesso e Sincronização para Tabelas Clínicas e Rivio_*
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'rivio_biomarker_definitions','rivio_patients','rivio_documents','rivio_exams',
    'rivio_wearable_daily','rivio_heart_rate_samples','rivio_alerts','rivio_medications','rivio_clinical_events',
    'patients','data_sources','clinical_documents','biomarkers','lab_measurements',
    'wearable_time_series','clinical_alerts','clinical_graph_nodes','clinical_graph_edges','doctor_access_sessions'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
      EXECUTE format('DROP POLICY IF EXISTS full_access_%I ON public.%I;', t, t);
      EXECUTE format('CREATE POLICY full_access_%I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);', t, t);
    END IF;
  END LOOP;
END $$;

-- 2. Índices adicionais para consultas de observabilidade em clinical_graph_nodes (kind = 'consultation')
-- e eventos em rivio_clinical_events
CREATE INDEX IF NOT EXISTS idx_graph_nodes_consultation_created
  ON public.clinical_graph_nodes (patient_id, kind, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_doctor_sessions_patient_created
  ON public.doctor_access_sessions (patient_id, created_at DESC);
