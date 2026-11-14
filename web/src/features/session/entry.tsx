"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  ArrowRight,
  KeyRound,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  ArrowLeft,
  FileCheck2,
  Clock,
  Sparkles,
} from "lucide-react";
import { useDoctor } from "./provider";
import { authenticationUrl } from "@/lib/api/http";
import { Failure, Loading } from "@/components/ui/status";
import { Workspace } from "@/features/workspace/workspace";
import { parseInvitation } from "@/features/sharing/parse-invitation";
import { PortfolioPage } from "@/features/patients/portfolio-page";
import { supabaseClinicalRepo } from "@/lib/supabase-clinical-repo";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export function Entry() {
  const ctx = useDoctor();
  const [tokenInput, setTokenInput] = useState("");
  const [resolving, setResolving] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [showPortfolio, setShowPortfolio] = useState(false);

  // Informação do token gerado em tempo real no app móvel
  const [liveToken, setLiveToken] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLatestActiveToken() {
      if (!isSupabaseConfigured) return;
      try {
        const { data } = await supabase
          .from("doctor_access_sessions")
          .select("token, active, expires_at")
          .eq("patient_id", "usr-dan-2026")
          .eq("active", true)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data?.token) {
          setLiveToken(data.token);
        } else {
          setLiveToken(null);
        }
      } catch {
        // Fallback
      }
    }

    void fetchLatestActiveToken();

    // Inscrição Realtime no Supabase para detectar quando o paciente gera um novo token no app móvel
    const channel = supabase
      .channel("doctor_sessions_live_feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "doctor_access_sessions" },
        () => {
          void fetchLatestActiveToken();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  // Campos de login médico
  const [crm, setCrm] = useState("123456-SP");
  const [doctorPass, setDoctorPass] = useState("••••••••");
  const [specialty, setSpecialty] = useState("Cardiologia & Clínica Médica");

  const controller = useRef<AbortController | null>(null);

  // Submissão do Token de 6 Dígitos
  const handleResolveToken = useCallback(
    async (rawToken: string) => {
      if (!rawToken.trim()) return;
      setResolving(true);
      setTokenError(null);
      const request = new AbortController();
      controller.current = request;

      try {
        const parsed = parseInvitation(rawToken, window.location.origin);

        // 1. Validação e Auditoria no Supabase (Open Health / LGPD)
        let resolvedPatientId = "usr-dan-2026";
        let resolvedScopes: (
          | "read_exams"
          | "read_wearables"
          | "read_graphrag_briefing"
          | "read_clinical_context"
          | "read_alerts"
        )[] = ["read_exams", "read_wearables", "read_graphrag_briefing"];

        if (isSupabaseConfigured) {
          const supabaseSession = await supabaseClinicalRepo.resolveDoctorToken(parsed);
          if (supabaseSession) {
            resolvedPatientId = supabaseSession.patient_id || "usr-dan-2026";
            if (supabaseSession.scope && Array.isArray(supabaseSession.scope)) {
              const validScopes = [
                "read_exams",
                "read_wearables",
                "read_graphrag_briefing",
                "read_clinical_context",
                "read_alerts",
              ];
              resolvedScopes = supabaseSession.scope.filter((s: string) =>
                validScopes.includes(s)
              ) as typeof resolvedScopes;
            }
            // Atualiza os dados do médico na auditoria
            await supabase
              .from("doctor_access_sessions")
              .update({
                doctor_crm: crm,
                doctor_name: "Dr. Roberto Silva",
              })
              .eq("id", supabaseSession.id);
          }
        }

        // 2. Resolve no ecossistema do cockpit
        const r = await ctx.api.resolve(parsed, { signal: request.signal });
        if (request.signal.aborted) return;

        const customTemporary = r.data.temporaryAccess
          ? {
              ...r.data.temporaryAccess,
              patientId: resolvedPatientId,
              scopes: resolvedScopes,
            }
          : null;

        ctx.setInvitation(r.data);
        ctx.setTemporary(customTemporary);
        setTokenInput("");
      } catch (err: unknown) {
        if (!request.signal.aborted) {
          setTokenError(
            (err as Error)?.message ||
              "Não foi possível validar o token informado. Verifique os 6 dígitos gerados no aplicativo."
          );
        }
      } finally {
        if (controller.current === request && !request.signal.aborted) {
          setResolving(false);
        }
      }
    },
    [ctx, crm]
  );

  // Encerramento da consulta temporária
  const handleClosePatientSession = () => {
    ctx.setTemporary(null);
    ctx.setInvitation(null);
    setTokenInput("");
    setTokenError(null);
  };

  // =========================================================================
  // PASSO 3: ACESSO AO HISTÓRICO GERAL DO PACIENTE (Cockpit Clínico / Workspace)
  // =========================================================================
  if (ctx.session?.state === "authenticated" && ctx.temporary) {
    return (
      <div className="stack" style={{ gap: "16px" }}>
        {/* Barra superior de controle do atendimento ativo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#eef8f4",
            border: "1px solid #c4dfd8",
            borderRadius: "8px",
            padding: "12px 20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "#087c73",
                boxShadow: "0 0 0 4px #b6e6dc",
              }}
            />
            <div>
              <strong style={{ fontSize: "14px", color: "#132f34" }}>
                Atendimento Clínico Ativo · Prontuário do Paciente
              </strong>
              <div style={{ fontSize: "12px", color: "#4d646b" }}>
                Acesso temporário liberado via Token de 6 dígitos · Validade de 15 minutos (Open Health Protocol)
              </div>
            </div>
          </div>
          <button
            type="button"
            className="button secondary"
            onClick={handleClosePatientSession}
            style={{ fontSize: "12px", minHeight: "36px", padding: "6px 14px" }}
          >
            <ArrowLeft size={14} />
            Finalizar Atendimento / Novo Token
          </button>
        </div>

        {/* Histórico Geral do Paciente: Workspace Completo */}
        <Workspace
          key={ctx.temporary.contextId}
          patientId={ctx.temporary.patientId}
          temporaryAccessId={ctx.temporary.contextId}
        />
      </div>
    );
  }

  // =========================================================================
  // PASSO 2: TELA DE PEDIDO DE TOKEN DO PACIENTE (Médico autenticado)
  // =========================================================================
  if (ctx.session?.state === "authenticated") {
    if (showPortfolio) {
      return (
        <div className="stack" style={{ gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              type="button"
              className="button secondary"
              onClick={() => setShowPortfolio(false)}
            >
              <ArrowLeft size={16} /> Voltar para Atendimento com Token
            </button>
          </div>
          <PortfolioPage />
        </div>
      );
    }

    const doctor = ctx.session.doctor;

    return (
      <div style={{ maxWidth: "680px", margin: "24px auto" }} className="stack">
        {/* Identificação do Médico Ativo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#fff",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "12px 18px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                backgroundColor: "#e1f1ec",
                display: "grid",
                placeItems: "center",
                color: "var(--teal)",
                fontWeight: "700",
              }}
            >
              <Stethoscope size={18} />
            </div>
            <div>
              <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--foreground)" }}>
                {doctor?.displayName || "Dr. Roberto Silva"}
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                {doctor?.professionalIdentifier || "CRM 123456-SP"} · {specialty}
              </div>
            </div>
          </div>
          <span className="badge">
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "#087c73",
                display: "inline-block",
                marginRight: "4px",
              }}
            />
            Plantão Ativo
          </span>
        </div>

        {/* Card Central de Pedido de Token do Paciente */}
        <section className="panel stack" style={{ padding: "32px 28px" }}>
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            <div
              style={{
                display: "inline-flex",
                padding: "12px",
                borderRadius: "50%",
                backgroundColor: "#eef8f4",
                color: "var(--teal)",
                marginBottom: "12px",
              }}
            >
              <KeyRound size={32} />
            </div>
            <h1 style={{ fontSize: "24px", marginBottom: "8px" }}>
              Acesso ao Histórico do Paciente
            </h1>
            <p className="muted" style={{ maxWidth: "520px", margin: "0 auto", fontSize: "14px" }}>
              Solicite o <strong>token de 6 dígitos</strong> gerado no aplicativo Rivio Flow do paciente para liberar o prontuário completo, histórico de laudos laboratoriais e evolução clínica.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleResolveToken(tokenInput);
            }}
            className="stack"
            style={{ gap: "20px" }}
          >
            <div className="field">
              <label
                htmlFor="patient-token-input"
                style={{ textAlign: "center", fontSize: "13px", color: "var(--muted)" }}
              >
                TOKEN DE ACESSO DO PACIENTE (6 DÍGITOS)
              </label>
              <input
                id="patient-token-input"
                type="text"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="6 DÍGITOS"
                style={{
                  fontFamily: "monospace",
                  fontSize: "30px",
                  letterSpacing: "0.25em",
                  textAlign: "center",
                  textTransform: "uppercase",
                  fontWeight: "800",
                  padding: "14px",
                  border: "2px solid var(--teal)",
                  borderRadius: "8px",
                  backgroundColor: "#fafdfc",
                }}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                disabled={resolving}
              />
            </div>

            {/* Painel Dinâmico de Token em Tempo Real */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                backgroundColor: "#f4f8f8",
                padding: "12px",
                borderRadius: "6px",
                border: "1px solid #d5e5e4",
              }}
            >
              {liveToken ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "12px", color: "#087c73", fontWeight: "700" }}>
                    ● Novo Token detectado no app móvel em tempo real:
                  </span>
                  <button
                    type="button"
                    className="button small"
                    onClick={() => {
                      setTokenInput(liveToken);
                      void handleResolveToken(liveToken);
                    }}
                    disabled={resolving}
                    style={{
                      fontSize: "14px",
                      fontWeight: "800",
                      letterSpacing: "0.15em",
                      backgroundColor: "#052e2e",
                      color: "#5ce0ba",
                      border: "1px solid #087c73",
                      padding: "8px 16px",
                    }}
                  >
                    <Sparkles size={14} color="#5ce0ba" /> Preencher Token Ativo: {liveToken}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                  <span style={{ fontSize: "12px", color: "var(--muted)", textAlign: "center" }}>
                    Nenhum token ativo no banco. Gere um token no app móvel do paciente.
                  </span>
                  <a
                    href="/patient"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: "12px",
                      color: "#2563EB",
                      fontWeight: "700",
                      textDecoration: "underline",
                      marginTop: "2px",
                    }}
                  >
                    Abrir App do Paciente (/patient) em nova aba ↗
                  </a>
                </div>
              )}
            </div>

            {/* Mensagem de Erro se houver */}
            {tokenError && (
              <div
                role="alert"
                style={{
                  backgroundColor: "#fef2f2",
                  color: "#991b1b",
                  border: "1px solid #fecaca",
                  padding: "10px 14px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  textAlign: "center",
                }}
              >
                {tokenError}
              </div>
            )}

            {/* Botão de Submissão Principal */}
            <button
              type="submit"
              className="button"
              disabled={resolving || !tokenInput.trim()}
              style={{
                fontSize: "15px",
                padding: "14px 20px",
                minHeight: "48px",
                justifyContent: "center",
              }}
            >
              <KeyRound size={18} />
              {resolving ? "Validando Token e Liberando Prontuário…" : "Acessar Histórico Geral do Paciente"}
              <ArrowRight size={18} />
            </button>
          </form>

          <hr style={{ margin: "20px 0 16px" }} />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: "12px",
              color: "var(--muted)",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Clock size={14} /> Validade de 2 horas por sessão
            </span>
            <button
              type="button"
              className="text-link"
              onClick={() => setShowPortfolio(true)}
              style={{ fontSize: "12px" }}
            >
              Ver carteira geral de pacientes
            </button>
          </div>
        </section>
      </div>
    );
  }

  // =========================================================================
  // PASSO 1: LOGIN MÉDICO (Identificação e Acesso Clínico)
  // =========================================================================
  return (
    <div className="entry-layout">
      {/* Formulário de Identificação do Médico */}
      <div className="entry-main">
        <div style={{ marginBottom: "20px" }}>
          <span className="badge" style={{ marginBottom: "12px" }}>
            <Stethoscope size={14} /> Portal do Médico · Rivio Flow
          </span>
          <h1 style={{ fontSize: "36px", marginBottom: "12px" }}>
            Login Médico.
            <br />
            <span>Acesse o consultório.</span>
          </h1>
          <p className="lead" style={{ fontSize: "15px", marginBottom: "20px" }}>
            Identifique-se com suas credenciais médicas para iniciar o atendimento e consultar o histórico de saúde liberado pelo paciente via Token.
          </p>
        </div>

        <section
          className="panel stack"
          style={{ maxWidth: "460px", padding: "24px", gap: "16px" }}
        >
          <div className="field">
            <label htmlFor="doctor-crm">CRM e Estado</label>
            <input
              id="doctor-crm"
              type="text"
              value={crm}
              onChange={(e) => setCrm(e.target.value)}
              placeholder="Ex: 123456-SP"
              autoComplete="off"
            />
          </div>

          <div className="field">
            <label htmlFor="doctor-specialty">Especialidade Clínica</label>
            <input
              id="doctor-specialty"
              type="text"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              placeholder="Ex: Cardiologia"
            />
          </div>

          <div className="field">
            <label htmlFor="doctor-password">Senha de Acesso / Certificado</label>
            <input
              id="doctor-password"
              type="password"
              value={doctorPass}
              onChange={(e) => setDoctorPass(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div style={{ marginTop: "8px" }} className="stack">
            {!ctx.sessionReady ? (
              <Loading label="Verificando sessão médica…" />
            ) : ctx.sessionError ? (
              <Failure error={ctx.sessionError} onRetry={ctx.refreshSession} />
            ) : ctx.mode === "demo" ? (
              <button
                type="button"
                className="button"
                style={{ width: "100%", justifyContent: "center", fontSize: "14px" }}
                onClick={() => {
                  ctx.demo?.login();
                  ctx.refreshSession();
                }}
              >
                <UserCheck size={18} /> Entrar no Espaço do Médico
              </button>
            ) : (
              <a
                className="button"
                style={{ width: "100%", justifyContent: "center" }}
                href={authenticationUrl()}
              >
                Identificar-me pelo CFM / ICP-Brasil <ArrowRight size={18} />
              </a>
            )}

            <button
              type="button"
              className="text-link"
              style={{ justifyContent: "center", marginTop: "8px" }}
              onClick={() => {
                ctx.demo?.login();
                ctx.refreshSession();
              }}
            >
              Acesso Rápido de Demonstração (Dr. Roberto Silva · CRM 123456-SP)
            </button>
          </div>
        </section>
      </div>

      {/* Painel Lateral com Políticas de Segurança e Open Health */}
      <div className="entry-aside">
        <ShieldCheck size={32} color="#087c73" />
        <h2>
          O paciente autoriza.
          <br />
          Você cuida.
        </h2>
        <p>
          O paciente gera um token temporário de 6 dígitos no aplicativo mobile e concede acesso seguro de 2 horas ao histórico completo de saúde.
        </p>
        <hr />
        <FileCheck2 size={24} color="#087c73" />
        <h3>Histórico e Síntese Clínica</h3>
        <p>
          Visualize exames laboratoriais, linha do tempo evolutiva, grafo de relações de saúde e fontes primárias autenticadas.
        </p>
        <p className="small muted">
          Em conformidade com a LGPD e o protocolo Open Health. Nenhuma informação é compartilhada sem o consentimento ativo do paciente.
        </p>
      </div>
    </div>
  );
}
