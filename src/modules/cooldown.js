/**
 * Cooldown Engine.
 * Monitors rage patterns via EventBus and triggers cooldown suggestions
 * when rage is sustained at high levels.
 */
import { eventBus } from '../utils/event-bus.js';

const BREATHING_MESSAGES = [
  'Your rage has been high for a while. Try the 4-7-8 breathing technique.',
  'Sustained tension detected. A breathing exercise could help.',
  'High rage persisting — let\'s try a quick breathing reset.',
];

const BREAK_MESSAGES = [
  'Still running hot. Consider stepping away for a minute.',
  'Rage is staying elevated. A short break might help.',
  'Tension is sustained — maybe take a quick break?',
];

const TIP_MESSAGES = [
  'Try unclenching your jaw and relaxing your shoulders.',
  'Focus on something far away for 20 seconds.',
  'Take a slow sip of water — it can help reset your nervous system.',
  'Stretch your arms overhead and take three slow breaths.',
  'Close your eyes for 10 seconds and picture something calming.',
];

const DEFAULT_CONFIG = {
  enabled: true,
  threshold: 70,
  sustainedDurationMs: 60000,
  suggestionCooldownMs: 300000,
  autoShow: false,
  technique: '4-7-8',
};

export class CooldownEngine {
  /**
   * @param {Partial<typeof DEFAULT_CONFIG>} config
   */
  constructor(config = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config };

    this._isMonitoring = false;
    this._highRageSince = null;
    this._lastSuggestionTime = 0;
    this._rageAtSuggestion = null;
    this._unsub = null;

    /** Tracks how many suggestions have been emitted this session */
    this._suggestionCount = 0;
    /** Tracks whether the user has dismissed a breathing suggestion */
    this._breathingDismissed = false;
  }

  /**
   * Subscribe to fusion:score events and begin monitoring.
   */
  start() {
    if (this._isMonitoring) return;
    this._isMonitoring = true;
    this._unsub = eventBus.on('fusion:score', (score) => this._evaluate(score));
  }

  /**
   * Unsubscribe from events and reset tracking state.
   */
  stop() {
    if (!this._isMonitoring) return;
    this._isMonitoring = false;
    this._unsub?.();
    this._unsub = null;
    this._highRageSince = null;
  }

  /**
   * Merge partial config updates.
   * @param {Partial<typeof DEFAULT_CONFIG>} newConfig
   */
  updateConfig(newConfig) {
    Object.assign(this._config, newConfig);
  }

  /**
   * Clean up all resources.
   */
  destroy() {
    this.stop();
    this._lastSuggestionTime = 0;
    this._rageAtSuggestion = null;
    this._suggestionCount = 0;
    this._breathingDismissed = false;
  }

  /**
   * Evaluate a rage score against sustained duration and cooldown rules.
   * Called on every fusion:score event.
   * @param {object} score - { smoothed, raw, level, color, timestamp }
   */
  _evaluate(score) {
    if (!this._config.enabled) return;

    if (score.smoothed >= this._config.threshold) {
      const now = Date.now();

      if (this._highRageSince === null) {
        // Start tracking sustained high rage
        this._highRageSince = now;
      } else if (now - this._highRageSince >= this._config.sustainedDurationMs) {
        // Rage has been sustained long enough — check suggestion cooldown
        if (now - this._lastSuggestionTime >= this._config.suggestionCooldownMs) {
          this._emitSuggestion(score.smoothed);
        }
      }
    } else {
      // Rage dropped below threshold — reset sustained timer
      this._highRageSince = null;
    }
  }

  /**
   * Determine suggestion type and emit cooldown:suggestion.
   * @param {number} smoothedScore
   */
  _emitSuggestion(smoothedScore) {
    const type = this._chooseSuggestionType();
    const message = this._chooseMessage(type);

    eventBus.emit('cooldown:suggestion', {
      type,
      message,
      timestamp: Date.now(),
    });

    this._lastSuggestionTime = Date.now();
    this._rageAtSuggestion = smoothedScore;
    this._highRageSince = null;
    this._suggestionCount++;
  }

  /**
   * Choose the suggestion type based on session history.
   * - First suggestion → 'breathing'
   * - If user has dismissed breathing → 'break'
   * - Otherwise → 'tip'
   * @returns {'breathing'|'break'|'tip'}
   */
  _chooseSuggestionType() {
    if (this._suggestionCount === 0) return 'breathing';
    if (this._breathingDismissed) return 'break';
    return 'tip';
  }

  /**
   * Pick a message for the given suggestion type.
   * @param {'breathing'|'break'|'tip'} type
   * @returns {string}
   */
  _chooseMessage(type) {
    let pool;
    switch (type) {
      case 'breathing':
        pool = BREATHING_MESSAGES;
        break;
      case 'break':
        pool = BREAK_MESSAGES;
        break;
      case 'tip':
      default:
        pool = TIP_MESSAGES;
        break;
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ── Effectiveness tracking (called by UI) ──────────────────────────

  /**
   * Record that the user started a cooldown exercise.
   * @param {'breathing'|'break'|'tip'} type
   */
  recordStart(type) {
    eventBus.emit('cooldown:started', {
      type,
      startRage: this._rageAtSuggestion,
    });
  }

  /**
   * Record that the user completed a cooldown exercise.
   * @param {'breathing'|'break'|'tip'} type
   * @param {number} endRage - Current rage score at completion
   */
  recordCompletion(type, endRage) {
    const reduction = (this._rageAtSuggestion || 0) - endRage;
    eventBus.emit('cooldown:completed', {
      type,
      startRage: this._rageAtSuggestion,
      endRage,
      rageReduction: reduction,
    });
    this._rageAtSuggestion = null;
  }

  /**
   * Record that the user dismissed a suggestion.
   * @param {'breathing'|'break'|'tip'} type
   */
  recordDismissal(type) {
    if (type === 'breathing') {
      this._breathingDismissed = true;
    }
    eventBus.emit('cooldown:dismissed', { type });
    this._rageAtSuggestion = null;
  }
}
