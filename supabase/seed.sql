-- ============================================================================
-- HUB DE SAÚDE PESSOAL - DADOS SINTÉTICOS: PACIENTE DANIEL VAZ
-- ALINHADO COM A ARQUITETURA DE DADOS DO README.MD (GRAPHRAG + TIME-SERIES)
-- ============================================================================

-- 1. PACIENTE PRINCIPAL
INSERT INTO patients (
    id, display_name, email, age, biological_sex, blood_type, 
    allergies, chronic_conditions, emergency_contact, created_at
) VALUES (
    'usr-dan-2026',
    'Daniel Vaz',
    'daniel.vaz@exemplo.com.br',
    32,
    'Masculino',
    'A+',
    ARRAY['Dipirona'],
    ARRAY['Hipotireoidismo Subclínico', 'Dislipidemia Leve'],
    '{"name": "Marina Vaz", "relationship": "Esposa", "phone": "(11) 98765-4321"}'::JSONB,
    '2022-01-10T10:00:00Z'
) ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    age = EXCLUDED.age,
    allergies = EXCLUDED.allergies,
    chronic_conditions = EXCLUDED.chronic_conditions;

-- 2. FONTES DE DADOS E INTEGRAÇÕES
INSERT INTO data_sources (id, label, kind, state, last_synced_at, coverage_from, coverage_to) VALUES
    ('src-fleury', 'Fleury Medicina e Saúde', 'laboratory', 'connected', '2026-11-11T14:30:00Z', '2022-03-15', '2025-10-18'),
    ('src-zoppi', 'Laboratório Salomão Zoppi', 'laboratory', 'connected', '2026-11-11T14:30:00Z', '2023-05-20', '2023-05-20'),
    ('src-dasa', 'Dasa / Alta Excelência Diagnóstica', 'laboratory', 'connected', '2026-11-11T14:30:00Z', '2024-08-10', '2024-08-10'),
    ('src-apple-watch', 'Apple Watch Series 9 (HealthKit)', 'wearable', 'connected', NOW(), '2026-05-01', CURRENT_DATE)
ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, last_synced_at = EXCLUDED.last_synced_at;

-- 3. DICIONÁRIO DE BIOMARCADORES PADRONIZADOS (ENTITY RESOLUTION)
INSERT INTO biomarkers (id, canonical_name, category, canonical_unit, standard_ref_min, standard_ref_max, description, synonyms) VALUES
    ('glicose', 'Glicemia de Jejum', 'Metabolismo', 'mg/dL', 70, 99, 'Nível de glicose sérica após 8 horas de jejum calórico.', ARRAY['Glicose', 'Glicose Plasmática', 'Açúcar no sangue']),
    ('hba1c', 'Hemoglobina Glicada (HbA1c)', 'Metabolismo', '%', 4.0, 5.6, 'Média estimada da glicose nos últimos 90 a 120 dias.', ARRAY['HbA1c', 'A1C', 'Fração A1c']),
    ('ldl', 'Colesterol LDL', 'Lipídios', 'mg/dL', 0, 130, 'Lipoproteína de baixa densidade (fração aterogênica).', ARRAY['LDL', 'LDL-C', 'Colesterol Fração Ruim']),
    ('hdl', 'Colesterol HDL', 'Lipídios', 'mg/dL', 40, 100, 'Lipoproteína de alta densidade (fração protetora).', ARRAY['HDL', 'HDL-C', 'Colesterol Bom']),
    ('colesterol_total', 'Colesterol Total', 'Lipídios', 'mg/dL', 0, 190, 'Somatório das frações lipídicas séricas.', ARRAY['Colesterol', 'CT']),
    ('triglicerideos', 'Triglicerídeos', 'Lipídios', 'mg/dL', 0, 150, 'Gorduras neutras circulantes no sangue.', ARRAY['Triglicérides', 'TG']),
    ('tsh', 'TSH Ultra-sensível', 'Tireoide', 'mcUI/mL', 0.4, 4.5, 'Hormônio tireoestimulante hipofisário.', ARRAY['TSH', 'Hormônio Tireoestimulante']),
    ('ferritina', 'Ferritina Sérica', 'Hematologia', 'ng/mL', 30, 400, 'Principal proteína de reserva tecidual e hepática de ferro.', ARRAY['Ferritina', 'Estoque de Ferro']),
    ('pcr', 'Proteína C Reativa Ultra-sensível', 'Inflamação', 'mg/L', 0, 1.0, 'Marcador de fase aguda e risco inflamatório vascular.', ARRAY['PCR', 'PCR-us', 'Proteína C-Reativa'])
ON CONFLICT (id) DO UPDATE SET canonical_name = EXCLUDED.canonical_name;

-- 4. DOCUMENTOS E LAUDOS DIGITAIS INGERIDOS (FOTOS E PDFS)
INSERT INTO clinical_documents (id, patient_id, source_id, title, occurred_on, received_at, mime_type, storage_path, file_size_bytes, status, extracted_count) VALUES
    ('doc-fleury-2025', 'usr-dan-2026', 'src-fleury', 'Laudo Completo Fleury — Outubro/2025', '2025-10-18', '2026-11-11T14:30:00Z', 'application/pdf', 'documents/usr-dan-2026/Laudo_Fleury_2025.pdf', 482000, 'processed', 4),
    ('doc-dasa-2024', 'usr-dan-2026', 'src-dasa', 'Checkup Laboratorial Dasa / Alta — Agosto/2024', '2024-08-10', '2026-11-11T14:30:00Z', 'application/pdf', 'documents/usr-dan-2026/Exame_Dasa_2024.pdf', 320000, 'processed', 3),
    ('doc-zoppi-2023', 'usr-dan-2026', 'src-zoppi', 'Exame de Sangue Salomão Zoppi — Maio/2023', '2023-05-20', '2026-11-11T14:30:00Z', 'image/jpeg', 'documents/usr-dan-2026/Foto_Laudo_Zoppi_2023.jpg', 1420000, 'processed', 3),
    ('doc-fleury-2022', 'usr-dan-2026', 'src-fleury', 'Checkup Periódico Fleury — Março/2022', '2022-03-15', '2026-11-11T14:30:00Z', 'application/pdf', 'documents/usr-dan-2026/Checkup_Fleury_2022.pdf', 390000, 'processed', 3)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

-- 5. SÉRIE TEMPORAL DE MEDIÇÕES LABORATORIAIS (2022 A 2025)
INSERT INTO lab_measurements (id, patient_id, biomarker_id, document_id, source_id, occurred_on, value, unit, ref_min, ref_max, status, notes) VALUES
    -- Glicemia de Jejum (Trajetória ascendente: 84 -> 89 -> 94 -> 104)
    ('ex-glic-2022', 'usr-dan-2026', 'glicose', 'doc-fleury-2022', 'src-fleury', '2022-03-15', 84, 'mg/dL', 70, 99, 'normal', 'Glicemia normal em jejum.'),
    ('ex-glic-2023', 'usr-dan-2026', 'glicose', 'doc-zoppi-2023', 'src-zoppi', '2023-05-20', 89, 'mg/dL', 70, 99, 'normal', 'Parâmetros normais.'),
    ('ex-glic-2024', 'usr-dan-2026', 'glicose', 'doc-dasa-2024', 'src-dasa', '2024-08-10', 94, 'mg/dL', 70, 99, 'normal', 'Próximo do limite superior.'),
    ('ex-glic-2025', 'usr-dan-2026', 'glicose', 'doc-fleury-2025', 'src-fleury', '2025-10-18', 104, 'mg/dL', 70, 99, 'attention', 'Discretamente acima da faixa de referência (atenção metabólica).'),

    -- Colesterol LDL (Trajetória ascendente: 112 -> 128 -> 142 -> 156)
    ('ex-ldl-2022', 'usr-dan-2026', 'ldl', 'doc-fleury-2022', 'src-fleury', '2022-03-15', 112, 'mg/dL', 0, 130, 'normal', 'Dentro do alvo terapêutico.'),
    ('ex-ldl-2023', 'usr-dan-2026', 'ldl', 'doc-zoppi-2023', 'src-zoppi', '2023-05-20', 128, 'mg/dL', 0, 130, 'normal', 'Normal com tendência de subida.'),
    ('ex-ldl-2024', 'usr-dan-2026', 'ldl', 'doc-dasa-2024', 'src-dasa', '2024-08-10', 142, 'mg/dL', 0, 130, 'attention', 'Acima da meta recomendada (< 130 mg/dL).'),
    ('ex-ldl-2025', 'usr-dan-2026', 'ldl', 'doc-fleury-2025', 'src-fleury', '2025-10-18', 156, 'mg/dL', 0, 130, 'critical', 'Elevação sustentada nos últimos 3 anos. Requer orientação clínica.'),

    -- Ferritina Sérica (Queda acentuada: 85 -> 58 -> 34 -> 22)
    ('ex-fer-2022', 'usr-dan-2026', 'ferritina', 'doc-fleury-2022', 'src-fleury', '2022-03-15', 85, 'ng/mL', 30, 400, 'normal', 'Estoque de ferro adequado.'),
    ('ex-fer-2023', 'usr-dan-2026', 'ferritina', 'doc-zoppi-2023', 'src-zoppi', '2023-05-20', 58, 'ng/mL', 30, 400, 'normal', 'Reserva de ferro normal.'),
    ('ex-fer-2024', 'usr-dan-2026', 'ferritina', 'doc-dasa-2024', 'src-dasa', '2024-08-10', 34, 'ng/mL', 30, 400, 'normal', 'Próximo ao limite inferior.'),
    ('ex-fer-2025', 'usr-dan-2026', 'ferritina', 'doc-fleury-2025', 'src-fleury', '2025-10-18', 22, 'ng/mL', 30, 400, 'attention', 'Abaixo da referência de 30 ng/mL. Correlaciona com queixas de fadiga matinal.'),

    -- TSH Ultra-sensível (Trajetória de subida: 1.8 -> 2.6 -> 3.4 -> 4.2)
    ('ex-tsh-2022', 'usr-dan-2026', 'tsh', 'doc-fleury-2022', 'src-fleury', '2022-03-15', 1.8, 'mcUI/mL', 0.4, 4.5, 'normal', 'Função tireoidiana normal.'),
    ('ex-tsh-2023', 'usr-dan-2026', 'tsh', 'doc-zoppi-2023', 'src-zoppi', '2023-05-20', 2.6, 'mcUI/mL', 0.4, 4.5, 'normal', 'Valores estáveis.'),
    ('ex-tsh-2024', 'usr-dan-2026', 'tsh', 'doc-dasa-2024', 'src-dasa', '2024-08-10', 3.4, 'mcUI/mL', 0.4, 4.5, 'normal', 'Tendência de elevação subclínica.'),
    ('ex-tsh-2025', 'usr-dan-2026', 'tsh', 'doc-fleury-2025', 'src-fleury', '2025-10-18', 4.2, 'mcUI/mL', 0.4, 4.5, 'normal', 'Próximo ao teto da normalidade (4.5). Indica monitoramento.')
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, status = EXCLUDED.status;

-- 6. SÉRIE TEMPORAL DE WEARABLES (APPLE WATCH)
INSERT INTO wearable_time_series (patient_id, source_id, source_device, metric_type, value, unit, recorded_at, metadata) VALUES
    -- Batimentos em repouso e anomalia noturna
    ('usr-dan-2026', 'src-apple-watch', 'Apple Watch Series 9', 'heart_rate', 64, 'bpm', '2026-11-10T08:00:00Z', '{"context": "resting"}'::JSONB),
    ('usr-dan-2026', 'src-apple-watch', 'Apple Watch Series 9', 'heart_rate', 68, 'bpm', '2026-11-10T14:30:00Z', '{"context": "working"}'::JSONB),
    ('usr-dan-2026', 'src-apple-watch', 'Apple Watch Series 9', 'heart_rate', 118, 'bpm', '2026-11-11T03:42:00Z', '{"context": "sleep_spike", "anomaly": true, "duration_minutes": 12}'::JSONB),
    ('usr-dan-2026', 'src-apple-watch', 'Apple Watch Series 9', 'heart_rate', 66, 'bpm', '2026-11-11T09:00:00Z', '{"context": "resting"}'::JSONB),

    -- Variabilidade da Frequência Cardíaca (HRV)
    ('usr-dan-2026', 'src-apple-watch', 'Apple Watch Series 9', 'hrv', 62, 'ms', '2026-11-09T07:00:00Z', '{"baseline": "good"}'::JSONB),
    ('usr-dan-2026', 'src-apple-watch', 'Apple Watch Series 9', 'hrv', 58, 'ms', '2026-11-10T07:00:00Z', '{"baseline": "good"}'::JSONB),
    ('usr-dan-2026', 'src-apple-watch', 'Apple Watch Series 9', 'hrv', 28, 'ms', '2026-11-11T07:00:00Z', '{"baseline": "low_recovery", "anomaly": true}'::JSONB),

    -- Estágios de Sono
    ('usr-dan-2026', 'src-apple-watch', 'Apple Watch Series 9', 'sleep_deep', 85, 'min', '2026-11-09T06:30:00Z', '{"target_min": 75}'::JSONB),
    ('usr-dan-2026', 'src-apple-watch', 'Apple Watch Series 9', 'sleep_deep', 32, 'min', '2026-11-11T06:30:00Z', '{"target_min": 75, "alert": "deep_sleep_depleted"}'::JSONB),
    ('usr-dan-2026', 'src-apple-watch', 'Apple Watch Series 9', 'sleep_score', 86, 'score', '2026-11-09T06:30:00Z', '{}'::JSONB),
    ('usr-dan-2026', 'src-apple-watch', 'Apple Watch Series 9', 'sleep_score', 54, 'score', '2026-11-11T06:30:00Z', '{"status": "poor"}'::JSONB)
ON CONFLICT (patient_id, metric_type, recorded_at, source_device) DO NOTHING;

-- 7. ALERTAS CLÍNICOS E ANOMALIAS
INSERT INTO clinical_alerts (id, patient_id, title, category, severity, description, clinical_hypothesis, detected_at, evidence_refs) VALUES
    (
        'alert-ferritina-baixa',
        'usr-dan-2026',
        'Deficiência de Ferritina com Sintoma de Fadiga',
        'lab_critical',
        'warning',
        'A ferritina caiu para 22 ng/mL (referência: 30 a 400 ng/mL) no laudo mais recente.',
        'Queda progressiva nos últimos 3 anos correlacionada com relatos de cansaço excessivo e queda de rendimento físico.',
        '2025-10-18T18:00:00Z',
        '[{"id": "ex-fer-2025", "label": "Ferritina: 22 ng/mL"}]'::JSONB
    ),
    (
        'alert-taquicardia-noturna',
        'usr-dan-2026',
        'Taquicardia em Repouso durante o Sono',
        'wearable_anomaly',
        'warning',
        'Frequência cardíaca disparou para 118 bpm às 03:42 da madrugada sem movimentação associada.',
        'Episódio pontual noturno acompanhado de queda brusca de HRV (28 ms) e privação de sono profundo.',
        '2026-11-11T03:42:00Z',
        '[{"id": "src-apple-watch", "type": "heart_rate", "value": 118}]'::JSONB
    ),
    (
        'alert-ldl-ascendente',
        'usr-dan-2026',
        'Tendência Ascendente Contínua de Colesterol LDL',
        'trend_warning',
        'info',
        'O LDL subiu progressivamente de 112 mg/dL (2022) para 156 mg/dL (2025).',
        'Indica necessidade de intervenção dietética ou farmacológica para mitigar risco cardiovascular acumulado.',
        '2025-10-18T18:00:00Z',
        '[{"id": "ex-ldl-2025", "label": "LDL: 156 mg/dL"}]'::JSONB
    )
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

-- 8. GRAFO DE CONHECIMENTO CLÍNICO - NÓS (HYBRID GRAPHRAG)
INSERT INTO clinical_graph_nodes (id, patient_id, kind, label, properties) VALUES
    ('node-dan', 'usr-dan-2026', 'patient', 'Daniel Vaz (32a, Masc)', '{"age": 32, "blood_type": "A+"}'::JSONB),
    ('node-bio-fer', 'usr-dan-2026', 'biomarker', 'Ferritina: 22 ng/mL (Baixa)', '{"value": 22, "unit": "ng/mL", "status": "attention"}'::JSONB),
    ('node-bio-ldl', 'usr-dan-2026', 'biomarker', 'LDL: 156 mg/dL (Elevado)', '{"value": 156, "unit": "mg/dL", "status": "critical"}'::JSONB),
    ('node-bio-glic', 'usr-dan-2026', 'biomarker', 'Glicemia: 104 mg/dL', '{"value": 104, "unit": "mg/dL", "status": "attention"}'::JSONB),
    ('node-bio-tsh', 'usr-dan-2026', 'biomarker', 'TSH: 4.2 mcUI/mL (Teto)', '{"value": 4.2, "unit": "mcUI/mL", "status": "normal"}'::JSONB),
    ('node-sym-fadiga', 'usr-dan-2026', 'symptom', 'Sintoma: Fadiga Matinal Crônica', '{"reported_since": "2025-08-01", "frequency": "diária"}'::JSONB),
    ('node-med-levo', 'usr-dan-2026', 'medication', 'Medicamento: Levotiroxina 50mcg', '{"dose": "50mcg", "posology": "1x ao dia em jejum", "since": "2024-09-01"}'::JSONB),
    ('node-alert-tachy', 'usr-dan-2026', 'wearable_alert', 'Alerta: Taquicardia Noturna (118 bpm)', '{"timestamp": "2026-11-11T03:42:00Z", "duration": "12min"}'::JSONB),
    ('node-alert-sono', 'usr-dan-2026', 'wearable_alert', 'Alerta: Queda de Sono Profundo e HRV (28ms)', '{"sleep_deep_min": 32, "hrv_ms": 28}'::JSONB),
    ('node-cond-dislip', 'usr-dan-2026', 'condition', 'Condição: Dislipidemia Aterogênica', '{"status": "em_investigacao"}'::JSONB)
ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label;

-- 9. GRAFO DE CONHECIMENTO CLÍNICO - ARESTAS (CAUSAS, MEDIÇÕES E CORRELAÇÕES)
INSERT INTO clinical_graph_edges (id, patient_id, source_node_id, target_node_id, relationship, label, basis, properties) VALUES
    ('edge-dan-fer', 'usr-dan-2026', 'node-dan', 'node-bio-fer', 'MEDIU', 'Exame Fleury registrou Ferritina de 22 ng/mL', 'recorded_fact', '{"exam_date": "2025-10-18"}'::JSONB),
    ('edge-dan-ldl', 'usr-dan-2026', 'node-dan', 'node-bio-ldl', 'MEDIU', 'Exame Fleury registrou LDL de 156 mg/dL', 'recorded_fact', '{"exam_date": "2025-10-18"}'::JSONB),
    ('edge-dan-tsh', 'usr-dan-2026', 'node-dan', 'node-bio-tsh', 'MEDIU', 'Exame Fleury registrou TSH de 4.2 mcUI/mL', 'recorded_fact', '{"exam_date": "2025-10-18"}'::JSONB),
    ('edge-dan-fadiga', 'usr-dan-2026', 'node-dan', 'node-sym-fadiga', 'APRESENTA', 'Paciente relata fadiga contínua ao acordar', 'recorded_fact', '{}'::JSONB),
    ('edge-dan-med', 'usr-dan-2026', 'node-dan', 'node-med-levo', 'TOMA', 'Prescrição ativa de reposição tireoidiana', 'recorded_fact', '{"since": "2024-09-01"}'::JSONB),
    ('edge-fer-fadiga', 'usr-dan-2026', 'node-bio-fer', 'node-sym-fadiga', 'CORRELACIONADO_COM', 'Deficiência de reserva de ferro correlacionada clinicamente com queixa de fadiga', 'clinical_inference', '{"confidence": 0.88}'::JSONB),
    ('edge-ldl-dislip', 'usr-dan-2026', 'node-bio-ldl', 'node-cond-dislip', 'INDICA', 'Histórico trienal de subida do LDL indica dislipidemia progressiva', 'clinical_inference', '{"confidence": 0.94}'::JSONB),
    ('edge-tachy-sono', 'usr-dan-2026', 'node-alert-tachy', 'node-alert-sono', 'CORRELACIONADO_COM', 'Episódio de taquicardia coincidiu com fragmentação do sono e queda de HRV', 'temporal_correlation', '{"confidence": 0.95}'::JSONB),
    ('edge-med-tachy', 'usr-dan-2026', 'node-med-levo', 'node-alert-tachy', 'CORRELACIONADO_COM', 'Necessidade de avaliar se dose matinal de levotiroxina pode influenciar frequência cardíaca', 'clinical_inference', '{"confidence": 0.65}'::JSONB)
ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label;

-- 10. SESSÕES DE ACESSO MÉDICO EFÊMERO (Geradas dinamicamente via App Mobile)
-- As sessões são criadas sob demanda pelo paciente com tokens alfanuméricos únicos de 6 dígitos e TTL de 15 minutos.
