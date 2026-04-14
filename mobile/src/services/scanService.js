import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import * as ImageManipulator from 'expo-image-manipulator';
import { Buffer } from 'buffer';

const CACHE_KEY = 'sania_scan_history';
const MAX_CACHE = 10;

// Severity thresholds (must match severity_model_v3 training)
const SEVERITY_LABELS = [
  { max: 5,   label: 'Low',      color: '#f1c40f' },
  { max: 20,  label: 'Low',      color: '#f1c40f' },
  { max: 40,  label: 'Moderate', color: '#e67e22' },
  { max: 60,  label: 'High',     color: '#e74c3c' },
  { max: 100, label: 'Critical', color: '#8e44ad' },
];

function getSeverityCategory(pct) {
  for (const s of SEVERITY_LABELS) {
    if (pct < s.max) return { label: s.label, color: s.color };
  }
  return { label: 'Critical', color: '#8e44ad' };
}

// Disease class names — MUST match training order (alphabetical)
const CLASSES = [
  'Apple___Apple_scab',
  'Apple___Black_rot',
  'Apple___Cedar_apple_rust',
  'Apple___healthy',
  'Background_without_leaves',
  'Grape___Black_rot',
  'Grape___Esca_(Black_Measles)',
  'Grape___Leaf_blight_(Isariopsis_Leaf_Spot)',
  'Grape___healthy',
  'Potato___Early_blight',
  'Potato___Late_blight',
  'Potato___healthy',
  'Tomato___Bacterial_spot',
  'Tomato___Early_blight',
  'Tomato___Late_blight',
  'Tomato___healthy',
];

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function loadCache() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveToCache(scanResult) {
  try {
    const existing = await loadCache();
    const updated = [scanResult, ...existing].slice(0, MAX_CACHE);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updated));
  } catch {
    // cache write failure is non-fatal
  }
}

// ─── On-device TFLite inference ───────────────────────────────────────────────

let _model = null;
let _severityModel = null;

/**
 * Load the disease classification TFLite model from bundled assets.
 * Requires a native build (npx expo run:android) — throws in Expo Go.
 */
async function getModel() {
  if (_model) return _model;

  const { loadTensorflowModel } = require('react-native-fast-tflite');
  const [asset] = await Asset.loadAsync(
    require('../../assets/models/best_model.tflite')
  );
  if (!asset?.localUri) {
    throw new Error('Disease model could not be resolved to a local file URI.');
  }
  _model = await loadTensorflowModel({ url: asset.localUri });
  return _model;
}

/**
 * Load the severity segmentation TFLite model (Attention U-Net v3).
 * Input:  [1, 128, 128, 3] float32 — RGB normalized to [0, 1]
 * Output: [1, 128, 128, 1] float32 — pixel-wise disease mask
 */
async function getSeverityModel() {
  if (_severityModel) return _severityModel;

  const { loadTensorflowModel } = require('react-native-fast-tflite');
  const [asset] = await Asset.loadAsync(
    require('../../assets/models/severity_model_v3.tflite')
  );
  if (!asset?.localUri) {
    throw new Error('Severity model could not be resolved to a local file URI.');
  }
  _severityModel = await loadTensorflowModel({ url: asset.localUri });
  return _severityModel;
}

/**
 * Resize image to 128×128 and return a Float32Array normalized to [0, 1].
 * The severity model expects values in [0,1], NOT [0,255].
 */
async function preprocessForSeverity(imageUri) {
  const { base64 } = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 128, height: 128 } }],
    { format: 'jpeg', base64: true }
  );

  const jpeg = require('jpeg-js');
  const { data } = jpeg.decode(Buffer.from(base64, 'base64'), { useTArray: true });

  const float32 = new Float32Array(128 * 128 * 3);
  let j = 0;
  for (let i = 0; i < data.length; i += 4) {
    float32[j++] = data[i]     / 255.0;  // R → [0,1]
    float32[j++] = data[i + 1] / 255.0;  // G → [0,1]
    float32[j++] = data[i + 2] / 255.0;  // B → [0,1]
  }
  return float32;
}

/**
 * Run severity analysis on an image.
 * Returns { severityPct, severityLabel, severityColor } or null on failure.
 * Never throws — severity is supplementary info, not critical.
 */
async function runSeverityAnalysis(imageUri) {
  try {
    const model  = await getSeverityModel();
    const pixels = await preprocessForSeverity(imageUri);
    const outputs = await model.run([pixels]);
    const mask    = outputs?.[0]; // Float32Array of 128*128*1 = 16384 values

    if (!mask || mask.length !== 128 * 128) return null;

    // Severity % = fraction of pixels above threshold × 100
    let diseased = 0;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] > 0.5) diseased++;
    }
    const severityPct = parseFloat(((diseased / mask.length) * 100).toFixed(1));
    const { label: severityLabel, color: severityColor } = getSeverityCategory(severityPct);

    return { severityPct, severityLabel, severityColor };
  } catch {
    return null; // severity is best-effort; don't block the main result
  }
}

/**
 * Resize the image to 224×224 and decode JPEG into a flat Float32Array [0–255].
 * The model includes MobileNetV3 preprocessing internally, so raw [0,255] is correct.
 */
async function preprocessToFloat32(imageUri) {
  // Step 1: resize to 224×224, get base64 JPEG
  const { base64 } = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: 224, height: 224 } }],
    { format: 'jpeg', base64: true }
  );

  // Step 2: decode JPEG → raw RGBA bytes using jpeg-js
  const jpeg = require('jpeg-js');
  const jpegBuffer = Buffer.from(base64, 'base64');
  const { data } = jpeg.decode(jpegBuffer, { useTArray: true }); // RGBA uint8

  // Step 3: RGBA → RGB Float32 [0, 255]
  const float32 = new Float32Array(224 * 224 * 3);
  let j = 0;
  for (let i = 0; i < data.length; i += 4) {
    float32[j++] = data[i];       // R
    float32[j++] = data[i + 1];   // G
    float32[j++] = data[i + 2];   // B
    // skip alpha
  }
  return float32;
}

/**
 * Check basic image quality before running inference.
 * Returns an error string if the image should be rejected, else null.
 */
function _checkPixelQuality(float32) {
  let rSum = 0, gSum = 0, bSum = 0, total = 224 * 224;
  let min = 255, max = 0;
  for (let i = 0; i < float32.length; i += 3) {
    rSum += float32[i];
    gSum += float32[i + 1];
    bSum += float32[i + 2];
    const v = (float32[i] + float32[i + 1] + float32[i + 2]) / 3;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const brightness = (rSum + gSum + bSum) / (total * 3);
  const stdProxy = max - min; // rough spread
  const greenRatio = gSum / (rSum + gSum + bSum);

  if (brightness < 30) return 'Image is too dark. Please take the photo in good lighting.';
  if (stdProxy < 20) return 'Image appears blank or solid color. Please take a clear photo of a leaf.';
  if (greenRatio < 0.28) return 'No plant leaf detected. Please take a close-up photo of a leaf.';
  return null;
}

/**
 * Run TFLite inference on-device. Works only in native builds (not Expo Go).
 */
async function runOfflineDetection(imageUri) {
  const model = await getModel();
  const pixels = await preprocessToFloat32(imageUri);

  const qualityError = _checkPixelQuality(pixels);
  if (qualityError) {
    throw { response: { data: { detail: qualityError } } };
  }

  // react-native-fast-tflite v2: run() returns a Promise<TypedArray[]>
  const outputs = await model.run([pixels]);
  const probabilities = outputs?.[0]; // Float32Array of 16 class probabilities
  if (!probabilities || probabilities.length !== CLASSES.length) {
    throw new Error(`Model returned unexpected output (got ${probabilities?.length ?? 'undefined'} values, expected ${CLASSES.length})`);
  }

  // Build top-5
  const indexed = Array.from(probabilities).map((p, i) => ({ disease: CLASSES[i], confidence: parseFloat(p.toFixed(4)) }));
  indexed.sort((a, b) => b.confidence - a.confidence);
  const top5 = indexed.slice(0, 5);

  // If the top prediction is "no leaf", fall back to the next best disease class
  let best = top5[0];
  if (best.disease === 'Background_without_leaves') {
    const nonBg = top5.filter(t => t.disease !== 'Background_without_leaves');
    if (nonBg.length > 0) {
      best = nonBg[0];
    } else {
      throw { response: { data: { detail: 'No plant leaf detected. Please point the camera at a leaf.' } } };
    }
  }

  if (best.confidence < 0.40) {
    throw { response: { data: { detail: 'Low confidence — try a clearer, well-lit close-up photo of a leaf.' } } };
  }

  return {
    predicted_disease: best.disease,
    confidence: best.confidence,
    top5,
    offline: true,
  };
}

/**
 * Attach severity analysis result to an existing scan result object.
 * Mutates and returns the result so callers can chain it.
 */
async function attachSeverity(result, imageUri) {
  // If backend already provided severity results, skip local inference
  if (result.severity_pct != null) return result;

  const severity = await runSeverityAnalysis(imageUri);
  if (severity) {
    result.severity_pct   = severity.severityPct;
    result.severity_label = severity.severityLabel;
    result.severity_color = severity.severityColor;
  }
  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const scanService = {
  /**
   * Online: Upload image to backend and run server-side detection.
   */
  async detectDisease(imageUri, options = {}) {
    const formData = new FormData();
    formData.append('image', { uri: imageUri, name: 'plant.jpg', type: 'image/jpeg' });
    if (options.fieldId) formData.append('field_id', options.fieldId);
    if (options.cropType) formData.append('crop_type', options.cropType);
    formData.append('save_scan', options.saveScan ? 'true' : 'false');

    const response = await api.post('/scans/detect', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });

    let result = { ...response.data, offline: false };
    if (options.awaitSeverity === true) {
      result = await attachSeverity(result, imageUri);
    }
    await saveToCache({
      id: Date.now().toString(),
      predicted_disease: result.predicted_disease,
      confidence: result.confidence,
      severity_pct: result.severity_pct ?? null,
      severity_label: result.severity_label ?? null,
      crop_type: options.cropType || 'Unknown',
      created_at: new Date().toISOString(),
      offline: false,
      synced: true,
    });
    return result;
  },

  /**
   * Offline: Run detection entirely on-device using bundled TFLite model.
   * Requires a native build (npx expo run:android).
   */
  async detectDiseaseOffline(imageUri, options = {}) {
    let result = await runOfflineDetection(imageUri);
    if (options.awaitSeverity === true) {
      result = await attachSeverity(result, imageUri);
    }
    await saveToCache({
      id: Date.now().toString(),
      predicted_disease: result.predicted_disease,
      confidence: result.confidence,
      severity_pct: result.severity_pct ?? null,
      severity_label: result.severity_label ?? null,
      crop_type: options.cropType || 'Unknown',
      created_at: new Date().toISOString(),
      offline: true,
      synced: false,
    });
    return result;
  },

  async getHistory() {
    try {
      const response = await api.get('/scans/');
      return response.data;
    } catch {
      return this.getCachedHistory();
    }
  },

  async getCachedHistory() {
    return loadCache();
  },

  async syncOfflineScans() {
    const cache = await loadCache();
    const unsynced = cache.filter((s) => !s.synced && s.offline);
    if (unsynced.length === 0) return;

    for (const scan of unsynced) {
      try {
        await api.post('/scans/', {
          field_id: null,
          crop_type: scan.crop_type,
          image_url: 'offline_scan',
          predicted_disease: scan.predicted_disease,
          confidence: scan.confidence,
        });
        scan.synced = true;
      } catch {
        // retry next time we come online
      }
    }

    const updated = cache.map((s) => unsynced.find((u) => u.id === s.id) || s);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(updated));
  },

  /**
   * Compute severity in a second step so disease detection stays fast.
   */
  async computeSeverity(imageUri, predictedDisease) {
    return attachSeverity({ predicted_disease: predictedDisease }, imageUri);
  },
};
