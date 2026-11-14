/**
 * Processador Clínico Longitudinal - Hub de Saúde Rivio
 * 
 * Responsável por:
 * 1. Calcular trajetórias de biomarcadores (deltas, variação percentual, velocidade anual, quebra de referências).
 * 2. Processar séries temporais de wearables (linha de base, desvios noturnos de FC, supressão de HRV e déficit de sono profundo).
 * 3. Identificar achados estruturados com evidências referenciadas para o Grafo de Conhecimento e Briefing Clínico de 30s.
 */

export interface BiomarkerTrajectory {
  biomarkerId: string;
  canonicalName: string;
  unit: string;
  firstValue: number;
  latestValue: number;
  firstDate: string;
  latestDate: string;
  delta: number;
  percentageChange: number;
  yearsTracked: number;
  velocityPerYear: number;
  direction: 'ascending' | 'descending' | 'stable';
  statusTransition: string;
  isBreached: boolean;
  refMin: number | null;
  refMax: number | null;
  measurementCount: number;
  history: Array<{ date: string; value: number; status: string; id: string }>;
}

export interface WearableBaselineAnalysis {
  restingHrBaseline: number;
  latestRestingHr: number;
  nocturnalSpikes: Array<{
    peakBpm: number;
    recordedAt: string;
    durationMinutes: number;
    context: string;
  }>;
  hrvBaseline: number;
  latestHrv: number;
  hrvSuppressionPercent: number;
  deepSleepBaselineMinutes: number;
  latestDeepSleepMinutes: number;
  deepSleepDeficitPercent: number;
  overallAnomalyDetected: boolean;
}

export interface StructuredClinicalFinding {
  id: string;
  title: string;
  category: 'metabolic' | 'cardiovascular' | 'hematologic' | 'hormonal' | 'wearable_anomaly';
  severity: 'info' | 'warning' | 'critical';
  basis: 'recorded_fact' | 'clinical_inference' | 'temporal_correlation';
  summary: string;
  evidenceIds: string[];
}

export class ClinicalDataProcessor {
  /**
   * Processa medições laboratoriais e calcula trajetórias evolutivas
   */
  static processLabTrajectories(
    measurements: Array<{
      id: string;
      biomarker_id: string;
      occurred_on: string;
      value: number | string;
      unit: string;
      ref_min?: number | string | null;
      ref_max?: number | string | null;
      status?: string;
      biomarker?: { canonical_name?: string };
    }>
  ): Map<string, BiomarkerTrajectory> {
    const trajectories = new Map<string, BiomarkerTrajectory>();

    // Agrupa por biomarcador
    const grouped = new Map<string, typeof measurements>();
    for (const m of measurements) {
      const list = grouped.get(m.biomarker_id) ?? [];
      list.push(m);
      grouped.set(m.biomarker_id, list);
    }

    for (const [bioId, items] of grouped.entries()) {
      // Ordena cronologicamente
      const sorted = [...items].sort(
        (a, b) => new Date(a.occurred_on).getTime() - new Date(b.occurred_on).getTime()
      );

      const first = sorted[0];
      const latest = sorted[sorted.length - 1];
      const firstVal = Number(first.value);
      const latestVal = Number(latest.value);

      const firstTime = new Date(first.occurred_on).getTime();
      const latestTime = new Date(latest.occurred_on).getTime();
      const diffYears = Math.max(0.08, (latestTime - firstTime) / (1000 * 60 * 60 * 24 * 365.25));

      const delta = latestVal - firstVal;
      const percentageChange = firstVal !== 0 ? ((delta / firstVal) * 100) : 0;
      const velocityPerYear = delta / diffYears;

      let direction: BiomarkerTrajectory['direction'] = 'stable';
      if (percentageChange > 4) direction = 'ascending';
      else if (percentageChange < -4) direction = 'descending';

      const refMin = latest.ref_min !== null && latest.ref_min !== undefined ? Number(latest.ref_min) : null;
      const refMax = latest.ref_max !== null && latest.ref_max !== undefined ? Number(latest.ref_max) : null;

      const isBreached =
        (refMin !== null && latestVal < refMin) ||
        (refMax !== null && latestVal > refMax) ||
        latest.status === 'attention' ||
        latest.status === 'critical';

      trajectories.set(bioId, {
        biomarkerId: bioId,
        canonicalName: latest.biomarker?.canonical_name || bioId,
        unit: latest.unit,
        firstValue: firstVal,
        latestValue: latestVal,
        firstDate: first.occurred_on,
        latestDate: latest.occurred_on,
        delta: Number(delta.toFixed(2)),
        percentageChange: Number(percentageChange.toFixed(1)),
        yearsTracked: Number(diffYears.toFixed(1)),
        velocityPerYear: Number(velocityPerYear.toFixed(2)),
        direction,
        statusTransition: `${first.status || 'normal'} → ${latest.status || 'normal'}`,
        isBreached,
        refMin,
        refMax,
        measurementCount: sorted.length,
        history: sorted.map((s) => ({
          id: s.id,
          date: s.occurred_on,
          value: Number(s.value),
          status: s.status || 'normal',
        })),
      });
    }

    return trajectories;
  }

  /**
   * Processa sinais temporais de wearables (Apple Watch) e detecta anomalias fisiológicas
   */
  static processWearables(
    timeSeries: Array<{
      id: string;
      metric_type: string;
      value: number | string;
      unit: string;
      recorded_at: string;
      metadata?: Record<string, unknown>;
    }>
  ): WearableBaselineAnalysis {
    const hrItems = timeSeries.filter((t) => t.metric_type === 'heart_rate');
    const hrvItems = timeSeries.filter((t) => t.metric_type === 'hrv');
    const sleepDeepItems = timeSeries.filter((t) => t.metric_type === 'sleep_deep');

    // Frequência Cardíaca
    const restingHrs = hrItems
      .filter((h) => !h.metadata?.anomaly && (!h.metadata?.context || h.metadata?.context === 'resting'))
      .map((h) => Number(h.value));
    const restingBaseline = restingHrs.length
      ? Math.round(restingHrs.reduce((a, b) => a + b, 0) / restingHrs.length)
      : 64;

    const latestHrItem = hrItems[hrItems.length - 1];
    const latestRestingHr = latestHrItem ? Number(latestHrItem.value) : restingBaseline;

    // Picos Noturnos de FC (anomalias registradas durante o sono ou madrugada)
    const nocturnalSpikes = hrItems
      .filter((h) => {
        const val = Number(h.value);
        const isAnomaly = Boolean(h.metadata?.anomaly);
        const isSleepContext = h.metadata?.context === 'sleep_spike';
        const hour = new Date(h.recorded_at).getUTCHours();
        // Horário de sono noturno (entre 23h e 06h UTC-3, aprox 02h-09h UTC)
        return isAnomaly || isSleepContext || (val > 100 && (hour >= 2 && hour <= 9));
      })
      .map((h) => ({
        peakBpm: Number(h.value),
        recordedAt: h.recorded_at,
        durationMinutes: Number(h.metadata?.duration_minutes || 12),
        context: String(h.metadata?.context || 'sleep_spike'),
      }));

    // HRV (Variabilidade Cardíaca)
    const baselineHrvItems = hrvItems
      .filter((h) => !h.metadata?.anomaly)
      .map((h) => Number(h.value));
    const hrvBaseline = baselineHrvItems.length
      ? Math.round(baselineHrvItems.reduce((a, b) => a + b, 0) / baselineHrvItems.length)
      : 58;

    const latestHrvItem = hrvItems[hrvItems.length - 1];
    const latestHrv = latestHrvItem ? Number(latestHrvItem.value) : hrvBaseline;
    const hrvSuppression = hrvBaseline > 0 ? ((hrvBaseline - latestHrv) / hrvBaseline) * 100 : 0;

    // Sono Profundo (minutos)
    const deepBaselineItems = sleepDeepItems
      .filter((s) => !s.metadata?.alert)
      .map((s) => Number(s.value));
    const deepBaseline = deepBaselineItems.length
      ? Math.round(deepBaselineItems.reduce((a, b) => a + b, 0) / deepBaselineItems.length)
      : 75;

    const latestDeepItem = sleepDeepItems[sleepDeepItems.length - 1];
    const latestDeep = latestDeepItem ? Number(latestDeepItem.value) : deepBaseline;
    const deepDeficit = deepBaseline > 0 ? ((deepBaseline - latestDeep) / deepBaseline) * 100 : 0;

    const overallAnomalyDetected =
      nocturnalSpikes.length > 0 || hrvSuppression > 35 || deepDeficit > 40;

    return {
      restingHrBaseline: restingBaseline,
      latestRestingHr,
      nocturnalSpikes,
      hrvBaseline,
      latestHrv,
      hrvSuppressionPercent: Number(Math.max(0, hrvSuppression).toFixed(1)),
      deepSleepBaselineMinutes: deepBaseline,
      latestDeepSleepMinutes: latestDeep,
      deepSleepDeficitPercent: Number(Math.max(0, deepDeficit).toFixed(1)),
      overallAnomalyDetected,
    };
  }
}
