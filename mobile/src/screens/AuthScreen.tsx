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
} from 'react-native';
import {
  Activity,
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Heart,
  Droplets,
  Thermometer,
  ShieldAlert,
  CreditCard,
  UserCheck,
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

interface PatientCardConfig {
  id: string;
  name: string;
  cpf: string;
  age: number;
  sex: string;
  city: string;
  badge: string;
  badgeType: 'ok' | 'warn' | 'danger' | 'info';
  icon: any;
  summary: string;
  keyMetric: string;
}

const PATIENTS_CONFIG: PatientCardConfig[] = [
  {
    id: 'usr-marcos-2026',
    name: 'Marcos Oliveira',
    cpf: SYNTHETIC_PATIENTS_CPFS['usr-marcos-2026'].formatted,
    age: 58,
    sex: 'Masculino',
    city: 'São Paulo, SP',
    badge: 'Diabetes Tipo 2',
    badgeType: 'warn',
    icon: Droplets,
    summary: 'Em tratamento com Metformina e Dapagliflozina. Queda consistente de HbA1c de 8,9% para 6,7%.',
    keyMetric: 'HbA1c: 8,9% → 6,7% • 365d Wearables',
  },
  {
    id: 'usr-camila-2026',
    name: 'Camila Santos',
    cpf: SYNTHETIC_PATIENTS_CPFS['usr-camila-2026'].formatted,
    age: 29,
    sex: 'Feminino',
    city: 'Curitiba, PR',
    badge: 'Rotina Preventiva',
    badgeType: 'ok',
    icon: Heart,
    summary: 'Jovem saudável, check-ups periódicos normais, sem alertas clínicos. Suplementação de Vitamina D.',
    keyMetric: 'Todos os exames na meta • 0 alertas',
  },
  {
    id: 'usr-antonio-2026',
    name: 'Antônio Silva',
    cpf: SYNTHETIC_PATIENTS_CPFS['usr-antonio-2026'].formatted,
    age: 47,
    sex: 'Masculino',
    city: 'Sobral, CE',
    badge: 'Leishmaniose Visceral',
    badgeType: 'danger',
    icon: ShieldAlert,
    summary: 'Pancitopenia e ferritina até 2.100 ng/mL na internação hospitalar. Plena recuperação clínica pós-tratamento.',
    keyMetric: 'Leucócitos 2.100 → 6.400 • Ferritina 2.100 ng/mL',
  },
  {
    id: 'usr-rafael-2026',
    name: 'Rafael Costa',
    cpf: SYNTHETIC_PATIENTS_CPFS['usr-rafael-2026'].formatted,
    age: 35,
    sex: 'Masculino',
    city: 'Florianópolis, SC',
    badge: 'Influenza H1N1 Aguda',
    badgeType: 'info',
    icon: Thermometer,
    summary: 'Queda transitória de SpO₂ (93%) e taquicardia em repouso (118 bpm) em out/2026. Terapia com Oseltamivir.',
    keyMetric: 'SpO₂ 93% • Taquicardia 118 bpm em 21-26/out',
  },
];

export const AuthScreen: React.FC = () => {
  const { selectPatient, login, register, isLoading: storeLoading } = useHealthStore();
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [showManualLogin, setShowManualLogin] = useState<boolean>(true);
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [cpf, setCpf] = useState<string>('123.456.789-09');
  const [password, setPassword] = useState<string>('••••••••');
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [manualLoading, setManualLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const cleanCurrentCpf = cleanCpf(cpf);
  const isCpfComplete = cleanCurrentCpf.length === 11;
  const isCpfValid = isCpfComplete && isValidCpf(cleanCurrentCpf);

  const handleCpfChange = (val: string) => {
    setCpf(formatCpf(val));
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handlePatientSelect = async (patient: PatientCardConfig) => {
    setSelectedPatientId(patient.id);
    setCpf(patient.cpf);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await selectPatient(patient.id);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao conectar com o prontuário no Supabase.');
    }
  };

  const handleManualSubmit = async () => {
    setManualLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (isRegister) {
        if (!cleanCurrentCpf) {
          setErrorMessage('É obrigatório informar o CPF para criar sua conta no prontuário.');
          setManualLoading(false);
          return;
        }

        if (cleanCurrentCpf.length !== 11) {
          setErrorMessage('O CPF é obrigatório e precisa ter exatamente 11 dígitos numéricos.');
          setManualLoading(false);
          return;
        }

        if (!isCpfValid) {
          setErrorMessage('CPF com dígitos verificadores inválidos. É obrigatório um CPF válido para criar a conta.');
          setManualLoading(false);
          return;
        }

        if (!name.trim()) {
          setErrorMessage('Por favor, informe seu nome completo para o prontuário.');
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
          setErrorMessage(res.error || 'Não foi possível cadastrar o paciente.');
        } else {
          setSuccessMessage(`Prontuário criado e indexado com sucesso com o CPF ${formatCpf(cleanCurrentCpf)}!`);
        }
      } else {
        if (!cleanCurrentCpf || cleanCurrentCpf.length !== 11) {
          setErrorMessage('Por favor, informe um CPF completo com 11 dígitos.');
          setManualLoading(false);
          return;
        }

        if (!password) {
          setErrorMessage('Por favor, informe sua senha de acesso.');
          setManualLoading(false);
          return;
        }

        const res = await login(cleanCurrentCpf, password);
        if (!res.success) {
          setErrorMessage(res.error || 'Credenciais inválidas. Verifique seu CPF e senha.');
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
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Branding e Logo Rivio — Pulso Calmo */}
        <View style={styles.brandHeader}>
          <View style={styles.logoCircle}>
            <Activity color={rivio.brand[600]} size={32} />
          </View>
          <Text style={styles.appName}>
            rivio<Text style={styles.brandDot}>.</Text>
          </Text>
          <Text style={styles.appTagline}>
            Do exame em papel de dez anos atrás aos sinais do seu relógio em tempo real.
          </Text>
          <View style={styles.tagBadge}>
            <Sparkles color={rivio.brand[600]} size={12} />
            <Text style={styles.tagBadgeText}>Prontuário Longitudinal • Indexador Único CPF</Text>
          </View>
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

        {/* Card Principal de Autenticação com CPF e Senha */}
        {showManualLogin && (
          <View style={styles.authCard}>
            <View style={styles.authCardHeader}>
              <View style={styles.authCardTitleRow}>
                <CreditCard color={rivio.brand[600]} size={18} />
                <Text style={styles.authCardTitle}>
                  {isRegister ? 'Cadastro de Conta do Paciente' : 'Acesso ao Prontuário'}
                </Text>
              </View>
              <Text style={styles.authCardSubtitle}>
                {isRegister
                  ? 'Preencha o CPF da pessoa como indexador obrigatório do prontuário digital.'
                  : 'Entre com o seu CPF indexador e senha de acesso.'}
              </Text>
            </View>

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
                  Entrar com CPF
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
                  Cadastro de Conta (CPF)
                </Text>
              </TouchableOpacity>
            </View>

            {isRegister && (
              <View style={styles.cpfRequiredNotice}>
                <ShieldCheck color={rivio.brand[700]} size={18} />
                <Text style={styles.cpfRequiredNoticeText}>
                  <Text style={styles.boldText}>CPF Obrigatório no Cadastro:</Text> O CPF é o indexador médico único que vincula todos os seus exames laboratoriais e dados de saúde de forma inviolável.
                </Text>
              </View>
            )}

            <View style={styles.formArea}>
              {/* CAMPO 1: CPF DO PACIENTE (INDEXADOR OBRIGATÓRIO) */}
              <View style={[styles.inputGroup, isRegister && styles.cpfHighlightBox]}>
                <View style={styles.inputLabelRow}>
                  <Text style={[styles.inputLabel, isRegister && styles.cpfHighlightLabel]}>
                    {isRegister ? '1. CPF da Pessoa (Obrigatório para Cadastro) *' : 'CPF do Paciente (Indexador)'}
                  </Text>
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
                            CPF Válido
                          </Text>
                        </>
                      ) : (
                        <>
                          <AlertCircle color="#DC2626" size={11} />
                          <Text style={[styles.cpfValidationText, { color: '#DC2626' }]}>
                            CPF Inválido
                          </Text>
                        </>
                      )}
                    </View>
                  )}
                </View>

                <View
                  style={[
                    styles.inputWrapper,
                    isRegister && styles.cpfInputWrapperLarge,
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
                        : isRegister
                        ? rivio.brand[600]
                        : rivio.ink[400]
                    }
                    size={20}
                  />
                  <TextInput
                    style={[styles.textInput, isRegister && styles.cpfTextInputLarge]}
                    placeholder="000.000.000-00 (Obrigatório)"
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
                      <Text style={styles.generateCpfBtnText}>Gerar Válido</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text
                  style={[
                    styles.inputHint,
                    isRegister && !isCpfComplete && styles.inputHintWarn,
                    isCpfComplete && isCpfValid && styles.inputHintSuccess,
                    isCpfComplete && !isCpfValid && styles.inputHintError,
                  ]}
                >
                  {isRegister
                    ? isCpfComplete
                      ? isCpfValid
                        ? '✓ CPF validado com sucesso! Este será o indexador do seu prontuário.'
                        : '✕ Dígitos verificadores inválidos. Digite um CPF matematicamente válido.'
                      : '⚠ O CPF é obrigatório para abrir o prontuário. Digite os 11 dígitos numéricos.'
                    : 'Digite o CPF cadastrado ou selecione um perfil demo abaixo.'}
                </Text>
              </View>

              {/* CAMPO 2: NOME COMPLETO (APENAS CADASTRO) */}
              {isRegister && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>2. Nome Completo do Paciente *</Text>
                  <View style={styles.inputWrapper}>
                    <User color={rivio.ink[400]} size={18} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Ex: João da Silva"
                      placeholderTextColor={rivio.ink[400]}
                      value={name}
                      onChangeText={setName}
                    />
                  </View>
                </View>
              )}

              {/* CAMPO 3: E-MAIL (APENAS CADASTRO) */}
              {isRegister && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>3. E-mail (Opcional)</Text>
                  <View style={styles.inputWrapper}>
                    <Mail color={rivio.ink[400]} size={18} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="seu.email@exemplo.com"
                      placeholderTextColor={rivio.ink[400]}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                    />
                  </View>
                </View>
              )}

              {/* CAMPO 4: SENHA DE ACESSO */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {isRegister ? '4. Senha de Acesso *' : 'Senha de Acesso'}
                </Text>
                <View style={styles.inputWrapper}>
                  <Lock color={rivio.ink[400]} size={18} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Sua senha secreta (mínimo 4 caracteres)"
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
                      {isRegister ? 'Cadastrar Prontuário com CPF' : 'Acessar com CPF e Senha'}
                    </Text>
                    <ArrowRight color="#FFFFFF" size={16} />
                  </>
                )}
              </TouchableOpacity>

              {/* Botão de Alternância Direta entre Login e Cadastro */}
              <TouchableOpacity
                style={styles.switchAuthModeBtn}
                onPress={() => {
                  const nextRegisterState = !isRegister;
                  setIsRegister(nextRegisterState);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  if (nextRegisterState) {
                    setCpf('');
                    setPassword('');
                    setName('');
                    setEmail('');
                  } else {
                    setCpf('123.456.789-09');
                    setPassword('••••••••');
                  }
                }}
              >
                <Text style={styles.switchAuthModeText}>
                  {!isRegister ? (
                    <>Ainda não possui conta? <Text style={styles.switchAuthModeHighlight}>Cadastre-se com seu CPF aqui</Text></>
                  ) : (
                    <>Já possui cadastro? <Text style={styles.switchAuthModeHighlight}>Entrar com seu CPF</Text></>
                  )}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Separador e Seção de Seleção Rápida de Pacientes */}
        <View style={styles.dividerWrap}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OU SELECIONE UM PERFIL DEMO PRÉ-CONFIGURADO</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pacientes Sintéticos com CPF Indexado</Text>
          <Text style={styles.sectionSubtitle}>
            Toque em um card para carregar o CPF indexador e os dados clínicos do paciente no Supabase.
          </Text>
        </View>

        <View style={styles.cardsGrid}>
          {PATIENTS_CONFIG.map((patient) => {
            const IconComponent = patient.icon;
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
                style={[styles.patientCard, isSelected && styles.patientCardActive]}
                onPress={() => handlePatientSelect(patient)}
                disabled={isBusy}
                activeOpacity={0.8}
              >
                <View style={styles.patientCardHeader}>
                  <View style={styles.patientAvatarWrap}>
                    <IconComponent color={rivio.brand[600]} size={20} />
                  </View>
                  <View style={styles.patientMeta}>
                    <Text style={styles.patientName}>{patient.name}</Text>
                    <View style={styles.cpfRow}>
                      <CreditCard color={rivio.brand[600]} size={11} />
                      <Text style={styles.cpfText}>CPF: {patient.cpf}</Text>
                    </View>
                    <Text style={styles.patientDemographics}>
                      {patient.age} anos • {patient.sex} • {patient.city}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.patientBadge,
                      { backgroundColor: badgeColors.bg, borderColor: badgeColors.border },
                    ]}
                  >
                    <Text style={[styles.patientBadgeText, { color: badgeColors.fg }]}>
                      {patient.badge}
                    </Text>
                  </View>
                </View>

                <Text style={styles.patientSummary}>{patient.summary}</Text>

                <View style={styles.patientCardFooter}>
                  <View style={styles.keyMetricWrap}>
                    <Activity color={rivio.ink[400]} size={12} />
                    <Text style={styles.keyMetricText}>{patient.keyMetric}</Text>
                  </View>
                  {isSelected ? (
                    <ActivityIndicator color={rivio.brand[600]} size="small" />
                  ) : (
                    <View style={styles.enterButtonMini}>
                      <Text style={styles.enterButtonText}>Usar Perfil</Text>
                      <ChevronRight color={rivio.brand[700]} size={14} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Rodapé LGPD / Privacidade */}
        <View style={styles.privacyFooter}>
          <ShieldCheck color={rivio.brand[600]} size={15} />
          <Text style={styles.privacyText}>
            CPF criptografado como indexador seguro no banco de dados. Conformidade estrita com LGPD e interoperabilidade médica.
          </Text>
        </View>
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
    padding: 16,
    paddingTop: 36,
    paddingBottom: 40,
    alignItems: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
    fontSize: 32,
    fontWeight: '800',
    color: rivio.ink[900],
    letterSpacing: -1,
  },
  brandDot: {
    color: rivio.brand[500],
  },
  appTagline: {
    fontSize: 12,
    color: rivio.ink[600],
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 320,
    lineHeight: 17,
  },
  tagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: rivio.brand[50],
    borderWidth: 1,
    borderColor: rivio.brand[200],
    borderRadius: rivio.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 8,
    gap: 6,
  },
  tagBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: rivio.brand[700],
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
    maxWidth: 440,
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
    maxWidth: 440,
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
    maxWidth: 440,
    backgroundColor: rivio.surface.card,
    borderRadius: rivio.radius.lg,
    borderWidth: 1,
    borderColor: rivio.surface.line,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  authCardHeader: {
    marginBottom: 12,
  },
  authCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  authCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: rivio.ink[900],
  },
  authCardSubtitle: {
    fontSize: 11,
    color: rivio.ink[600],
    lineHeight: 15,
  },
  cpfRequiredNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: rivio.brand[50],
    borderWidth: 1,
    borderColor: rivio.brand[200],
    borderRadius: rivio.radius.sm,
    padding: 10,
    marginBottom: 12,
    gap: 8,
  },
  cpfRequiredNoticeText: {
    fontSize: 11,
    color: rivio.brand[800],
    lineHeight: 16,
    flex: 1,
  },
  boldText: {
    fontWeight: '700',
  },
  labelActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  generateCpfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: rivio.brand[50],
    borderWidth: 1,
    borderColor: rivio.brand[200],
    borderRadius: rivio.radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  generateCpfBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: rivio.brand[700],
  },
  tabToggle: {
    flexDirection: 'row',
    backgroundColor: rivio.surface.subtle,
    borderRadius: rivio.radius.sm,
    padding: 3,
    marginBottom: 14,
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
    fontSize: 12,
    fontWeight: '500',
    color: rivio.ink[400],
  },
  tabButtonTextActive: {
    color: rivio.brand[700],
    fontWeight: '700',
  },
  formArea: {
    gap: 10,
  },
  inputGroup: {
    gap: 4,
  },
  cpfHighlightBox: {
    backgroundColor: rivio.brand[50],
    borderWidth: 1.5,
    borderColor: rivio.brand[200],
    borderRadius: rivio.radius.md,
    padding: 10,
    gap: 6,
  },
  cpfHighlightLabel: {
    color: rivio.brand[900],
    fontWeight: '700',
    fontSize: 13,
  },
  cpfInputWrapperLarge: {
    height: 48,
    backgroundColor: '#FFFFFF',
    borderColor: rivio.brand[200],
  },
  cpfTextInputLarge: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
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
  inputHint: {
    fontSize: 10,
    color: rivio.ink[400],
    marginTop: 2,
  },
  inputHintWarn: {
    color: '#D97706',
    fontWeight: '600',
  },
  inputHintSuccess: {
    color: '#059669',
    fontWeight: '600',
  },
  inputHintError: {
    color: '#DC2626',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: rivio.brand[600],
    borderRadius: rivio.radius.sm,
    height: 44,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  switchAuthModeBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  switchAuthModeText: {
    fontSize: 12,
    color: rivio.ink[600],
    textAlign: 'center',
  },
  switchAuthModeHighlight: {
    color: rivio.brand[700],
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  dividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 440,
    marginVertical: 14,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: rivio.surface.line,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '700',
    color: rivio.ink[400],
    letterSpacing: 0.5,
  },
  sectionHeader: {
    width: '100%',
    maxWidth: 440,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: rivio.ink[900],
  },
  sectionSubtitle: {
    fontSize: 11,
    color: rivio.ink[600],
    marginTop: 2,
  },
  cardsGrid: {
    width: '100%',
    maxWidth: 440,
    gap: 10,
  },
  patientCard: {
    backgroundColor: rivio.surface.card,
    borderRadius: rivio.radius.md,
    borderWidth: 1,
    borderColor: rivio.surface.line,
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  patientCardActive: {
    borderColor: rivio.brand[500],
    backgroundColor: rivio.brand[50],
  },
  patientCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  patientAvatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: rivio.brand[50],
    borderWidth: 1,
    borderColor: rivio.brand[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientMeta: {
    flex: 1,
  },
  patientName: {
    fontSize: 14,
    fontWeight: '700',
    color: rivio.ink[900],
  },
  cpfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  cpfText: {
    fontSize: 11,
    fontWeight: '700',
    color: rivio.brand[700],
  },
  patientDemographics: {
    fontSize: 11,
    color: rivio.ink[600],
    marginTop: 1,
  },
  patientBadge: {
    borderWidth: 1,
    borderRadius: rivio.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  patientBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  patientSummary: {
    fontSize: 11,
    color: rivio.ink[600],
    lineHeight: 16,
    marginBottom: 8,
  },
  patientCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: rivio.surface.subtle,
    paddingTop: 8,
  },
  keyMetricWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  keyMetricText: {
    fontSize: 10,
    fontWeight: '600',
    color: rivio.ink[900],
  },
  enterButtonMini: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: rivio.brand[50],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: rivio.radius.pill,
  },
  enterButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: rivio.brand[700],
  },
  privacyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    maxWidth: 400,
    paddingHorizontal: 8,
  },
  privacyText: {
    fontSize: 10,
    color: rivio.ink[400],
    lineHeight: 14,
    flex: 1,
  },
});
