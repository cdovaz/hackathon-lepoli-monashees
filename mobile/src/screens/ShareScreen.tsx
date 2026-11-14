import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Switch,
  Platform,
} from 'react-native';
import {
  KeyRound,
  ShieldCheck,
  Clock,
  Copy,
  RefreshCw,
  Lock,
  Eye,
  CheckCircle2,
  X,
  FileBadge,
  Sliders,
  Sparkles,
} from 'lucide-react-native';
import { useHealthStore } from '../store/useHealthStore';
import { theme, rivio } from '../theme/colors';

export const ShareScreen: React.FC = () => {
  const {
    user,
    doctorSession,
    generateDoctorAccessSession,
    revokeDoctorAccessSession,
  } = useHealthStore();
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<string>('01h 59m 40s');

  // Toggles de Escopo Granular (Open Health Protocol)
  const [shareExams, setShareExams] = useState<boolean>(true);
  const [shareWearables, setShareWearables] = useState<boolean>(true);
  const [shareAlerts, setShareAlerts] = useState<boolean>(true);
  const [shareChatNotes, setShareChatNotes] = useState<boolean>(false);

  // Modais
  const [showDoctorPreview, setShowDoctorPreview] = useState<boolean>(false);
  const [showEmergencyCard, setShowEmergencyCard] = useState<boolean>(false);

  const currentToken = doctorSession?.token || '';
  const currentUrl = doctorSession?.accessUrl || (currentToken ? `https://lepoli-health.app/doctor/consultation/${currentToken}` : '');
  const isSessionActive = doctorSession ? doctorSession.active : false;

  useEffect(() => {
    const checkTimer = () => {
      if (!doctorSession) {
        setTimeLeft('Inativo');
        return;
      }
      if (doctorSession.active === false) {
        setTimeLeft('Acesso Revogado');
        return;
      }
      const diffMs = new Date(doctorSession.expiresAt).getTime() - Date.now();
      if (diffMs <= 0) {
        setTimeLeft('Token Expirado');
      } else {
        const minutes = Math.floor(diffMs / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
        setTimeLeft(`${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`);
      }
    };

    checkTimer();
    const timer = setInterval(checkTimer, 1000);
    return () => clearInterval(timer);
  }, [doctorSession]);

  const handleGenerateNewToken = () => {
    const scopes: string[] = ['read_graphrag_briefing'];
    if (shareExams) scopes.push('read_exams');
    if (shareWearables) scopes.push('read_wearables');
    if (shareAlerts) scopes.push('read_alerts');
    if (shareChatNotes) scopes.push('read_chat_notes');
    generateDoctorAccessSession(scopes);
  };

  const handleCopyToken = () => {
    if (!currentToken) return;
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2500);
  };

  const handleCopyLink = () => {
    if (!currentUrl) return;
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <KeyRound color={theme.colors.primary} size={24} />
        </View>
        <Text style={styles.title}>Token de Acesso Médico</Text>
        <Text style={styles.subtitle}>
          Informe o código abaixo para o médico digitar no portal Rivio no consultório e liberar o acesso temporário seguro.
        </Text>
      </View>

      {/* Cartão de Acesso: Estado sem sessão ativa vs Estado com Sessão */}
      {!doctorSession ? (
        <View style={styles.noSessionCard}>
          <View style={styles.noSessionIconWrap}>
            <KeyRound color={theme.colors.primary} size={32} />
          </View>
          <Text style={styles.noSessionTitle}>Nenhum Token Ativo</Text>
          <Text style={styles.noSessionDesc}>
            Para liberar a consulta no consultório médico, gere um código temporário de 6 dígitos válido por 15 minutos.
          </Text>
          <TouchableOpacity style={styles.generateMainButton} onPress={handleGenerateNewToken}>
            <Sparkles color="#FFFFFF" size={18} />
            <Text style={styles.generateMainButtonText}>Gerar Novo Token (15 min)</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Cartão Central do Token Efêmero Ativo */
        <View style={styles.tokenCard}>
          <View style={styles.badgeRow}>
            <View style={styles.openHealthBadge}>
              <ShieldCheck color={theme.colors.primary} size={14} />
              <Text style={styles.openHealthText}>Open Health Protocol v1</Text>
            </View>
            <View
              style={[
                styles.timerBadge,
                !isSessionActive
                  ? { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }
                  : timeLeft === 'Token Expirado'
                  ? { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }
                  : { backgroundColor: '#073E3E', borderColor: '#075E59' },
              ]}
            >
              <Clock
                color={!isSessionActive ? '#DC2626' : timeLeft === 'Token Expirado' ? '#D97706' : rivio.brand[400]}
                size={12}
              />
              <Text
                style={[
                  styles.timerText,
                  !isSessionActive
                    ? { color: '#DC2626' }
                    : timeLeft === 'Token Expirado'
                    ? { color: '#D97706' }
                    : { color: rivio.brand[400] },
                ]}
              >
                {!isSessionActive ? 'Acesso Revogado' : `Expira em: ${timeLeft}`}
              </Text>
            </View>
          </View>

          {/* Caixa Principal de Exibição do Token */}
          <View style={styles.tokenDisplayBox}>
            <Text style={styles.tokenDisplayLabel}>TOKEN DE ACESSO (6 DÍGITOS)</Text>
            <Text
              style={[
                styles.tokenValueText,
                !isSessionActive && { textDecorationLine: 'line-through', opacity: 0.45, color: '#DC2626' },
              ]}
            >
              {currentToken}
            </Text>

            {!isSessionActive ? (
              <Text style={{ fontSize: 12, color: '#DC2626', fontWeight: '700', textAlign: 'center', marginVertical: 6 }}>
                Acesso bloqueado pelo paciente. Este token não permite mais leitura clínica.
              </Text>
            ) : (
              <Text style={styles.tokenInstructions}>
                O médico digita este código de 6 dígitos em{' '}
                <Text style={{ fontWeight: '700', color: rivio.brand[400] }}>
                  rivio.app/doctor
                </Text>{' '}
                para abrir a consulta imediatamente.
              </Text>
            )}

            {/* Botão de Cópia Rápida do Token */}
            {isSessionActive && (
              <TouchableOpacity style={styles.copyTokenButton} onPress={handleCopyToken}>
                {copiedToken ? (
                  <>
                    <CheckCircle2 color="#FFFFFF" size={16} />
                    <Text style={styles.copyTokenButtonText}>Token Copiado!</Text>
                  </>
                ) : (
                  <>
                    <Copy color="#FFFFFF" size={16} />
                    <Text style={styles.copyTokenButtonText}>Copiar Código do Token</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Link Alternativo Completo */}
          {isSessionActive && (
            <TouchableOpacity style={styles.copyLinkRow} onPress={handleCopyLink}>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkHeaderLabel}>LINK DIRETO DE CONSULTA</Text>
                <Text style={styles.urlPreview} numberOfLines={1}>
                  {currentUrl}
                </Text>
              </View>
              <View style={styles.copyBadge}>
                {copiedLink ? (
                  <CheckCircle2 color={theme.colors.badgePositiveText} size={14} />
                ) : (
                  <Copy color={theme.colors.primary} size={14} />
                )}
                <Text style={styles.copyBadgeText}>{copiedLink ? 'Copiado!' : 'Copiar'}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Toggles Granulares de Permissão Estilo Open Finance */}
      <View style={styles.permissionsCard}>
        <View style={styles.permissionsHeader}>
          <Sliders color={theme.colors.primary} size={16} />
          <Text style={styles.permissionsTitle}>Escopo Granular de Consentimento:</Text>
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Histórico de Exames de Sangue</Text>
            <Text style={styles.toggleDesc}>Laudos de 2022 a 2026 com faixas de referência</Text>
          </View>
          <Switch
            value={shareExams}
            onValueChange={setShareExams}
            trackColor={{ false: theme.colors.border, true: theme.colors.primaryHighlight }}
            thumbColor={shareExams ? theme.colors.primary : theme.colors.surfaceSubtle}
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Sinais Vitais de Wearables</Text>
            <Text style={styles.toggleDesc}>BPM, HRV e arquitetura de sono dos últimos 30 dias</Text>
          </View>
          <Switch
            value={shareWearables}
            onValueChange={setShareWearables}
            trackColor={{ false: theme.colors.border, true: theme.colors.primaryHighlight }}
            thumbColor={shareWearables ? theme.colors.primary : theme.colors.surfaceSubtle}
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Alertas de Arritmia & Taquicardia</Text>
            <Text style={styles.toggleDesc}>Episódios detectados pelo Apple Watch</Text>
          </View>
          <Switch
            value={shareAlerts}
            onValueChange={setShareAlerts}
            trackColor={{ false: theme.colors.border, true: theme.colors.primaryHighlight }}
            thumbColor={shareAlerts ? theme.colors.primary : theme.colors.surfaceSubtle}
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleLabel}>Conversas Pessoais com Assistente</Text>
            <Text style={styles.toggleDesc}>Desmarcado por padrão para proteger sua privacidade</Text>
          </View>
          <Switch
            value={shareChatNotes}
            onValueChange={setShareChatNotes}
            trackColor={{ false: theme.colors.border, true: theme.colors.primaryHighlight }}
            thumbColor={shareChatNotes ? theme.colors.primary : theme.colors.surfaceSubtle}
          />
        </View>
      </View>

      {/* Botões de Simulação e Ação */}
      <View style={styles.actionButtonsRow}>
        <TouchableOpacity
          style={styles.simulateDoctorButton}
          onPress={() => setShowDoctorPreview(true)}
        >
          <Eye color="#FFFFFF" size={16} />
          <Text style={styles.simulateDoctorText}>Simular Visão do Médico</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.emergencyCardButton}
          onPress={() => setShowEmergencyCard(true)}
        >
          <FileBadge color={theme.colors.primary} size={16} />
          <Text style={styles.emergencyCardText}>Cartão de Emergência</Text>
        </TouchableOpacity>
      </View>

      {/* Controles de Ciclo de Vida do Token */}
      <View style={styles.sessionControlRow}>
        <TouchableOpacity
          style={styles.regenerateButton}
          onPress={handleGenerateNewToken}
        >
          <RefreshCw color={theme.colors.primary} size={14} />
          <Text style={styles.regenerateButtonText}>Gerar Novo Token (15 min)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.revokeButton}
          onPress={() => revokeDoctorAccessSession()}
        >
          <Lock color={theme.colors.accentDanger} size={14} />
          <Text style={styles.revokeButtonText}>Revogar Acesso Imediatamente</Text>
        </TouchableOpacity>
      </View>

      {/* Trilha de Auditoria & Governança (LGPD / Open Health) */}
      <View style={styles.auditCard}>
        <View style={styles.auditHeader}>
          <ShieldCheck color={theme.colors.primary} size={16} />
          <Text style={styles.auditTitle}>Trilha de Auditoria e Consentimento (LGPD)</Text>
        </View>
        <Text style={styles.auditDesc}>
          Registro imutável de acessos ao seu prontuário clínico autorizado por token efêmero:
        </Text>

        <View style={styles.auditItem}>
          <View style={styles.auditTopRow}>
            <Text style={styles.auditDoctorName}>Dr. Roberto Silva • CRM 123456-SP</Text>
            <View style={[styles.auditStatusBadge, { backgroundColor: doctorSession?.active ? rivio.clinical.ok.bg : rivio.clinical.danger.bg }]}>
              <Text style={[styles.auditStatusText, { color: doctorSession?.active ? rivio.clinical.ok.fg : rivio.clinical.danger.fg }]}>
                {doctorSession?.active ? 'Acesso Ativo' : 'Acesso Revogado'}
              </Text>
            </View>
          </View>
          <Text style={styles.auditSub}>Especialidade: Cardiologia & Clínica Médica</Text>
          <Text style={styles.auditTime}>
            Sessão iniciada hoje • Token: {currentToken} • Protocolo TLS 1.3
          </Text>
        </View>
      </View>

      {/* Modal: Preview da Visão do Médico */}
      <Modal visible={showDoctorPreview} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Eye color={theme.colors.primary} size={20} />
                <Text style={styles.modalTitle}>Preview: Cockpit do Médico</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDoctorPreview(false)}>
                <X color={theme.colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              É exatamente assim que o cardiologista visualizará o prontuário efêmero em sua tela via token:
            </Text>

            <View style={styles.previewBox}>
              <View style={styles.previewTop}>
                <Text style={styles.previewPatient}>Daniel Vaz, 32 anos (Masculino)</Text>
                <View style={styles.readOnlyBadge}>
                  <Text style={styles.readOnlyText}>Token {currentToken} • Somente Leitura</Text>
                </View>
              </View>

              <View style={styles.briefingBox}>
                <Text style={styles.briefingTitle}>Briefing Pré-Consulta por IA (GraphRAG):</Text>
                <Text style={styles.briefingText}>
                  • Ferritina: 22 ng/mL (Abaixo da ref. 30-400 em out/2025).{'\n'}
                  • Glicemia: 104 mg/dL (Curva ascendente nos últimos 3 anos).{'\n'}
                  • Wearable: 3 picos noturnos de taquicardia em repouso (108-114 BPM) com queda de 62% no HRV.{'\n'}
                  • Hipótese sugerida: Sintomas adrenérgicos secundários à queda de ferro de depósito.
                </Text>
              </View>

              <View style={styles.scopeSummary}>
                <Text style={styles.scopeSummaryText}>
                  Permissões ativas: {shareExams ? '✓ Exames' : ''} {shareWearables ? '✓ Wearables' : ''} {shareAlerts ? '✓ Alertas' : ''}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowDoctorPreview(false)}
            >
              <Text style={styles.closeModalButtonText}>Fechar Visualização</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Cartão de Emergência Rápido */}
      <Modal visible={showEmergencyCard} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <FileBadge color={theme.colors.accentDanger} size={20} />
                <Text style={[styles.modalTitle, { color: theme.colors.accentDanger }]}>
                  Cartão de Emergência SOS
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowEmergencyCard(false)}>
                <X color={theme.colors.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            <View style={styles.emergencyCardBody}>
              <View style={styles.emergencyField}>
                <Text style={styles.emergencyLabel}>Paciente:</Text>
                <Text style={styles.emergencyVal}>
                  {user.name} ({user.age} anos){user.cpf ? ` • CPF: ${user.cpf}` : ''}
                </Text>
              </View>
              <View style={styles.emergencyField}>
                <Text style={styles.emergencyLabel}>Condições Clínicas:</Text>
                <Text style={styles.emergencyVal}>Histórico de arritmia e dislipidemia familiar</Text>
              </View>
              <View style={styles.emergencyField}>
                <Text style={styles.emergencyLabel}>Medicações Ativas:</Text>
                <Text style={styles.emergencyVal}>Vitamina D (2000 UI/dia)</Text>
              </View>
              <View style={styles.emergencyField}>
                <Text style={styles.emergencyLabel}>Contato de Emergência:</Text>
                <Text style={styles.emergencyVal}>(11) 98765-4321 (Esposa)</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.closeModalButton, { backgroundColor: theme.colors.accentDanger }]}
              onPress={() => setShowEmergencyCard(false)}
            >
              <Text style={styles.closeModalButtonText}>Salvar na Carteira Digital</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
    paddingTop: 8,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
    maxWidth: 320,
  },
  noSessionCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  noSessionIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
  },
  noSessionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  noSessionDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
    maxWidth: 290,
  },
  generateMainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
    gap: 8,
    width: '100%',
  },
  generateMainButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  tokenCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 14,
  },
  openHealthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primaryHighlight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  openHealthText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#073E3E',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  timerText: {
    fontSize: 10,
    fontWeight: '800',
    color: rivio.brand[400],
  },

  /* Caixa Visual do Token (DESIGN.md: card brand-900 #052E2E, Token branco, expiração brand-400 #5CE0BA) */
  tokenDisplayBox: {
    backgroundColor: rivio.brand[900],
    borderWidth: 1.5,
    borderColor: '#075E59',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
    width: '100%',
  },
  tokenDisplayLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: rivio.brand[400],
    letterSpacing: 1,
    marginBottom: 6,
  },
  tokenValueText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginVertical: 6,
  },
  tokenInstructions: {
    fontSize: 11,
    color: '#D7E3E5',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 16,
    maxWidth: 280,
  },
  copyTokenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 12,
    gap: 8,
    width: '100%',
  },
  copyTokenButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },

  /* Linha do Link Direto */
  copyLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    width: '100%',
    gap: 8,
  },
  linkHeaderLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  urlPreview: {
    fontSize: 11,
    color: theme.colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  copyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.primary,
  },

  permissionsCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
    gap: 12,
  },
  permissionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  permissionsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    textTransform: 'uppercase',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  toggleDesc: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginTop: 1,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  simulateDoctorButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  simulateDoctorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  emergencyCardButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  emergencyCardText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  sessionControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 16,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  regenerateButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  revokeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  revokeButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.accentDanger,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: 20,
    padding: 18,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginBottom: 14,
    lineHeight: 16,
  },
  previewBox: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 14,
  },
  previewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewPatient: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  readOnlyBadge: {
    backgroundColor: theme.colors.badgePositiveBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  readOnlyText: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.badgePositiveText,
  },
  briefingBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  briefingTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.primary,
    marginBottom: 4,
  },
  briefingText: {
    fontSize: 10,
    color: theme.colors.textPrimary,
    lineHeight: 15,
  },
  scopeSummary: {
    alignItems: 'flex-end',
  },
  scopeSummaryText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  closeModalButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  emergencyCardBody: {
    backgroundColor: theme.colors.accentDangerLight,
    borderWidth: 1,
    borderColor: theme.colors.accentDangerBorder,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  emergencyField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  emergencyLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.accentDanger,
  },
  emergencyVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#881337',
  },
  auditCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 16,
    marginBottom: 8,
  },
  auditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  auditTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  auditDesc: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    lineHeight: 15,
  },
  auditItem: {
    backgroundColor: theme.colors.surfaceSubtle,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  auditTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  auditDoctorName: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  auditStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  auditStatusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  auditSub: {
    fontSize: 10,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  auditTime: {
    fontSize: 9,
    color: theme.colors.textMuted,
  },
});
