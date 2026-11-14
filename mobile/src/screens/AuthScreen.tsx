import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import {
  Activity,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  X,
} from 'lucide-react-native';
import { rivio } from '../theme/colors';
import { useHealthStore } from '../store/useHealthStore';
import {
  cleanCpf,
  formatCpf,
  isValidCpf,
  generateValidCpf,
  SYNTHETIC_PATIENTS_CPFS,
} from '../lib/cpf';

interface SyntheticPatientOption {
  id: string;
  name: string;
  cpf: string;
  badge: string;
  badgeType: 'ok' | 'warn' | 'danger' | 'info';
}

const SYNTHETIC_PATIENTS: SyntheticPatientOption[] = [
  {
    id: 'usr-marcos-2026',
    name: 'Marcos Oliveira',
    cpf: SYNTHETIC_PATIENTS_CPFS['usr-marcos-2026']?.formatted || '123.456.789-09',
    badge: 'Diabetes Tipo 2',
    badgeType: 'warn',
  },
  {
    id: 'usr-camila-2026',
    name: 'Camila Santos',
    cpf: SYNTHETIC_PATIENTS_CPFS['usr-camila-2026']?.formatted || '987.654.321-00',
    badge: 'Rotina Preventiva',
    badgeType: 'ok',
  },
  {
    id: 'usr-antonio-2026',
    name: 'Antônio Silva',
    cpf: SYNTHETIC_PATIENTS_CPFS['usr-antonio-2026']?.formatted || '456.789.123-45',
    badge: 'Leishmaniose Visceral',
    badgeType: 'danger',
  },
  {
    id: 'usr-rafael-2026',
    name: 'Rafael Costa',
    cpf: SYNTHETIC_PATIENTS_CPFS['usr-rafael-2026']?.formatted || '321.654.987-12',
    badge: 'Influenza H1N1',
    badgeType: 'info',
  },
];

export const AuthScreen: React.FC = () => {
  const { selectPatient, login, register, isLoading: storeLoading } = useHealthStore();
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [cpf, setCpf] = useState<string>('123.456.789-09');
  const [password, setPassword] = useState<string>('••••••••');
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [manualLoading, setManualLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPickerModal, setShowPickerModal] = useState<boolean>(false);

  const cleanCurrentCpf = cleanCpf(cpf);
  const isCpfComplete = cleanCurrentCpf.length === 11;
  const isCpfValid = isCpfComplete && isValidCpf(cleanCurrentCpf);

  const handleCpfChange = (val: string) => {
    setCpf(formatCpf(val));
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handlePatientSelect = async (patient: SyntheticPatientOption) => {
    setSelectedPatientId(patient.id);
    setCpf(patient.cpf);
    setShowPickerModal(false);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await selectPatient(patient.id);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao conectar com o prontuário.');
    }
  };

  const handleManualSubmit = async () => {
    setManualLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (isRegister) {
        if (!cleanCurrentCpf || cleanCurrentCpf.length !== 11) {
          setErrorMessage('Informe um CPF válido com 11 dígitos.');
          setManualLoading(false);
          return;
        }

        if (!isCpfValid) {
          setErrorMessage('CPF com dígitos verificadores inválidos.');
          setManualLoading(false);
          return;
        }

        if (!name.trim()) {
          setErrorMessage('Por favor, informe seu nome completo.');
          setManualLoading(false);
          return;
        }

        if (!password || password.length < 4) {
          setErrorMessage('A senha deve conter no mínimo 4 dígitos.');
          setManualLoading(false);
          return;
        }

        const res = await register({
          name: name.trim(),
          cpf: cleanCurrentCpf,
          email: email.trim(),
          pass: password,
        });

        if (!res.success) {
          setErrorMessage(res.error || 'Não foi possível cadastrar.');
        } else {
          setSuccessMessage(`Conta cadastrada com sucesso!`);
        }
      } else {
        if (!cleanCurrentCpf || cleanCurrentCpf.length !== 11) {
          setErrorMessage('Informe um CPF completo.');
          setManualLoading(false);
          return;
        }

        if (!password) {
          setErrorMessage('Informe sua senha de acesso.');
          setManualLoading(false);
          return;
        }

        const res = await login(cleanCurrentCpf, password);
        if (!res.success) {
          setErrorMessage(res.error || 'Credenciais inválidas.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha na comunicação com o banco de dados.');
    } finally {
      setManualLoading(false);
    }
  };

  const isBusy = storeLoading || manualLoading;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo e Identidade Enxuta */}
        <View style={styles.brandHeader}>
          <View style={styles.logoCircle}>
            <Activity color={rivio.brand[600]} size={28} />
          </View>
          <Text style={styles.appName}>
            Rivio Flow<Text style={styles.brandDot}>.</Text>
          </Text>
        </View>

        {errorMessage && (
          <View style={styles.errorBanner}>
            <AlertCircle color="#DC2626" size={16} />
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        )}

        {successMessage && (
          <View style={styles.successBanner}>
            <CheckCircle2 color="#059669" size={16} />
            <Text style={styles.successBannerText}>{successMessage}</Text>
          </View>
        )}

        {/* Card Enxuto de Login / Cadastro */}
        <View style={styles.authCard}>
          <View style={styles.tabToggle}>
            <TouchableOpacity
              style={[styles.tabButton, !isRegister && styles.tabButtonActive]}
              onPress={() => {
                setIsRegister(false);
                setErrorMessage(null);
                setSuccessMessage(null);
                if (!cpf) {
                  setCpf('123.456.789-09');
                  setPassword('••••••••');
                }
              }}
            >
              <Text style={[styles.tabButtonText, !isRegister && styles.tabButtonTextActive]}>
                Entrar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, isRegister && styles.tabButtonActive]}
              onPress={() => {
                setIsRegister(true);
                setErrorMessage(null);
                setSuccessMessage(null);
                if (cpf === '123.456.789-09') {
                  setCpf('');
                  setPassword('');
                  setName('');
                  setEmail('');
                }
              }}
            >
              <Text style={[styles.tabButtonText, isRegister && styles.tabButtonTextActive]}>
                Criar Conta
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formArea}>
            {/* Campo: CPF */}
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Text style={styles.inputLabel}>CPF</Text>
                {isCpfComplete && (
                  <View
                    style={[
                      styles.cpfValidationBadge,
                      { backgroundColor: isCpfValid ? '#DCFCE7' : '#FEE2E2' },
                    ]}
                  >
                    {isCpfValid ? (
                      <>
                        <CheckCircle2 color="#059669" size={11} />
                        <Text style={[styles.cpfValidationText, { color: '#059669' }]}>
                          Válido
                        </Text>
                      </>
                    ) : (
                      <>
                        <AlertCircle color="#DC2626" size={11} />
                        <Text style={[styles.cpfValidationText, { color: '#DC2626' }]}>
                          Inválido
                        </Text>
                      </>
                    )}
                  </View>
                )}
              </View>

              <View
                style={[
                  styles.inputWrapper,
                  isCpfComplete &&
                    (isCpfValid ? styles.inputWrapperSuccess : styles.inputWrapperError),
                ]}
              >
                <CreditCard
                  color={
                    isCpfComplete
                      ? isCpfValid
                        ? '#059669'
                        : '#DC2626'
                      : rivio.ink[400]
                  }
                  size={18}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="000.000.000-00"
                  placeholderTextColor={rivio.ink[400]}
                  keyboardType="numeric"
                  maxLength={14}
                  value={cpf}
                  onChangeText={handleCpfChange}
                />
                {isRegister && (
                  <TouchableOpacity
                    style={styles.generateCpfBtn}
                    onPress={() => {
                      const generated = generateValidCpf();
                      setCpf(generated);
                      setErrorMessage(null);
                    }}
                  >
                    <Sparkles color={rivio.brand[700]} size={11} />
                    <Text style={styles.generateCpfBtnText}>Gerar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Nome Completo (Apenas Cadastro) */}
            {isRegister && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nome Completo</Text>
                <View style={styles.inputWrapper}>
                  <User color={rivio.ink[400]} size={18} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Seu nome completo"
                    placeholderTextColor={rivio.ink[400]}
                    value={name}
                    onChangeText={setName}
                  />
                </View>
              </View>
            )}

            {/* E-mail (Apenas Cadastro) */}
            {isRegister && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>E-mail (opcional)</Text>
                <View style={styles.inputWrapper}>
                  <Mail color={rivio.ink[400]} size={18} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="seu@email.com"
                    placeholderTextColor={rivio.ink[400]}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
              </View>
            )}

            {/* Senha */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Senha</Text>
              <View style={styles.inputWrapper}>
                <Lock color={rivio.ink[400]} size={18} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Sua senha"
                  placeholderTextColor={rivio.ink[400]}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? (
                    <EyeOff color={rivio.ink[400]} size={18} />
                  ) : (
                    <Eye color={rivio.ink[400]} size={18} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Botão de Envio */}
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleManualSubmit}
              disabled={isBusy}
            >
              {manualLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.submitButtonText}>
                    {isRegister ? 'Cadastrar' : 'Entrar'}
                  </Text>
                  <ArrowRight color="#FFFFFF" size={16} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Separador */}
        <View style={styles.dividerWrap}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OU</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Apenas um Botão para Pacientes Sintéticos */}
        <TouchableOpacity
          style={styles.syntheticButton}
          onPress={() => setShowPickerModal(true)}
          disabled={isBusy}
          activeOpacity={0.8}
        >
          <Sparkles color={rivio.brand[600]} size={18} />
          <Text style={styles.syntheticButtonText}>Acessar com Paciente Sintético</Text>
          {isBusy && selectedPatientId ? (
            <ActivityIndicator color={rivio.brand[600]} size="small" />
          ) : (
            <ChevronRight color={rivio.brand[600]} size={18} />
          )}
        </TouchableOpacity>

        {/* Modal Enxuto para Seleção de Paciente Sintético */}
        <Modal
          visible={showPickerModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPickerModal(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowPickerModal(false)}>
            <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <Sparkles color={rivio.brand[600]} size={18} />
                  <Text style={styles.modalTitle}>Pacientes Sintéticos</Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setShowPickerModal(false)}
                >
                  <X color={rivio.ink[400]} size={20} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalList}>
                {SYNTHETIC_PATIENTS.map((patient) => {
                  const isSelected = selectedPatientId === patient.id && isBusy;
                  const badgeColors =
                    patient.badgeType === 'ok'
                      ? rivio.clinical.ok
                      : patient.badgeType === 'warn'
                      ? rivio.clinical.warn
                      : patient.badgeType === 'danger'
                      ? rivio.clinical.danger
                      : rivio.clinical.info;

                  return (
                    <TouchableOpacity
                      key={patient.id}
                      style={[styles.modalItem, isSelected && styles.modalItemActive]}
                      onPress={() => handlePatientSelect(patient)}
                      disabled={isBusy}
                      activeOpacity={0.7}
                    >
                      <View style={styles.modalItemLeft}>
                        <Text style={styles.modalItemName}>{patient.name}</Text>
                        <View
                          style={[
                            styles.modalBadge,
                            { backgroundColor: badgeColors.bg, borderColor: badgeColors.border },
                          ]}
                        >
                          <Text style={[styles.modalBadgeText, { color: badgeColors.fg }]}>
                            {patient.badge}
                          </Text>
                        </View>
                      </View>
                      {isSelected ? (
                        <ActivityIndicator color={rivio.brand[600]} size="small" />
                      ) : (
                        <ChevronRight color={rivio.ink[400]} size={18} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: rivio.surface.base,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 48,
    paddingBottom: 40,
    alignItems: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: rivio.brand[50],
    borderWidth: 1.5,
    borderColor: rivio.brand[200],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: rivio.brand[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: rivio.ink[900],
    letterSpacing: -1,
  },
  brandDot: {
    color: rivio.brand[500],
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: rivio.radius.md,
    padding: 12,
    marginBottom: 12,
    width: '100%',
    maxWidth: 400,
    gap: 8,
  },
  errorBannerText: {
    fontSize: 12,
    color: '#991B1B',
    flex: 1,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: rivio.radius.md,
    padding: 12,
    marginBottom: 12,
    width: '100%',
    maxWidth: 400,
    gap: 8,
  },
  successBannerText: {
    fontSize: 12,
    color: '#065F46',
    flex: 1,
    fontWeight: '600',
  },
  authCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: rivio.surface.card,
    borderRadius: rivio.radius.lg,
    borderWidth: 1,
    borderColor: rivio.surface.line,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: rivio.surface.subtle,
    borderRadius: rivio.radius.sm,
    padding: 3,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: rivio.radius.sm - 2,
  },
  tabButtonActive: {
    backgroundColor: rivio.surface.card,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: rivio.ink[400],
  },
  tabButtonTextActive: {
    color: rivio.brand[700],
    fontWeight: '700',
  },
  formArea: {
    gap: 12,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: rivio.ink[900],
  },
  cpfValidationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: rivio.radius.pill,
  },
  cpfValidationText: {
    fontSize: 10,
    fontWeight: '700',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: rivio.surface.line,
    borderRadius: rivio.radius.sm,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: rivio.surface.card,
    gap: 8,
  },
  inputWrapperSuccess: {
    borderColor: '#059669',
  },
  inputWrapperError: {
    borderColor: '#DC2626',
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: rivio.ink[900],
  },
  generateCpfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: rivio.brand[50],
    borderWidth: 1,
    borderColor: rivio.brand[200],
    borderRadius: rivio.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  generateCpfBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: rivio.brand[700],
  },
  submitButton: {
    backgroundColor: rivio.brand[600],
    borderRadius: rivio.radius.sm,
    height: 44,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  dividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    marginVertical: 18,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: rivio.surface.line,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: rivio.ink[400],
    letterSpacing: 0.5,
  },
  syntheticButton: {
    width: '100%',
    maxWidth: 400,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: rivio.brand[50],
    borderWidth: 1.5,
    borderColor: rivio.brand[200],
    borderRadius: rivio.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
    shadowColor: rivio.brand[900],
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  syntheticButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: rivio.brand[700],
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: rivio.surface.card,
    borderRadius: rivio.radius.lg,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: rivio.ink[900],
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalList: {
    gap: 10,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: rivio.surface.base,
    borderWidth: 1,
    borderColor: rivio.surface.line,
    borderRadius: rivio.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  modalItemActive: {
    borderColor: rivio.brand[500],
    backgroundColor: rivio.brand[50],
  },
  modalItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  modalItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: rivio.ink[900],
  },
  modalBadge: {
    borderWidth: 1,
    borderRadius: rivio.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  modalBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});