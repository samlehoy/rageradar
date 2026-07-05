/**
 * Alert system.
 * Monitors rage score and triggers alerts when thresholds are crossed.
 */
import { eventBus } from '../utils/event-bus.js';
import { getRageLevel } from '../utils/rage-levels.js';

const DEFAULT_ALERT_CONFIG = {
  enabled: true,
  threshold: 70,
  cooldownMs: 30000,
  soundEnabled: true,
  soundType: 'beep',
  volume: 0.5,
};

const RAGE_MESSAGES = {
  calm: 'Everything is fine.',
  focused: 'Slight elevation detected.',
  tense: 'Tension is building.',
  angry: 'Rage level rising — take a breath.',
  rage: 'CRITICAL — rage threshold exceeded!',
};

const RAGE_EMOJIS = {
  calm: '😌',
  focused: '🙂',
  tense: '😬',
  angry: '😠',
  rage: '🤬',
};

export class AlertSystem {
  constructor(config = {}) {
    this.config = { ...DEFAULT_ALERT_CONFIG, ...config };
    this._lastAlertTime = 0;
    this._oscillator = null;
    this._gainNode = null;
    this._audioContext = null;

    this._unsubScore = eventBus.on('fusion:score', (rageScore) => {
      this._evaluate(rageScore);
    });
  }

  /**
   * Evaluate a rage score against threshold and cooldown.
   * @param {RageScore} rageScore
   */
  _evaluate(rageScore) {
    if (!this.config.enabled) return;
    if (rageScore.smoothed < this.config.threshold) return;

    const now = Date.now();
    if (now - this._lastAlertTime < this.config.cooldownMs) return;
    this._lastAlertTime = now;

    const level = rageScore.level || getRageLevel(rageScore.smoothed).name;

    eventBus.emit('alert:triggered', {
      score: rageScore.smoothed,
      level,
      color: rageScore.color,
      emoji: RAGE_EMOJIS[level] || '⚠️',
      timestamp: now,
      message: this.getMessage(level),
    });

    if (this.config.soundEnabled) {
      this._playAlertSound();
    }
  }

  /**
   * Get alert message for a rage level.
   * @param {string} level
   * @returns {string}
   */
  getMessage(level) {
    return RAGE_MESSAGES[level] || 'Alert triggered.';
  }

  /**
   * Play alert sound using Web Audio API.
   */
  _playAlertSound() {
    try {
      if (!this._audioContext) {
        this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this._audioContext.state === 'suspended') {
        this._audioContext.resume();
      }

      const ctx = this._audioContext;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      const { soundType, volume } = this.config;

      switch (soundType) {
        case 'alarm':
          oscillator.type = 'sawtooth';
          oscillator.frequency.value = 600;
          break;
        case 'gaming':
          oscillator.type = 'square';
          oscillator.frequency.value = 440;
          break;
        case 'beep':
        default:
          oscillator.type = 'sine';
          oscillator.frequency.value = 800;
          break;
      }

      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);

      oscillator.onended = () => {
        oscillator.disconnect();
        gainNode.disconnect();
      };
    } catch (err) {
      // Audio not available — fail silently
      console.warn('AlertSystem: could not play sound', err);
    }
  }

  /**
   * Update alert configuration.
   * @param {Partial<typeof DEFAULT_ALERT_CONFIG>} newConfig
   */
  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
  }

  /**
   * Clean up event subscriptions and audio resources.
   */
  destroy() {
    this._unsubScore?.();
    if (this._audioContext) {
      this._audioContext.close();
      this._audioContext = null;
    }
  }
}
