"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, KeyRound, LogOut, Users, ShieldCheck, Shield, Stethoscope } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useDoctor } from "./provider";
import { useEffect, useState, type ReactNode } from "react";
import { scenarioNames, type DemoScenario } from "@/lib/demo/scenarios";
import { TeamSpace } from "@/features/team/team-space";

export function Shell({ children }: { children: ReactNode }) {
  const ctx = useDoctor();
  const client = useQueryClient();
  const pathname = usePathname();
  const invitation = pathname.includes("/consultation");
  const [logoutState, setLogoutState] = useState<"pending" | "error" | null>(null);

  // Alternância explícita entre superfícies
  const [surface, setSurface] = useState<"medico" | "equipe">("medico");

  // Scenario control stays outside the clinical UI and never attaches to the real API.
  useEffect(() => {
    if (ctx.mode !== "demo" || !ctx.demo) return;
    const control = (event: Event) => {
      const { action, scenario } = (event as CustomEvent<{ action: string; scenario?: DemoScenario }>).detail ?? {};
      if (action === "scenario" && scenario && scenarioNames.includes(scenario)) {
        ctx.changeScenario(scenario);
        return;
      }
      if (action === "arrive") ctx.demo?.arrive();
      else if (action === "revoke") ctx.demo?.revoke();
      else if (action === "restrict") ctx.demo?.restrict();
      else if (action === "approve") ctx.demo?.decide("approved");
      else if (action === "reject") ctx.demo?.decide("rejected");
      else if (action === "doctor") {
        ctx.demo?.otherDoctor();
        ctx.refreshSession();
      } else return;
      void client.invalidateQueries({ predicate: (q) => q.queryKey.includes("access") || q.queryKey.includes("followup") || q.queryKey.includes("portfolio") });
    };
    window.addEventListener("rivio:scenario", control);
    return () => window.removeEventListener("rivio:scenario", control);
  }, [ctx, client]);

  async function logout() {
    setLogoutState("pending");
    await client.cancelQueries();
    client.removeQueries({ predicate: (q) => q.queryKey[1] !== "session" });
    ctx.setTemporary(null);
    ctx.setInvitation(null);
    try {
      await ctx.api.logout();
      ctx.clear();
    } catch {
      setLogoutState("error");
    }
  }

  const doctor = ctx.session?.doctor;
  const initials = doctor?.displayName.replace(/^Dra?\.\s*/i, "").split(" ").filter(Boolean).map((word) => word[0]).slice(0, 2).join("") ?? "MD";

  return (
    <div className="app-shell">
      <aside className="rail" aria-label="Navegação principal">
        <Link href={ctx.base} className="brand" aria-label="Rivio, espaço do médico">
          <Activity aria-hidden="true" size={28} />
          <span>rivio<span className="brand-dot">.</span></span>
        </Link>

        {/* Alternância de Superfície na Rail */}
        <div style={{ padding: "8px 6px", display: "flex", flexDirection: "column", gap: 6, margin: "6px 0 16px" }}>
          <button
            type="button"
            className="nav-link"
            aria-pressed={surface === "medico"}
            data-testid="surface-button-medico"
            style={{
              width: "100%",
              justifyContent: "center",
              background: surface === "medico" ? "rgba(102,148,255,0.18)" : "transparent",
              color: surface === "medico" ? "var(--blue, #6694FF)" : "inherit",
              borderRadius: "var(--r-caixa, 8px)",
              border: surface === "medico" ? "1px solid rgba(102,148,255,0.32)" : "1px solid transparent",
            }}
            onClick={() => setSurface("medico")}
          >
            <Stethoscope size={20} aria-hidden="true" />
            <span style={{ fontSize: 11, fontWeight: 700 }}>Médico</span>
          </button>

          <button
            type="button"
            className="nav-link"
            aria-pressed={surface === "equipe"}
            data-testid="surface-button-equipe"
            style={{
              width: "100%",
              justifyContent: "center",
              background: surface === "equipe" ? "rgba(102,148,255,0.18)" : "transparent",
              color: surface === "equipe" ? "var(--blue, #6694FF)" : "inherit",
              borderRadius: "var(--r-caixa, 8px)",
              border: surface === "equipe" ? "1px solid rgba(102,148,255,0.32)" : "1px solid transparent",
            }}
            onClick={() => setSurface("equipe")}
          >
            <Shield size={20} aria-hidden="true" />
            <span style={{ fontSize: 11, fontWeight: 700 }}>Equipe</span>
          </button>
        </div>

        <nav>
          {surface === "medico" ? (
            <>
              <Link className="nav-link" href={`${ctx.base}/patients`} aria-current={!invitation ? "page" : undefined} aria-label="Minha carteira">
                <Users size={22} aria-hidden="true" /><span>Carteira</span>
              </Link>
              <Link className="nav-link" href={`${ctx.base}/consultation`} aria-current={invitation ? "page" : undefined} aria-label="Inserir Token">
                <KeyRound size={22} aria-hidden="true" /><span>Token</span>
              </Link>
            </>
          ) : (
            <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--muted)", textAlign: "center" }}>
              Modo Operacional
            </div>
          )}
        </nav>
        <div className="rail-foot" title="Acesso autorizado pelo paciente">
          <ShieldCheck size={22} aria-hidden="true" /><span>Acesso<br />autorizado</span>
        </div>
      </aside>

      <div className="app-content">
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span className="topbar-title">
              {surface === "medico" ? "Espaço do Médico" : "Espaço Equipe"} <span>/</span>{" "}
              {surface === "medico" ? (invitation ? "Compartilhamento" : "Acompanhamento") : "Observabilidade & Governança B2B"}
            </span>

            {/* Alternância Rápida de Superfície no Topbar */}
            <div
              role="tablist"
              aria-label="Superfície de trabalho"
              style={{
                display: "inline-flex",
                background: "var(--superficie, #F0F5FF)",
                padding: 3,
                borderRadius: "var(--r-caixa, 8px)",
                border: "1px solid var(--border)",
              }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={surface === "medico"}
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "var(--font-label)",
                  textTransform: "uppercase",
                  letterSpacing: ".04em",
                  border: "none",
                  borderRadius: "var(--r-chip, 4px)",
                  cursor: "pointer",
                  background: surface === "medico" ? "#fff" : "transparent",
                  color: surface === "medico" ? "var(--blue, #6694FF)" : "var(--muted)",
                  boxShadow: surface === "medico" ? "0 1px 4px rgba(102,148,255,0.18)" : "none",
                }}
                onClick={() => setSurface("medico")}
              >
                Espaço Médico
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={surface === "equipe"}
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "var(--font-label)",
                  textTransform: "uppercase",
                  letterSpacing: ".04em",
                  border: "none",
                  borderRadius: "var(--r-chip, 4px)",
                  cursor: "pointer",
                  background: surface === "equipe" ? "#fff" : "transparent",
                  color: surface === "equipe" ? "var(--blue, #6694FF)" : "var(--muted)",
                  boxShadow: surface === "equipe" ? "0 1px 4px rgba(102,148,255,0.18)" : "none",
                }}
                onClick={() => setSurface("equipe")}
              >
                Espaço Equipe
              </button>
            </div>
          </div>

          <div className="doctor-identity">
            <span className="identity-mark">{initials}</span>
            <span>{doctor?.displayName ?? "Acesso do médico"}<small>{doctor?.professionalIdentifier ?? "Identificação pelo serviço central"}</small></span>
            {ctx.session?.state === "authenticated" ? <button className="icon-button" aria-label="Sair" data-discard-context onClick={() => void logout()}><LogOut size={18} /></button> : null}
          </div>
        </header>

        <main id="main" className="main-content">
          {logoutState ? (
            <section className="empty-state" role="status">
              <h1>{logoutState === "pending" ? "Encerrando sessão…" : "Não foi possível confirmar a saída no serviço"}</h1>
              <p>O conteúdo clínico foi removido deste espaço.</p>
              {logoutState === "error" ? <button className="button" onClick={() => void logout()}>Tentar encerrar novamente</button> : null}
            </section>
          ) : surface === "equipe" ? (
            <TeamSpace />
          ) : (
            <div key={`${ctx.mode}:${ctx.session ? (doctor?.id ?? "anonymous") : "blocked"}`}>
              {children}
            </div>
          )}
        </main>

        <footer className="app-footer">
          <span>Rivio · Contexto que acompanha o cuidado.</span>
          <span><ShieldCheck size={13} aria-hidden="true" /> Compartilhado pelo paciente · LGPD & Open Health</span>
        </footer>
      </div>
    </div>
  );
}
