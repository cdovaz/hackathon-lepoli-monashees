import { NextRequest, NextResponse } from 'next/server';
import {
  prepareInstitutionalContext,
  readInstitutionalContext,
  confirmInstitutionalReceipt,
  getObservabilityDashboardState,
} from '@/lib/observability/engine';

export const dynamic = 'force-dynamic';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Cache-Control': 'no-store, private',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  try {
    const patientId = req.nextUrl.searchParams.get('patientId') || undefined;
    const state = await getObservabilityDashboardState(patientId);
    return NextResponse.json(
      {
        status: 'ok',
        episodes: state.episodes,
        usageEvents: state.usageEvents,
        billingEvents: state.billingEvents,
        sources: state.sources,
        metrics: state.metrics,
      },
      { headers: corsHeaders }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { status: 'error', message: (err as Error)?.message || 'Falha ao consultar fluxo institucional' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const operation = body.operation as 'prepareContext' | 'readContext' | 'confirmReceipt';

    if (operation === 'prepareContext') {
      const result = await prepareInstitutionalContext({
        institutionId: body.institutionId || 'inst-sirio-libanes',
        institutionName: body.institutionName || 'Hospital Sírio-Libanês',
        patientId: body.patientId || 'usr-marcos-2026',
        attendanceRef: body.attendanceRef || `ATD-${Date.now().toString().slice(-4)}`,
        purpose: body.purpose || 'Avaliação Clínica Assistencial Integrada',
        professionalName: body.professionalName || 'Dra. Helena Costa',
        professionalId: body.professionalId || 'CRM 123456-SP',
        idempotencyKey: body.idempotencyKey || `idem-${body.patientId}-${body.attendanceRef}`,
        requestedScopes: body.requestedScopes,
      });
      return NextResponse.json({ status: 'ok', ...result }, { headers: corsHeaders });
    }

    if (operation === 'readContext') {
      const result = await readInstitutionalContext(body.episodeId);
      return NextResponse.json({ status: 'ok', ...result }, { headers: corsHeaders });
    }

    if (operation === 'confirmReceipt') {
      const result = await confirmInstitutionalReceipt({
        episodeId: body.episodeId,
        receiptToken: body.receiptToken,
      });
      return NextResponse.json({ status: 'ok', ...result }, { headers: corsHeaders });
    }

    return NextResponse.json(
      { status: 'error', message: `Operação institucional desconhecida: ${String(operation)}` },
      { status: 400, headers: corsHeaders }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { status: 'error', message: (err as Error)?.message || 'Erro no módulo institucional' },
      { status: 500, headers: corsHeaders }
    );
  }
}
