import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  Camera,
  KeyRound,
  LogOut,
  ChevronRight,
  FileText,
  Clock,
  Sparkles,
  ArrowRight,
  Activity,
  Heart,
  Moon,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react-native';
import { useHealthStore } from '../store/useHealthStore';
import { theme, rivio } from '../theme/colors';
import { ReadinessRing } from '../components/ReadinessRing';

interface HomeScreenProps {
  onNavigateToTab: (tabName: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigateToTab }) => {
  const { user, exams, wearables, activeAlerts, logout } = useHealthStore();

  // Último registro diário de wearable
  const lastWearable = wearables.length > 0 ? wearables[wearables.length - 1] : null;
  const readinessScore = lastWearable?.readinessScore ?? 82;
  const isAnomaly = Boolean(lastWearable?.hasAnomaly || (activeAlerts.length > 0 && !activeAlerts[0]?.resolved));

  // Alerta mais recente (não resolvido preferencialmente)
  const latestAlert = activeAlerts.find((a) => !a.resolved) || activeAlerts[0] || null;

  // Histórico ordenado dos exames mais recentes
  const recentExams = [...exams]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* 1. Saudação do Usuário */}
      <View style={styles.userHeader}>
        <View style={styles.userInfo}>
          <Text style={styles.greetingText}>Olá, {user.name.split(' ')[0]} 👋</Text>
          <Text style={styles.userSubText}>
            {user.cpf ? `CPF: ${user.cpf} • ` : ''}Prontuário Unificado • {user.age} anos • {user.city || 'Paciente Rivio'}
          </Text>
          {user.scenario && (
            <View style={styles.scenarioPill}>
              <Text style={styles.scenarioPillText} numberOfLines={1}>
                {user.scenario}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={logout}
          accessibilityLabel="Trocar de paciente ou sair"
        >
          <LogOut color={rivio.ink[600]} size={16} />
        </TouchableOpacity>
      </View>

      {/* 2. Anel de Prontidão & Sinais Vitais Contínuos do Dia */}
      <TouchableOpacity
        style={styles.readinessCard}
        onPress={() => onNavigateToTab('Wearables')}
        activeOpacity={0.9}
      >
        <View style={styles.readinessLeft}>
          <ReadinessRing
            score={readinessScore}
            isAnomaly={isAnomaly}
            size={96}
            strokeWidth={8}
          />
        </View>

        <View style={styles.readinessRight}>
          <View style={styles.readinessHeaderRow}>
            <Text style={styles.readinessLabel}>ÍNDICE DE PRONTIDÃO</Text>
            <View
              style={[
                styles.readinessStatusBadge,
                {
                  backgroundColor: isAnomaly ? rivio.clinical.danger.bg : rivio.clinical.ok.bg,
                  borderColor: isAnomaly ? rivio.clinical.danger.border : rivio.clinical.ok.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.readinessStatusText,
                  { color: isAnomaly ? rivio.clinical.danger.fg : rivio.clinical.ok.fg },
                ]}
              >
                {isAnomaly ? 'Atenção Clínica' : 'Equilíbrio Ideal'}
              </Text>
            </View>
          </View>

          <Text style={styles.readinessTitle}>
            {isAnomaly
              ? 'Sinal de estresse fisiológico detectado'
              : 'Recuperação e sinais vitais estáveis'}
          </Text>

          {/* Mini métricas do wearable */}
          <View style={styles.readinessMetricsGrid}>
            <View style={styles.readinessMetricItem}>
              <Heart color={rivio.series.hr} size={14} />
              <Text style={styles.readinessMetricVal}>
                {lastWearable?.restingHeartRate ?? 68} <Text style={styles.readinessMetricUnit}>bpm</Text>
              </Text>
            </View>

            <View style={styles.readinessMetricItem}>
              <Activity color={rivio.series.hrv} size={14} />
              <Text style={styles.readinessMetricVal}>
                {lastWearable?.hrv ?? 45} <Text style={styles.readinessMetricUnit}>ms HRV</Text>
              </Text>
            </View>

            <View style={styles.readinessMetricItem}>
              <Moon color={rivio.series.sleep} size={14} />
              <Text style={styles.readinessMetricVal}>
                {lastWearable?.sleepHours ?? 7.2} <Text style={styles.readinessMetricUnit}>h sono</Text>
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* 3. Card de Alerta Mais Recente (se houver) */}
      {latestAlert ? (
        <View
          style={[
            styles.alertCard,
            {
              backgroundColor: latestAlert.resolved ? rivio.surface.card : rivio.clinical.danger.bg,
              borderColor: latestAlert.resolved ? rivio.surface.line : rivio.clinical.danger.border,
            },
          ]}
        >
          <View style={styles.alertHeaderRow}>
            <View style={styles.alertIconTitleWrap}>
              {latestAlert.resolved ? (
                <CheckCircle2 color={rivio.clinical.ok.fg} size={18} />
              ) : (
                <AlertTriangle color={rivio.clinical.danger.fg} size={18} />
              )}
              <Text
                style={[
                  styles.alertTitle,
                  { color: latestAlert.resolved ? rivio.ink[900] : rivio.clinical.danger.fg },
                ]}
              >
                {latestAlert.resolved ? 'Alerta Anterior Concluído' : 'Alerta Clínico Recente'}
              </Text>
            </View>
            <Text style={styles.alertTimestamp}>{latestAlert.timestamp}</Text>
          </View>

          <Text style={styles.alertMessage}>{latestAlert.message}</Text>
          {latestAlert.context ? (
            <Text style={styles.alertContext}>{latestAlert.context}</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.normalAlertCard}>
          <CheckCircle2 color={rivio.clinical.ok.fg} size={16} />
          <Text style={styles.normalAlertText}>
            Sem alertas clínicos pendentes. Todos os biomarcadores monitorados na faixa segura.
          </Text>
        </View>
      )}

      {/* 4. Ação Principal: Anexar foto do exame */}
      <TouchableOpacity
        style={styles.primaryActionCard}
        onPress={() => onNavigateToTab('Exames')}
        activeOpacity={0.88}
      >
        <View style={styles.primaryActionLeft}>
          <View style={styles.primaryIconCircle}>
            <Camera color="#FFFFFF" size={24} />
          </View>
          <View style={styles.primaryActionTexts}>
            <View style={styles.primaryBadgeRow}>
              <Sparkles color="#FFFFFF" size={11} />
              <Text style={styles.primaryBadgeText}>Leitura Instantânea por IA</Text>
            </View>
            <Text style={styles.primaryActionTitle}>Anexar laudo ou exame</Text>
            <Text style={styles.primaryActionSub}>
              Digitalize laudos em papel ou importe PDFs laboratoriais
            </Text>
          </View>
        </View>
        <ChevronRight color="#FFFFFF" size={22} />
      </TouchableOpacity>

      {/* 5. Acesso Médico via Token */}
      <TouchableOpacity
        style={styles.secondaryActionCard}
        onPress={() => onNavigateToTab('Compartilhar')}
        activeOpacity={0.88}
      >
        <View style={styles.secondaryActionLeft}>
          <View style={styles.secondaryIconCircle}>
            <KeyRound color={rivio.brand[600]} size={22} />
          </View>
          <View style={styles.secondaryActionTexts}>
            <Text style={styles.secondaryActionTitle}>Compartilhar com Médico (Token)</Text>
            <Text style={styles.secondaryActionSub}>
              Gere uma sessão temporária de 15 minutos para seu médico no consultório
            </Text>
          </View>
        </View>
        <ChevronRight color={rivio.brand[600]} size={20} />
      </TouchableOpacity>

      {/* 6. Histórico dos Últimos Laudos Registrados */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleWrap}>
          <FileText color={rivio.brand[600]} size={16} />
          <Text style={styles.sectionTitle}>Últimos exames registrados</Text>
        </View>
        <TouchableOpacity onPress={() => onNavigateToTab('Timeline')}>
          <Text style={styles.sectionLink}>Ver todos ({exams.length})</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.examsCard}>
        {recentExams.length === 0 ? (
          <View style={styles.emptyState}>
            <Clock color={rivio.ink[400]} size={28} />
            <Text style={styles.emptyStateTitle}>Nenhum exame carregado</Text>
            <Text style={styles.emptyStateSub}>
              Carregue laudos laboratoriais para visualizar a linha do tempo.
            </Text>
          </View>
        ) : (
          recentExams.map((exam, index) => {
            const isOutOfRange = exam.status !== 'normal';
            return (
              <View
                key={exam.id}
                style={[
                  styles.examRow,
                  index < recentExams.length - 1 && styles.examRowBorder,
                ]}
              >
                <View style={styles.examMainInfo}>
                  <Text style={styles.examName}>{exam.canonicalName}</Text>
                  <Text style={styles.examMeta}>
                    {exam.labName} • {exam.date}
                  </Text>
                </View>

                <View style={styles.examValueColumn}>
                  <Text
                    style={[
                      styles.examValue,
                      isOutOfRange && styles.examValueAlert,
                    ]}
                  >
                    {exam.value} <Text style={styles.examUnit}>{exam.unit}</Text>
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      isOutOfRange ? styles.statusBadgeAlert : styles.statusBadgeOk,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isOutOfRange ? styles.statusBadgeTextAlert : styles.statusBadgeTextOk,
                      ]}
                    >
                      {isOutOfRange ? 'Alterado' : 'Normal'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}

        <TouchableOpacity
          style={styles.timelineFooterButton}
          onPress={() => onNavigateToTab('Timeline')}
        >
          <Text style={styles.timelineFooterText}>
            Acessar Linha do Tempo e Gráficos de Evolução
          </Text>
          <ArrowRight color={rivio.brand[600]} size={15} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: rivio.surface.base,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingTop: 4,
  },
  userInfo: {
    flex: 1,
    paddingRight: 8,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: '800',
    color: rivio.ink[900],
    letterSpacing: -0.4,
  },
  userSubText: {
    fontSize: 12,
    color: rivio.ink[600],
    marginTop: 2,
  },
  scenarioPill: {
    alignSelf: 'flex-start',
    backgroundColor: rivio.brand[50],
    borderWidth: 1,
    borderColor: rivio.brand[200],
    borderRadius: rivio.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 6,
  },
  scenarioPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: rivio.brand[700],
  },
  logoutButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: rivio.surface.card,
    borderWidth: 1,
    borderColor: rivio.surface.line,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Card de Prontidão */
  readinessCard: {
    flexDirection: 'row',
    backgroundColor: rivio.surface.card,
    borderRadius: rivio.radius.md,
    borderWidth: 1,
    borderColor: rivio.surface.line,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  readinessLeft: {
    marginRight: 14,
  },
  readinessRight: {
    flex: 1,
  },
  readinessHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  readinessLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: rivio.ink[400],
  },
  readinessStatusBadge: {
    borderWidth: 1,
    borderRadius: rivio.radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  readinessStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  readinessTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: rivio.ink[900],
    marginBottom: 8,
  },
  readinessMetricsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  readinessMetricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readinessMetricVal: {
    fontSize: 12,
    fontWeight: '700',
    color: rivio.ink[900],
  },
  readinessMetricUnit: {
    fontSize: 10,
    fontWeight: '500',
    color: rivio.ink[600],
  },

  /* Card de Alerta */
  alertCard: {
    borderRadius: rivio.radius.md,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  alertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  alertIconTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  alertTimestamp: {
    fontSize: 11,
    color: rivio.ink[400],
  },
  alertMessage: {
    fontSize: 12,
    fontWeight: '600',
    color: rivio.ink[900],
    lineHeight: 16,
  },
  alertContext: {
    fontSize: 11,
    color: rivio.ink[600],
    marginTop: 2,
    lineHeight: 15,
  },
  normalAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: rivio.clinical.ok.bg,
    borderWidth: 1,
    borderColor: rivio.clinical.ok.border,
    borderRadius: rivio.radius.md,
    padding: 10,
    marginBottom: 12,
  },
  normalAlertText: {
    fontSize: 12,
    color: rivio.clinical.ok.fg,
    fontWeight: '500',
    flex: 1,
  },

  /* Botão 1: Anexar foto do exame */
  primaryActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: rivio.brand[600],
    borderRadius: rivio.radius.md,
    padding: 16,
    marginBottom: 10,
    shadowColor: rivio.brand[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
    paddingRight: 8,
  },
  primaryIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryActionTexts: {
    flex: 1,
  },
  primaryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#CCFBF1',
    textTransform: 'uppercase',
  },
  primaryActionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  primaryActionSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },

  /* Botão 2: Compartilhar com Médico */
  secondaryActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: rivio.surface.card,
    borderRadius: rivio.radius.md,
    borderWidth: 1,
    borderColor: rivio.surface.line,
    padding: 14,
    marginBottom: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  secondaryActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
    paddingRight: 8,
  },
  secondaryIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: rivio.brand[50],
    borderWidth: 1,
    borderColor: rivio.brand[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryActionTexts: {
    flex: 1,
  },
  secondaryActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: rivio.ink[900],
  },
  secondaryActionSub: {
    fontSize: 11,
    color: rivio.ink[600],
    marginTop: 2,
  },

  /* Histórico de Exames */
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: rivio.ink[900],
  },
  sectionLink: {
    fontSize: 12,
    fontWeight: '600',
    color: rivio.brand[600],
  },
  examsCard: {
    backgroundColor: rivio.surface.card,
    borderRadius: rivio.radius.md,
    borderWidth: 1,
    borderColor: rivio.surface.line,
    padding: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: rivio.ink[900],
  },
  emptyStateSub: {
    fontSize: 12,
    color: rivio.ink[400],
    textAlign: 'center',
  },
  examRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  examRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: rivio.surface.subtle,
  },
  examMainInfo: {
    flex: 1,
    paddingRight: 8,
  },
  examName: {
    fontSize: 13,
    fontWeight: '600',
    color: rivio.ink[900],
  },
  examMeta: {
    fontSize: 11,
    color: rivio.ink[600],
    marginTop: 2,
  },
  examValueColumn: {
    alignItems: 'flex-end',
    gap: 3,
  },
  examValue: {
    fontSize: 13,
    fontWeight: '700',
    color: rivio.ink[900],
  },
  examValueAlert: {
    color: rivio.clinical.danger.fg,
  },
  examUnit: {
    fontSize: 11,
    fontWeight: '500',
    color: rivio.ink[600],
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: rivio.radius.pill,
    borderWidth: 1,
  },
  statusBadgeOk: {
    backgroundColor: rivio.clinical.ok.bg,
    borderColor: rivio.clinical.ok.border,
  },
  statusBadgeAlert: {
    backgroundColor: rivio.clinical.danger.bg,
    borderColor: rivio.clinical.danger.border,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  statusBadgeTextOk: {
    color: rivio.clinical.ok.fg,
  },
  statusBadgeTextAlert: {
    color: rivio.clinical.danger.fg,
  },
  timelineFooterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: rivio.surface.subtle,
    paddingTop: 12,
    marginTop: 6,
  },
  timelineFooterText: {
    fontSize: 12,
    fontWeight: '700',
    color: rivio.brand[600],
  },
});
