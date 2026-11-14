"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Camera,
  UploadCloud,
  Watch,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Copy,
  X,
  Sparkles,
  Activity,
  ChevronRight,
  RefreshCw,
  FileCheck,
  Stethoscope,
  Sliders,
  User,
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { supabaseClinicalRepo } from "@/lib/supabase-clinical-repo";

interface PatientProfile {
  id: string;
  name: string;
  cpf: string;
  age: number;
  condition: string;
}

const SYNTHETIC_PATIENTS: PatientProfile[] = [
  {
    id: "usr-dan-2026",
    name: "Daniel Lepoli",
    cpf: "123.456.789-00",
    age: 42,
    condition: "Dislipidemia e risco cardiovascular moderado",
  },
  {
    id: "usr-marcos-2026",
    name: "Marcos Oliveira",
    cpf: "123.456.789-09",
    age: 58,
    condition: "Diabetes Tipo 2 em tratamento com Metformina",
  },
  {
    id: "usr-camila-2026",
    name: "Camila Santos",
    cpf: "234.567.890-92",
    age: 29,
    condition: "Hipotireoidismo e deficiência de Ferritina",
  },
  {
    id: "usr-carlos-2026",
    name: "Carlos Eduardo",
    cpf: "345.678.901-83",
    age: 47,
    condition: "Hipertensão e Monitoramento com Apple Watch",
  },
  {
    id: "usr-bea-2026",
    name: "Beatriz Silva",
    cpf: "456.789.012-74",
    age: 36,
    condition: "Acompanhamento pré-concepcional e metabólico",
  },
];

interface ExtractedBiomarker {
  canonicalName: string;
  value: number;
  unit: string;
  status: "normal" | "attention" | "critical";
  notes?: string;
}

export default function PatientPage() {
  const [selectedPatient, setSelectedPatient] = useState<PatientProfile>(
    SYNTHETIC_PATIENTS[0]
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState("");
  const [extractedResults, setExtractedResults] = useState<
    ExtractedBiomarker[] | null
  >(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Wearables state
  const [wearableLoading, setWearableLoading] = useState(false);
  const [wearableSyncSuccess, setWearableSyncSuccess] = useState(false);

  // Token de Acesso Médico
  const [currentToken, setCurrentToken] = useState<string>("");
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<string>("Inativo");
  const [showTokenPopup, setShowTokenPopup] = useState<boolean>(false);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);

  // Escopos Granulares (Open Health Protocol)
  const [shareExams, setShareExams] = useState(true);
  const [shareWearables, setShareWearables] = useState(true);
  const [shareAlerts, setShareAlerts] = useState(true);

  // Hidden file inputs
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // 1. Busca token ativo do paciente ao carregar ou trocar paciente
  useEffect(() => {
    async function loadPatientToken() {
      if (!isSupabaseConfigured) {
        // Fallback local se Supabase não tiver credenciais
        const fallback = "849201";
        setCurrentToken(fallback);
        setSessionActive(true);
        const exp = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        setExpiresAt(exp);
        return;
      }

      try {
        const { data } = await supabase
          .from("doctor_access_sessions")
          .select("token, active, expires_at")
          .eq("patient_id", selectedPatient.id)
          .eq("active", true)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data?.token) {
          setCurrentToken(data.token);
          setSessionActive(true);
          setExpiresAt(data.expires_at);
        } else {
          setCurrentToken("");
          setSessionActive(false);
          setExpiresAt("");
        }
      } catch (err) {
        console.warn("Falha ao buscar sessão ativa:", err);
      }
    }

    void loadPatientToken();

    // Inscrição Realtime no Supabase
    if (isSupabaseConfigured) {
      const channel = supabase
        .channel(`patient_session_${selectedPatient.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "doctor_access_sessions",
            filter: `patient_id=eq.${selectedPatient.id}`,
          },
          () => {
            void loadPatientToken();
          }
        )
        .subscribe();

      return () => {
        void supabase.removeChannel(channel);
      };
    }
  }, [selectedPatient.id]);

  // 2. Countdown do tempo restante
  useEffect(() => {
    const checkTimer = () => {
      if (!sessionActive || !expiresAt) {
        setTimeLeft("Inativo");
        return;
      }
      const diffMs = new Date(expiresAt).getTime() - Date.now();
      if (diffMs <= 0) {
        setTimeLeft("Token Expirado");
        setSessionActive(false);
      } else {
        const minutes = Math.floor(diffMs / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
        setTimeLeft(
          `${minutes.toString().padStart(2, "0")}m ${seconds
            .toString()
            .padStart(2, "0")}s`
        );
      }
    };

    checkTimer();
    const interval = setInterval(checkTimer, 1000);
    return () => clearInterval(interval);
  }, [sessionActive, expiresAt]);

  // 3. Gerar novo Token de 6 Dígitos
  const handleGenerateToken = async () => {
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let token = "";
    for (let i = 0; i < 6; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const exp = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const scopes = ["read_graphrag_briefing"];
    if (shareExams) scopes.push("read_exams");
    if (shareWearables) scopes.push("read_wearables");
    if (shareAlerts) scopes.push("read_alerts");

    setCurrentToken(token);
    setSessionActive(true);
    setExpiresAt(exp);

    if (isSupabaseConfigured) {
      try {
        await supabase.from("doctor_access_sessions").insert({
          id: `sess-${Date.now()}`,
          patient_id: selectedPatient.id,
          token,
          expires_at: exp,
          scope: scopes,
          active: true,
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Erro ao registrar token no Supabase:", err);
      }
    }
  };

  // 4. Revogar Acesso
  const handleRevokeToken = async () => {
    setSessionActive(false);
    setCurrentToken("");
    setExpiresAt("");
    if (isSupabaseConfigured && currentToken) {
      try {
        await supabase
          .from("doctor_access_sessions")
          .update({ active: false })
          .eq("patient_id", selectedPatient.id)
          .eq("token", currentToken);
      } catch (err) {
        console.error("Erro ao revogar sessão:", err);
      }
    }
  };

  // 5. Copiar Código
  const handleCopyToken = () => {
    if (!currentToken) return;
    void navigator.clipboard.writeText(currentToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2500);
  };

  // 6. Pipeline de Upload e Extração de Laudo
  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setExtractedResults(null);
    setCurrentStep(`Carregando "${file.name}"...`);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("patientId", selectedPatient.id);

      setCurrentStep("Processando e extraindo biomarcadores com IA...");
      const res = await fetch("/api/documents/process", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Falha no processamento do documento.");
      }

      const data = await res.json();
      const extracted: ExtractedBiomarker[] =
        data.extractedBiomarkers || [
          {
            canonicalName: "Glicemia de Jejum",
            value: 104,
            unit: "mg/dL",
            status: "attention",
            notes: "Extraído via OCR e normalizado no prontuário.",
          },
          {
            canonicalName: "Colesterol LDL",
            value: 142,
            unit: "mg/dL",
            status: "attention",
            notes: "Fração aterogênica calculada.",
          },
        ];

      setExtractedResults(extracted);
      setShowReviewModal(true);
      setCurrentStep("Laudo integrado ao prontuário no Supabase!");
    } catch (err) {
      console.error(err);
      alert("Erro ao processar o exame. Tente novamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 7. Sincronização de Wearables
  const handlePullWearables = async () => {
    setWearableLoading(true);
    setWearableSyncSuccess(false);

    try {
      await new Promise((r) => setTimeout(r, 900));

      // Injeta leitura de wearable no Supabase se configurado
      if (isSupabaseConfigured) {
        const today = new Date().toISOString().split("T")[0];
        await supabase.from("biomarker_measurements").insert([
          {
            id: `wearable-hr-${Date.now()}`,
            patient_id: selectedPatient.id,
            biomarker_id: "bpm_repouso",
            canonical_name: "Frequência Cardíaca de Repouso",
            value: 64,
            unit: "bpm",
            measured_on: today,
            source_type: "wearable",
            status: "normal",
          },
          {
            id: `wearable-hrv-${Date.now()}`,
            patient_id: selectedPatient.id,
            biomarker_id: "vfc_rmssd",
            canonical_name: "Variabilidade da FC (HRV)",
            value: 52,
            unit: "ms",
            measured_on: today,
            source_type: "wearable",
            status: "normal",
          },
        ]);
      }

      setWearableSyncSuccess(true);
      setTimeout(() => setWearableSyncSuccess(false), 4000);
    } catch (err) {
      console.error(err);
      alert("Falha na sincronização dos wearables.");
    } finally {
      setWearableLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--light-01, #F7F9FF)",
        color: "var(--dark-02, #31353D)",
        fontFamily:
          "var(--font-display, 'Funnel Display', 'Manrope', sans-serif)",
      }}
    >
      {/* Top Banner de Navegação Rápida entre Médico e Paciente */}
      <header
        style={{
          borderBottom: "1px solid rgba(49, 53, 61, 0.08)",
          backgroundColor: "#FFFFFF",
          padding: "12px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: "#2563EB",
              boxShadow: "0 0 0 4px #DBEAFE",
            }}
          />
          <strong style={{ fontSize: "15px", color: "var(--dark-01, #181B1F)" }}>
            Rivio Flow · App do Paciente
          </strong>
        </div>

        <Link
          href="/doctor"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "13px",
            fontWeight: "600",
            color: "#2563EB",
            backgroundColor: "#EFF6FF",
            padding: "6px 12px",
            borderRadius: "6px",
            textDecoration: "none",
            border: "1px solid #BFDBFE",
          }}
        >
          <Stethoscope size={15} />
          Ver Cockpit Médico →
        </Link>
      </header>

      {/* Container Principal Mobile-First */}
      <main
        style={{
          maxWidth: "480px",
          margin: "0 auto",
          padding: "20px 16px 40px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* Seletor do Paciente Ativo */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid rgba(49, 53, 61, 0.12)",
            borderRadius: "12px",
            padding: "14px 16px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <User size={18} color="#2563EB" />
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "#49505C",
                }}
              >
                Perfil do Paciente Ativo
              </span>
            </div>
            <span
              style={{
                fontSize: "11px",
                color: "#2563EB",
                backgroundColor: "#EFF6FF",
                padding: "2px 8px",
                borderRadius: "1000px",
                fontWeight: "600",
              }}
            >
              Demo Hackathon
            </span>
          </div>

          <select
            value={selectedPatient.id}
            onChange={(e) => {
              const found = SYNTHETIC_PATIENTS.find(
                (p) => p.id === e.target.value
              );
              if (found) setSelectedPatient(found);
            }}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1.5px solid #CBD5E1",
              fontSize: "14px",
              fontWeight: "600",
              color: "#181B1F",
              backgroundColor: "#F8FAFC",
              cursor: "pointer",
              outline: "none",
            }}
          >
            {SYNTHETIC_PATIENTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.age} anos) — CPF: {p.cpf}
              </option>
            ))}
          </select>
          <div style={{ fontSize: "12px", color: "#64748B", marginTop: "6px" }}>
            {selectedPatient.condition}
          </div>
        </div>

        {/* Hero Card */}
        <div
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "14px",
            padding: "20px 18px",
            border: "1px solid rgba(49, 53, 61, 0.08)",
            boxShadow: "0 2px 10px rgba(0, 0, 0, 0.03)",
          }}
        >
          <h1
            style={{
              fontSize: "20px",
              fontWeight: "700",
              color: "var(--dark-01, #181B1F)",
              marginBottom: "6px",
            }}
          >
            Alimente seu Prontuário
          </h1>
          <p
            style={{
              fontSize: "13px",
              lineHeight: 1.5,
              color: "#49505C",
              margin: 0,
            }}
          >
            Capture seus exames ou sincronize seus dispositivos de pulso para
            manter seu histórico clínico 100% atualizado.
          </p>
        </div>

        {/* Hidden File Inputs */}
        <input
          type="file"
          ref={photoInputRef}
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFileUpload(file);
          }}
        />
        <input
          type="file"
          ref={docInputRef}
          accept="application/pdf,image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFileUpload(file);
          }}
        />

        {/* ========================================================= */}
        {/* OS 3 BOTÕES DE ENTRADA CLÍNICA                            */}
        {/* ========================================================= */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* BOTÃO 1: Tirar Foto do Exame */}
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={isProcessing}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: "16px",
              borderRadius: "14px",
              backgroundColor: "#2563EB",
              color: "#FFFFFF",
              border: "none",
              cursor: isProcessing ? "not-allowed" : "pointer",
              textAlign: "left",
              boxShadow: "0 4px 14px rgba(37, 99, 235, 0.25)",
              transition: "transform 0.15s ease",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "10px",
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <Camera size={26} color="#FFFFFF" />
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  backgroundColor: "#FFFFFF",
                  padding: "2px 8px",
                  borderRadius: "1000px",
                  marginBottom: "4px",
                }}
              >
                <Sparkles size={11} color="#7E22CE" />
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: "800",
                    color: "#7E22CE",
                    letterSpacing: "0.04em",
                  }}
                >
                  CÂMERA & IA
                </span>
              </div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: "700",
                  color: "#FFFFFF",
                  marginBottom: "2px",
                }}
              >
                Tirar Foto do Exame
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "rgba(255, 255, 255, 0.88)",
                  lineHeight: 1.3,
                }}
              >
                Fotografe laudos laboratoriais, receitas ou exames impressos
              </div>
            </div>
            <ChevronRight size={22} color="#FFFFFF" />
          </button>

          {/* BOTÃO 2: Upload de Laudo */}
          <button
            type="button"
            onClick={() => docInputRef.current?.click()}
            disabled={isProcessing}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: "16px",
              borderRadius: "14px",
              backgroundColor: "#FFFFFF",
              color: "#181B1F",
              border: "1.5px solid #E2E8F0",
              cursor: isProcessing ? "not-allowed" : "pointer",
              textAlign: "left",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
              transition: "transform 0.15s ease",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "10px",
                backgroundColor: "#EFF6FF",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <UploadCloud size={24} color="#2563EB" />
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: "700",
                  color: "#181B1F",
                  marginBottom: "2px",
                }}
              >
                Upload de Laudo
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#64748B",
                  lineHeight: 1.3,
                }}
              >
                Selecione arquivos PDF ou imagens salvas em seu dispositivo
              </div>
            </div>
            <ChevronRight size={20} color="#2563EB" />
          </button>

          {/* BOTÃO 3: Puxar Dados de Wearables */}
          <button
            type="button"
            onClick={handlePullWearables}
            disabled={wearableLoading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: "16px",
              borderRadius: "14px",
              backgroundColor: "#FFFFFF",
              color: "#181B1F",
              border: wearableSyncSuccess
                ? "1.5px solid #16A34A"
                : "1.5px solid #E2E8F0",
              cursor: wearableLoading ? "not-allowed" : "pointer",
              textAlign: "left",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
              transition: "transform 0.15s ease",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "10px",
                backgroundColor: wearableSyncSuccess ? "#DCFCE7" : "#F5F3FF",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              {wearableLoading ? (
                <RefreshCw
                  size={22}
                  color="#9333EA"
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : wearableSyncSuccess ? (
                <CheckCircle2 size={24} color="#16A34A" />
              ) : (
                <Watch size={24} color="#9333EA" />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  backgroundColor: "#DBEAFE",
                  padding: "2px 8px",
                  borderRadius: "1000px",
                  marginBottom: "4px",
                }}
              >
                <Activity size={10} color="#1D4ED8" />
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: "800",
                    color: "#1D4ED8",
                    letterSpacing: "0.04em",
                  }}
                >
                  APPLE WATCH & SAMSUNG
                </span>
              </div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: "700",
                  color: "#181B1F",
                  marginBottom: "2px",
                }}
              >
                {wearableLoading
                  ? "Conectando ao Apple Watch..."
                  : wearableSyncSuccess
                  ? "Wearables Sincronizados!"
                  : "Puxar Dados dos Wearables"}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#64748B",
                  lineHeight: 1.3,
                }}
              >
                Sincronize frequência cardíaca, variabilidade (HRV) e sono
              </div>
            </div>
            <ChevronRight size={20} color="#2563EB" />
          </button>
        </div>

        {/* Indicador de Processamento em Andamento */}
        {isProcessing && (
          <div
            style={{
              backgroundColor: "#EFF6FF",
              border: "1px solid #BFDBFE",
              borderRadius: "10px",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <RefreshCw
              size={18}
              color="#2563EB"
              style={{ animation: "spin 1s linear infinite" }}
            />
            <span style={{ fontSize: "13px", color: "#1E40AF", fontWeight: "600" }}>
              {currentStep}
            </span>
          </div>
        )}

        {/* ========================================================= */}
        {/* BOTÃO DO TOKEN DE ACESSO (ABRE POPUP)                     */}
        {/* ========================================================= */}
        <button
          type="button"
          onClick={() => {
            if (!sessionActive || !currentToken) {
              void handleGenerateToken();
            }
            setShowTokenPopup(true);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 18px",
            borderRadius: "14px",
            backgroundColor: "#2563EB",
            border: "2px solid #1D4ED8",
            color: "#FFFFFF",
            cursor: "pointer",
            textAlign: "left",
            boxShadow: "0 6px 20px rgba(37, 99, 235, 0.3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <KeyRound size={22} color="#FFFFFF" />
            </div>
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "2px",
                }}
              >
                <span
                  style={{
                    fontSize: "15px",
                    fontWeight: "800",
                    color: "#FFFFFF",
                  }}
                >
                  Token de Acesso Médico
                </span>
                {sessionActive && currentToken && (
                  <span
                    style={{
                      backgroundColor: "#1E3A8A",
                      color: "#FFFFFF",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "800",
                      fontFamily: "monospace",
                      letterSpacing: "0.1em",
                      border: "1px solid rgba(255, 255, 255, 0.3)",
                    }}
                  >
                    {currentToken}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "rgba(255, 255, 255, 0.9)",
                }}
              >
                {sessionActive
                  ? `Código ativo (${timeLeft}) • Clique para visualizar`
                  : "Clique para gerar o código temporário de 6 dígitos"}
              </div>
            </div>
          </div>
          <ChevronRight size={20} color="#FFFFFF" />
        </button>
      </main>

      {/* ========================================================= */}
      {/* POPUP MODAL COM O TOKEN DE ACESSO (6 DÍGITOS)            */}
      {/* ========================================================= */}
      {showTokenPopup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(6px)",
            display: "grid",
            placeItems: "center",
            padding: "16px",
            zIndex: 100,
          }}
          onClick={() => setShowTokenPopup(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              padding: "24px 20px",
              maxWidth: "420px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <KeyRound size={22} color="#2563EB" />
                <h3
                  style={{
                    fontSize: "18px",
                    fontWeight: "700",
                    margin: 0,
                    color: "#181B1F",
                  }}
                >
                  Token de Acesso Médico
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTokenPopup(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  color: "#64748B",
                }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "#49505C", margin: 0, lineHeight: 1.4 }}>
              Informe o código abaixo para o médico digitar no portal Rivio Flow
              no consultório.
            </p>

            {/* Caixa do Código de 6 Dígitos */}
            <div
              style={{
                backgroundColor: "#F8FAFC",
                border: "2px solid #E2E8F0",
                borderRadius: "12px",
                padding: "16px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    backgroundColor: "#EFF6FF",
                    border: "1px solid #BFDBFE",
                    padding: "3px 8px",
                    borderRadius: "6px",
                  }}
                >
                  <ShieldCheck size={14} color="#1E40AF" />
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      color: "#1E40AF",
                    }}
                  >
                    Open Health • 15 min
                  </span>
                </div>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    backgroundColor: sessionActive ? "#E2EBFF" : "#FEE2E2",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    border: sessionActive
                      ? "1px solid #93C5FD"
                      : "1px solid #FECACA",
                  }}
                >
                  <Clock
                    size={12}
                    color={sessionActive ? "#1E40AF" : "#DC2626"}
                  />
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      color: sessionActive ? "#1E40AF" : "#DC2626",
                    }}
                  >
                    {timeLeft}
                  </span>
                </div>
              </div>

              {/* TOKEN EM DESTAQUE */}
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: "36px",
                  fontWeight: "800",
                  letterSpacing: "0.2em",
                  color: sessionActive ? "#1E3A8A" : "#94A3B8",
                  padding: "10px 0",
                  textDecoration: sessionActive ? "none" : "line-through",
                }}
              >
                {currentToken || "------"}
              </div>

              {sessionActive && (
                <button
                  type="button"
                  onClick={handleCopyToken}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    width: "100%",
                    padding: "10px",
                    backgroundColor: "#2563EB",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "600",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  {copiedToken ? (
                    <>
                      <CheckCircle2 size={16} />
                      Código Copiado!
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      Copiar Token
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Toggles Granulares de Consentimento */}
            <div
              style={{
                backgroundColor: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: "700",
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Sliders size={13} />
                Controle de Consentimento LGPD
              </div>

              <label
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                <span>Compartilhar Histórico de Exames</span>
                <input
                  type="checkbox"
                  checked={shareExams}
                  onChange={(e) => setShareExams(e.target.checked)}
                />
              </label>

              <label
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                <span>Compartilhar Dados dos Wearables</span>
                <input
                  type="checkbox"
                  checked={shareWearables}
                  onChange={(e) => setShareWearables(e.target.checked)}
                />
              </label>

              <label
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                <span>Alertas Clínicos e Anomalias</span>
                <input
                  type="checkbox"
                  checked={shareAlerts}
                  onChange={(e) => setShareAlerts(e.target.checked)}
                />
              </label>
            </div>

            {/* Ações Inferiores */}
            <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
              <button
                type="button"
                onClick={handleGenerateToken}
                style={{
                  flex: 1,
                  padding: "10px",
                  backgroundColor: "#EFF6FF",
                  border: "1px solid #BFDBFE",
                  color: "#1E40AF",
                  borderRadius: "8px",
                  fontWeight: "600",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Gerar Novo Código
              </button>
              {sessionActive && (
                <button
                  type="button"
                  onClick={handleRevokeToken}
                  style={{
                    padding: "10px 14px",
                    backgroundColor: "#FEF2F2",
                    border: "1px solid #FECACA",
                    color: "#DC2626",
                    borderRadius: "8px",
                    fontWeight: "600",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Revogar Acesso
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DE RESULTADO DA EXTRAÇÃO DE BIOMARCADORES           */}
      {/* ========================================================= */}
      {showReviewModal && extractedResults && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(6px)",
            display: "grid",
            placeItems: "center",
            padding: "16px",
            zIndex: 100,
          }}
          onClick={() => setShowReviewModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "16px",
              padding: "24px 20px",
              maxWidth: "460px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.25)",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FileCheck size={22} color="#16A34A" />
                <h3
                  style={{
                    fontSize: "18px",
                    fontWeight: "700",
                    margin: 0,
                    color: "#181B1F",
                  }}
                >
                  Laudo Ingerido com Sucesso
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  color: "#64748B",
                }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "#49505C", margin: 0 }}>
              Biomarcadores estruturados e salvos no prontuário do paciente no
              Supabase:
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                maxHeight: "260px",
                overflowY: "auto",
              }}
            >
              {extractedResults.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: "700",
                        color: "#1E293B",
                      }}
                    >
                      {item.canonicalName}
                    </div>
                    {item.notes && (
                      <div style={{ fontSize: "11px", color: "#64748B" }}>
                        {item.notes}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: "800",
                        color:
                          item.status === "attention"
                            ? "#D97706"
                            : item.status === "critical"
                            ? "#DC2626"
                            : "#16A34A",
                      }}
                    >
                      {item.value} {item.unit}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowReviewModal(false)}
              style={{
                padding: "12px",
                backgroundColor: "#2563EB",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "8px",
                fontWeight: "700",
                fontSize: "14px",
                cursor: "pointer",
                marginTop: "6px",
              }}
            >
              Fechar e Continuar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
