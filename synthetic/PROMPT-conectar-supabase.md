Conecte o app mobile (Expo/React Native) e o portal do médico (Next.js) ao Supabase, lendo os dados sintéticos das tabelas `rivio_*`, substituindo os dados mockados/seed atuais. Leia `DESIGN.md` e mantenha a identidade visual Rivio existente.

## Contexto
- Projeto Supabase: `https://ngxqzfvfehendlsyxhmq.supabase.co`. Clientes já criados em `mobile/src/lib/supabase.ts` e `web/src/lib/supabase.ts`; chaves publicáveis já estão em `mobile/.env.local` (`EXPO_PUBLIC_SUPABASE_*`) e `web/.env.local` (`NEXT_PUBLIC_SUPABASE_*`).
- Use SOMENTE a publishable key no cliente. Nunca use `SUPABASE_SERVICE_ROLE_KEY` em código de app/navegador.
- RLS: as policies de `synthetic/supabase/policies.sql` liberam apenas SELECT. Não tente escrever nas tabelas.
- Esquema: `synthetic/supabase/schema.sql`. Tabelas: `rivio_patients`, `rivio_biomarker_definitions`, `rivio_documents`, `rivio_exams`, `rivio_wearable_daily`, `rivio_heart_rate_samples`, `rivio_alerts`, `rivio_medications`, `rivio_clinical_events`.
- Pacientes (4): `usr-marcos-2026` (diabetes tipo 2), `usr-camila-2026` (saudável), `usr-antonio-2026` (leishmaniose visceral), `usr-rafael-2026` (H1N1). Cada um tem ~365 dias de wearables, FC horária dos últimos 60 dias, exames, alertas, medicações e eventos.
- Os tipos do app estão em `mobile/src/types/index.ts` (snake_case no banco → camelCase nos tipos; crie um mapper por tabela).

## Mobile (`mobile/`)
1. Crie `mobile/src/data/supabaseRepo.ts` com funções: `listPatients()`, `getPatient(id)`, `getExams(id)`, `getBiomarkerDefinitions()`, `getWearables(id, days)`, `getHeartRateSamples(id, days)`, `getAlerts(id)`, `getMedications(id)`, `getEvents(id)`, `getDocuments(id)`. Pagine com `.range()` em blocos de 1000 (limite padrão da API) e ordene por data.
2. Adapte `useHealthStore` (Zustand): carregar do Supabase no login/seleção de paciente em vez de `seedData`. Estados `loading`/`error` e fallback para o seed apenas se a rede falhar.
3. `AuthScreen`: substitua o login demo por um seletor dos 4 pacientes (cards com nome, idade, cenário). O paciente escolhido define o `patient_id` usado em todas as telas.
4. Telas: Home (anel de prontidão a partir do último `wearable_daily`, alerta mais recente), Timeline (mescla `rivio_exams` + `rivio_clinical_events` por data), Wearables (séries diárias + FC horária), Exames (gráficos por biomarcador com faixa de referência e `status`), Chat/Compartilhar mantêm o comportamento atual usando os dados carregados.
5. Biomarcadores novos (renal, hepático, nutricional, PCR, VHS, ferritina etc.) devem renderizar sem quebrar os gráficos; categorias estão em `BiomarkerCategory`.

## Portal do médico (`web/`)
1. Crie `web/src/lib/supabase-data.ts` (server-safe, usando `@supabase/supabase-js` com a publishable key) com as mesmas consultas, tipadas conforme `web/src/lib/api/types.ts`/`generated.ts`.
2. Mantenha o contrato existente do portal (`web/src/lib/api/doctor-api.ts`, rota proxy `/api/doctor/v0/[...path]`, modo demo). Implemente um novo adaptador "supabase" que devolve o mesmo formato do fixture demo (`web/src/lib/demo/api.ts`), ligado por variável `DOCTOR_DATA_SOURCE=supabase` (padrão continua demo).
3. Telas: Carteira de pacientes (`/doctor/patients`) lista os 4 de `rivio_patients` com último exame e alertas abertos; Paciente (`/doctor/patients/[patientId]`) mostra briefing, evolução (Recharts; sinais vitais + biomarcadores com marcadores de medicação de `rivio_medications`), evidências (exames + laudos de `rivio_documents`) e grafo clínico (`@xyflow/react`) derivado de exames ↔ medicações ↔ eventos ↔ alertas.
4. Briefing pré-consulta: gerar texto determinístico (sem LLM) com: condições crônicas, medicações ativas (`end_date is null`), exames fora da faixa mais recentes, alertas não resolvidos e eventos dos últimos 90 dias.

## Qualidade e critérios de aceite
- `cd web && npm run typecheck && npm run lint && npm test` passam; os testes existentes não podem regredir (ajuste fixtures só se necessário).
- `cd mobile && npx tsc --noEmit` passa.
- Cada cenário aparece de forma reconhecível: Marcos com HbA1c caindo de 8,9% para 6,7%; Antônio com pancitopenia e ferritina até 2.100 na internação e recuperação depois; Rafael com queda de SpO₂ (~93%) e taquicardia em 21–26/out/2026; Camila sem alertas e todos os exames normais.
- Estados vazios, de carregamento e de erro tratados; nenhum valor ausente vira zero em gráfico.
- Não inclua chaves em código ou logs; não commite `.env.local`.
- Ao final, rode o app/portal, valide visualmente os 4 pacientes e liste o que foi alterado e o que ficou pendente.
