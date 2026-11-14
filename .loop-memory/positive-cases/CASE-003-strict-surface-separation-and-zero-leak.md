# Case: Strict Surface Separation (Espaço Médico vs. Espaço Equipe) & Zero-Leak LGPD
- **Date:** 2026-11-14
- **Domain:** Engineering
- **Type:** Positive
- **Trigger / Context:** Implementing explicit dual-surface toggle in Web Shell with live observability, institutional episode billing, and LGPD strict separation.

## Pattern / Technique
1. **Explicit Surface Toggle in UI (`Shell`):**
   - Provide dedicated, accessible tab buttons in both topbar (`role="tablist"`) and rail (`aria-pressed`) allowing instantaneous switching between `"Espaço Médico"` (`surface === "medico"`) and `"Espaço Equipe"` (`surface === "equipe"`).
2. **Strict Clinical Privacy in "Espaço Equipe":**
   - Completely omit numerical biomarker values, lab result units, clinical diagnoses, and free-text reports from the Team Space surface.
   - Restrict rendering to operational KPIs, opaque IDs, actor roles (`patient`, `doctor`, `institution_system`, `team_ops`), transition events, connector status toggles (`data_sources`), 15-minute TTL cache trackers, and idempotent commercial billing records (max 1 billable unit of R$ 18.50 per confirmed qualified episode).
3. **Idempotent Dual-Run Automated Tests:**
   - Always load `.env.local` in `vitest.config.mts` safely via standard `fs.readFileSync` avoiding missing external dependencies (like `dotenv`).
   - Use dynamic unique references (`ATEND-TEST-${Date.now()}`) in integration test runs so replay and idempotency invariants are proven without collision across sequential test executions.

## Concrete Artifact / Code Snippet / Prompt
```tsx
// Surface toggle in Shell:
<button role="tab" aria-selected={surface === "medico"} onClick={() => setSurface("medico")}>
  Espaço Médico
</button>
<button role="tab" aria-selected={surface === "equipe"} onClick={() => setSurface("equipe")}>
  Espaço Equipe
</button>

// Render separation:
{surface === "equipe" ? <TeamSpace /> : <div key={...}>{children}</div>}
```

## Takeaway & Heuristic
- **Do:** Always keep clinical care separate from operational governance and billing audit logs. Ensure 100% of test suites and typechecks pass deterministically.
- **Don't:** Never expose clinical parameters or raw medical text in administrative/governance views.
