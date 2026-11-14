import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { ClinicalDataProcessor } from '@/lib/clinical/processor';
import { HypothesisEngine } from '@/lib/clinical/hypothesis-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const patientId = body.patientId || 'usr-dan-2026';

    if (!isSupabaseConfigured) {
      return NextResponse.json(
        { error: 'Supabase não configurado neste ambiente.' },
        { status: 503 }
      );
    }

    // 1. Carrega dados brutos do paciente do Supabase
    const [patientRes, labRes, wearRes] = await Promise.all([
      supabase.from('patients').select('*').eq('id', patientId).single(),
      supabase
        .from('lab_measurements')
        .select('*, biomarker:biomarkers(canonical_name)')
        .eq('patient_id', patientId)
        .order('occurred_on', { ascending: true }),
      supabase
        .from('wearable_time_series')
        .select('*')
        .eq('patient_id', patientId)
        .order('recorded_at', { ascending: true }),
    ]);

    const patient = patientRes.data;
    const measurements = labRes.data || [];
    const timeSeries = wearRes.data || [];

    // 2. Processa trajetórias longitudinais
    const trajectories = ClinicalDataProcessor.processLabTrajectories(measurements);

    // 3. Processa dados de wearable
    const wearableAnalysis = ClinicalDataProcessor.processWearables(timeSeries);

    // 4. Executa motor de hipóteses clínicas
    const hypotheses = HypothesisEngine.generateHypotheses({
      patientId,
      patientName: patient?.display_name || 'Daniel Vaz',
      trajectories,
      wearables: wearableAnalysis,
      symptoms: patient?.chronic_conditions || ['Hipotireoidismo Subclínico'],
      medications: ['Levotiroxina 50mcg'],
    });

    // 5. Persiste hipóteses no Supabase (Grafo + Alertas)
    await HypothesisEngine.persistHypothesesToDatabase(patientId, hypotheses);

    const trajectoriesArray = Array.from(trajectories.values());

    return NextResponse.json({
      success: true,
      patientId,
      trajectoriesCount: trajectoriesArray.length,
      trajectories: trajectoriesArray,
      wearableAnalysis,
      hypothesesCount: hypotheses.length,
      hypotheses: hypotheses.map((h) => ({
        id: h.id,
        title: h.title,
        category: h.category,
        severity: h.severity,
        confidence: h.confidence,
        summary: h.summary,
        clinicalRationale: h.clinicalRationale,
        recommendations: h.actionableRecommendations,
        evidenceCount: h.evidenceIds.length,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao processar dados clínicos do usuário.';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
