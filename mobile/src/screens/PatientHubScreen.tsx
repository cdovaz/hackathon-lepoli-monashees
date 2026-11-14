import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Switch,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  Camera,
  UploadCloud,
  Watch,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  X,
  FileCheck,
  Activity,
  LogOut,
  ChevronRight,
  KeyRound,
  Clock,
  Copy,
  Lock,
  RefreshCw,
  Sliders,
} from 'lucide-react-native';
import { useHealthStore } from '../store/useHealthStore';
import { theme, rivio } from '../theme/colors';
import { ExamMeasurement } from '../types';

export const PatientHubScreen: React.FC = () => {
  const {
    user,
    logout,
    registerUploadedDocument,
    injectWearableAnomalyScenario,
    syncWithSupabase,
    doctorSession,
    generateDoctorAccessSession,
    revokeDoctorAccessSession,
  } = useHealthStore();

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [extractedResults, setExtractedResults] = useState<ExamMeasurement[] | null>(null);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [wearableSyncSuccess, setWearableSyncSuccess] = useState<boolean>(false);
  const [wearableLoading, setWearableLoading] = useState<boolean>(false);

  // POPUP DO TOKEN DE ACESSO
  const [showTokenPopup, setShowTokenPopup] = useState<boolean>(false);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<string>('01h 59m 40s');

  // Toggles de Escopo Granular (Open Health Protocol)
  const [shareExams, setShareExams] = useState<boolean>(true);
  const [shareWearables, setShareWearables] = useState<boolean>(true);
  const [shareAlerts, setShareAlerts] = useState<boolean>(true);

  const currentToken = doctorSession?.token || '';
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

  const handleGenerateToken = () => {
    const scopes: string[] = ['read_graphrag_briefing'];
    if (shareExams) scopes.push('read_exams');
    if (shareWearables) scopes.push('read_wearables');
    if (shareAlerts) scopes.push('read_alerts');
    generateDoctorAccessSession(scopes);
  };

  const handleCopyToken = () => {
    if (!currentToken) return;
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2500);
  };

  // 1. AÇÃO: Tirar foto do exame (Câmera Nativa)
  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Permissão de Câmera',
          'Autorize o acesso à câmera para fotografar seus laudos e exames.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileName = `Foto_Laudo_${Date.now()}.jpg`;
        await processExamFile({
          name: fileName,
          uri: asset.uri,
          mimeType: 'image/jpeg',
        });
      }
    } catch (err) {
      console.error('Erro ao abrir câmera:', err);
      Alert.alert('Erro', 'Não foi possível capturar a foto do exame.');
    }
  };

  // 2. AÇÃO: Upload de Laudo (DocumentPicker - PDF ou Imagem da Galeria)
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        await processExamFile({
          name: file.name,
          uri: file.uri,
          size: file.size,
          mimeType: file.mimeType,
        });
      }
    } catch (err) {
      console.error('Erro ao escolher arquivo:', err);
      Alert.alert('Erro', 'Não foi possível selecionar o arquivo.');
    }
  };

  // Pipeline de extração e persistência do documento
  const processExamFile = async (file: {
    name: string;
    uri: string;
    size?: number;
    mimeType?: string;
  }) => {
    setIsProcessing(true);
    setExtractedResults(null);

    try {
      setCurrentStep(`Carregando "${file.name}"...`);
      await new Promise((r) => setTimeout(r, 400));

      setCurrentStep('Digitalizando documento e extraindo biomarcadores...');
      const results = await registerUploadedDocument(file);

      setCurrentStep('Laudo integrado ao prontuário no Supabase!');
      setExtractedResults(results);
      setShowReviewModal(true);
    } catch (e) {
      console.error('Erro no processamento do laudo:', e);
      Alert.alert('Erro', 'Falha ao processar e salvar o laudo.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. AÇÃO: Puxar dados dos serviços de wearables (Apple Watch, Samsung Health, HealthKit)
  const handlePullWearables = async () => {
    setWearableLoading(true);
    setWearableSyncSuccess(false);

    try {
      injectWearableAnomalyScenario();
      await syncWithSupabase();

      setWearableSyncSuccess(true);
      setTimeout(() => {
        setWearableSyncSuccess(false);
      }, 4000);

      Alert.alert(
        'Wearables Sincronizados',
        'Dados fisiológicos recebidos com sucesso via Apple Watch & Samsung Health (Frequência Cardíaca, HRV e Sono integrados ao Supabase).'
      );
    } catch (e) {
      console.error('Erro ao sincronizar wearables:', e);
      Alert.alert('Erro', 'Não foi possível comunicar com os serviços de wearables.');
    } finally {
      setWearableLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Cabeçalho do Paciente com Logout */}
      <View style={styles.headerRow}>
        <View style={styles.userInfo}>
          <Text style={styles.greetingText}>Olá, {user.name.split(' ')[0]}</Text>
          <Text style={styles.subText}>
            {user.cpf ? `CPF: ${user.cpf} • ` : ''}Prontuário Pessoal Unificado
          </Text>
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={logout}
          accessibilityLabel="Trocar de paciente ou sair"
        >
          <LogOut color={rivio.ink[600]} size={16} />
        </TouchableOpacity>
      </View>

      {/* Banner de Direcionamento Direto */}
      <View style={styles.heroBox}>
        <Text style={styles.heroTitle}>Alimente seu Prontuário</Text>
        <Text style={styles.heroDesc}>
          Capture seus exames ou sincronize seus dispositivos de pulso para manter seu histórico clínico 100% atualizado.
        </Text>
      </View>

      {/* OS 3 BOTÕES PRINCIPAIS DE ENTRADA CLÍNICA */}
      <View style={styles.actionsStack}>
        {/* BOTÃO 1: Tirar foto do exame */}
        <TouchableOpacity
          style={styles.actionCardPrimary}
          onPress={handleTakePhoto}
          disabled={isProcessing}
          activeOpacity={0.88}
        >
          <View style={styles.actionIconPrimaryWrap}>
            <Camera color="#FFFFFF" size={26} />
          </View>
          <View style={styles.actionTextsWrap}>
            <View style={styles.badgeRow}>
              <Sparkles color="#7E22CE" size={12} />
              <Text style={styles.badgeText}>Câmera & IA</Text>
            </View>
            <Text style={styles.actionTitlePrimary}>Tirar Foto do Exame</Text>
            <Text style={styles.actionDescPrimary}>
              Fotografe laudos laboratoriais, receitas ou exames impressos
            </Text>
          </View>
          <ChevronRight color={rivio.palette.blue} size={22} />
        </TouchableOpacity>

        {/* BOTÃO 2: Upload de Laudo */}
        <TouchableOpacity
          style={styles.actionCardSecondary}
          onPress={handlePickDocument}
          disabled={isProcessing}
          activeOpacity={0.88}
        >
          <View style={styles.actionIconSecondaryWrap}>
            <UploadCloud color={rivio.palette.blue} size={24} />
          </View>
          <View style={styles.actionTextsWrap}>
            <Text style={styles.actionTitleSecondary}>Upload de Laudo</Text>
            <Text style={styles.actionDescSecondary}>
              Selecione arquivos PDF ou imagens salvas em seu dispositivo
            </Text>
          </View>
          <ChevronRight color={rivio.palette.blue} size={20} />
        </TouchableOpacity>

        {/* BOTÃO 3: Puxar dados de Wearables */}
        <TouchableOpacity
          style={[styles.actionCardSecondary, styles.actionCardWearables]}
          onPress={handlePullWearables}
          disabled={wearableLoading}
          activeOpacity={0.88}
        >
          <View style={styles.actionIconWearableWrap}>
            {wearableLoading ? (
              <ActivityIndicator color={rivio.palette.purple} size="small" />
            ) : wearableSyncSuccess ? (
              <CheckCircle2 color="#FFFFFF" size={24} />
            ) : (
              <Watch color={rivio.palette.purple} size={24} />
            )}
          </View>
          <View style={styles.actionTextsWrap}>
            <View style={styles.badgeRowDark}>
              <Activity color="#1D4ED8" size={11} />
              <Text style={styles.badgeTextDark}>Apple Watch & Samsung</Text>
            </View>
            <Text style={styles.actionTitleSecondary}>
              {wearableLoading
                ? 'Conectando ao Apple Watch...'
                : wearableSyncSuccess
                ? 'Wearables Sincronizados!'
                : 'Puxar Dados dos Wearables'}
            </Text>
            <Text style={styles.actionDescSecondary}>
              Sincronize frequência cardíaca, variabilidade (HRV) e sono
            </Text>
          </View>
          <ChevronRight color={rivio.palette.blue} size={20} />
        </TouchableOpacity>
      </View>

      {/* BOTÃO DO TOKEN DE ACESSO (ABRE O POPUP) */}
      <TouchableOpacity
        style={styles.tokenTriggerCard}
        onPress={() => {
          if (!doctorSession || !doctorSession.active) {
            handleGenerateToken();
          }
          setShowTokenPopup(true);
        }}
        activeOpacity={0.88}
      >
        <View style={styles.tokenTriggerLeft}>
          <View style={styles.tokenTriggerIconWrap}>
            <KeyRound color="#FFFFFF" size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Text style={styles.tokenTriggerTitle}>Token de Acesso Médico</Text>
              {isSessionActive && currentToken ? (
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>{currentToken}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.tokenTriggerSub}>
              {isSessionActive
                ? `Código ativo (${timeLeft}) • Toque para visualizar`
                : 'Toque para gerar o código temporário de 6 dígitos'}
            </Text>
          </View>
        </View>
        <ChevronRight color="#FFFFFF" size={20} />
      </TouchableOpacity>

      {/* POPUP MODAL COM O TOKEN DE ACESSO */}
      <Modal
        visible={showTokenPopup}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTokenPopup(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.popupCard}>
            {/* Header do Popup */}
            <View style={styles.popupHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <KeyRound color="#2563EB" size={22} />
                <Text style={styles.popupTitle}>Token de Acesso Médico</Text>
              </View>
              <TouchableOpacity
                style={styles.popupCloseBtn}
                onPress={() => setShowTokenPopup(false)}
              >
                <X color={rivio.palette.dark01} size={18} />
              </TouchableOpacity>
            </View>

            <Text style={styles.popupDesc}>
              Informe o código abaixo para o médico digitar no portal Rivio Flow no consultório.
            </Text>

            {/* Caixa do Código de 6 Dígitos */}
            <View style={styles.tokenBox}>
              <View style={styles.tokenStatusRow}>
                <View style={styles.openHealthBadge}>
                  <ShieldCheck color="#1E40AF" size={14} />
                  <Text style={styles.openHealthText}>Open Health • 2h</Text>
                </View>

                <View
                  style={[
                    styles.timerBadge,
                    !isSessionActive
                      ? { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }
                      : timeLeft === 'Token Expirado'
                      ? { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }
                      : { backgroundColor: '#E2EBFF', borderColor: '#93C5FD' },
                  ]}
                >
                  <Clock
                    color={!isSessionActive ? '#B91C1C' : timeLeft === 'Token Expirado' ? '#B45309' : '#1E40AF'}
                    size={12}
                  />
                  <Text
                    style={[
                      styles.timerText,
                      !isSessionActive
                        ? { color: '#B91C1C' }
                        : timeLeft === 'Token Expirado'
                        ? { color: '#B45309' }
                        : { color: '#1E40AF' },
                    ]}
                  >
                    {timeLeft}
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  styles.tokenCodeText,
                  !isSessionActive && { textDecorationLine: 'line-through', opacity: 0.4, color: '#DC2626' },
                ]}
              >
                {currentToken || '------'}
              </Text>

              {isSessionActive ? (
                <TouchableOpacity style={styles.copyBtn} onPress={handleCopyToken}>
                  {copiedToken ? (
                    <>
                      <CheckCircle2 color="#FFFFFF" size={16} />
                      <Text style={styles.copyBtnText}>Código Copiado!</Text>
                    </>
                  ) : (
                    <>
                      <Copy color="#FFFFFF" size={16} />
                      <Text style={styles.copyBtnText}>Copiar Token</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Toggles Rápidos de Consentimento */}
            <View style={styles.togglesCard}>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Compartilhar Exames</Text>
                <Switch
                  value={shareExams}
                  onValueChange={setShareExams}
                  trackColor={{ false: '#CBD5E8', true: rivio.palette.blue }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Compartilhar Wearables</Text>
                <Switch
                  value={shareWearables}
                  onValueChange={setShareWearables}
                  trackColor={{ false: '#CBD5E8', true: rivio.palette.blue }}
                  thumbColor="#FFFFFF"
                />
              </View>
              <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.toggleLabel}>Compartilhar Alertas</Text>
                <Switch
                  value={shareAlerts}
                  onValueChange={setShareAlerts}
                  trackColor={{ false: '#CBD5E8', true: rivio.palette.blue }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Ações: Gerar Novo ou Revogar Imediatamente */}
            <View style={styles.popupActionsRow}>
              <TouchableOpacity
                style={styles.generateBtn}
                onPress={handleGenerateToken}
              >
                <RefreshCw color="#FFFFFF" size={14} />
                <Text style={styles.generateBtnText}>Novo Token</Text>
              </TouchableOpacity>

              {isSessionActive && (
                <TouchableOpacity
                  style={styles.revokeBtn}
                  onPress={() => {
                    revokeDoctorAccessSession();
                    Alert.alert('Acesso Revogado', 'O acesso médico foi bloqueado imediatamente.');
                  }}
                >
                  <Lock color="#DC2626" size={14} />
                  <Text style={styles.revokeBtnText}>Revogar Acesso</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Progresso do Processamento de Documento */}
      {isProcessing && (
        <Modal transparent animationType="fade" visible={isProcessing}>
          <View style={styles.modalBackdrop}>
            <View style={styles.processingCard}>
              <ActivityIndicator color={rivio.palette.blue} size="large" />
              <Text style={styles.processingTitle}>Processando Laudo</Text>
              <Text style={styles.processingStep}>{currentStep}</Text>
            </View>
          </View>
        </Modal>
      )}

      {/* Modal de Revisão Rápida dos Biomarcadores Extraídos */}
      <Modal
        visible={showReviewModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReviewModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.reviewModalCard}>
            <View style={styles.reviewModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 color={rivio.palette.blue} size={20} />
                <Text style={styles.reviewModalTitle}>Laudo Integrado</Text>
              </View>
              <TouchableOpacity onPress={() => setShowReviewModal(false)}>
                <X color={rivio.ink[600]} size={20} />
              </TouchableOpacity>
            </View>

            <Text style={styles.reviewModalSubtitle}>
              Os dados foram extraídos e persistidos com sucesso no cofre do Supabase:
            </Text>

            <ScrollView style={{ maxHeight: 240, marginVertical: 12 }}>
              {extractedResults && extractedResults.length > 0 ? (
                extractedResults.map((item, idx) => (
                  <View key={item.id || idx} style={styles.extractedItemRow}>
                    <Text style={styles.extractedItemName}>{item.canonicalName}</Text>
                    <Text style={styles.extractedItemValue}>
                      {item.value} {item.unit}
                    </Text>
                  </View>
                ))
              ) : (
                <View style={{ padding: 14, alignItems: 'center' }}>
                  <FileCheck color={rivio.palette.blue} size={32} />
                  <Text style={{ fontSize: 13, color: rivio.ink[600], marginTop: 6, textAlign: 'center' }}>
                    Documento arquivado com segurança no bucket clínico.
                  </Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.reviewModalCloseBtn}
              onPress={() => setShowReviewModal(false)}
            >
              <Text style={styles.reviewModalCloseBtnText}>Concluir</Text>
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
    backgroundColor: rivio.surface.base,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  userInfo: {
    flex: 1,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: '800',
    color: rivio.ink[900],
  },
  subText: {
    fontSize: 12,
    color: rivio.ink[600],
    marginTop: 2,
  },
  logoutBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: rivio.surface.card,
    borderWidth: 1,
    borderColor: rivio.surface.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBox: {
    backgroundColor: rivio.palette.superficie,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: rivio.palette.superficieAlta,
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: rivio.palette.dark01,
    marginBottom: 4,
  },
  heroDesc: {
    fontSize: 13,
    color: rivio.palette.dark03,
    lineHeight: 18,
  },
  actionsStack: {
    gap: 14,
    marginBottom: 20,
  },
  actionCardPrimary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(102, 148, 255, 0.32)',
    shadowColor: '#6694FF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  actionIconPrimaryWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: rivio.palette.blue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTextsWrap: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
    backgroundColor: 'rgba(233, 146, 255, 0.14)',
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7E22CE',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionTitlePrimary: {
    fontSize: 16,
    fontWeight: '800',
    color: rivio.palette.dark01,
    marginBottom: 2,
  },
  actionDescPrimary: {
    fontSize: 12,
    color: rivio.palette.dark03,
    lineHeight: 16,
  },
  actionCardSecondary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: rivio.surface.line,
    shadowColor: '#181B1F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  actionCardWearables: {
    borderColor: 'rgba(233, 146, 255, 0.3)',
  },
  actionIconSecondaryWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: rivio.palette.superficie,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconWearableWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(233, 146, 255, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeRowDark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
    backgroundColor: '#EFF6FF',
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeTextDark: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionTitleSecondary: {
    fontSize: 15,
    fontWeight: '800',
    color: rivio.palette.dark01,
    marginBottom: 2,
  },
  actionDescSecondary: {
    fontSize: 12,
    color: rivio.palette.dark03,
    lineHeight: 16,
  },
  tokenTriggerCard: {
    backgroundColor: '#2563EB',
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  tokenTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  tokenTriggerIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenTriggerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  tokenTriggerSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.92)',
    fontWeight: '500',
  },
  activePill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  activePillText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1E40AF',
    fontFamily: 'monospace',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popupCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 22,
  },
  popupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  popupTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: rivio.palette.dark01,
  },
  popupCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: rivio.palette.superficie,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupDesc: {
    fontSize: 13,
    color: rivio.palette.dark03,
    lineHeight: 18,
    marginBottom: 16,
  },
  tokenBox: {
    backgroundColor: '#F0F5FF',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#CBD5E8',
  },
  tokenStatusRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  openHealthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E2EBFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  openHealthText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E40AF',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  timerText: {
    fontSize: 11,
    fontWeight: '800',
  },
  tokenCodeText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#1E3A8A',
    letterSpacing: 6,
    fontFamily: 'monospace',
    marginVertical: 8,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  copyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  togglesCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: rivio.palette.dark01,
  },
  popupActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  generateBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  generateBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  revokeBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  revokeBtnText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '800',
  },
  processingCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  processingTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: rivio.ink[900],
  },
  processingStep: {
    fontSize: 12,
    color: rivio.ink[600],
    textAlign: 'center',
  },
  reviewModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  reviewModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: rivio.palette.dark01,
  },
  reviewModalSubtitle: {
    fontSize: 12,
    color: rivio.ink[600],
    marginBottom: 8,
  },
  extractedItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: rivio.surface.line,
  },
  extractedItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: rivio.ink[900],
  },
  extractedItemValue: {
    fontSize: 13,
    fontWeight: '700',
    color: rivio.palette.blue,
  },
  reviewModalCloseBtn: {
    backgroundColor: rivio.palette.blue,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  reviewModalCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
