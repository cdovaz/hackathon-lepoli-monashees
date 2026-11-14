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
  Activity,
  Heart,
  Moon,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Info,
  Calendar,
  Stethoscope,
  Pill,
  Hospital,
  AlertTriangle,
  FileCheck2,
} from 'lucide-react-native';
import { useHealthStore } from '../store/useHealthStore';
import { theme, rivio } from '../theme/colors';
import { BiomarkerChart } from '../components/BiomarkerChart';
import { ReadinessRing } from '../components/ReadinessRing';
import { Sparkline } from '../components/Sparkline';
import { BiomarkerCategory } from '../types';

const SCREEN_WIDTH = Dimensions.get('window').width;

const CATEGORIES: (string)[] = [
  'Todos',
  'Alterados',
  'Glicêmico',
  'Lipídico',
  'Hematológico',
  'Hormonal',
  'Renal',
  'Inflamatório',
  'Hepático',
  'Nutricional',
];

interface TimelineScreenProps {
  onNavigateToTab: (tabName: string) => void;
}

type TimelineItem =
  | {
      kind: 'exam';
      id: string;
      date: string;
      title: string;
      category?: string;
      value: number;
      unit: string;
      status: 'normal' | 'attention' | 'critical';
      labName: string;
      notes?: string;
    }
  | {
      kind: 'event';
      id: string;
      date: string;
      title: string;
      eventType: string;
      description?: string;
      severity?: string;
    };

export const TimelineScreen: React.FC<TimelineScreenProps> = ({ onNavigateToTab }) => {
  const {
    user,
    biomarkers,
    exams,
    wearables,
    activeAlerts,
    clinicalEvents,
    medications,
    isSimulatedAnomalyActive,
  } = useHealthStore();

  const [selectedBiomarkerId, setSelectedBiomarkerId] = useState<string>('glicose');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todos');
  const [timelineMode, setTimelineMode] = useState<'biomarkers' | 'chronological'>('chronological');

  const latestWearable = wearables[wearables.length - 1];
  const readinessScore = latestWearable?.readinessScore ?? (isSimulatedAnomalyActive ? 48 : 82);
  const isAnomaly = Boolean(latestWearable?.hasAnomaly || isSimulatedAnomalyActive || (activeAlerts.length > 0 && !activeAlerts[0]?.resolved));

  // Agrupa os exames por biomarcador
  const groupedBiomarkers = Object.values(biomarkers).map((bm) => {
    const measurements = exams.filter((e) => e.biomarkerId === bm.id);
    const sorted = [...measurements].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const latest = sorted[0];
    const previous = sorted[1];

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (latest && previous) {
      if (latest.value > previous.value) trend = 'up';
      else if (latest.value < previous.value) trend = 'down';
    }

    const isOutOfRange = latest ? latest.value < bm.refMin || latest.value > bm.refMax : false;

    return {
      definition: bm,
      measurements,
      latest,
      trend,
      isOutOfRange,
    };
  });

  const filteredBiomarkers = groupedBiomarkers.filter((item) => {
    if (categoryFilter === 'Todos') return true;
    if (categoryFilter === 'Alterados') return item.isOutOfRange;
    return item.definition.category === categoryFilter;
  });

  // Se o biomarcador selecionado não tiver exames no paciente atual, ajusta para o primeiro que tiver
  const activeBiomarkerData =
    groupedBiomarkers.find((b) => b.definition.id === selectedBiomarkerId && b.measurements.length > 0) ||
    groupedBiomarkers.find((b) => b.measurements.length > 0) ||
    groupedBiomarkers[0];

  // Mescla unificada de rivio_exams + rivio_clinical_events por ordem cronológica decrescente
  const unifiedTimeline: TimelineItem[] = [
    ...exams.map((e): TimelineItem => ({
      kind: 'exam',
      id: e.id,
      date: e.date,
      title: e.canonicalName,
      category: biomarkers[e.biomarkerId]?.category,
      value: e.value,
      unit: e.unit,
      status: e.status,
      labName: e.labName,
      notes: e.notes,
    })),
    ...clinicalEvents.map((evt): TimelineItem => ({
      kind: 'event',
      id: evt.id,
      date: evt.date,
      title: evt.title,
      eventType: evt.eventType,
      description: evt.description,
      severity: evt.severity,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Sparklines com dados dos últimos 7 dias
  const last7DaysBpm = wearables.slice(-7).map((w) => w.restingHeartRate);
  const last7DaysHrv = wearables.slice(-7).map((w) => w.hrv);
  const last7DaysSleep = wearables.slice(-7).map((w) => w.sleepHours);

  // Correlação com wearable se disponível
  const correlationDataset = {
    name: 'FC Repouso',
    unit: 'BPM',
    color: rivio.series.hr,
    data: wearables.slice(-8).map((w) => ({
      date: w.date,
      value: w.restingHeartRate,
    })),
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* 1. Header com Perfil do Paciente & Cenário Clínico */}
      <View style={[styles.heroCard, isAnomaly && styles.heroCardAlert]}>
        <View style={styles.heroLeft}>
          <View style={styles.userBadge}>
            <Text style={styles.userBadgeText}>{user.name} • {user.age} anos</Text>
          </View>
          <Text style={styles.heroTitle}>
            {isAnomaly ? 'Atenção Clínica em Curso' : 'Prontuário Longitudinal'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {user.scenario ||
              (isAnomaly
                ? 'Sinais de alerta ou alterações laboratoriais ativas no prontuário.'
                : 'Sinais vitais e biomarcadores em acompanhamento contínuo.')}
          </Text>
          <View style={styles.metricTags}>
            <View style={styles.tagItem}>
              <Text style={styles.tagLabel}>Exames:</Text>
              <Text style={styles.tagValue}>{exams.length}</Text>
            </View>
            <View style={styles.tagItem}>
              <Text style={styles.tagLabel}>Eventos:</Text>
              <Text style={styles.tagValue}>{clinicalEvents.length}</Text>
            </View>
            <View style={styles.tagItem}>
              <Text style={styles.tagLabel}>Wearables:</Text>
              <Text style={styles.tagValue}>{wearables.length}d</Text>
            </View>
          </View>
        </View>

        <View style={styles.heroRight}>
          <ReadinessRing score={readinessScore} isAnomaly={isAnomaly} size={98} />
        </View>
      </View>

      {/* 2. Alerta Proativo em Destaque */}
      {activeAlerts.length > 0 && (
        <View
          style={[
            styles.alertCard,
            activeAlerts[0].resolved && {
              backgroundColor: rivio.surface.card,
              borderColor: rivio.surface.line,
            },
          ]}
        >
          <View style={styles.alertHeader}>
            <View style={styles.alertIconWrapper}>
              <ShieldAlert
                color={activeAlerts[0].resolved ? rivio.brand[600] : rivio.clinical.danger.fg}
                size={20}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.alertTitle,
                  activeAlerts[0].resolved && { color: rivio.ink[900] },
                ]}
              >
                {activeAlerts[0].message}
              </Text>
              <Text style={styles.alertTimestamp}>{activeAlerts[0].timestamp}</Text>
            </View>
          </View>
          {activeAlerts[0].context && (
            <Text style={styles.alertDescription}>{activeAlerts[0].context}</Text>
          )}

          <View style={styles.alertActions}>
            <TouchableOpacity
              style={styles.alertPrimaryButton}
              onPress={() => onNavigateToTab('Assistente')}
            >
              <Text style={styles.alertPrimaryButtonText}>Investigar no Chat IA</Text>
              <ArrowRight color="#FFFFFF" size={14} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.alertSecondaryButton}
              onPress={() => onNavigateToTab('Compartilhar')}
            >
              <Text style={styles.alertSecondaryButtonText}>Gerar Token Médico</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 3. Cards de Sinais Vitais com Sparklines */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Sinais Vitais (Últimos 7 dias)</Text>
        <TouchableOpacity onPress={() => onNavigateToTab('Wearables')}>
          <Text style={styles.sectionLink}>Ver wearables</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.vitalsRow}>
        <View style={[styles.vitalCard, isAnomaly && styles.vitalCardAlert]}>
          <View style={styles.vitalHeaderRow}>
            <View style={styles.vitalIconTitle}>
              <Heart color={isAnomaly ? rivio.clinical.danger.fg : rivio.series.hr} size={15} />
              <Text style={styles.vitalLabel}>Frequência</Text>
            </View>
            <Sparkline
              data={last7DaysBpm}
              color={isAnomaly ? rivio.clinical.danger.fg : rivio.series.hr}
              width={50}
              height={20}
            />
          </View>
          <Text style={[styles.vitalValue, isAnomaly && styles.vitalValueAlert]}>
            {latestWearable?.restingHeartRate || 68} <Text style={styles.vitalUnit}>BPM</Text>
          </Text>
          <Text style={styles.vitalSub}>
            {isAnomaly ? 'Atenção em repouso' : 'Repouso estável'}
          </Text>
        </View>

        <View style={[styles.vitalCard, isAnomaly && styles.vitalCardAlert]}>
          <View style={styles.vitalHeaderRow}>
            <View style={styles.vitalIconTitle}>
              <Activity color={isAnomaly ? rivio.clinical.warn.fg : rivio.series.hrv} size={15} />
              <Text style={styles.vitalLabel}>HRV</Text>
            </View>
            <Sparkline
              data={last7DaysHrv}
              color={isAnomaly ? rivio.clinical.warn.fg : rivio.series.hrv}
              width={50}
              height={20}
            />
          </View>
          <Text style={styles.vitalValue}>
            {latestWearable?.hrv || 48} <Text style={styles.vitalUnit}>ms</Text>
          </Text>
          <Text style={styles.vitalSub}>Variabilidade cardíaca</Text>
        </View>

        <View style={styles.vitalCard}>
          <View style={styles.vitalHeaderRow}>
            <View style={styles.vitalIconTitle}>
              <Moon color={rivio.series.sleep} size={15} />
              <Text style={styles.vitalLabel}>Sono</Text>
            </View>
            <Sparkline data={last7DaysSleep} color={rivio.series.sleep} width={50} height={20} />
          </View>
          <Text style={styles.vitalValue}>
            {latestWearable?.sleepHours || 7.2} <Text style={styles.vitalUnit}>h</Text>
          </Text>
          <Text style={styles.vitalSub}>
            {latestWearable?.deepSleepHours || 1.6}h profundo
          </Text>
        </View>
      </View>

      {/* 4. Alternador de Modo de Visualização */}
      <View style={styles.modeToggleRow}>
        <TouchableOpacity
          style={[
            styles.modeToggleButton,
            timelineMode === 'chronological' && styles.modeToggleButtonActive,
          ]}
          onPress={() => setTimelineMode('chronological')}
        >
          <Calendar
            size={14}
            color={timelineMode === 'chronological' ? rivio.brand[700] : rivio.ink[400]}
          />
          <Text
            style={[
              styles.modeToggleText,
              timelineMode === 'chronological' && styles.modeToggleTextActive,
            ]}
          >
            Linha Cronológica Unificada ({unifiedTimeline.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeToggleButton,
            timelineMode === 'biomarkers' && styles.modeToggleButtonActive,
          ]}
          onPress={() => setTimelineMode('biomarkers')}
        >
          <Activity
            size={14}
            color={timelineMode === 'biomarkers' ? rivio.brand[700] : rivio.ink[400]}
          />
          <Text
            style={[
              styles.modeToggleText,
              timelineMode === 'biomarkers' && styles.modeToggleTextActive,
            ]}
          >
            Gráficos por Biomarcador
          </Text>
        </TouchableOpacity>
      </View>

      {/* 5A. MODO CRONOLÓGICO: Mescla de rivio_exams + rivio_clinical_events */}
      {timelineMode === 'chronological' ? (
        <View style={styles.timelineSection}>
          <View style={styles.timelineList}>
            {unifiedTimeline.slice(0, 30).map((item, idx) => {
              if (item.kind === 'event') {
                const isHospital = item.eventType.toLowerCase().includes('interna') || item.eventType.toLowerCase().includes('hospital');
                return (
                  <View key={item.id} style={styles.timelineItemWrap}>
                    <View style={styles.timelineLine}>
                      <View
                        style={[
                          styles.timelineDot,
                          {
                            backgroundColor: isHospital ? rivio.clinical.danger.bg : rivio.clinical.info.bg,
                            borderColor: isHospital ? rivio.clinical.danger.fg : rivio.clinical.info.fg,
                          },
                        ]}
                      >
                        {isHospital ? (
                          <Hospital size={12} color={rivio.clinical.danger.fg} />
                        ) : (
                          <Stethoscope size={12} color={rivio.clinical.info.fg} />
                        )}
                      </View>
                      {idx < Math.min(unifiedTimeline.length, 30) - 1 && (
                        <View style={styles.timelineVerticalLine} />
                      )}
                    </View>

                    <View style={[styles.timelineCard, styles.timelineEventCard]}>
                      <View style={styles.timelineCardHeader}>
                        <View style={styles.eventBadgeWrap}>
                          <Text style={styles.eventTypeBadge}>{item.eventType}</Text>
                          <Text style={styles.timelineDate}>{item.date}</Text>
                        </View>
                        {item.severity && (
                          <View
                            style={[
                              styles.severityPill,
                              {
                                backgroundColor:
                                  item.severity === 'critical'
                                    ? rivio.clinical.danger.bg
                                    : rivio.clinical.warn.bg,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.severityPillText,
                                {
                                  color:
                                    item.severity === 'critical'
                                      ? rivio.clinical.danger.fg
                                      : rivio.clinical.warn.fg,
                                },
                              ]}
                            >
                              {item.severity}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.timelineItemTitle}>{item.title}</Text>
                      {item.description && (
                        <Text style={styles.timelineItemDesc}>{item.description}</Text>
                      )}
                    </View>
                  </View>
                );
              }

              // Item de Exame
              const isAlert = item.status !== 'normal';
              return (
                <View key={item.id} style={styles.timelineItemWrap}>
                  <View style={styles.timelineLine}>
                    <View
                      style={[
                        styles.timelineDot,
                        {
                          backgroundColor: isAlert ? rivio.clinical.danger.bg : rivio.brand[50],
                          borderColor: isAlert ? rivio.clinical.danger.fg : rivio.brand[600],
                        },
                      ]}
                    >
                      <FileCheck2
                        size={12}
                        color={isAlert ? rivio.clinical.danger.fg : rivio.brand[600]}
                      />
                    </View>
                    {idx < Math.min(unifiedTimeline.length, 30) - 1 && (
                      <View style={styles.timelineVerticalLine} />
                    )}
                  </View>

                  <View style={styles.timelineCard}>
                    <View style={styles.timelineCardHeader}>
                      <Text style={styles.timelineCategoryText}>
                        {item.category || 'Exame Laboratorial'}
                      </Text>
                      <Text style={styles.timelineDate}>{item.date}</Text>
                    </View>

                    <View style={styles.examMainRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.timelineItemTitle}>{item.title}</Text>
                        <Text style={styles.timelineLabMeta}>{item.labName}</Text>
                      </View>

                      <View style={styles.examValueBadgeWrap}>
                        <Text
                          style={[
                            styles.examTimelineValue,
                            isAlert && styles.examTimelineValueAlert,
                          ]}
                        >
                          {item.value} <Text style={styles.examTimelineUnit}>{item.unit}</Text>
                        </Text>
                        <View
                          style={[
                            styles.statusPillSmall,
                            {
                              backgroundColor: isAlert
                                ? rivio.clinical.danger.bg
                                : rivio.clinical.ok.bg,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusPillSmallText,
                              {
                                color: isAlert
                                  ? rivio.clinical.danger.fg
                                  : rivio.clinical.ok.fg,
                              },
                            ]}
                          >
                            {isAlert ? 'Alterado' : 'Normal'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {item.notes && <Text style={styles.examNotesText}>{item.notes}</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        /* 5B. MODO BIOMARCADORES: Gráfico Interativo e Filtros por Categoria */
        <View>
          {activeBiomarkerData && (
            <View style={styles.chartCard}>
              <View style={styles.chartCardHeader}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.chartBiomarkerName}>
                    {activeBiomarkerData.definition.canonicalName}
                  </Text>
                  <Text style={styles.chartBiomarkerDesc}>
                    {activeBiomarkerData.definition.description}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    activeBiomarkerData.isOutOfRange
                      ? styles.statusBadgeWarning
                      : styles.statusBadgeSuccess,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      activeBiomarkerData.isOutOfRange
                        ? styles.statusBadgeTextWarning
                        : styles.statusBadgeTextSuccess,
                    ]}
                  >
                    {activeBiomarkerData.isOutOfRange ? 'Alterado' : 'Dentro da Faixa'}
                  </Text>
                </View>
              </View>

              <BiomarkerChart
                data={activeBiomarkerData.measurements.map((m) => ({
                  date: m.date,
                  value: m.value,
                  labName: m.labName,
                }))}
                refMin={activeBiomarkerData.definition.refMin}
                refMax={activeBiomarkerData.definition.refMax}
                unit={activeBiomarkerData.definition.unit}
                lineColor={rivio.brand[600]}
                width={SCREEN_WIDTH - 64}
                height={210}
                correlationData={
                  activeBiomarkerData.definition.id === 'glicose' ||
                  activeBiomarkerData.definition.id === 'ferritina' ||
                  activeBiomarkerData.definition.id === 'leucocitos'
                    ? correlationDataset
                    : undefined
                }
              />
            </View>
          )}

          {/* Filtros de Categoria (Todas as 8 categorias oficiais do schema) */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Filtrar por Categoria</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterRow}
            contentContainerStyle={styles.filterRowContent}
          >
            {CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.filterChip,
                  categoryFilter === category && styles.filterChipActive,
                ]}
                onPress={() => setCategoryFilter(category)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    categoryFilter === category && styles.filterChipTextActive,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Grade de Seleção de Biomarcadores */}
          <View style={styles.biomarkerGrid}>
            {filteredBiomarkers.map((item) => {
              const isSelected = item.definition.id === activeBiomarkerData?.definition.id;
              return (
                <TouchableOpacity
                  key={item.definition.id}
                  style={[
                    styles.biomarkerRowCard,
                    isSelected && styles.biomarkerRowCardSelected,
                    item.isOutOfRange && styles.biomarkerRowCardOutOfRange,
                  ]}
                  onPress={() => setSelectedBiomarkerId(item.definition.id)}
                >
                  <View style={styles.biomarkerRowMain}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.biomarkerRowTitle}>
                        {item.definition.canonicalName}
                      </Text>
                      <Text style={styles.biomarkerRowCategory}>
                        {item.definition.category} • Ref: {item.definition.refMin}-
                        {item.definition.refMax} {item.definition.unit}
                      </Text>
                    </View>

                    <View style={styles.biomarkerRowValues}>
                      {item.latest ? (
                        <>
                          <Text
                            style={[
                              styles.biomarkerValueText,
                              item.isOutOfRange && styles.biomarkerValueTextAlert,
                            ]}
                          >
                            {item.latest.value}{' '}
                            <Text style={styles.biomarkerUnitText}>
                              {item.definition.unit}
                            </Text>
                          </Text>
                          <View style={styles.biomarkerTrendBox}>
                            {item.trend === 'up' && <TrendingUp size={12} color="#E11D48" />}
                            {item.trend === 'down' && <TrendingDown size={12} color="#10B981" />}
                            <Text style={styles.biomarkerDateText}>{item.latest.date}</Text>
                          </View>
                        </>
                      ) : (
                        <Text style={styles.noDataText}>Sem registros</Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
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
  heroCard: {
    flexDirection: 'row',
    backgroundColor: rivio.surface.card,
    borderRadius: rivio.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: rivio.surface.line,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  heroCardAlert: {
    borderColor: rivio.clinical.danger.border,
    backgroundColor: rivio.clinical.danger.bg,
  },
  heroLeft: {
    flex: 1,
    paddingRight: 10,
  },
  heroRight: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  userBadge: {
    alignSelf: 'flex-start',
    backgroundColor: rivio.surface.subtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  userBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: rivio.ink[600],
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: rivio.ink[900],
    marginBottom: 3,
  },
  heroSubtitle: {
    fontSize: 11,
    color: rivio.ink[600],
    lineHeight: 15,
    marginBottom: 8,
  },
  metricTags: {
    flexDirection: 'row',
    gap: 8,
  },
  tagItem: {
    flexDirection: 'row',
    gap: 3,
    backgroundColor: rivio.surface.subtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagLabel: {
    fontSize: 10,
    color: rivio.ink[400],
    fontWeight: '600',
  },
  tagValue: {
    fontSize: 10,
    fontWeight: '700',
    color: rivio.ink[900],
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
    gap: 10,
    alignItems: 'center',
  },
  alertIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(225, 29, 72, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: rivio.clinical.danger.fg,
  },
  alertTimestamp: {
    fontSize: 10,
    color: rivio.ink[400],
    marginTop: 1,
  },
  alertDescription: {
    fontSize: 12,
    color: rivio.ink[900],
    marginTop: 8,
    lineHeight: 16,
  },
  alertActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  alertPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: rivio.brand[600],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: rivio.radius.sm,
  },
  alertPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  alertSecondaryButton: {
    backgroundColor: rivio.surface.card,
    borderWidth: 1,
    borderColor: rivio.surface.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: rivio.radius.sm,
    justifyContent: 'center',
  },
  alertSecondaryButtonText: {
    color: rivio.ink[900],
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
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
  vitalsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  vitalCard: {
    flex: 1,
    backgroundColor: rivio.surface.card,
    borderRadius: rivio.radius.md,
    borderWidth: 1,
    borderColor: rivio.surface.line,
    padding: 10,
  },
  vitalCardAlert: {
    borderColor: rivio.clinical.danger.border,
    backgroundColor: rivio.clinical.danger.bg,
  },
  vitalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  vitalIconTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vitalLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: rivio.ink[600],
  },
  vitalValue: {
    fontSize: 15,
    fontWeight: '800',
    color: rivio.ink[900],
  },
  vitalValueAlert: {
    color: rivio.clinical.danger.fg,
  },
  vitalUnit: {
    fontSize: 10,
    fontWeight: '500',
    color: rivio.ink[600],
  },
  vitalSub: {
    fontSize: 9,
    color: rivio.ink[400],
    marginTop: 2,
  },

  /* Alternador de Modo */
  modeToggleRow: {
    flexDirection: 'row',
    backgroundColor: rivio.surface.subtle,
    borderRadius: rivio.radius.sm,
    padding: 3,
    marginBottom: 14,
    gap: 4,
  },
  modeToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: rivio.radius.sm - 2,
  },
  modeToggleButtonActive: {
    backgroundColor: rivio.surface.card,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  modeToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: rivio.ink[400],
  },
  modeToggleTextActive: {
    color: rivio.brand[700],
    fontWeight: '700',
  },

  /* Timeline Cronológica Unificada */
  timelineSection: {
    marginTop: 4,
  },
  timelineList: {
    paddingLeft: 4,
  },
  timelineItemWrap: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  timelineLine: {
    width: 28,
    alignItems: 'center',
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  timelineVerticalLine: {
    width: 2,
    flex: 1,
    backgroundColor: rivio.surface.line,
    marginTop: 2,
    marginBottom: -4,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: rivio.surface.card,
    borderRadius: rivio.radius.md,
    borderWidth: 1,
    borderColor: rivio.surface.line,
    padding: 12,
    marginLeft: 8,
  },
  timelineEventCard: {
    backgroundColor: rivio.surface.subtle,
    borderLeftWidth: 3,
    borderLeftColor: rivio.brand[500],
  },
  timelineCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventTypeBadge: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: rivio.brand[700],
    backgroundColor: rivio.brand[100],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timelineCategoryText: {
    fontSize: 10,
    fontWeight: '700',
    color: rivio.ink[400],
    textTransform: 'uppercase',
  },
  timelineDate: {
    fontSize: 11,
    color: rivio.ink[400],
  },
  timelineItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: rivio.ink[900],
  },
  timelineItemDesc: {
    fontSize: 11,
    color: rivio.ink[600],
    marginTop: 3,
    lineHeight: 15,
  },
  timelineLabMeta: {
    fontSize: 11,
    color: rivio.ink[400],
    marginTop: 2,
  },
  severityPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  severityPillText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  examMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  examValueBadgeWrap: {
    alignItems: 'flex-end',
    gap: 2,
  },
  examTimelineValue: {
    fontSize: 13,
    fontWeight: '700',
    color: rivio.ink[900],
  },
  examTimelineValueAlert: {
    color: rivio.clinical.danger.fg,
  },
  examTimelineUnit: {
    fontSize: 10,
    color: rivio.ink[400],
  },
  statusPillSmall: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  statusPillSmallText: {
    fontSize: 9,
    fontWeight: '700',
  },
  examNotesText: {
    fontSize: 10,
    color: rivio.ink[600],
    backgroundColor: rivio.surface.subtle,
    padding: 6,
    borderRadius: 4,
    marginTop: 6,
    fontStyle: 'italic',
  },

  /* Gráficos por Biomarcador */
  chartCard: {
    backgroundColor: rivio.surface.card,
    borderRadius: rivio.radius.md,
    borderWidth: 1,
    borderColor: rivio.surface.line,
    padding: 14,
    marginBottom: 16,
  },
  chartCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  chartBiomarkerName: {
    fontSize: 15,
    fontWeight: '800',
    color: rivio.ink[900],
  },
  chartBiomarkerDesc: {
    fontSize: 11,
    color: rivio.ink[400],
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: rivio.radius.pill,
  },
  statusBadgeSuccess: {
    backgroundColor: rivio.clinical.ok.bg,
    borderWidth: 1,
    borderColor: rivio.clinical.ok.border,
  },
  statusBadgeWarning: {
    backgroundColor: rivio.clinical.danger.bg,
    borderWidth: 1,
    borderColor: rivio.clinical.danger.border,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadgeTextSuccess: {
    color: rivio.clinical.ok.fg,
  },
  statusBadgeTextWarning: {
    color: rivio.clinical.danger.fg,
  },
  filterRow: {
    marginBottom: 12,
  },
  filterRowContent: {
    gap: 6,
    paddingRight: 16,
  },
  filterChip: {
    backgroundColor: rivio.surface.card,
    borderWidth: 1,
    borderColor: rivio.surface.line,
    borderRadius: rivio.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: rivio.brand[50],
    borderColor: rivio.brand[500],
  },
  filterChipText: {
    fontSize: 11,
    color: rivio.ink[600],
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: rivio.brand[700],
    fontWeight: '700',
  },
  biomarkerGrid: {
    gap: 8,
  },
  biomarkerRowCard: {
    backgroundColor: rivio.surface.card,
    borderRadius: rivio.radius.sm,
    borderWidth: 1,
    borderColor: rivio.surface.line,
    padding: 12,
  },
  biomarkerRowCardSelected: {
    borderColor: rivio.brand[500],
    backgroundColor: rivio.brand[50],
  },
  biomarkerRowCardOutOfRange: {
    borderLeftWidth: 3,
    borderLeftColor: rivio.clinical.danger.fg,
  },
  biomarkerRowMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  biomarkerRowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: rivio.ink[900],
  },
  biomarkerRowCategory: {
    fontSize: 10,
    color: rivio.ink[400],
    marginTop: 2,
  },
  biomarkerRowValues: {
    alignItems: 'flex-end',
    gap: 2,
  },
  biomarkerValueText: {
    fontSize: 13,
    fontWeight: '700',
    color: rivio.ink[900],
  },
  biomarkerValueTextAlert: {
    color: rivio.clinical.danger.fg,
  },
  biomarkerUnitText: {
    fontSize: 10,
    fontWeight: '500',
    color: rivio.ink[400],
  },
  biomarkerTrendBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  biomarkerDateText: {
    fontSize: 9,
    color: rivio.ink[400],
  },
  noDataText: {
    fontSize: 11,
    color: rivio.ink[400],
    fontStyle: 'italic',
  },
});
