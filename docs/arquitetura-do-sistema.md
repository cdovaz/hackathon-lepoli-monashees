# Arquitetura do Sistema Rivio Health — "Pulso Calmo"

> Especificação arquitetural completa do Hub de Saúde Pessoal (App do Paciente + Cockpit do Médico + Supabase + Pipeline de IA).  
> Aprovada via `/grill-me` em 12/11/2026.

---

## 1. Visão Geral da Topologia do Sistema

O sistema opera sob uma topologia **BFF Híbrida (Backend-for-Frontend)** centrada no **Supabase** como fonte da verdade clínica obrigatória (*Live Only*), complementada por rotas de API especializadas no Next.js para orquestração de Inteligência Artificial, processamento em 2 estágios de documentos e auditoria de consentimento médico.

```mermaid
flowchart TD
    subgraph Clientes["Clientes Rivio ('Pulso Calmo')"]
        Mobile["📱 App do Paciente (Expo React Native)<br/>• Sinais Vitais & Wearables<br/>• Gerador de Token 6 Dígitos<br/>• Upload de Exames (Câmera/PDF)<br/>• Chat Copiloto IA"]
        Web["💻 Cockpit do Médico (Next.js 16 / React 19)<br/>• Entrada via CRM + Token<br/>• Briefing 30s<br/>• Evolução Cruzada (Exames vs BPM)<br/>• Grafo de Causa & Efeito (@xyflow)"]
    end

    subgraph API_Gateway["Next.js API Gateway / BFF"]
        APIToken["/api/doctor/v0/access<br/>Validação e Auditoria de Token"]
        APIOcr["/api/documents/process<br/>Pipeline 2 Estágios (OCR + LLM)"]
        APIGraphRAG["/api/assistant/chat<br/>Motor GraphRAG (Busca Vetorial)"]
    end

    subgraph Supabase["Supabase Cloud (Fonte Canônica da Verdade)"]
        Auth["Supabase Auth<br/>JWT & Sessões Seguras"]
        Storage["Supabase Storage<br/>Bucket: clinical-documents"]
        Postgres[("PostgreSQL 15+<br/>• patients & data_sources<br/>• clinical_documents & lab_measurements<br/>• wearable_time_series<br/>• clinical_alerts<br/>• clinical_graph_nodes & edges<br/>• doctor_access_sessions")]
        HNSW["pgvector + Índice HNSW<br/>RPC: match_clinical_nodes"]
        Realtime["Supabase Realtime (WebSockets)<br/>Canal: clinical_alerts & wearables"]
    end

    %% Relações do Mobile
    Mobile -- "Auth (JWT)" --> Auth
    Mobile -- "Upload Binário" --> Storage
    Mobile -- "Gera Token 6 Dígitos" --> Postgres
    Mobile -- "Dispara Anomalia (114 BPM)" --> Postgres
    Postgres -. "Broadcast Instantâneo" .-> Realtime
    Mobile -- "Pergunta ao Copiloto" --> APIGraphRAG

    %% Relações do Web
    Web -- "Valida CRM + Token" --> APIToken
    Web -- "Escuta Alertas ao Vivo" --> Realtime
    Realtime -. "Alerta Noturno Pisca na Tela" .-> Web
    Web -- "Consulta Prontuário & Gráficos" --> Postgres
    Web -- "Consulta Grafo Clínico" --> Postgres

    %% Relações do Gateway
    APIToken --> Postgres
    APIOcr --> Storage
    APIOcr --> Postgres
    APIGraphRAG --> HNSW
```

---

## 2. Subsistemas e Contratos de Dados

### 2.1 Protocolo de Consentimento Médico e Token Efêmero (Open Health)
1. **Geração no Mobile**: O paciente gera um token alfanumérico seguro de 6 dígitos (ex: `RV-8492` ou `R9K42X`) com TTL de 15 minutos.
2. **Persistência**: Gravado em `doctor_access_sessions` com `active = true`, `expires_at = NOW() + INTERVAL '15 min'` e escopo `['read_exams', 'read_wearables', 'read_graphrag_briefing']`.
3. **Validação no Web**: O médico preenche CRM + Estado + Nome e digita o token. A API valida:
   - Token existe, `active = true` e `expires_at > NOW()`.
   - Se aprovado, grava `doctor_crm` e `doctor_name` na sessão, emitindo credencial efêmera.
4. **Trilha de Auditoria & Revogação**:
   - O paciente vê no Mobile o log de quem acessou seu prontuário em tempo real.
   - O paciente pode revogar com 1 toque no app (`active = false`, `revoked_at = NOW()`).
   - Ao revogar ou expirar, o Web invalida imediatamente todo o cache clínico em memória.

---

### 2.2 Pipeline Documental em 2 Estágios (OCR Textual + Parser LLM)

```mermaid
sequenceDiagram
    autonumber
    actor Paciente as 📱 Paciente (Mobile)
    participant Storage as 🗄️ Supabase Storage
    participant API as ⚙️ Next.js /api/documents/process
    participant OCR as 🔍 Engine OCR (Texto Puro)
    participant LLM as 🧠 LLM (Structured JSON Schema)
    participant DB as 🗄️ PostgreSQL (lab_measurements)

    Paciente->>Storage: 1. Upload do PDF / Foto (Bucket: clinical-documents)
    Storage-->>Paciente: Retorna storage_path
    Paciente->>API: 2. Dispara processamento do arquivo
    API->>Storage: Obtém stream/bytes do arquivo
    API->>OCR: 3. Estágio 1: Extração do Texto Bruto fiel ao laudo
    OCR-->>API: Raw Text do Laudo Laboratorial
    API->>LLM: 4. Estágio 2: Mapeamento em JSON Schema com padronização canônica
    LLM-->>API: Array de Biomarcadores (valor, unidade, min, max, data, laboratório)
    API->>DB: 5. Insere em clinical_documents e em lote em lab_measurements
    DB-->>Paciente: Sincronização concluída (Linha do tempo atualizada)
```

---

### 2.3 Sinais Contínuos de Wearables e Realtime de Alta Fidelidade

- **Tabela**: `wearable_time_series` com restrição de idempotência e desduplicação `UNIQUE(patient_id, metric_type, recorded_at, source_device)`.
- **Métricas**: `heart_rate`, `hrv`, `spo2`, `sleep_deep`, `sleep_rem`, `sleep_score`.
- **Simulador de Palco**:
  - Quando o apresentador clica em *"Disparar Taquicardia Noturna (114 BPM)"* no Mobile:
  - 1. Insere a anomalia em `wearable_time_series` e o alerta em `clinical_alerts` (`category: wearable_anomaly`, `severity: critical`).
  - 2. O canal do Supabase Realtime dispara evento WebSocket para o Cockpit do Médico (`Web`).
  - 3. O painel médico atualiza a curva de BPM noturna instantaneamente, sem recarregar a página, destacando a correlação com a Ferritina Sérica de 22 ng/mL.

---

### 2.4 Knowledge Graph Dirigido por Eventos & Copiloto GraphRAG

- **Nós e Arestas Canônicas**:
  - Tabelas: `clinical_graph_nodes` e `clinical_graph_edges`.
  - Tipos de nós: `patient`, `biomarker`, `lab_result`, `symptom`, `medication`, `condition`, `wearable_alert`.
  - Arestas: `MEDIU`, `TOMA`, `CORRELACIONADO_COM`, `APRESENTA`, `INDICA`.
- **Busca Semântica**:
  - Cada nó possui vetor `embedding vector(384)` indexado via **HNSW**.
  - Função RPC `match_clinical_nodes(query_embedding, patient_id)` recupera os nós mais relevantes com similaridade de cosseno em milissegundos.
  - O Chat do Mobile e o Briefing do Médico citam exatamente as fontes e evidências encontradas no grafo.

---

## 3. Roadmap das 4 Fases de Implementação

```mermaid
gantt
    title Roadmap de Execução: Rivio Health Full-Stack
    dateFormat  YYYY-MM-DD
    section Fase 1
    Infraestrutura Supabase & Auth           :done, f1_1, 2026-11-12, 1d
    Token 6 Dígitos & Trilha de Auditoria    :active, f1_2, after f1_1, 1d
    section Fase 2
    Bucket Storage clinical-documents        :f2_1, after f1_2, 1d
    Pipeline OCR 2 Estágios (Raw + LLM)      :f2_2, after f2_1, 1d
    Hidratação de Prontuário e Laudos        :f2_3, after f2_2, 1d
    section Fase 3
    Série Temporal Wearables & Desduplicação :f3_1, after f2_3, 1d
    Supabase Realtime (Anomalia de Palco)    :f3_2, after f3_1, 1d
    section Fase 4
    Event-Driven Graph Builder               :f4_1, after f3_2, 1d
    Visualização @xyflow + GraphRAG no Chat :f4_2, after f4_1, 1d
```

### Detalhamento das 4 Fases:

#### **Fase 1: Infraestrutura de Conexão, Auth & Token Efêmero (Open Health Protocol)**
- Configurar credenciais do Supabase no Mobile e Web.
- Conectar a geração do token de 6 dígitos no Mobile (`ShareScreen.tsx`) diretamente à tabela `doctor_access_sessions`.
- Conectar a validação do token no Web (`Entry.tsx` / `/doctor/consultation`) com auditoria de CRM e expiração.
- Painel de auditoria no Mobile para o paciente ver acessos ativos e histórico.

#### **Fase 2: Prontuário Central, Storage & Pipeline Documental em 2 Estágios**
- Configuração do bucket `clinical-documents` no Supabase Storage com RLS.
- Criação do endpoint `/api/documents/process` executando: Estágio 1 (OCR de texto puro) + Estágio 2 (Parser JSON padronizado com `biomarkers`).
- Inserção em `clinical_documents` e `lab_measurements`.
- Conectar gráficos de biomarcadores (`BiomarkerChart` no mobile e `Evolution` no web) para ler dados reais do Supabase.

#### **Fase 3: Sinais Vitais Contínuos (Wearables) & Sincronização Realtime**
- Persistência das séries de Apple Watch em `wearable_time_series`.
- Ativação do Supabase Realtime no Web (`supabase.channel('public:clinical_alerts')`).
- Disparo da simulação de anomalia no Mobile atualizando o Cockpit Médico instantaneamente via WebSocket.

#### **Fase 4: Knowledge Graph Dirigido por Eventos & Copiloto GraphRAG**
- Serviço Event-Driven que sincroniza nós e arestas de causa/efeito a cada novo laudo ou anomalia.
- Renderização do grafo no Web via `@xyflow/react` lendo do Supabase.
- Rota `/api/assistant/chat` executando a RPC `match_clinical_nodes` com embeddings HNSW para o copiloto no Mobile com fontes clínicas citadas.
