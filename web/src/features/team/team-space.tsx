"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Shield,
  Database,
  Receipt,
  RefreshCw,
  Building2,
  Lock,
  ChevronRight,
  Server,
  Zap,
} from "lucide-react";

interface TransitionEvent {
  id: string;
  patientId: string;
  patientName?: string;
  eventType: string;
  actorRole: "patient" | "doctor" | "institution_system" | "team_ops";
  actorName: string;
  scopes: string[];
  decision: "allowed" | "denied" | "revoked" | "partial";
  accessRevision: string;
  summary: string;
  occurredAt: string;
}

interface InstitutionalEpisode {
  episodeId: string;
  institutionName: string;
  patientId: string;
  attendanceRef: string;
  packageStatus: "ready" | "partial" | "denied" | "expired";
  deliveryStatus: "prepared" | "read" | "confirmed";
  cacheExpiresAt: string;
  receiptToken: string;
  readCount: number;
}

interface UsageEvent {
  id: string;
  episodeId: string;
  institutionName: string;
  action: string;
  outcome: string;
  occurredAt: string;
}

interface BillingEvent {
  id: string;
  episodeId: string;
  institutionName: string;
  amountBrl: number;
  confirmedAt: string;
}

interface DataSource {
  id: string;
  name: string;
  state: "connected" | "stale" | "disconnected";
  healthNote: string;
}

interface ObservabilityMetrics {
  totalTransitions: number;
  activeTokensCount: number;
  revokedTokensCount: number;
  totalEpisodes: number;
  confirmedBillableUnits: number;
  totalBilledBrl: number;
  connectedSourcesCount: number;
  totalSourcesCount: number;
}

export function TeamSpace() {
  const [activeTab, setActiveTab] = useState<"transitions" | "episodes" | "billing" | "governance">("transitions");
  const [loading, setLoading] = useState(false);
  const [currentTime] = useState<number>(() => Date.now());

  const [metrics, setMetrics] = useState<ObservabilityMetrics>({
    totalTransitions: 0,
    activeTokensCount: 0,
    revokedTokensCount: 0,
    totalEpisodes: 0,
    confirmedBillableUnits: 0,
    totalBilledBrl: 0,
    connectedSourcesCount: 0,
    totalSourcesCount: 0,
  });

  const [events, setEvents] = useState<TransitionEvent[]>([]);
  const [episodes, setEpisodes] = useState<InstitutionalEpisode[]>([]);
  const [usageEvents, setUsageEvents] = useState<UsageEvent[]>([]);
  const [billingEvents, setBillingEvents] = useState<BillingEvent[]>([]);
  const [sources, setSources] = useState<DataSource[]>([]);

  // Filtros Tab 1
  const [filterPatient, setFilterPatient] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterDecision, setFilterDecision] = useState<string>("all");

  // Simulador Tab 2
  const [simInstitution, setSimInstitution] = useState("Hospital Sírio-Libanês");
  const [simPatient, setSimPatient] = useState("usr-marcos-2026");
  const [simRef, setSimRef] = useState("ATEND-2026-9021");
  const [simPurpose, setSimPurpose] = useState("emergencia");
  const [simResult, setSimResult] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchObservability = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/observability");
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.metrics || metrics);
        setEvents(data.events || []);
        setEpisodes(data.episodes || []);
        setUsageEvents(data.usageEvents || []);
        setBillingEvents(data.billingEvents || []);
        setSources(data.sources || []);
      }
    } catch (e) {
      console.error("Falha ao carregar observabilidade:", e);
    } finally {
      setLoading(false);
    }
  }, [metrics]);

  useEffect(() => {
    let active = true;
    const fetchAsync = async () => {
      try {
        const res = await fetch("/api/observability");
        if (res.ok && active) {
          const data = await res.json();
          setMetrics(data.metrics || metrics);
          setEvents(data.events || []);
          setEpisodes(data.episodes || []);
          setUsageEvents(data.usageEvents || []);
          setBillingEvents(data.billingEvents || []);
          setSources(data.sources || []);
        }
      } catch (e) {
        console.error("Falha ao carregar observabilidade:", e);
      }
    };

    void fetchAsync();
    const interval = setInterval(() => {
      void fetchAsync();
    }, 10000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [metrics]);

  // Simulador Módulo Profundo
  const handlePrepareContext = async () => {
    setActionLoading(true);
    setSimResult(null);
    try {
      const res = await fetch("/api/institutional", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prepareContext",
          institutionId: simInstitution === "Hospital Sírio-Libanês" ? "inst-sirio" : "inst-dasa",
          institutionName: simInstitution,
          patientId: simPatient,
          attendanceRef: simRef,
          purpose: simPurpose,
          scopes: ["read_exams", "read_wearables", "read_alerts"],
        }),
      });
      const data = await res.json();
      setSimResult(JSON.stringify(data, null, 2));
      void fetchObservability();
    } catch (e) {
      setSimResult("Erro na chamada: " + String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReadContext = async (epId: string) => {
    setActionLoading(true);
    setSimResult(null);
    try {
      const res = await fetch("/api/institutional", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "readContext",
          episodeId: epId,
        }),
      });
      const data = await res.json();
      setSimResult(JSON.stringify(data, null, 2));
      void fetchObservability();
    } catch (e) {
      setSimResult("Erro na leitura: " + String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReceipt = async (epId: string, token: string) => {
    setActionLoading(true);
    setSimResult(null);
    try {
      const res = await fetch("/api/institutional", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirmReceipt",
          episodeId: epId,
          receiptToken: token,
        }),
      });
      const data = await res.json();
      setSimResult(JSON.stringify(data, null, 2));
      void fetchObservability();
    } catch (e) {
      setSimResult("Erro na confirmação: " + String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleConnectorState = async (sourceId: string, newState: "connected" | "stale" | "disconnected") => {
    try {
      await fetch("/api/observability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateDataSourceState",
          sourceId,
          state: newState,
        }),
      });
      void fetchObservability();
    } catch (e) {
      console.error(e);
    }
  };

  // Filtragem de eventos
  const filteredEvents = events.filter((ev) => {
    if (filterPatient !== "all" && ev.patientId !== filterPatient) return false;
    if (filterRole !== "all" && ev.actorRole !== filterRole) return false;
    if (filterDecision !== "all" && ev.decision !== filterDecision) return false;
    return true;
  });

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", paddingBottom: 60 }} data-testid="team-space-surface">
      {/* Cabeçalho da Superfície Operacional */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(8,124,115,0.08)", color: "var(--brand-700, #075e59)", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            <Shield size={14} /> Espaço Equipe · Governança, Observabilidade & Bilhetagem LGPD
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, color: "var(--foreground)" }}>
            Painel Operacional & Observabilidade de Transições
          </h1>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>
            Monitoramento em tempo real do ciclo de consentimento, transição entre pacientes/médicos, residência de dados e fatura B2B por episódio institucional.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="button secondary"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: 13 }}
            onClick={() => void fetchObservability()}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "spin" : ""} /> Atualizar
          </button>
        </div>
      </div>

      {/* Faixa de Aviso Estrito de Privacidade LGPD */}
      <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "12px 16px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12, fontSize: 12.5, color: "#166534" }}>
        <Lock size={18} style={{ flexShrink: 0 }} />
        <span>
          <strong>Segregação Estrita de Privacidade Clínica:</strong> Conforme definido em <code>docs/institutional-data-residency.md</code>, o Espaço Equipe opera exclusivamente com metadados estruturados, revisões de consentimento, escopos e auditoria técnica. Valores clínicos de biomarcadores e laudos são restritos ao médico e paciente.
        </span>
      </div>

      {/* Grid de Métricas Operacionais e Governança */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
        <div className="panel" style={{ padding: 18, borderLeft: "4px solid #087c73" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: 12, fontWeight: 600 }}>
            <span>Transições Registradas</span>
            <Activity size={16} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6, color: "var(--foreground)" }}>
            {metrics.totalTransitions}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Trilha imutável auditável</div>
        </div>

        <div className="panel" style={{ padding: 18, borderLeft: "4px solid #14A394" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: 12, fontWeight: 600 }}>
            <span>Sessões Ativas / Revogadas</span>
            <Shield size={16} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6, color: "var(--foreground)" }}>
            {metrics.activeTokensCount} <span style={{ fontSize: 16, color: "#EF4444", fontWeight: 600 }}>/ {metrics.revokedTokensCount} rev</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Tokens 6 dígitos Supabase</div>
        </div>

        <div className="panel" style={{ padding: 18, borderLeft: "4px solid #6366F1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: 12, fontWeight: 600 }}>
            <span>Episódios Institucionais</span>
            <Building2 size={16} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6, color: "var(--foreground)" }}>
            {metrics.totalEpisodes}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>TTL 15 min · Cache Híbrido</div>
        </div>

        <div className="panel" style={{ padding: 18, borderLeft: "4px solid #10B981" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: 12, fontWeight: 600 }}>
            <span>Unidades Faturáveis B2B</span>
            <Receipt size={16} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6, color: "#065F46" }}>
            {metrics.confirmedBillableUnits} <span style={{ fontSize: 15, fontWeight: 600 }}>({(metrics.totalBilledBrl).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Zero cobrança por clique/releitura</div>
        </div>

        <div className="panel" style={{ padding: 18, borderLeft: "4px solid #F59E0B" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: 12, fontWeight: 600 }}>
            <span>Conectores Online</span>
            <Server size={16} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6, color: "var(--foreground)" }}>
            {metrics.connectedSourcesCount} <span style={{ fontSize: 16, color: "var(--muted)" }}>/ {metrics.totalSourcesCount}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Dasa, Fleury, Zoppi, Apple Watch</div>
        </div>
      </div>

      {/* Navegação por Abas Operacionais */}
      <div style={{ display: "flex", borderBottom: "2px solid var(--border)", marginBottom: 24, gap: 8 }}>
        <button
          style={{
            padding: "12px 18px",
            fontSize: 14,
            fontWeight: 700,
            background: "none",
            border: "none",
            borderBottom: activeTab === "transitions" ? "3px solid #087c73" : "3px solid transparent",
            color: activeTab === "transitions" ? "#087c73" : "var(--muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
          onClick={() => setActiveTab("transitions")}
        >
          <Activity size={16} /> 1. Transições ao Vivo (Audit Trail)
        </button>

        <button
          style={{
            padding: "12px 18px",
            fontSize: 14,
            fontWeight: 700,
            background: "none",
            border: "none",
            borderBottom: activeTab === "episodes" ? "3px solid #087c73" : "3px solid transparent",
            color: activeTab === "episodes" ? "#087c73" : "var(--muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
          onClick={() => setActiveTab("episodes")}
        >
          <Building2 size={16} /> 2. Módulo Profundo Institucional (TTL 15m)
        </button>

        <button
          style={{
            padding: "12px 18px",
            fontSize: 14,
            fontWeight: 700,
            background: "none",
            border: "none",
            borderBottom: activeTab === "billing" ? "3px solid #087c73" : "3px solid transparent",
            color: activeTab === "billing" ? "#087c73" : "var(--muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
          onClick={() => setActiveTab("billing")}
        >
          <Receipt size={16} /> 3. Auditoria de Uso vs. Cobrança
        </button>

        <button
          style={{
            padding: "12px 18px",
            fontSize: 14,
            fontWeight: 700,
            background: "none",
            border: "none",
            borderBottom: activeTab === "governance" ? "3px solid #087c73" : "3px solid transparent",
            color: activeTab === "governance" ? "#087c73" : "var(--muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
          onClick={() => setActiveTab("governance")}
        >
          <Database size={16} /> 4. Governança de Fontes & Sessões
        </button>
      </div>

      {/* ABA 1: TRANSIÇÕES AO VIVO */}
      {activeTab === "transitions" && (
        <div className="stack" style={{ gap: 20 }}>
          {/* Diagrama de Transição */}
          <div className="panel" style={{ padding: 20, background: "var(--surface-50, #f8fbfb)" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px", color: "var(--foreground)" }}>
              Fluxo Arquitetural de Transição de Contexto e Governança
            </h3>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 200, padding: 14, background: "#fff", border: "1px solid var(--border)", borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontWeight: 700, color: "#087c73", fontSize: 13 }}>Paciente (Mobile)</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Geração de Token 6d, Revogação e Switches de Escopo em tempo real</div>
              </div>
              <ChevronRight color="var(--muted)" />
              <div style={{ flex: 1, minWidth: 240, padding: 14, background: "#F0FDFA", border: "1px solid #99F6E4", borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontWeight: 700, color: "#0F766E", fontSize: 13 }}>Hub de Consentimento & Residência Híbrida</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Validação RLS, TTL de 15 min, versionamento de acesso e trilha imutável</div>
              </div>
              <ChevronRight color="var(--muted)" />
              <div style={{ flex: 1, minWidth: 200, padding: 14, background: "#fff", border: "1px solid var(--border)", borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontWeight: 700, color: "#1E40AF", fontSize: 13 }}>Médico / Instituição (Web)</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Cockpit Clínico Projeção Zero-Leak e Módulo B2B com Recibo Opaco</div>
              </div>
            </div>
          </div>

          {/* Filtros da Trilha */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
              Paciente:
              <select
                style={{ marginLeft: 6, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                value={filterPatient}
                onChange={(e) => setFilterPatient(e.target.value)}
              >
                <option value="all">Todos os Pacientes</option>
                <option value="usr-marcos-2026">Marcos (usr-marcos-2026)</option>
                <option value="usr-camila-2026">Camila (usr-camila-2026)</option>
                <option value="usr-antonio-2026">Antônio (usr-antonio-2026)</option>
                <option value="usr-rafael-2026">Rafael (usr-rafael-2026)</option>
                <option value="usr-dan-2026">Daniel Vaz (usr-dan-2026)</option>
              </select>
            </label>

            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
              Papel do Ator:
              <select
                style={{ marginLeft: 6, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
              >
                <option value="all">Todos os Papéis</option>
                <option value="patient">Paciente</option>
                <option value="doctor">Médico Assistente</option>
                <option value="institution_system">Sistema Institucional</option>
                <option value="team_ops">Equipe Operacional</option>
              </select>
            </label>

            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
              Decisão:
              <select
                style={{ marginLeft: 6, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                value={filterDecision}
                onChange={(e) => setFilterDecision(e.target.value)}
              >
                <option value="all">Todas as Decisões</option>
                <option value="allowed">Autorizado (allowed)</option>
                <option value="denied">Negado (denied)</option>
                <option value="revoked">Revogado (revoked)</option>
                <option value="partial">Parcial Gratuito (partial)</option>
              </select>
            </label>
          </div>

          {/* Tabela de Eventos */}
          <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
              <thead>
                <tr style={{ background: "var(--surface-100, #edf5f4)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "10px 14px", fontWeight: 700 }}>Horário</th>
                  <th style={{ padding: "10px 14px", fontWeight: 700 }}>Tipo de Transição</th>
                  <th style={{ padding: "10px 14px", fontWeight: 700 }}>Paciente</th>
                  <th style={{ padding: "10px 14px", fontWeight: 700 }}>Ator & Papel</th>
                  <th style={{ padding: "10px 14px", fontWeight: 700 }}>Decisão</th>
                  <th style={{ padding: "10px 14px", fontWeight: 700 }}>Escopos & Reversões</th>
                  <th style={{ padding: "10px 14px", fontWeight: 700 }}>Resumo Operacional</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
                      Nenhum evento registrado com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((ev) => (
                    <tr key={ev.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "10px 14px", color: "var(--muted)", whiteSpace: "nowrap" }}>
                        {new Date(ev.occurredAt).toLocaleTimeString("pt-BR")}
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                        <code style={{ background: "rgba(0,0,0,0.04)", padding: "2px 6px", borderRadius: 4 }}>
                          {ev.eventType}
                        </code>
                      </td>
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        <strong>{ev.patientName || ev.patientId}</strong>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{ev.patientId}</div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <div>{ev.actorName}</div>
                        <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#E0F2FE", color: "#0369A1", fontWeight: 600 }}>
                          {ev.actorRole}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span
                          style={{
                            fontSize: 11,
                            padding: "3px 8px",
                            borderRadius: 6,
                            fontWeight: 700,
                            background:
                              ev.decision === "allowed"
                                ? "#DCFCE7"
                                : ev.decision === "revoked"
                                ? "#FEE2E2"
                                : ev.decision === "partial"
                                ? "#FEF3C7"
                                : "#F3F4F6",
                            color:
                              ev.decision === "allowed"
                                ? "#166534"
                                : ev.decision === "revoked"
                                ? "#991B1B"
                                : ev.decision === "partial"
                                ? "#92400E"
                                : "#374151",
                          }}
                        >
                          {ev.decision}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 11 }}>
                        <div>rev: {ev.accessRevision}</div>
                        <div style={{ color: "var(--muted)" }}>{ev.scopes.slice(0, 2).join(", ")}{ev.scopes.length > 2 ? ` +${ev.scopes.length - 2}` : ""}</div>
                      </td>
                      <td style={{ padding: "10px 14px", color: "var(--foreground)" }}>
                        {ev.summary}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 2: MÓDULO PROFUNDO INSTITUCIONAL (TTL 15m) */}
      {activeTab === "episodes" && (
        <div className="stack" style={{ gap: 24 }}>
          {/* Console de Simulação de Episódio */}
          <div className="panel" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 14px", color: "var(--foreground)" }}>
              Console de Chamadas Institucionais B2B (API Deep Module)
            </h3>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px" }}>
              Dispare e teste o ciclo rigoroso de residência híbrida: preparação idempotente por <code>(institutionId, patientId, attendanceRef, purpose)</code> com TTL de 15 minutos, releitura gratuita e confirmação de recebimento com recibo opaco.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 18 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Instituição Solicitante</label>
                <select
                  style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                  value={simInstitution}
                  onChange={(e) => setSimInstitution(e.target.value)}
                >
                  <option value="Hospital Sírio-Libanês">Hospital Sírio-Libanês</option>
                  <option value="Alta Excelência Diagnóstica (Dasa)">Alta Excelência Diagnóstica (Dasa)</option>
                  <option value="Hospital Israelita Albert Einstein">Hospital Israelita Albert Einstein</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Paciente</label>
                <select
                  style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                  value={simPatient}
                  onChange={(e) => setSimPatient(e.target.value)}
                >
                  <option value="usr-marcos-2026">Marcos (usr-marcos-2026)</option>
                  <option value="usr-camila-2026">Camila (usr-camila-2026)</option>
                  <option value="usr-antonio-2026">Antônio (usr-antonio-2026)</option>
                  <option value="usr-rafael-2026">Rafael (usr-rafael-2026)</option>
                  <option value="usr-dan-2026">Daniel Vaz (usr-dan-2026)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Referência Atendimento</label>
                <input
                  style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                  value={simRef}
                  onChange={(e) => setSimRef(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600 }}>Finalidade Assistencial</label>
                <select
                  style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
                  value={simPurpose}
                  onChange={(e) => setSimPurpose(e.target.value)}
                >
                  <option value="emergencia">Emergência / Pronto Atendimento</option>
                  <option value="consulta_especializada">Consulta Especializada</option>
                  <option value="internacao">Internação Eletiva</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button
                className="button"
                onClick={() => void handlePrepareContext()}
                disabled={actionLoading}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <Zap size={16} /> 1. Preparar Pacote (prepareContext)
              </button>
            </div>

            {simResult && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>Resposta do Módulo Institucional:</div>
                <pre style={{ background: "#1E293B", color: "#F8FAFC", padding: 12, borderRadius: 6, fontSize: 12, overflowX: "auto", maxHeight: 220 }}>
                  {simResult}
                </pre>
              </div>
            )}
          </div>

          {/* Lista de Episódios Institucionais Gravados */}
          <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Episódios Ativos & Histórico de Cache</h3>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>TTL fixo de 15 minutos</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
              <thead>
                <tr style={{ background: "var(--surface-100, #edf5f4)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "10px 14px", fontWeight: 700 }}>Episódio ID</th>
                  <th style={{ padding: "10px 14px", fontWeight: 700 }}>Instituição</th>
                  <th style={{ padding: "10px 14px", fontWeight: 700 }}>Paciente</th>
                  <th style={{ padding: "10px 14px", fontWeight: 700 }}>Status Pacote</th>
                  <th style={{ padding: "10px 14px", fontWeight: 700 }}>Status Entrega</th>
                  <th style={{ padding: "10px 14px", fontWeight: 700 }}>Leituras (R$ 0)</th>
                  <th style={{ padding: "10px 14px", fontWeight: 700 }}>Expiração Cache</th>
                  <th style={{ padding: "10px 14px", fontWeight: 700 }}>Ações Operacionais</th>
                </tr>
              </thead>
              <tbody>
                {episodes.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 24, textAlign: "center", color: "var(--muted)" }}>
                      Nenhum episódio institucional registrado até o momento.
                    </td>
                  </tr>
                ) : (
                  episodes.map((ep) => {
                    const isExpired = currentTime > 0 && new Date(ep.cacheExpiresAt).getTime() < currentTime;
                    return (
                      <tr key={ep.episodeId} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11 }}>
                          {ep.episodeId}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <strong>{ep.institutionName}</strong>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>ref: {ep.attendanceRef}</div>
                        </td>
                        <td style={{ padding: "10px 14px" }}>{ep.patientId}</td>
                        <td style={{ padding: "10px 14px" }}>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontWeight: 700,
                              background: ep.packageStatus === "ready" ? "#DCFCE7" : "#FEF3C7",
                              color: ep.packageStatus === "ready" ? "#166534" : "#92400E",
                            }}
                          >
                            {ep.packageStatus}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 8px",
                              borderRadius: 4,
                              fontWeight: 700,
                              background: ep.deliveryStatus === "confirmed" ? "#DCFCE7" : "#E0F2FE",
                              color: ep.deliveryStatus === "confirmed" ? "#166534" : "#0369A1",
                            }}
                          >
                            {ep.deliveryStatus}
                          </span>
                        </td>
                        <td style={{ padding: "10px 14px", fontWeight: 700 }}>
                          {ep.readCount || 1}x
                        </td>
                        <td style={{ padding: "10px 14px", color: isExpired ? "#EF4444" : "var(--foreground)" }}>
                          {isExpired ? "Expirado" : new Date(ep.cacheExpiresAt).toLocaleTimeString("pt-BR")}
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              className="button secondary small"
                              onClick={() => void handleReadContext(ep.episodeId)}
                              disabled={actionLoading || isExpired}
                              title="Releitura gratuita sem estender TTL"
                            >
                              Ler (R$ 0)
                            </button>
                            {ep.deliveryStatus !== "confirmed" && (
                              <button
                                className="button small"
                                onClick={() => void handleConfirmReceipt(ep.episodeId, ep.receiptToken)}
                                disabled={actionLoading || isExpired || ep.packageStatus !== "ready"}
                                title="Gera 1 unidade faturável idempotente"
                              >
                                Confirmar Recibo
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA 3: AUDITORIA DE USO VS. COBRANÇA */}
      {activeTab === "billing" && (
        <div className="stack" style={{ gap: 24 }}>
          {/* Painel de Princípio de Cobrança Zero por Clique */}
          <div className="panel" style={{ padding: 20, background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 6px", color: "#166534" }}>
              Modelo Comercial: Faturamento Idempotente por Episódio Assistencial
            </h3>
            <p style={{ fontSize: 12.5, color: "#166534", margin: 0 }}>
              Conforme o contrato B2B <code>CTR-B2B-2026-01</code>, operações técnicas (preparação, releituras de cache dentro dos 15 minutos, entregas parciais por laboratório offline e replays) são <strong>R$ 0,00</strong>. Apenas episódios clinicamente completos e confirmados pelo médico assistente geram 1 única fatura de <strong>R$ 18,50</strong>.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Lado Esquerdo: Eventos de Uso Técnico (R$ 0) */}
            <div className="panel" style={{ padding: 0 }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Eventos Técnicos de Uso (usage_events)</h3>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>R$ 0,00 (Não Faturáveis)</span>
              </div>
              <div style={{ maxHeight: 380, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-100, #edf5f4)", borderBottom: "1px solid var(--border)" }}>
                      <th style={{ padding: "8px 12px" }}>Ação</th>
                      <th style={{ padding: "8px 12px" }}>Instituição</th>
                      <th style={{ padding: "8px 12px" }}>Resultado</th>
                      <th style={{ padding: "8px 12px" }}>Horário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usageEvents.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: 18, textAlign: "center", color: "var(--muted)" }}>
                          Nenhum evento técnico gravado.
                        </td>
                      </tr>
                    ) : (
                      usageEvents.map((u) => (
                        <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px 12px", fontFamily: "monospace" }}>{u.action}</td>
                          <td style={{ padding: "8px 12px" }}>{u.institutionName}</td>
                          <td style={{ padding: "8px 12px" }}>
                            <span style={{ padding: "2px 6px", borderRadius: 4, background: "#E5E7EB", fontSize: 11 }}>
                              {u.outcome}
                            </span>
                          </td>
                          <td style={{ padding: "8px 12px", color: "var(--muted)" }}>
                            {new Date(u.occurredAt).toLocaleTimeString("pt-BR")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Lado Direito: Unidades Comerciais Faturáveis (R$ 18,50) */}
            <div className="panel" style={{ padding: 0 }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Unidades Faturáveis (billing_events)</h3>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#065F46" }}>1 un por Episódio Confirmado</span>
              </div>
              <div style={{ maxHeight: 380, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-100, #edf5f4)", borderBottom: "1px solid var(--border)" }}>
                      <th style={{ padding: "8px 12px" }}>Fatura ID</th>
                      <th style={{ padding: "8px 12px" }}>Instituição</th>
                      <th style={{ padding: "8px 12px" }}>Valor</th>
                      <th style={{ padding: "8px 12px" }}>Confirmação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingEvents.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: 18, textAlign: "center", color: "var(--muted)" }}>
                          Nenhuma unidade faturável confirmada ainda.
                        </td>
                      </tr>
                    ) : (
                      billingEvents.map((b) => (
                        <tr key={b.id} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 11 }}>{b.id}</td>
                          <td style={{ padding: "8px 12px" }}>{b.institutionName}</td>
                          <td style={{ padding: "8px 12px", fontWeight: 700, color: "#065F46" }}>
                            {b.amountBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </td>
                          <td style={{ padding: "8px 12px", color: "var(--muted)" }}>
                            {new Date(b.confirmedAt).toLocaleTimeString("pt-BR")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: GOVERNANÇA DE FONTES & SESSÕES */}
      {activeTab === "governance" && (
        <div className="stack" style={{ gap: 24 }}>
          {/* Conectores Institucionais */}
          <div className="panel" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 14px", color: "var(--foreground)" }}>
              Estado dos Conectores de Dados (data_sources)
            </h3>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 16px" }}>
              Quando uma fonte fica <code>disconnected</code> (ex: Sabin ou Apple Watch fora do ar), o sistema automaticamente gera pacotes parciais gratuitos para o hospital e marca status de resiliência sem travar a emergência.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
              {sources.map((src) => (
                <div key={src.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: 13 }}>{src.name}</strong>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 4,
                        fontWeight: 700,
                        background:
                          src.state === "connected" ? "#DCFCE7" : src.state === "stale" ? "#FEF3C7" : "#FEE2E2",
                        color:
                          src.state === "connected" ? "#166534" : src.state === "stale" ? "#92400E" : "#991B1B",
                      }}
                    >
                      {src.state.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{src.healthNote}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                    <button
                      className="button secondary small"
                      style={{ fontSize: 10, padding: "3px 8px" }}
                      onClick={() => void handleToggleConnectorState(src.id, "connected")}
                    >
                      Operacional
                    </button>
                    <button
                      className="button secondary small"
                      style={{ fontSize: 10, padding: "3px 8px" }}
                      onClick={() => void handleToggleConnectorState(src.id, "stale")}
                    >
                      Atrasado
                    </button>
                    <button
                      className="button secondary small"
                      style={{ fontSize: 10, padding: "3px 8px", color: "#DC2626" }}
                      onClick={() => void handleToggleConnectorState(src.id, "disconnected")}
                    >
                      Offline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
