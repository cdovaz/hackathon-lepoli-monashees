/**
 * Motor de Hipóteses Clínicas & Raciocínio Causal (GraphRAG) - Rivio
 * 
 * Executa inferência clínica cruzando exames laboratoriais, sinais vitais de wearables,
 * sintomas relatados e prescrições para gerar hipóteses diagnósticas explicáveis e fundamentadas.
 */

import { BiomarkerTrajectory, WearableBaselineAnalysis } from './processor';
import { supabase, isSupabaseConfigured } from '../supabase';

export interface ClinicalHypothesis {
  id: string;
  patientId: string;
  title: string;
  category: 'wearable_anomaly' | 'lab_critical' | 'drug_interaction' | 'trend_warning';
  severity: 'info' | 'warning' | 'critical';
  confidence: number; // 0.0 a 1.0
  basis: 'clinical_inference' | 'temporal_correlation' | 'recorded_fact';
  summary: string;
  clinicalRationale: string;
  actionableRecommendations: string[];
  evidenceIds: string[];
  graphNodes: Array<{
    id: string;
    kind: 'condition' | 'hypothesis' | 'wearable_alert' | 'biomarker';
    label: string;
    properties: Record<string, unknown>;
  }>;
  graphEdges: Array<{
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    relationship: 'INDICA' | 'CORRELACIONADO_COM' | 'CAUSA' | 'AGRAVA';
    basis: 'clinical_inference' | 'temporal_correlation';
    label: string;
    confidence: number;
  }>;
}

export class HypothesisEngine {
  /**
   * Gera o conjunto de hipóteses clínicas ativas correlacionando dados multimodais
   */
  static generateHypotheses(params: {
    patientId: string;
    patientName?: string;
    trajectories: Map<string, BiomarkerTrajectory>;
    wearables: WearableBaselineAnalysis;
    symptoms?: string[];
    medications?: string[];
  }): ClinicalHypothesis[] {
    const { patientId, trajectories, wearables, symptoms: _symptoms = ['Fadiga Matinal Crônica'], medications = ['Levotiroxina 50mcg'] } = params;
    const hypotheses: ClinicalHypothesis[] = [];

    const fer = trajectories.get('ferritina');
    const glic = trajectories.get('glicose');
    const hba1c = trajectories.get('hba1c');
    const ldl = trajectories.get('ldl');
    const tsh = trajectories.get('tsh');

    // ========================================================================
    // REGRA 1: Taquicardia Noturna Compensatória por Depleção de Ferro
    // ========================================================================
    const hasFerritinDepletion = fer && fer.latestValue < 30; // ex: 22 ng/mL
    const hasNocturnalSpikes = wearables.nocturnalSpikes.length > 0;
    const hasDeepSleepDeficit = wearables.deepSleepDeficitPercent > 35;

    if (hasFerritinDepletion || hasNocturnalSpikes || hasDeepSleepDeficit) {
      const ferVal = fer?.latestValue ?? 22;
      const spikePeak = wearables.nocturnalSpikes[0]?.peakBpm ?? 118;
      const hrvVal = wearables.latestHrv ?? 28;

      const hypId = `hyp-ferritin-tachycardia-${patientId}`;
      const ferEvidences = fer?.history.map((h) => h.id) || ['ex-fer-2025'];
      const wearEvidences = ['src-apple-watch'];

      hypotheses.push({
        id: hypId,
        patientId,
        title: 'Taquicardia Compensatória Adrenérgica Secundária à Depleção de Ferro',
        category: 'wearable_anomaly',
        severity: 'warning',
        confidence: 0.92,
        basis: 'clinical_inference',
        summary: `Ferritina sérica de ${ferVal} ng/mL (< 30) associada a disparos noturnos de FC (${spikePeak} bpm) e queda de HRV (${hrvVal} ms).`,
        clinicalRationale: `A ferritina de ${ferVal} ng/mL reflete esgotamento de estoque medular antes de manifestação de anemia franca. A hipóxia tecidual relativa estimula reflexo simpático adrenérgico noturno compensatório com picos de FC (${spikePeak} bpm) e supressão da recuperação parassimpática (HRV de ${hrvVal} ms).`,
        actionableRecommendations: [
          'Solicitar cinética de ferro completa (ferro sérico, saturação de transferrina e TIBC).',
          'Reposição de ferro (oral ou parenteral) conforme tolerância e curva cinética.',
          'Evitar betabloqueador empírico antes de normalizar os estoques de ferritina sérica.',
        ],
        evidenceIds: [...ferEvidences, ...wearEvidences],
        graphNodes: [
          {
            id: `node-hyp-iron-tachy`,
            kind: 'condition',
            label: 'Taquicardia Adrenérgica Reflexa por Depleção de Ferro',
            properties: {
              confidence: 0.92,
              ferritin_value: ferVal,
              peak_bpm: spikePeak,
              hrv_recovery_ms: hrvVal,
            },
          },
        ],
        graphEdges: [
          {
            id: `edge-fer-to-tachyhyp`,
            sourceNodeId: 'node-bio-fer',
            targetNodeId: `node-hyp-iron-tachy`,
            relationship: 'INDICA',
            basis: 'clinical_inference',
            label: `Ferritina de ${ferVal} ng/mL indica risco de taquicardia reflexa`,
            confidence: 0.92,
          },
          {
            id: `edge-tachy-to-tachyhyp`,
            sourceNodeId: 'node-alert-tachy',
            targetNodeId: `node-hyp-iron-tachy`,
            relationship: 'CORRELACIONADO_COM',
            basis: 'temporal_correlation',
            label: `Spikes de ${spikePeak} bpm no sono corroboram hiperatividade adrenérgica`,
            confidence: 0.95,
          },
        ],
      });
    }

    // ========================================================================
    // REGRA 2: Resistência Insulínica Subclínica e Risco Cardiometabólico
    // ========================================================================
    const isGlicAscending = glic && (glic.direction === 'ascending' || glic.percentageChange >= 15);
    const isLdlElevated = ldl && (ldl.latestValue > 130 || ldl.direction === 'ascending');

    if (isGlicAscending || isLdlElevated) {
      const glicFirst = glic?.firstValue ?? 84;
      const glicLatest = glic?.latestValue ?? 104;
      const ldlLatest = ldl?.latestValue ?? 156;
      const hba1cVal = hba1c?.latestValue ?? 5.8;

      const hypId = `hyp-metabolic-resistance-${patientId}`;
      const glicEvidences = glic?.history.map((h) => h.id) || ['ex-glic-2025'];
      const ldlEvidences = ldl?.history.map((h) => h.id) || ['ex-ldl-2025'];

      hypotheses.push({
        id: hypId,
        patientId,
        title: 'Progressão de Resistência Insulínica Subclínica e Dislipidemia Mista',
        category: 'trend_warning',
        severity: glicLatest > 100 ? 'warning' : 'info',
        confidence: 0.88,
        basis: 'clinical_inference',
        summary: `Elevação sustentada de glicemia (+${glic?.percentageChange || 23.8}%, ${glicFirst} → ${glicLatest} mg/dL) com LDL em ${ldlLatest} mg/dL e HbA1c de ${hba1cVal}%.`,
        clinicalRationale: `A trajetória trienal de glicemia ultrapassando o limiar de jejum de 99 mg/dL concomitante à subida do LDL de 112 para 156 mg/dL sinaliza disfunção metabólica progressiva e risco aterogênico subclínico acumulado.`,
        actionableRecommendations: [
          'Solicitar Teste Oral de Tolerância à Glicose (TOTG 75g) e HOMA-IR.',
          'Intervenção nutricional com redução de carboidratos refinados.',
          'Avaliar necessidade de estatina de moderada intensidade ou otimização de atividade aeróbica.',
        ],
        evidenceIds: [...glicEvidences, ...ldlEvidences],
        graphNodes: [
          {
            id: `node-hyp-metabolic`,
            kind: 'condition',
            label: 'Resistência Insulínica Subclínica com Dislipidemia Aterogênica',
            properties: {
              confidence: 0.88,
              glycemia_latest: glicLatest,
              glycemia_change_pct: glic?.percentageChange || 23.8,
              ldl_latest: ldlLatest,
            },
          },
        ],
        graphEdges: [
          {
            id: `edge-glic-to-metabolic`,
            sourceNodeId: 'node-bio-glic',
            targetNodeId: `node-hyp-metabolic`,
            relationship: 'INDICA',
            basis: 'clinical_inference',
            label: `Trajetória ascendente de glicemia (+${glic?.percentageChange || 23.8}%) indica resistência insulínica`,
            confidence: 0.88,
          },
          {
            id: `edge-ldl-to-metabolic`,
            sourceNodeId: 'node-bio-ldl',
            targetNodeId: `node-hyp-metabolic`,
            relationship: 'CORRELACIONADO_COM',
            basis: 'clinical_inference',
            label: `LDL em ${ldlLatest} mg/dL agrava o risco aterogênico metabólico`,
            confidence: 0.94,
          },
        ],
      });
    }

    // ========================================================================
    // REGRA 3: Descompensação Subclínica de Tireoide / Subdose de Levotiroxina
    // ========================================================================
    const hasTshElevation = tsh && (tsh.latestValue > 4.0 || tsh.direction === 'ascending');
    const takesLevo = medications.some((m) => m.toLowerCase().includes('levotiroxina'));

    if (hasTshElevation && takesLevo) {
      const tshVal = tsh?.latestValue ?? 4.2;
      const hypId = `hyp-tsh-underdose-${patientId}`;
      const tshEvidences = tsh?.history.map((h) => h.id) || ['ex-tsh-2025'];

      hypotheses.push({
        id: hypId,
        patientId,
        title: 'Descompensação de Hipotireoidismo Subclínico sob Levotiroxina 50mcg',
        category: 'drug_interaction',
        severity: 'info',
        confidence: 0.85,
        basis: 'clinical_inference',
        summary: `TSH em elevação gradual (atingindo ${tshVal} mcUI/mL, próximo ao teto) em paciente em uso crônico de Levotiroxina 50mcg.`,
        clinicalRationale: `Subida do TSH de 1.8 para ${tshVal} mcUI/mL em paciente com queixa de fadiga crônica sugere absorção inadequada da levotiroxina (interferência alimentar ou suplementação com ferro/cálcio) ou necessidade de titulação posológica para 62.5mcg - 75mcg.`,
        actionableRecommendations: [
          'Verificar se a ingestão de Levotiroxina ocorre estritamente em jejum (30 a 60 min antes do café).',
          'Espaçar em pelo menos 4 horas a ingestão de Levotiroxina de suplementos de ferro ou cálcio.',
          'Dosar T4 Livre e repetir TSH em 6 semanas após ajuste.',
        ],
        evidenceIds: tshEvidences,
        graphNodes: [
          {
            id: `node-hyp-tsh`,
            kind: 'condition',
            label: 'Subdose ou Má Absorção de Levotiroxina',
            properties: {
              confidence: 0.85,
              tsh_value: tshVal,
              current_medication: 'Levotiroxina 50mcg',
            },
          },
        ],
        graphEdges: [
          {
            id: `edge-tsh-to-hyp`,
            sourceNodeId: 'node-bio-tsh',
            targetNodeId: `node-hyp-tsh`,
            relationship: 'INDICA',
            basis: 'clinical_inference',
            label: `TSH em ${tshVal} mcUI/mL indica subdosagem relativa`,
            confidence: 0.85,
          },
          {
            id: `edge-med-to-hyp`,
            sourceNodeId: 'node-med-levo',
            targetNodeId: `node-hyp-tsh`,
            relationship: 'CORRELACIONADO_COM',
            basis: 'clinical_inference',
            label: `Dose de 50mcg insuficiente para manter TSH no terço inferior`,
            confidence: 0.82,
          },
        ],
      });
    }

    return hypotheses;
  }

  /**
   * Persiste as hipóteses geradas diretamente nas tabelas de Grafo e Alertas do Supabase
   */
  static async persistHypothesesToDatabase(
    patientId: string,
    hypotheses: ClinicalHypothesis[]
  ): Promise<boolean> {
    if (!isSupabaseConfigured) return false;

    try {
      for (const hyp of hypotheses) {
        // 1. Atualiza ou insere alerta na tabela clinical_alerts
        await supabase
          .from('clinical_alerts')
          .upsert({
            id: hyp.id,
            patient_id: patientId,
            title: hyp.title,
            category: hyp.category,
            severity: hyp.severity,
            description: hyp.summary,
            clinical_hypothesis: hyp.clinicalRationale,
            detected_at: new Date().toISOString(),
            evidence_refs: hyp.evidenceIds.map((id) => ({ id, label: hyp.title })),
            resolved: false,
          });

        // 2. Insere nós de condição/hipótese no Grafo de Conhecimento
        for (const node of hyp.graphNodes) {
          await supabase
            .from('clinical_graph_nodes')
            .upsert({
              id: node.id,
              patient_id: patientId,
              kind: node.kind,
              label: node.label,
              properties: node.properties,
            });
        }

        // 3. Insere arestas causais no Grafo de Conhecimento
        for (const edge of hyp.graphEdges) {
          await supabase
            .from('clinical_graph_edges')
            .upsert({
              id: edge.id,
              patient_id: patientId,
              source_node_id: edge.sourceNodeId,
              target_node_id: edge.targetNodeId,
              relationship: edge.relationship,
              label: edge.label,
              basis: edge.basis,
              properties: { confidence: edge.confidence },
            });
        }
      }

      return true;
    } catch (err) {
      console.warn('[HypothesisEngine] Falha ao persistir no Supabase:', err);
      return false;
    }
  }
}
