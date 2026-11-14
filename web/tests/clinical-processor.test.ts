import { describe, expect, it } from 'vitest';
import { ClinicalDataProcessor } from '../src/lib/clinical/processor';
import { HypothesisEngine } from '../src/lib/clinical/hypothesis-engine';

describe('ClinicalDataProcessor', () => {
  it('calculates longitudinal trajectories correctly (deltas, velocity, percentage change)', () => {
    const rawMeasurements = [
      { id: 'ex-1', biomarker_id: 'glicose', occurred_on: '2022-03-15', value: 84, unit: 'mg/dL', status: 'normal' },
      { id: 'ex-2', biomarker_id: 'glicose', occurred_on: '2023-05-20', value: 89, unit: 'mg/dL', status: 'normal' },
      { id: 'ex-3', biomarker_id: 'glicose', occurred_on: '2024-08-10', value: 94, unit: 'mg/dL', status: 'normal' },
      { id: 'ex-4', biomarker_id: 'glicose', occurred_on: '2025-10-18', value: 104, unit: 'mg/dL', status: 'attention', ref_min: 70, ref_max: 99 },
    ];

    const trajectories = ClinicalDataProcessor.processLabTrajectories(rawMeasurements);
    const glic = trajectories.get('glicose');

    expect(glic).toBeDefined();
    expect(glic?.firstValue).toBe(84);
    expect(glic?.latestValue).toBe(104);
    expect(glic?.delta).toBe(20);
    expect(glic?.percentageChange).toBe(23.8);
    expect(glic?.direction).toBe('ascending');
    expect(glic?.isBreached).toBe(true);
    expect(glic?.statusTransition).toBe('normal → attention');
  });

  it('detects wearable baseline deviations and nocturnal tachycardia clusters', () => {
    const rawWearables = [
      { id: 'w-1', metric_type: 'heart_rate', value: 62, unit: 'bpm', recorded_at: '2026-11-10T08:00:00Z', metadata: { context: 'resting' } },
      { id: 'w-2', metric_type: 'heart_rate', value: 114, unit: 'bpm', recorded_at: '2026-11-11T03:30:00Z', metadata: { context: 'sleep_spike', anomaly: true, duration_minutes: 15 } },
      { id: 'w-3', metric_type: 'hrv', value: 58, unit: 'ms', recorded_at: '2026-11-10T07:00:00Z' },
      { id: 'w-4', metric_type: 'hrv', value: 24, unit: 'ms', recorded_at: '2026-11-11T07:00:00Z', metadata: { anomaly: true } },
      { id: 'w-5', metric_type: 'sleep_deep', value: 80, unit: 'min', recorded_at: '2026-11-10T06:00:00Z' },
      { id: 'w-6', metric_type: 'sleep_deep', value: 25, unit: 'min', recorded_at: '2026-11-11T06:00:00Z', metadata: { alert: 'deep_sleep_depleted' } },
    ];

    const analysis = ClinicalDataProcessor.processWearables(rawWearables);

    expect(analysis.restingHrBaseline).toBe(62);
    expect(analysis.nocturnalSpikes.length).toBe(1);
    expect(analysis.nocturnalSpikes[0].peakBpm).toBe(114);
    expect(analysis.hrvSuppressionPercent).toBeGreaterThan(50);
    expect(analysis.deepSleepDeficitPercent).toBeGreaterThan(60);
    expect(analysis.overallAnomalyDetected).toBe(true);
  });
});

describe('HypothesisEngine', () => {
  it('synthesizes multi-modal hypothesis for ferritin depletion and nocturnal tachycardia', () => {
    const rawMeasurements = [
      { id: 'ex-fer-1', biomarker_id: 'ferritina', occurred_on: '2022-03-15', value: 85, unit: 'ng/mL', status: 'normal' },
      { id: 'ex-fer-2', biomarker_id: 'ferritina', occurred_on: '2025-10-18', value: 22, unit: 'ng/mL', status: 'attention', ref_min: 30, ref_max: 400 },
    ];
    const rawWearables = [
      { id: 'w-1', metric_type: 'heart_rate', value: 60, unit: 'bpm', recorded_at: '2026-11-10T08:00:00Z' },
      { id: 'w-2', metric_type: 'heart_rate', value: 118, unit: 'bpm', recorded_at: '2026-11-11T03:40:00Z', metadata: { anomaly: true, context: 'sleep_spike' } },
      { id: 'w-3', metric_type: 'hrv', value: 58, unit: 'ms', recorded_at: '2026-11-10T07:00:00Z' },
      { id: 'w-4', metric_type: 'hrv', value: 22, unit: 'ms', recorded_at: '2026-11-11T07:00:00Z', metadata: { anomaly: true } },
    ];

    const trajectories = ClinicalDataProcessor.processLabTrajectories(rawMeasurements);
    const wearables = ClinicalDataProcessor.processWearables(rawWearables);

    const hypotheses = HypothesisEngine.generateHypotheses({
      patientId: 'usr-dan-2026',
      patientName: 'Daniel Vaz',
      trajectories,
      wearables,
    });

    const ironHyp = hypotheses.find((h) => h.id.includes('hyp-ferritin-tachycardia'));
    expect(ironHyp).toBeDefined();
    expect(ironHyp?.confidence).toBeGreaterThanOrEqual(0.9);
    expect(ironHyp?.basis).toBe('clinical_inference');
    expect(ironHyp?.clinicalRationale.toLowerCase()).toContain('ferritina');
    expect(ironHyp?.graphNodes.length).toBeGreaterThan(0);
    expect(ironHyp?.graphEdges.length).toBeGreaterThan(0);
  });

  it('synthesizes metabolic resistance hypothesis when glucose rises consecutively', () => {
    const rawMeasurements = [
      { id: 'ex-g1', biomarker_id: 'glicose', occurred_on: '2022-03-15', value: 84, unit: 'mg/dL', status: 'normal' },
      { id: 'ex-g2', biomarker_id: 'glicose', occurred_on: '2025-10-18', value: 104, unit: 'mg/dL', status: 'attention', ref_min: 70, ref_max: 99 },
      { id: 'ex-l1', biomarker_id: 'ldl', occurred_on: '2022-03-15', value: 112, unit: 'mg/dL', status: 'normal' },
      { id: 'ex-l2', biomarker_id: 'ldl', occurred_on: '2025-10-18', value: 156, unit: 'mg/dL', status: 'critical', ref_min: 0, ref_max: 130 },
    ];

    const trajectories = ClinicalDataProcessor.processLabTrajectories(rawMeasurements);
    const wearables = ClinicalDataProcessor.processWearables([]);

    const hypotheses = HypothesisEngine.generateHypotheses({
      patientId: 'usr-dan-2026',
      patientName: 'Daniel Vaz',
      trajectories,
      wearables,
    });

    const metaHyp = hypotheses.find((h) => h.id.includes('hyp-metabolic-resistance'));
    expect(metaHyp).toBeDefined();
    expect(metaHyp?.confidence).toBeGreaterThanOrEqual(0.85);
    expect(metaHyp?.summary).toContain('104 mg/dL');
  });
});
