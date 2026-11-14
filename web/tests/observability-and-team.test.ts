import { describe, it, expect } from "vitest";
import {
  recordTransitionEvent,
  listTransitionEvents,
  prepareInstitutionalContext,
  readInstitutionalContext,
  confirmInstitutionalReceipt,
  createFollowupRequestInDb,
  decideFollowupRequestInDb,
  recordDoctorReviewInDb,
  updateDataSourceState,
  getObservabilityDashboardState,
} from "@/lib/observability/engine";

describe("Observability & Institutional Deep Module Invariants", () => {
  it("records immutable transition events without leaking clinical values", async () => {
    const event = await recordTransitionEvent({
      patientId: "usr-marcos-2026",
      patientName: "Marcos Vinicius",
      eventType: "token_resolved",
      actorRole: "doctor",
      actorId: "doc-roberto-123456",
      actorName: "Dr. Roberto Silva",
      recipientId: "usr-marcos-2026",
      recipientName: "Marcos Vinicius",
      institutionName: "Hospital Sírio-Libanês",
      scopes: ["read_exams", "read_wearables"],
      decision: "allowed",
      accessRevision: "rev-acc-1",
      dataRevision: "rev-dat-1",
      summary: "Médico validou token temporário MRC206",
    });

    expect(event).toBeDefined();
    expect(event.id).toBeDefined();
    expect(event.decision).toBe("allowed");
    expect(event.scopes).toEqual(["read_exams", "read_wearables"]);

    const list = await listTransitionEvents({ patientId: "usr-marcos-2026", limit: 10 });
    expect(list.some((e) => e.id === event.id)).toBe(true);
  });

  it("handles institutional episode lifecycle: 15-min TTL and idempotent billing", async () => {
    const uniqueRef = `ATEND-TEST-${Date.now()}`;
    const prepInput = {
      institutionId: "inst-test-sirio",
      institutionName: "Hospital Sírio-Libanês",
      patientId: "usr-marcos-2026",
      attendanceRef: uniqueRef,
      purpose: "emergencia",
      professionalName: "Dr. Roberto Silva",
      professionalId: "CRM 123456-SP",
      idempotencyKey: `idem-${uniqueRef}`,
      requestedScopes: ["read_exams", "read_wearables"],
    };

    // 1. prepareContext
    const res1 = await prepareInstitutionalContext(prepInput);
    const ep1 = res1.episode;
    expect(ep1.episodeId).toBeDefined();
    expect(ep1.receiptToken).toBeDefined();
    expect(ep1.readCount).toBe(1);

    const ttlMs = new Date(ep1.cacheExpiresAt).getTime() - new Date(ep1.obtainedAt).getTime();
    expect(ttlMs).toBe(15 * 60 * 1000); // 15 minutos exatos

    // Replay idempotente de prepareContext
    const res1Repeat = await prepareInstitutionalContext(prepInput);
    expect(res1Repeat.episode.episodeId).toBe(ep1.episodeId);
    expect(res1Repeat.reused).toBe(true);

    // 2. readContext sem estender o TTL
    const read1 = await readInstitutionalContext(ep1.episodeId);
    expect(read1?.episode?.episodeId).toBe(ep1.episodeId);
    expect(read1?.episode?.cacheExpiresAt).toBe(ep1.cacheExpiresAt);
    expect(read1?.episode?.readCount).toBe(2);

    // 3. confirmReceipt gerando exatamente 1 unidade faturável
    const conf1 = await confirmInstitutionalReceipt({
      episodeId: ep1.episodeId,
      receiptToken: ep1.receiptToken,
    });
    if (conf1.errorCode) {
      console.log("CONFIRM ERROR CODE:", conf1.errorCode, "packageStatus:", conf1.episode?.packageStatus, "qualified:", conf1.episode?.qualified);
    }
    expect(conf1.episode?.deliveryStatus).toBe("confirmed");
    expect(conf1.billingEvent).toBeDefined();
    expect(conf1.billingEvent?.unitPriceBrl).toBe(18.5);

    // Replay de confirmação não duplica fatura
    const conf2 = await confirmInstitutionalReceipt({
      episodeId: ep1.episodeId,
      receiptToken: ep1.receiptToken,
    });
    expect(conf2.billingEvent?.id).toBe(conf1.billingEvent?.id);
    expect(conf2.idempotentReplay).toBe(true);
  }, 15000);

  it("handles follow-up requests and decisions in DB", async () => {
    const req = await createFollowupRequestInDb({
      invitationId: "inv-test-camila",
      patientId: "usr-camila-2026",
      doctorId: "doc-roberto",
      doctorName: "Dr. Roberto Silva",
      doctorCrm: "123456-SP",
      institutionName: "Clínica Médica",
      requestedScopes: ["read_exams", "read_wearables"],
      requestedDuration: { mode: "indefinite", expiresAt: null },
    });

    expect(req.id).toMatch(/^fup-/);
    expect(req.status).toBe("pending_patient_approval");

    const approved = await decideFollowupRequestInDb(req.id, "approved");
    expect(approved?.status).toBe("approved");
    expect(approved?.grantId).toMatch(/^grant-/);
  }, 15000);

  it("records doctor longitudinal review in DB", async () => {
    const rev = await recordDoctorReviewInDb({
      patientId: "usr-antonio-2026",
      doctorId: "doc-123",
      doctorName: "Dr. Roberto Silva",
      snapshotId: "snap-123",
      reviewToken: "cursor-rev-100",
    });

    expect(rev.id).toBeDefined();
    expect(rev.lastReviewedCursor).toBe("cursor-rev-100");
  });

  it("updates data source states and returns dashboard metrics", async () => {
    const updated = await updateDataSourceState("src-sabin", "disconnected");
    expect(updated?.state).toBe("disconnected");

    const dash = await getObservabilityDashboardState();
    expect(dash.metrics.totalTransitions).toBeGreaterThan(0);
    expect(dash.sources.some((s) => s.id === "src-sabin" && s.state === "disconnected")).toBe(true);

    // Restaura para connected
    await updateDataSourceState("src-sabin", "connected");
  });
});
