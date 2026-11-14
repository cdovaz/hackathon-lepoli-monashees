# Case: Dual-Schema Synchronization & 384d HNSW Embeddings in Supabase
- **Date:** 2026-11-14
- **Domain:** Engineering
- **Type:** Positive
- **Trigger / Context:** Syncing 5 patients (`usr-marcos-2026`, `usr-camila-2026`, `usr-antonio-2026`, `usr-rafael-2026`, `usr-dan-2026`) across `rivio_*` tables and `patients` / `clinical_*` / `clinical_graph_nodes` tables with `vector(384)` embeddings.

## Pattern / Technique
Maintain referential integrity and complete parity between the patient personal vault tables (`rivio_patients`, `rivio_documents`, `rivio_exams`, `rivio_wearable_daily`, `rivio_alerts`, `rivio_medications`, `rivio_clinical_events`) and the clinical intelligence/graph tables (`patients`, `clinical_documents`, `lab_measurements`, `wearable_time_series`, `clinical_alerts`, `clinical_graph_nodes`, `clinical_graph_edges`). Use deterministic 384-dimensional normalized semantic vectors (`computeEmbedding384`) so `match_clinical_nodes` (pgvector HNSW) works reliably without external API failures.

## Concrete Artifact / Code Snippet / Prompt
```ts
// Always dual-write or sync via unified endpoint/repo:
await supabase.from('rivio_exams').upsert(rivioExamRow, { onConflict: 'id' });
await supabase.from('lab_measurements').upsert(clinicalLabRow, { onConflict: 'id' });
await supabase.from('clinical_graph_nodes').upsert(graphNodeWith384Embedding, { onConflict: 'id' });
```

## Takeaway & Heuristic
- **Do:** Always pass the active `patientId` (`user.id`) dynamically and persist to both `rivio_*` and clinical graph schemas, plus record an immutable transition event in the observability layer.
- **Don't:** Never hardcode `'usr-dan-2026'` as default when another patient is authenticated or selected.
