import { NextRequest, NextResponse } from 'next/server';
import {
  getObservabilityDashboardState,
  listTransitionEvents,
  recordTransitionEvent,
  updateDataSourceState,
  decideFollowupRequestInDb,
  createFollowupRequestInDb,
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
    const actorRole = req.nextUrl.searchParams.get('actorRole') || undefined;
    const eventType = req.nextUrl.searchParams.get('eventType') || undefined;
    const decision = req.nextUrl.searchParams.get('decision') || undefined;
    const view = req.nextUrl.searchParams.get('view') || 'dashboard';

    if (view === 'events') {
      const events = await listTransitionEvents({ patientId, actorRole, eventType, decision });
      return NextResponse.json({ status: 'ok', events }, { headers: corsHeaders });
    }

    const dashboard = await getObservabilityDashboardState(patientId);
    return NextResponse.json({ status: 'ok', ...dashboard }, { headers: corsHeaders });
  } catch (err: unknown) {
    return NextResponse.json(
      { status: 'error', message: (err as Error)?.message || 'Erro ao carregar observabilidade' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action || 'record_event';

    if (action === 'update_source_state') {
      const updated = await updateDataSourceState(body.sourceId, body.state, body.actorName);
      return NextResponse.json({ status: 'ok', dataSource: updated }, { headers: corsHeaders });
    }

    if (action === 'create_followup') {
      const created = await createFollowupRequestInDb(body);
      return NextResponse.json({ status: 'ok', followup: created }, { headers: corsHeaders });
    }

    if (action === 'decide_followup') {
      const decided = await decideFollowupRequestInDb(body.requestId, body.decision);
      return NextResponse.json({ status: 'ok', followup: decided }, { headers: corsHeaders });
    }

    const event = await recordTransitionEvent({
      patientId: body.patientId || 'usr-marcos-2026',
      patientName: body.patientName,
      eventType: body.eventType || 'snapshot_read',
      actorRole: body.actorRole || 'doctor',
      actorId: body.actorId || 'doctor-demo-1',
      actorName: body.actorName || 'Dra. Helena Costa',
      recipientId: body.recipientId || 'doctor-demo-1',
      recipientName: body.recipientName || 'Dra. Helena Costa',
      institutionName: body.institutionName || 'Hospital Sírio-Libanês',
      episodeId: body.episodeId || null,
      attendanceRef: body.attendanceRef || null,
      billingEventId: body.billingEventId || null,
      scopes: Array.isArray(body.scopes) ? body.scopes : ['read_exams', 'read_wearables', 'read_clinical_context'],
      decision: body.decision || 'allowed',
      accessRevision: body.accessRevision || `rev-acc-${Date.now()}`,
      dataRevision: body.dataRevision || `rev-dat-${Date.now()}`,
      summary: body.summary || 'Transição de dados registrada na camada de observabilidade.',
    });

    return NextResponse.json({ status: 'ok', event }, { headers: corsHeaders });
  } catch (err: unknown) {
    return NextResponse.json(
      { status: 'error', message: (err as Error)?.message || 'Falha ao processar ação de observabilidade' },
      { status: 500, headers: corsHeaders }
    );
  }
}
