/**
 * Emotion Fusion Engine.
 * Combines camera (facial expression) and microphone (audio) signals
 * into a unified rage score using EMA smoothing, momentum tracking,
 * and hysteresis-based level transitions.
 */
import { eventBus } from '../utils/event-bus.js';
import { getRageLevel } from '../utils/rage-levels.js';

/**
 * Expression weights.
 * Positive values indicate rage-relevant expressions.
 * Negative values indicate rage-reducing expressions (happy, neutral).
 */
const EXPRESSION_WEIGHTS = {
  angry: 1.0,
  disgusted: 0.8,
  fearful: 0.7,
  sad: 0.4,
  surprised: 0.2,
  happy: -0.5,
  neutral: -0.2,
};

/** Maximum possible positive weighted sum (sum of all positive weights). */
const MAX_POSITIVE_WEIGHTED_SUM = 1.0 + 0.8 + 0.7 + 0.4 + 0.2; // 3.1

/** Default configuration values. */
const DEFAULT_CONFIG = {
  faceWeight: 0.65,
  audioWeight: 0.35,
  emaAlpha: 0.3,
  momentumDecay: 0.9,
  hysteresisTimeout: 2000,
};

export class FusionEngine {
  /**
   * @param {Object} [config] - Overrides for default configuration.
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    /** @private */
    this._lastAudio = null;
    /** @private Smoothed rage score (EMA output). */
    this._smoothedScore = 0;
    /** @private Previous raw score for momentum / rate-of-change calculation. */
    this._previousRawScore = 0;
    /** @private Current momentum value (rate of change with decay). */
    this._momentum = 0;
    /** @private Currently emitted rage level name (post-hysteresis). */
    this._currentRageLevel = 'calm';
    /** @private Pending rage level name waiting for hysteresis timeout. */
    this._pendingLevel = null;
    /** @private Timestamp when the pending level was first detected (ms). */
    this._pendingSince = 0;
    /** @private Timestamp of the last actual level change (ms). */
    this._lastLevelChangeTime = Date.now();

    // Bind handlers
    this._onExpression = this._onExpression.bind(this);
    this._onAudio = this._onAudio.bind(this);

    // Subscribe to events
    this._unsubExpression = eventBus.on('camera:expression', this._onExpression);
    this._unsubAudio = eventBus.on('mic:audio', this._onAudio);
  }

  // ============================================================
  //  Score Calculation (pure functions, no side effects)
  // ============================================================

  /**
   * Calculate a rage score (0-100) from facial expression values.
   * Uses EXPRESSION_WEIGHTS. Happy and neutral reduce the score.
   * @param {Object} expressions - { angry, disgusted, fearful, happy, neutral, sad, surprised }
   * @returns {number} Score 0-100
   */
  calculateFaceScore(expressions) {
    if (!expressions) return 0;

    let weightedSum = 0;
    for (const [emotion, value] of Object.entries(expressions)) {
      const weight = EXPRESSION_WEIGHTS[emotion];
      if (weight !== undefined) {
        weightedSum += value * weight;
      }
    }

    // Normalize to 0-100: weightedSum=0 → 0, weightedSum=MAX_POSITIVE → 100
    // Clamp negative values (when happy/neutral dominate) to 0
    const normalized = (weightedSum / MAX_POSITIVE_WEIGHTED_SUM) * 100;
    return Math.max(0, Math.min(100, normalized));
  }

  /**
   * Calculate a rage score (0-100) from an audio snapshot.
   * Only contributes when the speaker is actively speaking (isSpeaking === true).
   * @param {Object|null} audio - AudioSnapshot, or null
   * @returns {number} Score 0-100
   */
  calculateAudioScore(audio) {
    if (!audio || !audio.isSpeaking) return 0;

    // Volume (RMS 0-1) → 0-100 scale → 50% weight
    const volumeScore = audio.volumeRMS * 100;
    const volumeComponent = volumeScore * 0.5;

    // Pitch (Hz) → 0-100 scale (500 Hz maps to max) → 30% weight
    const pitchNorm = Math.min(100, (audio.pitchHz / 500) * 100);
    const pitchComponent = pitchNorm * 0.3;

    // Spectral centroid (Hz) → 0-100 scale (4000 Hz maps to max) → 20% weight
    const centroidNorm = Math.min(100, (audio.spectralCentroid / 4000) * 100);
    const centroidComponent = centroidNorm * 0.2;

    return Math.min(100, volumeComponent + pitchComponent + centroidComponent);
  }

  /**
   * Weighted combination of face and audio scores.
   * @param {number} faceScore  - 0-100
   * @param {number} audioScore - 0-100
   * @returns {number} Combined score 0-100
   */
  calculateRawScore(faceScore, audioScore) {
    const combined =
      faceScore * this.config.faceWeight +
      audioScore * this.config.audioWeight;
    return Math.max(0, Math.min(100, combined));
  }

  /**
   * Exponential Moving Average smoothing.
   * @param {number} current  - New input value
   * @param {number} previous - Previous smoothed value
   * @returns {number} Smoothed value
   */
  applyEMA(current, previous) {
    return previous + this.config.emaAlpha * (current - previous);
  }

  /**
   * Update momentum — tracks rate of change with decay.
   * @param {number} current  - Current raw score
   * @param {number} previous - Previous raw score
   * @returns {number} New momentum value
   */
  updateMomentum(current, previous) {
    this._momentum =
      this.config.momentumDecay * this._momentum + (current - previous);
    return this._momentum;
  }

  /**
   * Apply hysteresis to prevent level flickering.
   * A level change is only emitted after the score has remained in the new
   * level's range for `hysteresisTimeout` ms.
   * @param {number} score - Current rage score (0-100)
   * @returns {string} Current rage level name (post-hysteresis)
   */
  applyHysteresis(score) {
    const newLevel = getRageLevel(score).name;
    const now = Date.now();

    if (newLevel !== this._currentRageLevel) {
      // Score has entered a new level
      if (this._pendingLevel !== newLevel) {
        // First detection of this pending level
        this._pendingLevel = newLevel;
        this._pendingSince = now;
      }

      // Check if hysteresis timeout has elapsed
      if (now - this._pendingSince >= this.config.hysteresisTimeout) {
        this._currentRageLevel = newLevel;
        this._lastLevelChangeTime = now;
        this._pendingLevel = null;
      }
    } else {
      // Score is back in the same level as the emitted one — cancel pending
      this._pendingLevel = null;
    }

    return this._currentRageLevel;
  }

  /**
   * Return the current engine state (useful for testing and UI).
   * @returns {Object} Snapshot of internal state
   */
  getState() {
    return {
      smoothedScore: this._smoothedScore,
      momentum: this._momentum,
      currentRageLevel: this._currentRageLevel,
      pendingLevel: this._pendingLevel,
    };
  }

  /**
   * Clean up subscriptions. Call when the engine is no longer needed.
   */
  destroy() {
    if (this._unsubExpression) this._unsubExpression();
    if (this._unsubAudio) this._unsubAudio();
    this._unsubExpression = null;
    this._unsubAudio = null;
    this._lastAudio = null;
  }

  // ============================================================
  //  Private Event Handlers
  // ============================================================

  /**
   * Handle incoming microphone audio data.
   * @private
   * @param {Object} snapshot - AudioSnapshot
   */
  _onAudio(snapshot) {
    this._lastAudio = snapshot;
  }

  /**
   * Handle incoming camera expression detection.
   * Triggers a full fusion update: face score → audio score → raw →
   * EMA → momentum → hysteresis → emit.
   * @private
   * @param {Object} snapshot - EmotionSnapshot
   */
  _onExpression(snapshot) {
    this._update(snapshot);
  }

  /**
   * Core fusion pipeline. Called on each face detection event.
   * @private
   * @param {Object} expressionSnapshot - EmotionSnapshot from camera
   */
  _update(expressionSnapshot) {
    // 1. Face score
    const faceScore = this.calculateFaceScore(expressionSnapshot.expressions);

    // 2. Audio score (uses last buffered audio snapshot)
    const audioScore = this.calculateAudioScore(this._lastAudio);

    // 3. Blended raw score
    const rawScore = this.calculateRawScore(faceScore, audioScore);

    // 4. EMA smoothing
    this._smoothedScore = this.applyEMA(rawScore, this._smoothedScore);

    // 5. Momentum (rate of change)
    this.updateMomentum(rawScore, this._previousRawScore);
    this._previousRawScore = rawScore;

    // 6. Hysteresis for level
    const level = this.applyHysteresis(this._smoothedScore);

    // 7. Emit result
    eventBus.emit('fusion:update', {
      rawScore,
      smoothedScore: this._smoothedScore,
      faceScore,
      audioScore,
      level,
      momentum: this._momentum,
      timestamp: expressionSnapshot.timestamp,
    });
  }
}
