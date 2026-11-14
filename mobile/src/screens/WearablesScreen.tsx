import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {
  Watch,
  Heart,
  Activity,
  Moon,
  AlertTriangle,
  RotateCcw,
  Zap,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Wind,
  Footprints,
  Clock,
  Flame,
} from 'lucide-react-native';
import { useHealthStore } from '../store/useHealthStore';
import { theme, rivio } from '../theme/colors';
import { Sparkline } from '../components/Sparkline';
import { TachogramChart } from '../components/TachogramChart';
import Svg, { Polyline, Circle, Line, Text as SvgText, Rect } from 'react-native-svg';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface WearablesScreenProps {
  onNavigateToTab: (tabName: string) => void;
}

export const WearablesScreen: React.FC<WearablesScreenProps> = ({ onNavigateToTab }) => {
  const {
    user,
    wearables,
    heartRateSamples,
    activeAlerts,
    isSimulatedAnomalyActive,
    injectWearableAnomalyScenario,
    resetWearableScenario,
  } = useHealthStore();

  const [selectedHrWindow, setSelectedHrWindow] = useState<'24h' | '48h' | '7d'>('24h');

  const latest = wearables[wearables.length - 1] || {
    restingHeartRate: 68,
    hrv: 48,
    sleepHours: 7.2,
    deepSleepHours: 1.6,
    remSleepHours: 1.8,
    steps: 6400,
    spo2: 98,
    date: 'Hoje',
  };

  // Gráfico da série diária de BPM
  const chartW = SCREEN_WIDTH - 64;
  const chartH = 120;
  const padL = 30;
  const padR = 20;
  const padT = 20;
  const padB = 25;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const displayWearables = wearables.slice(-30);
  const bpmValues = displayWearables.map((w) => w.restingHeartRate);
  const minBpm = Math.min(...bpmValues, 45);
  const maxBpm = Math.max(...bpmValues, 125);
  const bpmRange = maxBpm - minBpm || 1;

  const pointsStr = displayWearables
    .map((w, idx) => {
      const x = padL + (idx / Math.max(displayWearables.length - 1, 1)) * innerW;
      const y = padT + innerH - ((w.restingHeartRate - minBpm) / bpmRange) * innerH;
      return `${x},${y}`;
    })
    .join(' ');

  // Amostras de FC Horária (filtra conforme a janela selecionada)
  const windowCount = selectedHrWindow === '24h' ? 24 : selectedHrWindow === '48h' ? 48 : 168;
  const recentHourlySamples = heartRateSamples.slice(-windowCount);

  // Mini gráfico para FC Horária
  const hourlyBpmValues = recentHourlySamples.map((s) => s.bpm);
  const minHourlyBpm = hourlyBpmValues.length > 0 ? Math.min(...hourlyBpmValues, 50) : 50;
  const maxHourlyBpm = hourlyBpmValues.length > 0 ? Math.max(...hourlyBpmValues, 120) : 120;
  const hourlyRange = maxHourlyBpm - minHourlyBpm || 1;

  const hourlyPointsStr = recentHourlySamples
    .map((s, idx) => {
      const x = padL + (idx / Math.max(recentHourlySamples.length - 1, 1)) * innerW;
      const y = padT + innerH - ((s.bpm - minHourlyBpm) / hourlyRange) * innerH;
      return `${x},${y}`;
    })
    .join(' ');

  // Dados para sparklines individuais dos cards
  const sparkBpm = wearables.slice(-14).map((w) => w.restingHeartRate);
  const sparkHrv = wearables.slice(-14).map((w) => w.hrv);
  const sparkSleep = wearables.slice(-14).map((w) => w.sleepHours);
  const sparkSteps = wearables.slice(-14).map((w) => w.steps);

  // Decomposição dos estágios de sono
  const totalSleep = latest.sleepHours || 7.2;
  const deepSleep = latest.deepSleepHours || (isSimulatedAnomalyActive ? 0.3 : 1.6);
  const remSleep = latest.remSleepHours || (isSimulatedAnomalyActive ? 0.8 : 1.7);
  const lightSleep = Math.max(0.5, Number((totalSleep - deepSleep - remSleep).toFixed(1)));
  const deepPct = Math.round((deepSleep / totalSleep) * 100);
  const remPct = Math.round((remSleep / totalSleep) * 100);
  const lightPct = Math.max(5, 100 - deepPct - remPct);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Cabeçalho */}
      <View style={styles.header}>
        <Text style={styles.title}>Sinais Contínuos & Wearables</Text>
        <Text style={styles.subtitle}>
          Streaming contínuo via Apple Watch • Prontuário de {user.name} ({wearables.length} dias registrados)
        </Text>
      </View>

      {/* Status do Dispositivo Pareado */}
      <View style={styles.deviceStatusCard}>
        <View style={styles.deviceIconBox}>
          <Watch color={rivio.brand[600]} size={22} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.deviceName}>Apple Watch Ultra 2</Text>
          <Text style={styles.deviceSub}>HealthKit Telemetria • Bluetooth BLE • Ao vivo</Text>
        </View>
        <View style={styles.deviceConnectedBadge}>
          <View style={styles.connectedDot} />
          <Text style={styles.connectedText}>Sincronizado</Text>
        </View>
      </View>

      {/* Alerta Clínico Detectado (se houver) */}
      {activeAlerts.length > 0 && (
        <View style={styles.alertCard}>
          <View style={styles.alertHeader}>
            <AlertTriangle color={rivio.clinical.danger.fg} size={18} />
            <Text style={styles.alertTitle}>Alerta Clínico Detectado</Text>
          </View>
          <Text style={styles.alertMainText}>{activeAlerts[0].message}</Text>
          {activeAlerts[0].context ? (
            <Text style={styles.alertSubText}>{activeAlerts[0].context}</Text>
          ) : null}

          {/* Gráfico de Tacograma Noturno */}
          <Text style={styles.tacogramHeader}>Registro do Tacograma Noturno (00:00 - 06:30):</Text>
          <TachogramChart width={SCREEN_WIDTH - 64} height={100} />

          <View style={styles.alertButtons}>
            <TouchableOpacity
              style={styles.actionChatButton}
              onPress={() => onNavigateToTab('Assistente')}
            >
              <Text style={styles.actionChatButtonText}>Investigar no Assistente IA</Text>
              <ArrowRight color="#FFFFFF" size={14} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionShareButton}
              onPress={() => onNavigateToTab('Compartilhar')}
            >
              <Text style={styles.actionShareButtonText}>Compartilhar com Médico</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 1. SEÇÃO: Frequência Cardíaca Horária (Apple Watch Samples) */}
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <Clock color={rivio.series.hr} size={18} />
            <Text style={styles.chartTitle}>FC Horária Contínua</Text>
          </View>
          <View style={styles.windowToggleRow}>
            {(['24h', '48h', '7d'] as const).map((w) => (
              <TouchableOpacity
                key={w}
                style={[styles.windowChip, selectedHrWindow === w && styles.windowChipActive]}
                onPress={() => setSelectedHrWindow(w)}
              >
                <Text
                  style={[
                    styles.windowChipText,
                    selectedHrWindow === w && styles.windowChipTextActive,
                  ]}
                >
                  {w}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {recentHourlySamples.length > 0 ? (
          <>
            <Svg width={chartW} height={chartH}>
              {/* Faixa limite de taquicardia (>100 bpm) */}
              <Line
                x1={padL}
                y1={padT + innerH - ((100 - minHourlyBpm) / hourlyRange) * innerH}
                x2={padL + innerW}
                y2={padT + innerH - ((100 - minHourlyBpm) / hourlyRange) * innerH}
                stroke={rivio.clinical.danger.border}
                strokeDasharray="4,4"
                strokeWidth={1}
              />
              <SvgText
                x={padL - 4}
                y={padT + innerH - ((100 - minHourlyBpm) / hourlyRange) * innerH + 3}
                fill={rivio.clinical.danger.fg}
                fontSize={9}
                fontWeight="700"
                textAnchor="end"
              >
                100
              </SvgText>

              {/* Curva de Amostras Horárias */}
              <Polyline
                points={hourlyPointsStr}
                fill="none"
                stroke={rivio.series.hr}
                strokeWidth={2}
              />

              {/* Última amostra */}
              <Circle
                cx={padL + innerW}
                cy={
                  padT +
                  innerH -
                  ((recentHourlySamples[recentHourlySamples.length - 1].bpm - minHourlyBpm) /
                    hourlyRange) *
                    innerH
                }
                r={4}
                fill={rivio.series.hr}
                stroke="#FFFFFF"
                strokeWidth={1.5}
              />
            </Svg>

            <View style={styles.chartFooter}>
              <Text style={styles.chartFooterText}>
                {recentHourlySamples[0].ts.split('T')[1]?.slice(0, 5) || 'Início'}
              </Text>
              <Text style={styles.chartFooterText}>
                {recentHourlySamples.length} amostras • Última:{' '}
                {recentHourlySamples[recentHourlySamples.length - 1].bpm} bpm
              </Text>
              <Text style={styles.chartFooterText}>Agora</Text>
            </View>
          </>
        ) : (
          <View style={styles.emptySamplesBox}>
            <Text style={styles.emptySamplesText}>
              Amostras horárias sincronizadas a partir dos registros de telemetria do Supabase.
            </Text>
          </View>
        )}
      </View>

      {/* 2. SEÇÃO: Série Temporal de FC de Repouso Diária (30 dias) */}
      <View style={styles.chartContainer}>
        <View style={styles.chartHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Heart color={rivio.series.hr} size={18} />
            <Text style={styles.chartTitle}>FC de Repouso Diária ({displayWearables.length}d)</Text>
          </View>
          <Text style={styles.chartCurrentBpm}>{latest.restingHeartRate} BPM</Text>
        </View>

        <Svg width={chartW} height={chartH}>
          {/* Limiar de Alerta 100 BPM */}
          <Line
            x1={padL}
            y1={padT + innerH - ((100 - minBpm) / bpmRange) * innerH}
            x2={padL + innerW}
            y2={padT + innerH - ((100 - minBpm) / bpmRange) * innerH}
            stroke="#FECDD3"
            strokeDasharray="4,4"
            strokeWidth={1}
          />
          <SvgText
            x={padL - 4}
            y={padT + innerH - ((100 - minBpm) / bpmRange) * innerH + 3}
            fill={rivio.clinical.danger.fg}
            fontSize={9}
            fontWeight="700"
            textAnchor="end"
          >
            100
          </SvgText>

          {/* Curva da Série Temporal Diária */}
          <Polyline
            points={pointsStr}
            fill="none"
            stroke={rivio.series.hr}
            strokeWidth={2.5}
          />

          <Circle
            cx={padL + innerW}
            cy={padT + innerH - ((latest.restingHeartRate - minBpm) / bpmRange) * innerH}
            r={5}
            fill={rivio.series.hr}
            stroke="#FFFFFF"
            strokeWidth={2}
          />
        </Svg>

        <View style={styles.chartFooter}>
          <Text style={styles.chartFooterText}>30 dias atrás</Text>
          <Text style={styles.chartFooterText}>Hoje ({latest.restingHeartRate} bpm)</Text>
        </View>
      </View>

      {/* 3. Grid de Métricas Vitais com Sparklines */}
      <View style={styles.metricsGrid}>
        {/* Card FC */}
        <View style={styles.metricCard}>
          <View style={styles.metricCardHeader}>
            <Heart color={rivio.series.hr} size={16} />
            <Text style={styles.metricCardTitle}>FC Repouso</Text>
          </View>
          <Text style={styles.metricValue}>
            {latest.restingHeartRate} <Text style={styles.metricUnit}>bpm</Text>
          </Text>
          <Sparkline data={sparkBpm} color={rivio.series.hr} width={90} height={24} />
        </View>

        {/* Card HRV */}
        <View style={styles.metricCard}>
          <View style={styles.metricCardHeader}>
            <Activity color={rivio.series.hrv} size={16} />
            <Text style={styles.metricCardTitle}>HRV (VFC)</Text>
          </View>
          <Text style={styles.metricValue}>
            {latest.hrv} <Text style={styles.metricUnit}>ms</Text>
          </Text>
          <Sparkline data={sparkHrv} color={rivio.series.hrv} width={90} height={24} />
        </View>

        {/* Card Sono */}
        <View style={styles.metricCard}>
          <View style={styles.metricCardHeader}>
            <Moon color={rivio.series.sleep} size={16} />
            <Text style={styles.metricCardTitle}>Sono Total</Text>
          </View>
          <Text style={styles.metricValue}>
            {latest.sleepHours} <Text style={styles.metricUnit}>h</Text>
          </Text>
          <Sparkline data={sparkSleep} color={rivio.series.sleep} width={90} height={24} />
        </View>

        {/* Card Passos / Atividade */}
        <View style={styles.metricCard}>
          <View style={styles.metricCardHeader}>
            <Footprints color={rivio.series.activity} size={16} />
            <Text style={styles.metricCardTitle}>Passos</Text>
          </View>
          <Text style={styles.metricValue}>
            {latest.steps?.toLocaleString('pt-BR') || '6.400'}{' '}
            <Text style={styles.metricUnit}>passos</Text>
          </Text>
          <Sparkline data={sparkSteps} color={rivio.series.activity} width={90} height={24} />
        </View>
      </View>

      {/* 4. Decomposição dos Estágios de Sono */}
      <View style={styles.sleepStageCard}>
        <View style={styles.sleepHeader}>
          <Moon color={rivio.series.sleep} size={18} />
          <Text style={styles.sleepTitle}>Arquitetura do Sono (Última Noite)</Text>
        </View>

        <View style={styles.sleepBarWrap}>
          <View style={[styles.sleepSegment, { width: `${deepPct}%`, backgroundColor: '#312E81' }]} />
          <View style={[styles.sleepSegment, { width: `${remPct}%`, backgroundColor: '#4338CA' }]} />
          <View style={[styles.sleepSegment, { width: `${lightPct}%`, backgroundColor: '#818CF8' }]} />
        </View>

        <View style={styles.sleepLegendRow}>
          <View style={styles.sleepLegendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#312E81' }]} />
            <Text style={styles.legendText}>Profundo: {deepSleep}h ({deepPct}%)</Text>
          </View>
          <View style={styles.sleepLegendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#4338CA' }]} />
            <Text style={styles.legendText}>REM: {remSleep}h ({remPct}%)</Text>
          </View>
          <View style={styles.sleepLegendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#818CF8' }]} />
            <Text style={styles.legendText}>Leve: {lightSleep}h ({lightPct}%)</Text>
          </View>
        </View>
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
    paddingBottom: 36,
  },
  header: {
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: rivio.ink[900],
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    color: rivio.ink[600],
    marginTop: 2,
    lineHeight: 16,
  },
  deviceStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: rivio.surface.card,
    borderRadius: rivio.radius.md,
    borderWidth: 1,
    borderColor: rivio.surface.line,
    padding: 12,
    marginBottom: 14,
    gap: 12,
  },
  deviceIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: rivio.brand[50],
    borderWidth: 1,
    borderColor: rivio.brand[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '700',
    color: rivio.ink[900],
  },
  deviceSub: {
    fontSize: 11,
    color: rivio.ink[400],
    marginTop: 1,
  },
  deviceConnectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: rivio.brand[50],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: rivio.radius.pill,
  },
  connectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: rivio.brand[500],
  },
  connectedText: {
    fontSize: 10,
    fontWeight: '700',
    color: rivio.brand[700],
  },
  alertCard: {
    backgroundColor: rivio.clinical.danger.bg,
    borderWidth: 1,
    borderColor: rivio.clinical.danger.border,
    borderRadius: rivio.radius.md,
    padding: 14,
    marginBottom: 16,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: rivio.clinical.danger.fg,
  },
  alertMainText: {
    fontSize: 13,
    fontWeight: '700',
    color: rivio.ink[900],
    marginBottom: 4,
  },
  alertSubText: {
    fontSize: 11,
    color: rivio.ink[600],
    lineHeight: 15,
  },
  tacogramHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: rivio.ink[600],
    marginTop: 10,
    marginBottom: 6,
  },
  alertButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: rivio.brand[600],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: rivio.radius.sm,
  },
  actionChatButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  actionShareButton: {
    backgroundColor: rivio.surface.card,
    borderWidth: 1,
    borderColor: rivio.surface.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: rivio.radius.sm,
    justifyContent: 'center',
  },
  actionShareButtonText: {
    color: rivio.ink[900],
    fontSize: 11,
    fontWeight: '600',
  },
  chartContainer: {
    backgroundColor: rivio.surface.card,
    borderRadius: rivio.radius.md,
    borderWidth: 1,
    borderColor: rivio.surface.line,
    padding: 14,
    marginBottom: 14,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: rivio.ink[900],
  },
  chartCurrentBpm: {
    fontSize: 13,
    fontWeight: '800',
    color: rivio.series.hr,
  },
  windowToggleRow: {
    flexDirection: 'row',
    backgroundColor: rivio.surface.subtle,
    borderRadius: rivio.radius.sm,
    padding: 2,
    gap: 2,
  },
  windowChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: rivio.radius.sm - 2,
  },
  windowChipActive: {
    backgroundColor: rivio.surface.card,
  },
  windowChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: rivio.ink[400],
  },
  windowChipTextActive: {
    color: rivio.brand[700],
    fontWeight: '700',
  },
  chartFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: rivio.surface.subtle,
  },
  chartFooterText: {
    fontSize: 10,
    color: rivio.ink[400],
  },
  emptySamplesBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptySamplesText: {
    fontSize: 11,
    color: rivio.ink[400],
    textAlign: 'center',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  metricCard: {
    width: (SCREEN_WIDTH - 40) / 2,
    backgroundColor: rivio.surface.card,
    borderRadius: rivio.radius.md,
    borderWidth: 1,
    borderColor: rivio.surface.line,
    padding: 12,
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  metricCardTitle: {
    fontSize: 11,
    color: rivio.ink[600],
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: rivio.ink[900],
    marginBottom: 6,
  },
  metricUnit: {
    fontSize: 11,
    fontWeight: '500',
    color: rivio.ink[400],
  },
  sleepStageCard: {
    backgroundColor: rivio.surface.card,
    borderRadius: rivio.radius.md,
    borderWidth: 1,
    borderColor: rivio.surface.line,
    padding: 14,
  },
  sleepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sleepTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: rivio.ink[900],
  },
  sleepBarWrap: {
    flexDirection: 'row',
    height: 14,
    borderRadius: 7,
    overflow: 'hidden',
    marginBottom: 12,
  },
  sleepSegment: {
    height: '100%',
  },
  sleepLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  sleepLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: rivio.ink[600],
    fontWeight: '500',
  },
});
