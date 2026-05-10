import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BrainCircuit,
  CheckCircle2,
  CloudRain,
  Droplets,
  Gauge,
  Leaf,
  Loader2,
  Play,
  RefreshCw,
  Sprout,
  SunMedium,
  Thermometer,
  Waves,
} from 'lucide-react';
import { fieldService, irrigationService, sensorService } from '../services/api';
import { useTranslation } from '../i18n';
import './IrrigationShowcase.css';

const soilPresets = {
  'Sandy Loam': { fc: 38, wp: 14, label: 'Sandy Loam' },
  Loam: { fc: 42, wp: 20, label: 'Loam' },
  'Silt Loam': { fc: 46, wp: 24, label: 'Silt Loam' },
};

const copy = {
  fr: {
    kicker: 'Automatisation irrigation',
    titleA: 'Agent Irrigation',
    titleB: 'en simulation live',
    intro: "Choisissez une parcelle, ajustez les conditions, puis lancez le modele SANIA v4.0 pour voir la decision d'irrigation.",
    field: 'Parcelle',
    liveContext: 'Contexte reel',
    controls: 'Conditions de simulation',
    run: "Lancer l'agent",
    running: 'Analyse en cours...',
    reset: 'Recharger donnees',
    decision: 'Decision agent',
    noDecision: 'Lancez le scenario pour voir la decision du modele.',
    confidence: 'Score risque',
    decisionSource: 'Source decision',
    volume: 'Volume eau',
    minutes: 'Minutes estimees',
    reason: 'Raison modele',
    model: 'Modele',
    timeline: 'Pipeline decisionnel',
    scene: 'Simulation visuelle',
    agentReady: 'Agent pret',
    agentDown: 'Agent indisponible',
    noFields: 'Aucune parcelle trouvee. Le mode demo utilise une zone virtuelle.',
    source: 'donnees champ + meteo',
    soilMoisture: 'Humidite sol',
    temperature: 'Temperature',
    humidity: 'Humidite air',
    rain: 'Pluie 24h',
    et0: 'ET0',
    cropAge: 'Age culture',
    efficiency: 'Efficacite systeme',
    soilType: 'Type sol',
    fieldCapacity: 'Capacite champ',
    wiltingPoint: 'Point fletrissement',
    area: 'Surface',
    days: 'jours',
    stepRead: 'Lecture parcelle',
    stepWeather: 'Meteo et pluie',
    stepDeficit: 'Calcul deficit SMD',
    stepPredict: 'Score risque ML',
    stepAction: 'Action irrigation',
    error: "Impossible de lancer l'agent irrigation.",
  },
  en: {
    kicker: 'Irrigation automation',
    titleA: 'Irrigation Agent',
    titleB: 'live simulation',
    intro: 'Choose a field, adjust conditions, then run the SANIA v4.0 model to see the irrigation decision.',
    field: 'Field',
    liveContext: 'Live context',
    controls: 'Simulation conditions',
    run: 'Run agent',
    running: 'Analyzing...',
    reset: 'Reload data',
    decision: 'Agent decision',
    noDecision: 'Run the scenario to see the model decision.',
    confidence: 'Risk score',
    decisionSource: 'Decision source',
    volume: 'Water volume',
    minutes: 'Estimated minutes',
    reason: 'Model reason',
    model: 'Model',
    timeline: 'Decision pipeline',
    scene: 'Visual simulation',
    agentReady: 'Agent ready',
    agentDown: 'Agent unavailable',
    noFields: 'No fields found. Demo mode uses a virtual zone.',
    source: 'field + weather data',
    soilMoisture: 'Soil moisture',
    temperature: 'Temperature',
    humidity: 'Air humidity',
    rain: 'Rain 24h',
    et0: 'ET0',
    cropAge: 'Crop age',
    efficiency: 'System efficiency',
    soilType: 'Soil type',
    fieldCapacity: 'Field capacity',
    wiltingPoint: 'Wilting point',
    area: 'Area',
    days: 'days',
    stepRead: 'Read field',
    stepWeather: 'Weather and rain',
    stepDeficit: 'Calculate SMD deficit',
    stepPredict: 'ML risk score',
    stepAction: 'Irrigation action',
    error: 'Could not run irrigation agent.',
  },
  tn: {
    kicker: 'اوتوماتيك السقي',
    titleA: 'Agent متاع السقي',
    titleB: 'سيمولاسيون لايف',
    intro: 'اختار البقعة، بدل الظروف، وبعد خلي موديل SANIA v4.0 يقرر السقي.',
    field: 'البقعة',
    liveContext: 'داتا حية',
    controls: 'ظروف السيمولاسيون',
    run: 'شغل الagent',
    running: 'يحلل...',
    reset: 'عاود حمل الداتا',
    decision: 'قرار الagent',
    noDecision: 'شغل السيناريو باش تشوف قرار الموديل.',
    confidence: 'الثقة',
    volume: 'كمية الماء',
    minutes: 'دقايق تقديرية',
    reason: 'سبب الموديل',
    model: 'الموديل',
    timeline: 'مراحل القرار',
    scene: 'سيمولاسيون مرئية',
    agentReady: 'الagent حاضر',
    agentDown: 'الagent موش حاضر',
    noFields: 'ما فماش بقع. الديمو يستعمل زون افتراضية.',
    source: 'داتا البقعة + المتيو',
    soilMoisture: 'رطوبة التربة',
    temperature: 'السخانة',
    humidity: 'رطوبة الهواء',
    rain: 'شتاء 24 ساعة',
    et0: 'ET0',
    cropAge: 'عمر الزريعة',
    efficiency: 'نجاعة السيستام',
    soilType: 'نوع التربة',
    fieldCapacity: 'قدرة التربة',
    wiltingPoint: 'نقطة الذبول',
    area: 'المساحة',
    days: 'نهار',
    stepRead: 'قراءة البقعة',
    stepWeather: 'المتيو والشتاء',
    stepDeficit: 'حساب نقص الماء',
    stepPredict: 'توقع الاحتمال',
    stepAction: 'قرار السقي',
    error: 'ما نجمناش نشغلو agent السقي.',
  },
};

const numberOr = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const pickNumber = (source, paths, fallback) => {
  for (const path of paths) {
    const value = path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), source);
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return fallback;
};

const cropKeyFromField = (field) => {
  const crop = String(field?.crop_type || field?.name || '').toLowerCase();
  if (crop.includes('potato') || crop.includes('pomme')) return 'potato';
  if (crop.includes('tomato') || crop.includes('tomate')) return 'tomato';
  if (crop.includes('grape') || crop.includes('vigne') || crop.includes('vignoble')) return 'grape';
  if (crop.includes('apple') || crop.includes('pommier')) return 'apple';
  return 'tomato';
};

const rootDepthFor = (cropKey) => ({
  potato: 0.35,
  tomato: 0.4,
  grape: 0.6,
  apple: 0.55,
}[cropKey] || 0.4);

const statusMeta = (decisionLabel) => {
  const label = String(decisionLabel || 'IDLE').toUpperCase();
  if (label === 'IRRIGATE') return { className: 'irrigate', text: 'IRRIGATE', icon: Droplets };
  if (label === 'WARNING') return { className: 'warn', text: 'WARNING', icon: Activity };
  if (label === 'WATCH') return { className: 'watch', text: 'WATCH', icon: Activity };
  if (label === 'WARN') return { className: 'watch', text: 'WATCH', icon: Activity };
  if (label === 'RAIN_GUARD') return { className: 'rain', text: 'RAIN GUARD', icon: CloudRain };
  if (label === 'SATURATED') return { className: 'skip', text: 'SATURATED', icon: CheckCircle2 };
  if (label === 'SKIP') return { className: 'skip', text: 'SKIP', icon: CheckCircle2 };
  if (label === 'ERROR') return { className: 'error', text: 'ERROR', icon: Activity };
  return { className: 'idle', text: 'READY', icon: BrainCircuit };
};

const decisionSource = (decision) => {
  const label = String(decision?.decision_label || '').toUpperCase();
  const reason = String(decision?.reason || '').toLowerCase();

  if (!decision) return '--';
  if (label === 'RAIN_GUARD' || reason.includes('rain guard')) return 'Rain guard';
  if (label === 'SATURATED' || reason.includes('saturated')) return 'Saturated guard';
  if (reason.includes('fao rule')) return 'FAO SMD threshold';
  if (reason.includes('randomforest') || reason.includes('stress_next_24h')) return 'RandomForest risk model';
  return label || '--';
};

const Slider = ({ label, icon: Icon, value, min, max, step = 1, unit, onChange }) => (
  <label className="irrigation-control">
    <span>
      <Icon size={15} />
      {label}
      <strong>{value}{unit}</strong>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  </label>
);

const IrrigationScene = ({ decision, phase, values }) => {
  const meta = statusMeta(decision?.decision_label);
  const moisture = numberOr(values.soil_moisture_pct, 35);
  const dry = moisture < 35;
  const hot = numberOr(values.temperature_C, 25) > 34;
  const raining = meta.className === 'rain' || numberOr(values.twin_rain_mm_24h, 0) > 5;
  const activeWater = meta.className === 'irrigate';
  const analyzing = phase !== 'idle' && phase !== 'done';

  return (
    <div className={`irrigation-scene ${meta.className} ${dry ? 'is-dry' : ''} ${hot ? 'is-hot' : ''} ${activeWater ? 'water-on' : ''}`}>
      <div className="irrigation-sky">
        <div className="irrigation-sun"><SunMedium size={26} /></div>
        {raining && <div className="irrigation-cloud"><CloudRain size={34} /></div>}
        {analyzing && <div className="irrigation-scan-beam" />}
      </div>

      <div className="irrigation-agent-core">
        <BrainCircuit size={28} />
        <span>{meta.text}</span>
      </div>

      <div className="irrigation-field">
        {[0, 1, 2, 3].map((row) => (
          <div className="crop-row" key={row}>
            {Array.from({ length: 9 }).map((_, index) => (
              <span className="crop-plant" key={index}>
                <Sprout size={18 + ((row + index) % 3)} />
              </span>
            ))}
          </div>
        ))}
        <div className="irrigation-main-pipe" />
        {[18, 38, 58, 78].map((left) => (
          <div className="irrigation-sprinkler" style={{ left: `${left}%` }} key={left}>
            <span />
          </div>
        ))}
        {activeWater && (
          <div className="water-layer">
            {Array.from({ length: 28 }).map((_, index) => (
              <i key={index} style={{ '--delay': `${index * 0.08}s`, '--x': `${8 + (index * 7) % 86}%` }} />
            ))}
          </div>
        )}
        {raining && (
          <div className="rain-layer">
            {Array.from({ length: 36 }).map((_, index) => (
              <i key={index} style={{ '--delay': `${index * 0.05}s`, '--x': `${(index * 11) % 100}%` }} />
            ))}
          </div>
        )}
      </div>

      <div className="irrigation-scene-metrics">
        <span><Droplets size={14} /> {Math.round(moisture)}%</span>
        <span><Thermometer size={14} /> {Math.round(numberOr(values.temperature_C, 25))}C</span>
        <span><Waves size={14} /> {Number(decision?.volume_m3 || 0).toFixed(1)} m3</span>
      </div>
    </div>
  );
};

const defaultValues = {
  soil_type: 'Loam',
  crop_age_days: 65,
  temperature_C: 28,
  humidity_pct: 55,
  soil_moisture_pct: 34,
  twin_rain_mm_24h: 0,
  twin_et0_mm: 5,
  application_efficiency_pct: 85,
};

const IrrigationShowcase = () => {
  const { language } = useTranslation();
  const c = copy[language] || copy.fr;
  const [fields, setFields] = useState([]);
  const [selectedFieldId, setSelectedFieldId] = useState(() => localStorage.getItem('sania-selected-field-id') || '');
  const [values, setValues] = useState(defaultValues);
  const [context, setContext] = useState({ sensor: null, weather: null, logs: [] });
  const [agentHealth, setAgentHealth] = useState(null);
  const [decision, setDecision] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const selectedField = useMemo(
    () => fields.find((field) => String(field.id) === String(selectedFieldId)) || fields[0] || null,
    [fields, selectedFieldId],
  );

  const cropKey = cropKeyFromField(selectedField);
  const soil = soilPresets[values.soil_type] || soilPresets.Loam;
  const areaHa = numberOr(selectedField?.area_ha, 1);
  const meta = statusMeta(decision?.decision_label);
  const MetaIcon = meta.icon;
  const estimatedMinutes = decision?.volume_m3 ? Math.max(1, Math.round((decision.volume_m3 / 3) * 60)) : 0;
  const sourceLabel = decisionSource(decision);

  const updateValue = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const hydrateFromContext = (field, sensor, weather) => {
    const weatherTemp = pickNumber(weather, ['temperature_C', 'temperature_c', 'current_weather.temperature', 'temperature'], null);
    const weatherHumidity = pickNumber(weather, ['humidity_pct', 'relative_humidity_pct', 'relative_humidity_2m', 'air_humidity_pct'], null);
    const weatherRain = pickNumber(weather, ['rain_mm_24h', 'precipitation_24h', 'daily.rain_sum.0', 'rain'], 0);
    const weatherEt0 = pickNumber(weather, ['et0_mm', 'et0_forecast_mm', 'evapotranspiration_mm'], 5);

    setValues((current) => ({
      ...current,
      temperature_C: Math.round(numberOr(weatherTemp ?? sensor?.temperature, current.temperature_C)),
      humidity_pct: Math.round(numberOr(weatherHumidity ?? sensor?.humidity, current.humidity_pct)),
      soil_moisture_pct: clamp(
        Math.round(numberOr(sensor?.soil_moisture ?? weather?.soil_moisture_surface_pct ?? weather?.soil_moisture_rootzone_pct, current.soil_moisture_pct)),
        soilPresets[current.soil_type]?.wp ?? 10,
        soilPresets[current.soil_type]?.fc ?? 45,
      ),
      twin_rain_mm_24h: Math.round(numberOr(weatherRain, current.twin_rain_mm_24h) * 10) / 10,
      twin_et0_mm: Math.round(numberOr(weatherEt0, current.twin_et0_mm) * 10) / 10,
      crop_age_days: numberOr(field?.crop_age_days, current.crop_age_days),
    }));
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [fieldsRes, healthRes] = await Promise.allSettled([
        fieldService.getFields(),
        irrigationService.getHealth(),
      ]);

      const nextFields = fieldsRes.status === 'fulfilled' ? (fieldsRes.value.data || []) : [];
      setFields(nextFields);
      setAgentHealth(healthRes.status === 'fulfilled' ? healthRes.value.data : null);

      const preferred = nextFields.find((field) => String(field.id) === String(selectedFieldId)) || nextFields[0] || null;
      if (preferred?.id) {
        setSelectedFieldId(preferred.id);
        localStorage.setItem('sania-selected-field-id', preferred.id);
      }
    } catch (err) {
      setError(c.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedField?.id) return;
    let active = true;
    const loadFieldContext = async () => {
      setError(null);
      const [sensorRes, weatherRes, logsRes] = await Promise.allSettled([
        sensorService.getHistory(selectedField.id, 7),
        sensorService.getFieldWeather(selectedField.id),
        fieldService.getIrrigationLogs(selectedField.id),
      ]);

      if (!active) return;
      const readings = sensorRes.status === 'fulfilled' ? (sensorRes.value.data || []) : [];
      const latestSensor = [...readings].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0] || null;
      const weather = weatherRes.status === 'fulfilled' ? weatherRes.value.data : null;
      const logs = logsRes.status === 'fulfilled' ? (logsRes.value.data || []) : [];
      setContext({ sensor: latestSensor, weather, logs });
      hydrateFromContext(selectedField, latestSensor, weather);
    };

    loadFieldContext();
    return () => {
      active = false;
    };
  }, [selectedField?.id]);

  const buildPayload = () => ({
    field_id: selectedField?.id || `twin_${cropKey}`,
    soil_type: values.soil_type,
    crop_age_days: Math.round(numberOr(values.crop_age_days, 65)),
    temperature_C: numberOr(values.temperature_C, 28),
    humidity_pct: numberOr(values.humidity_pct, 55),
    soil_moisture_pct: clamp(numberOr(values.soil_moisture_pct, 34), soil.wp, soil.fc),
    field_capacity_pct: soil.fc,
    wilting_point_pct: soil.wp,
    area_m2: Math.max(100, areaHa * 10000),
    root_zone_depth_m: rootDepthFor(cropKey),
    application_efficiency_pct: numberOr(values.application_efficiency_pct, 85),
    twin_et0_mm: numberOr(values.twin_et0_mm, 5),
    twin_rain_mm_24h: numberOr(values.twin_rain_mm_24h, 0),
  });

  const runAgent = async () => {
    setRunning(true);
    setError(null);
    setDecision(null);
    const phases = ['read', 'weather', 'deficit', 'predict'];
    let idx = 0;
    setPhase(phases[idx]);
    const timer = window.setInterval(() => {
      idx += 1;
      setPhase(phases[Math.min(idx, phases.length - 1)]);
    }, 520);

    try {
      const res = await irrigationService.decide(buildPayload());
      setDecision(res.data);
      setPhase('done');
    } catch (err) {
      setError(err?.response?.data?.detail || c.error);
      setPhase('idle');
    } finally {
      window.clearInterval(timer);
      setRunning(false);
    }
  };

  const timeline = [
    { key: 'read', label: c.stepRead, value: selectedField?.name || 'Demo zone' },
    { key: 'weather', label: c.stepWeather, value: `${values.twin_rain_mm_24h} mm rain` },
    { key: 'deficit', label: c.stepDeficit, value: `${values.soil_moisture_pct}% / FC ${soil.fc}%` },
    { key: 'predict', label: c.stepPredict, value: decision ? `${Math.round(decision.confidence * 100)}%` : '--' },
    { key: 'done', label: c.stepAction, value: decision?.decision_label || '--' },
  ];

  return (
    <section className="irrigation-page">
      <div className="irrigation-hero glass-card">
        <div className="irrigation-hero-copy">
          <span className="section-kicker"><Droplets size={16} /> {c.kicker}</span>
          <h1>{c.titleA} <span>{c.titleB}</span></h1>
          <p>{c.intro}</p>
        </div>
        <div className={`irrigation-agent-status ${agentHealth?.model_ready ? 'ready' : 'down'}`}>
          <BrainCircuit size={22} />
          <strong>{agentHealth?.model_ready ? c.agentReady : c.agentDown}</strong>
          <span>{agentHealth?.model_version || 'SanIA-v4.0'}</span>
        </div>
      </div>

      {loading ? (
        <div className="glass-card irrigation-loading">
          <Loader2 className="animate-spin" size={22} /> {c.liveContext}
        </div>
      ) : (
        <>
          <div className="irrigation-layout">
            <aside className="irrigation-panel glass-card">
              <div className="irrigation-panel-title">
                <Leaf size={18} />
                <div>
                  <strong>{c.field}</strong>
                  <small>{c.source}</small>
                </div>
              </div>

              {fields.length > 0 ? (
                <select
                  className="irrigation-select"
                  value={selectedField?.id || ''}
                  onChange={(event) => {
                    setSelectedFieldId(event.target.value);
                    localStorage.setItem('sania-selected-field-id', event.target.value);
                    setDecision(null);
                  }}
                >
                  {fields.map((field) => (
                    <option key={field.id} value={field.id}>{field.name}</option>
                  ))}
                </select>
              ) : (
                <p className="irrigation-empty">{c.noFields}</p>
              )}

              <div className="irrigation-context-grid">
                <span><strong>{selectedField?.crop_type || cropKey}</strong><small>Crop</small></span>
                <span><strong>{areaHa.toFixed(1)} ha</strong><small>{c.area}</small></span>
                <span><strong>{context.logs.length}</strong><small>Logs</small></span>
                <span><strong>{values.soil_moisture_pct}%</strong><small>{c.soilMoisture}</small></span>
              </div>

              <div className="irrigation-control-block">
                <div className="irrigation-panel-title compact">
                  <Gauge size={17} />
                  <strong>{c.controls}</strong>
                </div>

                <label className="irrigation-control">
                  <span><Sprout size={15} /> {c.soilType}<strong>{values.soil_type}</strong></span>
                  <select
                    className="irrigation-select compact"
                    value={values.soil_type}
                    onChange={(event) => {
                      const nextSoil = soilPresets[event.target.value] || soilPresets.Loam;
                      setValues((current) => ({
                        ...current,
                        soil_type: event.target.value,
                        soil_moisture_pct: clamp(numberOr(current.soil_moisture_pct, nextSoil.fc), nextSoil.wp, nextSoil.fc),
                      }));
                      setDecision(null);
                    }}
                  >
                    {Object.keys(soilPresets).map((key) => <option key={key} value={key}>{key}</option>)}
                  </select>
                </label>

                <Slider label={c.soilMoisture} icon={Droplets} value={clamp(values.soil_moisture_pct, soil.wp, soil.fc)} min={soil.wp} max={soil.fc} unit="%" onChange={(value) => updateValue('soil_moisture_pct', value)} />
                <Slider label={c.temperature} icon={Thermometer} value={values.temperature_C} min={5} max={48} unit="C" onChange={(value) => updateValue('temperature_C', value)} />
                <Slider label={c.humidity} icon={CloudRain} value={values.humidity_pct} min={10} max={100} unit="%" onChange={(value) => updateValue('humidity_pct', value)} />
                <Slider label={c.rain} icon={CloudRain} value={values.twin_rain_mm_24h} min={0} max={35} step={0.5} unit="mm" onChange={(value) => updateValue('twin_rain_mm_24h', value)} />
                <Slider label={c.et0} icon={SunMedium} value={values.twin_et0_mm} min={1} max={10} step={0.1} unit="mm" onChange={(value) => updateValue('twin_et0_mm', value)} />
                <Slider label={c.cropAge} icon={Leaf} value={values.crop_age_days} min={0} max={180} unit={` ${c.days}`} onChange={(value) => updateValue('crop_age_days', value)} />
                <Slider label={c.efficiency} icon={Gauge} value={values.application_efficiency_pct} min={50} max={100} unit="%" onChange={(value) => updateValue('application_efficiency_pct', value)} />
              </div>

              <button className="btn btn-outline irrigation-refresh" type="button" onClick={loadData}>
                <RefreshCw size={16} /> {c.reset}
              </button>
            </aside>

            <main className="irrigation-center">
              <div className="glass-card irrigation-scene-card">
                <div className="irrigation-section-head">
                  <div>
                    <span>{c.scene}</span>
                    <h2>{selectedField?.name || 'SANIA Demo Field'}</h2>
                  </div>
                  <button className="btn btn-primary" type="button" onClick={runAgent} disabled={running}>
                    {running ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
                    {running ? c.running : c.run}
                  </button>
                </div>
                <IrrigationScene decision={decision} phase={phase} values={values} />
              </div>

              <div className="glass-card irrigation-timeline-card">
                <div className="irrigation-panel-title compact">
                  <Activity size={17} />
                  <strong>{c.timeline}</strong>
                </div>
                <div className="irrigation-timeline">
                  {timeline.map((item, index) => {
                    const active = phase === item.key || (phase === 'done' && index < timeline.length);
                    return (
                      <div className={`irrigation-step ${active ? 'active' : ''}`} key={item.key}>
                        <span>{index + 1}</span>
                        <strong>{item.label}</strong>
                        <small>{item.value}</small>
                      </div>
                    );
                  })}
                </div>
              </div>
            </main>

            <aside className="irrigation-panel glass-card decision-panel">
              <div className="irrigation-panel-title">
                <MetaIcon size={18} />
                <div>
                  <strong>{c.decision}</strong>
                  <small>{decision?.model_version || c.noDecision}</small>
                </div>
              </div>

              <div className={`decision-badge ${meta.className}`}>
                <MetaIcon size={26} />
                <span>{meta.text}</span>
              </div>

              <div className="decision-metrics">
                <span>
                  <small>{c.confidence}</small>
                  <strong>{decision ? `${Math.round(decision.confidence * 100)}%` : '--'}</strong>
                </span>
                <span>
                  <small>{c.volume}</small>
                  <strong>{decision ? `${Number(decision.volume_m3 || 0).toFixed(1)} m3` : '--'}</strong>
                </span>
                <span>
                  <small>{c.minutes}</small>
                  <strong>{decision ? `${estimatedMinutes} min` : '--'}</strong>
                </span>
              </div>

              <div className="decision-reason">
                <small>{c.decisionSource || 'Decision source'}</small>
                <p>{sourceLabel}</p>
              </div>

              <div className="decision-reason">
                <small>{c.reason}</small>
                <p>{decision?.reason || c.noDecision}</p>
              </div>

              <div className="decision-reason compact">
                <small>{c.model}</small>
                <p>{decision?.model_version || agentHealth?.model_version || 'SanIA-v4.0-Production'}</p>
              </div>

              <div className="irrigation-context-grid tight">
                <span><strong>{soil.fc}%</strong><small>{c.fieldCapacity}</small></span>
                <span><strong>{soil.wp}%</strong><small>{c.wiltingPoint}</small></span>
                <span><strong>{rootDepthFor(cropKey)}m</strong><small>Root zone</small></span>
                <span><strong>{decision?.lag_features_used ?? 0}</strong><small>Lags</small></span>
              </div>

              {error && <div className="irrigation-error">{error}</div>}
            </aside>
          </div>
        </>
      )}
    </section>
  );
};

export default IrrigationShowcase;
