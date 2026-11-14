import { describe, it, expect } from "vitest";
import { buildPatientSnapshotFromSupabase } from "../src/lib/supabase-data";
import { assertSnapshot } from "../src/lib/api/validate";
import * as validators from "../src/lib/api/validators.js";

interface ValidatorFn {
  (data: unknown): boolean;
  errors?: unknown[] | null;
}

const snapshotValidator = (validators as Record<string, unknown>).Snapshot as ValidatorFn;

describe("Supabase Snapshot Validation", () => {
  const patientIds = [
    "usr-marcos-2026",
    "usr-camila-2026",
    "usr-antonio-2026",
    "usr-rafael-2026",
  ];

  for (const id of patientIds) {
    it(`validates AJV and assertSnapshot for ${id}`, async () => {
      const s = await buildPatientSnapshotFromSupabase(id);
      expect(s).toBeDefined();

      const valid = snapshotValidator(s);
      if (!valid) {
        console.error(`ERROS AJV DETALHADOS EM ${id}:`, snapshotValidator.errors);
      }
      expect(snapshotValidator.errors).toBeNull();
      expect(() => assertSnapshot(s)).not.toThrow();
    });
  }
});
