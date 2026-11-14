# Case: Hybrid Data Residency & Idempotent Institutional Episode Billing
- **Date:** 2026-11-14
- **Domain:** Engineering
- **Type:** Positive
- **Trigger / Context:** Implementing `docs/institutional-access-flow.md` and `docs/institutional-data-residency.md` along with the "Espaço Médico" vs. "Espaço Equipe" separation in the web frontend.

## Pattern / Technique
1. Separate **Usage Events** (`usage_events`: technical calls, retries, partial deliveries, revoked attempts = R$ 0.00) from **Billing Events** (`billing_events`: at most 1 billable unit per episode `(institutionId, patientId, attendanceRef, purpose)` upon valid `confirmReceipt` with opaque `receiptToken`).
2. Enforce a fixed 15-minute TTL on institutional context materialization (`cacheExpiresAt`) that does NOT extend on `readContext` or UI refresh.
3. Enforce strict clinical privacy in **"Espaço Equipe"**: display only opaque IDs, transition metadata, revisions (`accessRevision`, `dataRevision`), scopes, connector states, and billing/usage audit trails—never lab values, diagnoses, or clinical report bodies.

## Concrete Artifact / Code Snippet / Prompt
```ts
// Idempotent episode key: (institutionId, patientId, attendanceRef, purpose)
// Fixed 15-min TTL:
cacheExpiresAt: new Date(now + 15 * 60 * 1000).toISOString()
```

## Takeaway & Heuristic
- **Do:** Revalidate `doctor_access_sessions` on every `prepareContext`, `readContext`, `confirmReceipt`, and `api.access()` call; block billing if revoked before confirmation.
- **Don't:** Never leak lab results, clinical text, or biomarker values into the "Espaço Equipe" surface or into `TransitionAuditEvent` / `BillingEventRecord` payloads.
