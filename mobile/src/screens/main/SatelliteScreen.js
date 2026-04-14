import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { satelliteService } from '../../services/satelliteService';
import { colors as T, gradients, radius, shadows } from '../../theme/theme';
import MeshOrbs from '../../components/MeshOrbs';

// ── NDVI status colors (kept as-is for data-driven meaning) ─────────────────
const NDVI_HIGH  = '#d73027';
const NDVI_MED   = '#fdae61';
const NDVI_OK    = '#a6d96a';
const NDVI_LOW   = '#1a9850';

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }) {
  return (
    <View style={ss.sectionHeader}>
      <View style={ss.sectionIcon}>
        <Ionicons name={icon} size={18} color={T.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={ss.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={ss.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function MetricPill({ label, value, color }) {
  return (
    <View style={[ss.metricPill, { borderColor: color || T.glassBorder }]}>
      <Text style={[ss.metricValue, { color: color || T.text }]}>{value ?? '—'}</Text>
      <Text style={ss.metricLabel}>{label}</Text>
    </View>
  );
}

// ─── NDVI Card ────────────────────────────────────────────────────────────────
function NdviCard({ ndvi }) {
  const { t } = useTranslation();
  if (!ndvi || ndvi.summary?.error) {
    return (
      <View style={ss.card}>
        <SectionHeader icon="satellite-outline" title={t('satellite.ndviTitle')} subtitle={t('satellite.ndviSub')} />
        <Text style={ss.emptyText}>{ndvi?.summary?.error || t('satellite.noPolygon')}</Text>
      </View>
    );
  }
  const s = ndvi.summary || {};
  const ndviVal = typeof s.avg_ndvi === 'number' ? s.avg_ndvi : null;
  const color = ndviVal !== null
    ? ndviVal < 0.2 ? NDVI_HIGH : ndviVal < 0.4 ? NDVI_MED : ndviVal < 0.6 ? NDVI_OK : NDVI_LOW
    : T.textMuted;

  return (
    <View style={ss.card}>
      <SectionHeader icon="satellite-outline" title={t('satellite.ndviTitle')} subtitle={`${s.source || 'Sentinel-2'} · ${s.date || '—'}`} />
      <View style={ss.pillRow}>
        <MetricPill label={t('satellite.avgNdvi')} value={ndviVal !== null ? ndviVal.toFixed(2) : t('common.na')} color={color} />
        <MetricPill label={t('satellite.minNdvi')} value={typeof s.min_ndvi === 'number' ? s.min_ndvi.toFixed(2) : s.min_ndvi} />
        <MetricPill label={t('satellite.maxNdvi')} value={typeof s.max_ndvi === 'number' ? s.max_ndvi.toFixed(2) : s.max_ndvi} />
        <MetricPill label={t('satellite.clouds')} value={s.clouds !== undefined ? `${s.clouds}%` : '—'} />
      </View>

      {ndviVal !== null && (
        <View style={ss.ndviBarWrapper}>
          <LinearGradient
            colors={['#d73027', '#fdae61', '#a6d96a', '#1a9850']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={ss.ndviGradient}
          />
          <View style={[ss.ndviMarker, { left: `${Math.min(ndviVal * 100, 97)}%` }]} />
          <View style={ss.ndviAxisRow}>
            {['0', '0.2', '0.4', '0.6', '0.8', '1.0'].map(v => (
              <Text key={v} style={ss.ndviAxisLabel}>{v}</Text>
            ))}
          </View>
        </View>
      )}

      <View style={[ss.healthBadge, { backgroundColor: color + '22', borderColor: color }]}>
        <Ionicons name="leaf" size={14} color={color} />
        <Text style={[ss.healthBadgeText, { color }]}>{s.health_label || '—'}</Text>
      </View>
    </View>
  );
}

// ─── VRA Map Card ─────────────────────────────────────────────────────────────
function VraCard({ vra }) {
  const { t } = useTranslation();
  if (!vra) return null;
  const zones = vra.zones || [];

  return (
    <View style={ss.card}>
      <SectionHeader
        icon="map-outline"
        title={t('satellite.vraTitle')}
        subtitle={`${vra.area_ha} ha · NDVI ${vra.avg_ndvi ?? '—'}`}
      />
      {zones.map(z => (
        <View key={z.id} style={ss.zoneRow}>
          <View style={[ss.zoneColorBar, { backgroundColor: z.color }]} />
          <View style={{ flex: 1 }}>
            <View style={ss.zoneHeaderRow}>
              <Text style={ss.zoneLabel}>{z.label} ({z.area_pct}%)</Text>
              <Text style={[ss.zoneRate, { color: z.color }]}>{z.application_rate_pct}%</Text>
            </View>
            <View style={ss.zoneBarBg}>
              <View style={[ss.zoneBarFill, { width: `${z.area_pct}%`, backgroundColor: z.color }]} />
            </View>
            <Text style={ss.zoneDetail}>
              N {z.prescription.N_kg} kg · P {z.prescription.P_kg} kg · K {z.prescription.K_kg} kg · {z.prescription.water_m3} m³
            </Text>
          </View>
        </View>
      ))}

      {vra.savings_vs_uniform_pct > 0 && (
        <View style={ss.savingsBanner}>
          <Ionicons name="trending-down-outline" size={16} color={NDVI_LOW} />
          <Text style={ss.savingsText}>{vra.savings_message}</Text>
        </View>
      )}

      <View style={ss.totalRow}>
        <Text style={ss.totalLabel}>{t('satellite.totalPrescription')}</Text>
        <Text style={ss.totalValue}>
          N {vra.total_prescription?.N_kg} kg · P {vra.total_prescription?.P_kg} kg · K {vra.total_prescription?.K_kg} kg
        </Text>
      </View>
    </View>
  );
}

// ─── Soil Health Card ─────────────────────────────────────────────────────────
function SoilHealthCard({ soil }) {
  const { t } = useTranslation();
  if (!soil) return null;
  const ind = soil.indicators || {};
  const score = soil.health_score ?? 0;

  return (
    <View style={ss.card}>
      <SectionHeader icon="earth-outline" title={t('satellite.soilTitle')} subtitle={t('satellite.soilSub')} />

      <View style={ss.scoreRow}>
        <View style={[ss.scoreCircle, { borderColor: soil.health_color }]}>
          <Text style={[ss.scoreNumber, { color: soil.health_color }]}>{score}</Text>
          <Text style={ss.scoreMax}>/100</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={[ss.healthLabel, { color: soil.health_color }]}>{soil.health_label}</Text>
          <Text style={ss.fertilityLabel}>{soil.fertility_class}{t('satellite.fertilitySuffix')}</Text>
          <Text style={ss.fertilityDesc}>{soil.fertility_desc}</Text>
        </View>
      </View>

      <View style={ss.pillRow}>
        <MetricPill label={t('satellite.ndvi')} value={ind.ndvi?.toFixed(3)} />
        <MetricPill label={t('satellite.savi')} value={ind.savi?.toFixed(3)} />
        <MetricPill label={t('satellite.msavi')} value={ind.msavi?.toFixed(3)} />
        {ind.soil_moisture_pct != null && (
          <MetricPill label={t('satellite.moisture')} value={`${ind.soil_moisture_pct}%`} />
        )}
      </View>

      <View style={[ss.stressBadge, {
        backgroundColor: soil.moisture_stress === 'Low' ? 'rgba(26,152,80,0.15)' : soil.moisture_stress === 'Moderate' ? 'rgba(253,174,97,0.15)' : 'rgba(215,48,39,0.15)',
        borderColor: soil.moisture_stress === 'Low' ? NDVI_LOW : soil.moisture_stress === 'Moderate' ? NDVI_MED : NDVI_HIGH,
      }]}>
        <Ionicons
          name="water-outline" size={14}
          color={soil.moisture_stress === 'Low' ? NDVI_LOW : soil.moisture_stress === 'Moderate' ? NDVI_MED : NDVI_HIGH}
        />
        <Text style={[ss.stressBadgeText, {
          color: soil.moisture_stress === 'Low' ? NDVI_LOW : soil.moisture_stress === 'Moderate' ? NDVI_MED : NDVI_HIGH,
        }]}>
          {t('satellite.moistureStressFmt', {
            level: t(`satellite.stressLevels.${soil.moisture_stress}`, { defaultValue: soil.moisture_stress }),
          })}
        </Text>
      </View>

      {(soil.recommendations || []).map((rec, i) => (
        <View key={i} style={ss.recRow}>
          <Ionicons name="checkmark-circle-outline" size={16} color={T.accent} style={{ marginTop: 1 }} />
          <Text style={ss.recText}>{rec}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Crop Calendar Card ───────────────────────────────────────────────────────
function CropCalendarCard({ calendar }) {
  const { t } = useTranslation();
  if (!calendar) return null;
  const cur = calendar.current_stage || {};
  const ndviv = calendar.ndvi_vs_expected || {};
  const timeline = calendar.timeline || [];

  return (
    <View style={ss.card}>
      <SectionHeader
        icon="calendar-outline"
        title={t('satellite.calendarTitle')}
        subtitle={`${calendar.crop_name_fr || calendar.crop_type} · Stage ${cur.index}/${cur.total}`}
      />

      <View style={ss.progressBarBg}>
        <LinearGradient colors={gradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[ss.progressBarFill, { width: `${calendar.season_progress_pct}%` }]} />
      </View>
      <Text style={ss.progressLabel}>{t('satellite.seasonProgress', { pct: calendar.season_progress_pct })}</Text>

      <View style={ss.currentStageBox}>
        <View style={ss.currentStageHeader}>
          <Ionicons name="location" size={16} color={T.accent} />
          <Text style={ss.currentStageName}>{cur.name_fr} ({cur.name})</Text>
        </View>
        <Text style={ss.currentStageAction}>{cur.action}</Text>
      </View>

      <View style={[ss.ndviAssessRow, { backgroundColor: ndviv.color + '22' }]}>
        <Ionicons name="analytics-outline" size={15} color={ndviv.color} />
        <Text style={[ss.ndviAssessText, { color: ndviv.color }]}>
          NDVI {ndviv.current_ndvi} vs expected {ndviv.expected_ndvi} — {ndviv.assessment}
        </Text>
      </View>

      <Text style={ss.timelineTitle}>{t('satellite.timelineTitle')}</Text>
      {timeline.map((stage, i) => (
        <View key={i} style={ss.timelineRow}>
          <View style={[
            ss.timelineDot,
            stage.status === 'completed' && { backgroundColor: T.textDim },
            stage.status === 'current'   && { backgroundColor: T.accent, transform: [{ scale: 1.3 }] },
            stage.status === 'upcoming'  && { backgroundColor: 'transparent', borderWidth: 2, borderColor: T.glassBorder },
          ]} />
          {i < timeline.length - 1 && <View style={ss.timelineLine} />}
          <View style={[ss.timelineContent, stage.is_current && ss.timelineContentCurrent]}>
            <View style={ss.timelineTop}>
              <Text style={[
                ss.timelineName,
                stage.status === 'completed' && { color: T.textDim },
                stage.is_current && { color: T.accent, fontWeight: '700' },
              ]}>
                {stage.name_fr}
              </Text>
              <Text style={ss.timelinePeriod}>{stage.period}</Text>
            </View>
            {stage.is_current && <Text style={ss.timelineAction}>{stage.action}</Text>}
          </View>
        </View>
      ))}

      {calendar.next_stage && (
        <View style={ss.nextStageRow}>
          <Ionicons name="arrow-forward-circle-outline" size={16} color={T.accent} />
          <Text style={ss.nextStageText}>
            {t('satellite.nextStage', { name: calendar.next_stage.name_fr })}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SatelliteScreen() {
  const { t } = useTranslation();
  const [fields, setFields]               = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [analysis, setAnalysis]           = useState(null);
  const [loading, setLoading]             = useState(false);
  const [loadingFields, setLoadingFields] = useState(true);
  const [error, setError]                 = useState(null);
  const [refreshing, setRefreshing]       = useState(false);

  useEffect(() => {
    satelliteService.getFields()
      .then(data => {
        setFields(data);
        if (data.length > 0) setSelectedField(data[0]);
      })
      .catch(() => setError(t('satellite.loadError')))
      .finally(() => setLoadingFields(false));
  }, []);

  const loadAnalysis = useCallback(async (field) => {
    if (!field) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const data = await satelliteService.getFullAnalysis(field.id);
      setAnalysis(data);
    } catch {
      setError(t('satellite.loadErrorAnalysis'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAnalysis(selectedField); }, [selectedField, loadAnalysis]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAnalysis(selectedField);
    setRefreshing(false);
  }, [selectedField, loadAnalysis]);

  return (
    <LinearGradient colors={gradients.hero} style={ss.gradient}>
      <SafeAreaView style={ss.safeArea} edges={['top']}>
        {/* ── Header ─── */}
        <View style={ss.header}>
          <MeshOrbs variant="compact" />
          <View style={ss.headerIconWrap}>
            <Ionicons name="globe-outline" size={20} color={T.accent} />
          </View>
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={ss.headerTitle}>{t('satellite.headerTitle')}</Text>
            <Text style={ss.headerSubtitle}>{t('satellite.headerSubtitle')}</Text>
          </View>
          <TouchableOpacity
            onPress={onRefresh}
            disabled={loading}
            style={[ss.refreshBtn, loading && { opacity: 0.4 }]}
          >
            <Ionicons name="refresh-outline" size={20} color={T.accent} />
          </TouchableOpacity>
        </View>

        {/* ── Field selector ─── */}
        {!loadingFields && fields.length > 0 && (
          <View style={ss.fieldSelectorWrapper}>
            <FlatList
              data={fields}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={f => f.id}
              contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}
              renderItem={({ item }) => {
                const active = selectedField?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[ss.fieldChip, active && ss.fieldChipActive]}
                    onPress={() => setSelectedField(item)}
                    activeOpacity={0.8}
                  >
                    {active ? (
                      <LinearGradient colors={gradients.cta} style={ss.fieldChipGrad}>
                        <Ionicons name="leaf-outline" size={13} color={T.primaryMid} />
                        <Text style={ss.fieldChipTextActive}>{item.name}</Text>
                        {item.area_ha && <Text style={ss.fieldChipSubActive}>{item.area_ha} ha</Text>}
                      </LinearGradient>
                    ) : (
                      <>
                        <Ionicons name="leaf-outline" size={13} color={T.accent} />
                        <Text style={ss.fieldChipText}>{item.name}</Text>
                        {item.area_ha && <Text style={ss.fieldChipSub}>{item.area_ha} ha</Text>}
                      </>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}

        {/* ── Body ─── */}
        {loadingFields ? (
          <View style={ss.centered}>
            <ActivityIndicator size="large" color={T.accent} />
            <Text style={ss.loadingText}>{t('satellite.loadingFields')}</Text>
          </View>
        ) : fields.length === 0 ? (
          <View style={ss.centered}>
            <View style={ss.emptyIconWrap}>
              <Ionicons name="map-outline" size={36} color={T.accent} />
            </View>
            <Text style={ss.emptyTitle}>{t('satellite.noFields')}</Text>
            <Text style={ss.emptyText}>{t('satellite.noFieldsSub')}</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={ss.scroll}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.accent} />}
          >
            {loading && (
              <View style={ss.loadingCard}>
                <ActivityIndicator size="small" color={T.accent} />
                <Text style={ss.loadingCardText}>{t('satellite.fetching')}</Text>
              </View>
            )}

            {error && !loading && (
              <View style={ss.errorCard}>
                <Ionicons name="cloud-offline-outline" size={20} color={T.danger} />
                <Text style={ss.errorText}>{error}</Text>
              </View>
            )}

            {analysis && !loading && (
              <>
                <NdviCard ndvi={analysis.ndvi_diagnostic} />
                <VraCard vra={analysis.vra_map} />
                <SoilHealthCard soil={analysis.soil_health} />
                <CropCalendarCard calendar={analysis.crop_calendar} />
                <Text style={ss.footerNote}>
                  {t('satellite.footer', { date: analysis.vra_map?.generated_at?.slice(0, 10) ?? '—' })}
                </Text>
              </>
            )}

            <View style={{ height: 32 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  headerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: T.glassGreen,
    borderWidth: 1,
    borderColor: T.glassGreenBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle:    { fontSize: 18, fontWeight: '800', color: T.text, letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 11, color: T.textMuted, marginTop: 2, fontWeight: '600' },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: T.glassGreen,
    borderWidth: 1,
    borderColor: T.glassGreenBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Field selector
  fieldSelectorWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: T.glassBorder,
  },
  fieldChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: T.glassBorder,
    backgroundColor: T.glass,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fieldChipActive: { borderColor: 'transparent', padding: 0 },
  fieldChipGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fieldChipText:       { fontSize: 13, fontWeight: '700', color: T.textSecondary },
  fieldChipTextActive: { fontSize: 13, fontWeight: '800', color: T.primaryMid },
  fieldChipSub:        { fontSize: 11, color: T.textMuted },
  fieldChipSubActive:  { fontSize: 11, color: T.primaryMid, opacity: 0.75 },

  // Content layout
  scroll:   { padding: 14, gap: 14 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },

  // Loading / Error
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: T.glass,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: T.glassBorder,
  },
  loadingCardText: { fontSize: 13, color: T.textMuted },
  loadingText:     { fontSize: 14, color: T.textMuted, marginTop: 10 },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: T.dangerBg,
    borderRadius: radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.2)',
  },
  errorText: { flex: 1, fontSize: 13, color: T.danger },

  // Empty
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: T.glassGreen,
    borderWidth: 1,
    borderColor: T.glassGreenBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: T.text },
  emptyText:  { fontSize: 13, color: T.textMuted, textAlign: 'center', lineHeight: 20 },

  // Card
  card: {
    backgroundColor: T.glass,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: T.glassBorder,
    ...shadows.soft,
  },

  // Section header
  sectionHeader:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionIcon:     { width: 34, height: 34, borderRadius: 10, backgroundColor: T.glassGreen, borderWidth: 1, borderColor: T.glassGreenBorder, justifyContent: 'center', alignItems: 'center' },
  sectionTitle:    { fontSize: 15, fontWeight: '800', color: T.text },
  sectionSubtitle: { fontSize: 11, color: T.textMuted, marginTop: 1 },

  // Metric pills
  pillRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  metricPill: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1.5, minWidth: 70 },
  metricValue:{ fontSize: 16, fontWeight: '800' },
  metricLabel:{ fontSize: 10, color: T.textMuted, marginTop: 2, fontWeight: '600' },

  // NDVI bar
  ndviBarWrapper: { marginBottom: 12 },
  ndviGradient:   { height: 12, borderRadius: 6 },
  ndviMarker:     { position: 'absolute', top: -3, width: 4, height: 18, backgroundColor: T.text, borderRadius: 2, marginLeft: -2 },
  ndviAxisRow:    { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  ndviAxisLabel:  { fontSize: 9, color: T.textMuted },
  healthBadge:    { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1.5 },
  healthBadgeText:{ fontSize: 12, fontWeight: '700' },
  emptyText2:     { fontSize: 13, color: T.textMuted, marginTop: 4 },

  // VRA
  zoneRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  zoneColorBar: { width: 5, borderRadius: 3, alignSelf: 'stretch', minHeight: 48 },
  zoneHeaderRow:{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  zoneLabel:    { fontSize: 13, fontWeight: '700', color: T.text },
  zoneRate:     { fontSize: 13, fontWeight: '800' },
  zoneBarBg:    { height: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  zoneBarFill:  { height: '100%', borderRadius: 3 },
  zoneDetail:   { fontSize: 11, color: T.textMuted },
  savingsBanner:{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(26,152,80,0.15)', borderRadius: 10, padding: 10, marginTop: 4, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(26,152,80,0.25)' },
  savingsText:  { flex: 1, fontSize: 12, color: NDVI_LOW, fontWeight: '600' },
  totalRow:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingTop: 10, borderTopWidth: 1, borderTopColor: T.glassBorder },
  totalLabel:   { fontSize: 12, fontWeight: '700', color: T.text },
  totalValue:   { fontSize: 12, color: T.textMuted },

  // Soil
  scoreRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  scoreCircle:   { width: 68, height: 68, borderRadius: 34, borderWidth: 3, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  scoreNumber:   { fontSize: 22, fontWeight: '900' },
  scoreMax:      { fontSize: 10, color: T.textMuted },
  healthLabel:   { fontSize: 16, fontWeight: '800' },
  fertilityLabel:{ fontSize: 12, fontWeight: '600', color: T.textSecondary, marginTop: 2 },
  fertilityDesc: { fontSize: 11, color: T.textMuted, marginTop: 2, lineHeight: 16 },
  stressBadge:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, alignSelf: 'flex-start', marginBottom: 12 },
  stressBadgeText:{ fontSize: 12, fontWeight: '700' },
  recRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  recText:       { flex: 1, fontSize: 13, color: T.textSecondary, lineHeight: 18 },

  // Calendar
  progressBarBg:  { height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  progressBarFill:{ height: '100%', borderRadius: 4 },
  progressLabel:  { fontSize: 11, color: T.textMuted, marginBottom: 12 },
  currentStageBox:{ backgroundColor: T.glassGreen, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: T.glassGreenBorder },
  currentStageHeader:{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  currentStageName:{ fontSize: 14, fontWeight: '800', color: T.accent },
  currentStageAction:{ fontSize: 13, color: T.textSecondary, lineHeight: 18 },
  ndviAssessRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, padding: 10, marginBottom: 12 },
  ndviAssessText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 18 },
  timelineTitle:  { fontSize: 13, fontWeight: '700', color: T.text, marginBottom: 10 },
  timelineRow:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  timelineDot:    { width: 12, height: 12, borderRadius: 6, backgroundColor: T.accent, marginTop: 4, marginRight: 8, zIndex: 1 },
  timelineLine:   { position: 'absolute', left: 5.5, top: 16, width: 1, height: 28, backgroundColor: T.glassBorder },
  timelineContent:{ flex: 1, paddingBottom: 8 },
  timelineContentCurrent:{ backgroundColor: T.glassGreen, borderRadius: 10, padding: 8, marginLeft: 4, borderWidth: 1, borderColor: T.glassGreenBorder },
  timelineTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineName:   { fontSize: 13, fontWeight: '600', color: T.text },
  timelinePeriod: { fontSize: 11, color: T.textMuted },
  timelineAction: { fontSize: 12, color: T.textSecondary, marginTop: 4, lineHeight: 17 },
  nextStageRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: T.glassBorder },
  nextStageText:  { fontSize: 13, color: T.textSecondary },
  footerNote:     { fontSize: 11, color: T.textDim, textAlign: 'center', marginTop: 4 },

  // emptyText alias for NdviCard
  emptyText: { fontSize: 13, color: T.textMuted, lineHeight: 20 },
});
