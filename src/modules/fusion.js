/**
 * Emotion Fusion Engine.
 * Combines camera (facial expression) and microphone (audio) signals
 * into a unified rage score using EMA smoothing, momentum tracking,
 * and hysteresis-based level transitions.
 */
import { eventBus } from '../utils/event-bus.js';
import { getRageLevel } from '../utils/rage-levels.js';

/**
 * Default weights for rage score calculation.
 */
const DEFAULT_CONFIG = {
  faceWeight: 0.65,
  audioWeight: 0.35,
  emaAlpha: 0.3,           // Smoothing factor (0 = max smooth, 1 = no smooth)
  momentumDecay: 0.9,      // Momentum decay factor
  hysteresisMargin: 5,     // Points beyond boundary before level changes
  hysteresisTimeMs: 2000,  // Time in new zone before level changes
};

/**
 * Emotion expression weights for rage calculation.
 * Positive = contributes to rage, negative = reduces rage.
 */
const EXPRESSION_WEIGHTS = {
  angry: 1.0,
  disgusted: 0.6,
  fearful: 0.3,
  sad: 0.2,
  surprised: 0.15,
  happy: -0.4,
  neutral: -0.3,
};

export class FusionEngine {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this._lastFace = null;
    this._lastAudio = null;
    this._smoothedScore = 0;
    this._momentum = 0;
    this._currentLevel = 'calm';
    this._levelEnteredAt = 0;
    this._pendingLevel = null;
    this._pendingLevelSince = 0;

    // Subscribe to module events
    this._unsubFace = eventBus.on('camera:expression', (data) => {
      this._lastFace = data;
      this._update();
    });

    this._unsubAudio = eventBus.on('mic:audio', (data) => {
      this._lastAudio = data;
      // Don't trigger update from audio alone; wait for face data
    });
  }

  /**
   * Calculate raw rage score from face expressions.
   * @param {EmotionSnapshot} face
   * @returns {number} 0–100
   */
  calculateFaceScore(face) {
    if (!face) return 0;

    let score = 0;
    for (const [expression, weight] of Object.entries(EXPRESSION_WEIGHTS)) {
      score += (face.expressions[expression] || 0) * weight;
    }

    // Normalize: EXPRESSION_WEIGHTS sum of positives ≈ 2.25
    // Scale to 0–100
    return Math.max(0, Math.min(100, (score / 1.5) * 100));
  }

  /**
   * Calculate rage contribution from audio.
   * @param {AudioSnapshot} audio
   * @returns {number} 0–100
   */
  calculateAudioScore(audio) {
    if (!audio || !audio.isSpeaking) return 0;

    // Volume contribution (normalized RMS → 0-100)
    const volumeScore = Math.min(100, audio.volumeRMS * 200);

    // Pitch contribution (higher pitch → more rage, capped)
    let pitchScore = 0;
    if (audio.pitchHz > 0) {
      // Normal speech: 85-255 Hz. High rage: 300+ Hz
      pitchScore = Math.max(0, Math.min(100, ((audio.pitchHz - 150) / 200) * 100));
    }

    // Spectral centroid (brighter = more intense)
    const centroidScore = Math.min(100, (audio.spectralCentroid / 4000) * 100);

    // Weighted combination
    return (volumeScore * 0.5) + (pitchScore * 0.3) + (centroidScore * 0.2);
  }

  /**
   * Combine face + audio → raw rage score.
   * @returns {number} 0–100
   */
  calculateRawScore() {
    const faceScore = this.calculateFaceScore(this._lastFace);
    const audioScore = this.calculateAudioScore(this._lastAudio);

    // Weighted combination
    const { faceWeight, audioWeight } = this.config;
    const totalWeight = faceWeight + audioWeight;
    const raw = ((faceScore * faceWeight) + (audioScore * audioWeight)) / totalWeight;

    return Math.max(0, Math.min(100, raw));
  }

  /**
   * Apply Exponential Moving Average smoothing.
   * @param {number} rawScore
   * @returns {number} Smoothed score
   */
  applyEMA(rawScore) {
    const alpha = this.config.emaAlpha;
    this._smoothedScore = alpha * rawScore + (1 - alpha) * this._smoothedScore;
    return this._smoothedScore;
  }

  /**
   * Update momentum (rate of change).
   * @param {number} rawScore
   * @param {number} smoothedScore
   */
  updateMomentum(rawScore, smoothedScore) {
    const delta = rawScore - smoothedScore;
    this._momentum = this.config.momentumDecay * this._momentum + (1 - this.config.momentumDecay) * delta;
  }

  /**
   * Apply hysteresis to prevent level flickering at boundaries.
   * @param {number} score
   * @returns {string} Rage level name
   */
  applyHysteresis(score) {
    const newLevel = getRageLevel(score);
    const now = Date.now();

    if (newLevel.name === this._currentLevel) {
      this._pendingLevel = null;
      return this._currentLevel;
    }

    if (this._pendingLevel !== newLevel.name) {
      this._pendingLevel = newLevel.name;
      this._pendingLevelSince = now;
      return this._currentLevel;
    }

    if (now - this._pendingLevelSince >= this.config.hysteresisTimeMs) {
      this._currentLevel = newLevel.name;
      this._pendingLevel = null;
      eventBus.emit('fusion:level-change', {
        level: this._currentLevel,
        score,
        timestamp: now,
      });
      return this._currentLevel;
    }

    return this._currentLevel;
  }

  /**
   * Main update cycle — called on each new face detection.
   */
  _update() {
    const raw = this.calculateRawScore();
    const smoothed = this.applyEMA(raw);
    this.updateMomentum(raw, smoothed);
    const level = this.applyHysteresis(smoothed);
    const rageLevel = getRageLevel(smoothed);

    /** @type {RageScore} */
    const rageScore = {
      timestamp: Date.now(),
      raw: Math.round(raw * 10) / 10,
      smoothed: Math.round(smoothed * 10) / 10,
      momentum: Math.round(this._momentum * 10) / 10,
      level,
      color: rageLevel.color,
      face: this._lastFace,
      audio: this._lastAudio,
    };

    eventBus.emit('fusion:score', rageScore);
  }

  /**
   * Update fusion config (from settings).
   * @param {Partial<typeof DEFAULT_CONFIG>} newConfig
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
  }

  /**
   * Reset engine state.
   */
  reset() {
    this._smoothedScore = 0;
    this._momentum = 0;
    this._currentLevel = 'calm';
    this._lastFace = null;
    this._lastAudio = null;
    this._pendingLevel = null;
  }

  /**
   * Clean up event subscriptions.
   */
  destroy() {
    this._unsubFace?.();
    this._unsubAudio?.();
  }
}
