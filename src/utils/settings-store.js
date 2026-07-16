/**
 * Settings persistence layer.
 * Loads, saves, and resets application settings to/from localStorage
 * with deep-merge fallback to defaults.
 */
const STORAGE_KEY = 'rageradar_settings';

const DEFAULT_SETTINGS = {
  camera: {
    detectionFps: 10,
    showPreview: true,
    showOverlay: true,
  },
  microphone: {
    volumeWeight: 0.5,
    pitchWeight: 0.3,
    noiseGateDB: -50,
  },
  fusion: {
    faceWeight: 0.65,
    audioWeight: 0.35,
    emaAlpha: 0.3,
    momentumDecay: 0.9,
  },
  alerts: {
    enabled: true,
    threshold: 70,
    cooldownMs: 30000,
    soundEnabled: true,
    soundType: 'beep',
    volume: 0.5,
  },
  sensitivity: {
    overall: 0.5,
    decaySpeed: 0.5,
  },
  cooldown: {
    enabled: true,
    threshold: 70,
    sustainedDurationMs: 60000,
    suggestionCooldownMs: 300000,
    autoShow: false,
    technique: '4-7-8',
  },
};

/**
 * Deep-merge source into target. Source values override target.
 * Both objects remain unmodified — returns a new object.
 * @param {Object} target - Base defaults
 * @param {Object} source - Overrides (e.g. stored user settings)
 * @returns {Object} Merged result
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      result[key] &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Load settings from localStorage, merged with DEFAULT_SETTINGS.
 * Missing keys fall back to defaults.
 * @returns {Object}
 */
function loadSettings() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return deepMerge(DEFAULT_SETTINGS, parsed);
    }
  } catch (e) {
    console.warn('Settings load failed:', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

/**
 * Persist settings to localStorage.
 * @param {Object} settings
 */
function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Settings save failed:', e);
  }
}

/**
 * Remove stored settings and return a fresh defaults object.
 * @returns {Object}
 */
function resetSettings() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Settings reset failed:', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

export { STORAGE_KEY, DEFAULT_SETTINGS, deepMerge, loadSettings, saveSettings, resetSettings };
