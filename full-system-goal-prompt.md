# Prompt Mestre para Execução Autônoma (/goal): Unificação Full-Stack (Mobile + Web), Sincronização de Schemas no Supabase, Camada de Observabilidade de Transições e Espaço Médico vs. Espaço Equipe

Copie e cole o bloco abaixo em uma sessão com o comando `/goal` para executar de ponta a ponta toda a implementação, integração real com o banco de dados Supabase, camada de observabilidade de transições entre usuários e a divisão do frontend web em **Espaço Médico** e **Espaço Equipe**.

```markdown
/goal Execute o desenvolvimento autônomo completo, a sincronização de banco de dados (Supabase PostgreSQL + pgvector + Storage) e a integração real ponta a ponta entre o App Mobile do Paciente (`./mobile`), o Frontend/Backend Web (`./web`) e a Camada de Observabilidade de Transições de Dados do ecossistema Rivio, eliminando todos os mocks, funções parciais, hardcodings (`usr-dan-2026`) e desconexões entre schemas, e implementando no Frontend Web a alternância explícita entre o **"Espaço Médico"** (assistencial/clínico) e o **"Espaço Equipe"** (operações institucionais, observabilidade de transições, governança LGPD e bilhetagem por episódio).

### DIRETRIZES INEGOCIÁVEIS DE EXECUÇÃO:
1. **Zero Gambiarra, Zero Mock Isolado, 100% Persistido no Supabase:**
   - Nenhuma ação de criação, edição, exclusão, chat, geração/revogação de token, pedido/aprovação de vínculo contínuo (`followup`/`grant`), conclusão de revisão médica (`review`) ou episódio institucional pode ficar apenas em memória (`useState`/`Map`/Zustand). Todas as operações devem ler e gravar no banco de dados Supabase real.
2. **Unificação e Sincronização dos 2 Schemas do Banco (`rivio_*` + Schema Clínico/Grafo):**
   - Sincronize todos os 5 pacientes (`usr-marcos-2026`, `usr-camila-2026`, `usr-antonio-2026`, `usr-rafael-2026` e `usr-dan-2026`) entre `rivio_patients` e `patients`, garantindo integridade referencial (FKs) em todas as 19 tabelas do banco.
   - Popule o Grafo de Conhecimento Clínico (`clinical_graph_nodes` e `clinical_graph_edges`) e o dicionário `biomarkers` com vetores semânticos normalizados de 384 dimensões (`vector(384)`) para todos os pacientes, habilitando a busca vetorial real via RPC `match_clinical_nodes` (HNSW pgvector).
   - Configure e popule o bucket `clinical-documents` no Supabase Storage com laudos PDF reais para que a visualização/download de documentos originais (`original`) funcione de verdade.
   - Toda escrita clínica (upload de laudo, adição manual de exame, exclusão de exame/documento, injeção/reset de anomalia de wearable) deve manter sincronizadas tanto as tabelas `rivio_*` quanto as tabelas `clinical_documents`, `lab_measurements`, `wearable_time_series`, `clinical_alerts` e `clinical_graph_nodes`.
3. **Eliminação Total de Hardcodings de Paciente (`usr-dan-2026`):**
   - Todas as chamadas no Mobile e na Web devem operar dinamicamente sobre o `patientId` selecionado/autorizado. O listener Realtime e a resolução de tokens na Web devem detectar tokens de qualquer paciente em tempo real.

---

### ETAPA 1: Sincronização de Banco de Dados, Storage e Camada de Persistência Unificada
- Crie a migration consolidada em `supabase/migrations/20261114000000_unified_observability_and_sync.sql` documentando a unificação de schemas, políticas e estruturas de observabilidade.
- Crie e execute o script `web/scripts/sync-database.mjs` (usando `SUPABASE_SERVICE_ROLE_KEY`) que:
  1. Sincroniza os 5 pacientes (`usr-marcos-2026`, `usr-camila-2026`, `usr-antonio-2026`, `usr-rafael-2026`, `usr-dan-2026`) em `rivio_patients` e `patients` (incluindo contatos de emergência reais, alergias, condições crônicas e medicações).
  2. Sincroniza os 23 biomarcadores entre `rivio_biomarker_definitions` e `biomarkers` com embeddings `vector(384)`.
  3. Constrói e persiste nós (`clinical_graph_nodes` com embeddings `vector(384)`) e arestas (`clinical_graph_edges`) para todos os 5 pacientes a partir de seus exames, medicamentos, alertas e eventos clínicos.
  4. Cria o bucket `clinical-documents` no Supabase Storage e gera/envia arquivos PDF clínicos reais para os documentos dos pacientes, atualizando as referências para download real.
  5. Semeia eventos iniciais reais na trilha de observabilidade, sessões de acesso (`doctor_access_sessions`) e episódios institucionais demonstráveis.
- Crie uma API unificada de sincronização e persistência no Next.js (`/api/clinical/sync`, `/api/observability`, `/api/institutional`, `/api/assistant/chat`, `/api/documents/process`) que permita ao Mobile e à Web executar escritas transacionais autenticadas no Supabase com validação estrita.

---

### ETAPA 2: Conexão Integral do App Mobile do Paciente (`./mobile`) ao Banco de Dados
1. **Seleção Multi-Paciente Completa (`AuthScreen.tsx` & `useHealthStore.ts`):**
   - Carregue todos os pacientes do Supabase (`listPatients`), incluindo perfil completo, contato de emergência e alergias reais vindos do banco.
2. **Upload Real de Documentos e Extração Estruturada (`ExamIngestionScreen.tsx` & `useHealthStore.ts`):**
   - Ao enviar um documento/laudo, faça upload para o Supabase Storage (`clinical-documents`) ou via `/api/documents/process`, extraia biomarcadores reais baseados no conteúdo/metadados do documento e grave no Supabase em `rivio_documents`, `clinical_documents`, `rivio_exams`, `lab_measurements` e `clinical_graph_nodes` usando o `user.id` ativo, registrando o evento na trilha de observabilidade (`document_uploaded`).
3. **Adição Manual e Exclusão Real de Exames e Documentos (`addExamMeasurement`, `removeExam`, `deleteUploadedDocument`):**
   - `addExamMeasurement`: insira em `rivio_exams` e `lab_measurements` para o `user.id` ativo e atualize o grafo clínico no Supabase.
   - `removeExam` e `deleteUploadedDocument`: execute `DELETE` real em `rivio_exams`, `lab_measurements`, `rivio_documents` e `clinical_documents` no Supabase, removendo nós derivados órfãos e gravando evento de auditoria (`document_deleted` / `exam_deleted`).
4. **Simulador de Anomalia de Wearable Persistido (`WearablesScreen.tsx` & `useHealthStore.ts`):**
   - Adicione na UI de `WearablesScreen.tsx` os controles para injetar e restaurar o cenário de anomalia aguda (taquicardia noturna / queda de HRV e SpO₂).
   - `injectWearableAnomalyScenario` e `resetWearableScenario` devem gravar e remover os registros diretamente no Supabase (`rivio_wearable_daily`, `rivio_heart_rate_samples`, `rivio_alerts`, `wearable_time_series`, `clinical_alerts`) para o `user.id` ativo, disparando atualização em tempo real no Cockpit Web e registrando evento na camada de observabilidade.
5. **Chat Pessoal Hybrid GraphRAG Conectado ao Banco (`AssistantChatScreen.tsx` & `useHealthStore.ts`):**
   - Conecte `sendChatMessage` à rota `/api/assistant/chat` e/ou busca direta no Supabase que gera o vetor de consulta (384d), executa a RPC `match_clinical_nodes` (pgvector HNSW), cruza com as arestas de `clinical_graph_edges` e os exames/wearables/medicações reais do paciente ativo, e persiste todas as mensagens de pergunta/resposta no Supabase para que o histórico de conversa seja mantido entre sessões.
   - Substitua a transcrição de voz simulada fixa por um seletor contextual inteligente de comando de voz baseado nos alertas e biomarcadores reais do paciente ativo.
6. **Compartilhamento Open Health, Aprovação de Vínculo Contínuo e Auditoria LGPD Viva (`ShareScreen.tsx`):**
   - Gere e revogue tokens em `doctor_access_sessions` sempre para o `user.id` ativo, sincronizando alterações de escopo (`read_exams`, `read_wearables`, `read_clinical_context`, `read_alerts`, `read_graphrag_briefing`) em tempo real no banco.
   - Substitua a trilha de auditoria hardcoded por dados reais vindos do Supabase (`getDoctorAccessAudit` + eventos de transição da camada de observabilidade) com assinatura Realtime.
   - Exiba pedidos de acompanhamento contínuo (`followup_requests`) enviados pelo médico na Web para que o paciente possa **Aprovar** ou **Recusar** o vínculo duradouro diretamente no `ShareScreen.tsx`.
   - Alimente o Modal de Preview do Médico e o Cartão de Emergência (SOS) com os dados reais do paciente logado (`user`, `exams`, `activeAlerts`, `medications`, `emergencyContact`).

---

### ETAPA 3: Conexão Integral do Cockpit Web (`./web`) e Fechamento do Loop de Consentimento
1. **Resolução Dinâmica de Tokens e Escuta Realtime Multi-Paciente (`entry.tsx` & `invitation.tsx`):**
   - Remova o filtro hardcoded `patient_id=eq.usr-dan-2026`. Escute `doctor_access_sessions` para todos os pacientes e exiba os tokens ativos recém-gerados no Mobile com identificação do paciente e contagem regressiva.
   - Faça `invitation.tsx` (`/doctor/consultation/[token]`) resolver tokens diretamente no Supabase (`resolveDoctorToken`), validando expiração, revogação e escopos reais e registrando o evento `token_resolved` na camada de observabilidade.
2. **Filtragem Estrita por Escopo (`buildPatientSnapshotFromSupabase`):**
   - Aplique `projectFixture(snapshot, activeScopes)` na construção do Snapshot a partir do Supabase para garantir que seções não autorizadas pelo paciente no Mobile (`not_shared`) tenham seus itens, evidências, fontes e nós do grafo suprimidos sem vazamento de dados.
3. **Revalidação de Acesso em Tempo Real e Revogação Ponta a Ponta (`access()`, `closeTemporary()`, `workspace.tsx`):**
   - Faça `api.access()` consultar o estado real da sessão/vínculo no Supabase (`doctor_access_sessions` / grants) a cada 15s e via Realtime. Quando o paciente revogar o acesso ou alterar os escopos no Mobile, o Cockpit Web deve detectar imediatamente a nova `accessRevision` ou o estado `revoked`, limpando os dados clínicos da tela na hora.
   - Faça `closeTemporary()` desativar a sessão temporária no Supabase e registrar o encerramento na trilha de auditoria.
4. **Fluxo Completo de Pedido de Acompanhamento (`requestFollowup`, `followup`), Novidades (`updates`) e Revisão (`review`):**
   - Implemente `requestFollowup` e `followup` persistindo no Supabase e permitindo que a aprovação pelo paciente no Mobile promova o acesso para um vínculo contínuo (`grant`) na Carteira do Médico.
   - Implemente `updates` e `review` persistindo o cursor de revisão por médico/paciente no Supabase (`lastReviewedCursor`, `lastReviewedAt`), atualizando o status da carteira e registrando o evento na camada de observabilidade.
5. **Streaming Real de Laudos Originais (`original`):**
   - Conecte `original()` e a rota de conteúdo de documentos ao bucket `clinical-documents` do Supabase Storage (com geração automática de PDF clínico estruturado caso o documento tenha sido ingerido sem binário prévio), marcando `originalAvailable: true` nos documentos válidos.

---

### ETAPA 4: Camada de Observabilidade de Transições e Alternância "Espaço Médico" vs. "Espaço Equipe" na Web
1. **Motor de Observabilidade de Transições e Fluxo Institucional (`web/src/lib/observability/` & `/api/observability`, `/api/institutional`):**
   - Implemente o registro imutável (append-only no Supabase) de todas as transições de dados entre usuários:
     - `token_created`, `token_resolved`, `scope_updated`, `token_revoked`, `temporary_closed`
     - `snapshot_read`, `original_document_viewed`, `review_completed`
     - `followup_requested`, `grant_approved`, `grant_rejected`
     - `document_uploaded`, `document_deleted`, `exam_added`, `exam_deleted`, `wearable_anomaly_injected`
     - `episode_prepared` (`prepareContext`), `episode_read` (`readContext`), `receipt_confirmed` (`confirmReceipt`)
   - Implemente o módulo de **Episódios de Acesso Institucional** conforme `docs/institutional-access-flow.md` e `docs/institutional-data-residency.md`:
     - Chave única por `(institutionId, patientId, attendanceRef, purpose)`.
     - TTL de 15 minutos para o cache de materialização institucional (sem renovação por refresh/leitura).
     - Emissão de recibo opaco (`receiptToken`) junto ao pacote qualificado e confirmação idempotente via `confirmReceipt`.
     - Separação estrita entre **Eventos de Uso** (`usage_events`: toda chamada técnica, tentativa negada, releitura ou pacote parcial = R$ 0 / não cobrável) e **Eventos de Cobrança** (`billing_events`: no máximo 1 unidade cobrável por episódio após a primeira confirmação válida de pacote clínico qualificado, bloqueando cobrança se revogado antes da confirmação).
2. **Seletor Global no Frontend Web: "Espaço Médico" vs. "Espaço Equipe" (`Shell` em `web/src/features/session/shell.tsx`):**
   - Adicione no topo (`topbar`) e na navegação (`rail`) do Frontend Web um seletor claro e acessível que alterna entre duas superfícies distintas:
     - **Visão 1 — "Espaço Médico" (Superfície Assistencial Clínica):**
       - Destinada ao médico no cuidado direto ao paciente.
       - Exibe Carteira de Pacientes, Entrada de Token/QR em tempo real, e Espaço do Paciente (Resumo com Briefing rastreável, Evolução temporal, Histórico unificado, Grafo de Relações, Inspector de Evidências com PDF original, barra de Revisão de Novidades, Solicitação de Vínculo Contínuo e widget de Status de Consentimento/Transição da sessão atual).
     - **Visão 2 — "Espaço Equipe" (Superfície de Operações Institucionais, Observabilidade de Transições, Governança LGPD & Bilhetagem):**
       - Destinada à equipe técnica, auditoria de governança e gestão operacional da instituição de saúde.
       - **Segregação de Privacidade Clínica:** Respeita rigorosamente a regra de `docs/institutional-data-residency.md` — exibe metadados de transição, IDs opacos, revisões (`dataRevision`, `accessRevision`), escopos, fontes, cobertura, latência e status de confirmação/cobrança, **sem expor valores laboratoriais, diagnósticos ou textos de laudos dos pacientes**.
       - Composta por 4 abas/módulos operacionais conectados em tempo real ao Supabase:
         1. **Fluxo & Transições (Live Audit Trail):** Linha do tempo em tempo real de todas as transições de dados Paciente ↔ Médico ↔ Instituição com filtros por ator, tipo de transição e decisão (`allowed`, `denied`, `revoked`, `partial`).
         2. **Episódios Institucionais (`prepareContext` / `readContext` / `confirmReceipt`):** Console interativo para iniciar episódios de atendimento institucional, inspecionar o manifesto do pacote clínico, acompanhar o TTL de 15 min do cache de residência híbrida, confirmar recebimento via `receiptToken` e testar cenários de idempotência, retry e revogação pré/pós-confirmação.
         3. **Eventos de Uso vs. Cobrança (Auditoria de Bilhetagem):** Tabela comparativa e métricas em tempo real demonstrando a regra "Zero cobrança por clique/releitura/falha" (`usage_events` vs. `billing_events` com chave única por episódio).
         4. **Governança de Fontes & Consentimentos Ativos:** Controle operacional do estado dos conectores (`data_sources`: Fleury, Dasa, Salomão Zoppi, Apple Watch HealthKit — permitindo alternar entre `connected`, `stale` e `disconnected` no banco) e gestão administrativa das sessões de compartilhamento (`doctor_access_sessions`) e pedidos de vínculo (`followup_requests`).

---

### ETAPA 5: Validação Automatizada, Testes de Integração e Verificação Ponta a Ponta
- Execute o script de sincronização do banco (`node --env-file=.env.local scripts/sync-database.mjs`) e valide que todas as tabelas e o Storage do Supabase estão populados e sincronizados.
- Crie testes automatizados (`vitest`) cobrindo:
  - Sincronização e projeção de escopos (`projectFixture` em `buildPatientSnapshotFromSupabase`).
  - Ciclo completo de observabilidade de transições (criação de token → resolução → mudança de escopo → revogação).
  - Módulo de episódios institucionais (`prepareContext`, `readContext`, `confirmReceipt`, idempotência de unidade cobrável, bloqueio por revogação e expiração de cache de 15 min).
  - Alternância e renderização distinta entre **"Espaço Médico"** e **"Espaço Equipe"** (garantindo que o Espaço Equipe não vaza valores clínicos sensíveis).
- Execute `npm run typecheck`, `npm run lint` e `npm test` em `./web` e `npx tsc --noEmit` em `./mobile`, garantindo 0 erros e 100% dos testes passando.
```
