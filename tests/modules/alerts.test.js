import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AlertSystem } from '../../src/modules/alerts.js';
import { eventBus } from '../../src/utils/event-bus.js';

/**
 * Install a mock AudioContext on window for testing sound paths.
 * jsdom does not provide Web Audio API by default.
 */
function installMockAudioContext() {
  const mockOscillator = {
    type: '',
    frequency: { value: 0 },
    connect: vi.fn().mockReturnThis(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
    onended: null,
  };

  const mockGainNode = {
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };

  window.AudioContext = class {
    constructor() {
      this.state = 'running';
      this.currentTime = 0;
    }
    createOscillator() { return Object.create(mockOscillator); }
    createGain() { return Object.create(mockGainNode); }
    resume() { this.state = 'running'; }
    close() { return Promise.resolve(); }
  };
}

describe('AlertSystem', () => {
  let alertSystem;

  beforeEach(() => {
    eventBus.clear();
    alertSystem = new AlertSystem({ soundEnabled: false });
  });

  afterEach(() => {
    alertSystem.destroy();
  });

  it('should initialize with default config', () => {
    expect(alertSystem.config.enabled).toBe(true);
    expect(alertSystem.config.threshold).toBe(70);
    expect(alertSystem.config.cooldownMs).toBe(30000);
    expect(alertSystem.config.soundEnabled).toBe(false);
  });

  it('should accept custom config', () => {
    const custom = new AlertSystem({ threshold: 50, cooldownMs: 5000 });
    expect(custom.config.threshold).toBe(50);
    expect(custom.config.cooldownMs).toBe(5000);
    custom.destroy();
  });

  describe('getMessage', () => {
    it('should return correct message for each level', () => {
      expect(alertSystem.getMessage('calm')).toBe('Everything is fine.');
      expect(alertSystem.getMessage('focused')).toBe('Slight elevation detected.');
      expect(alertSystem.getMessage('tense')).toBe('Tension is building.');
      expect(alertSystem.getMessage('angry')).toBe('Rage level rising — take a breath.');
      expect(alertSystem.getMessage('rage')).toBe('CRITICAL — rage threshold exceeded!');
    });

    it('should return default message for unknown level', () => {
      expect(alertSystem.getMessage('unknown')).toBe('Alert triggered.');
    });
  });

  describe('_evaluate', () => {
    beforeEach(() => {
      alertSystem._lastAlertTime = 0;
    });

    it('should emit alert:triggered when score exceeds threshold', () => {
      const listener = vi.fn();
      eventBus.on('alert:triggered', listener);

      alertSystem._evaluate({ smoothed: 85, level: 'rage', color: '#ef4444' });

      expect(listener).toHaveBeenCalledOnce();
      const alert = listener.mock.calls[0][0];
      expect(alert.score).toBe(85);
      expect(alert.level).toBe('rage');
      expect(alert.color).toBe('#ef4444');
      expect(alert.emoji).toBe('🤬');
      expect(alert.message).toBe('CRITICAL — rage threshold exceeded!');
      expect(alert).toHaveProperty('timestamp');
    });

    it('should not alert when disabled', () => {
      alertSystem.updateConfig({ enabled: false });
      const listener = vi.fn();
      eventBus.on('alert:triggered', listener);

      alertSystem._evaluate({ smoothed: 90, level: 'rage', color: '#ef4444' });
      expect(listener).not.toHaveBeenCalled();
    });

    it('should not alert when score is below threshold', () => {
      const listener = vi.fn();
      eventBus.on('alert:triggered', listener);

      alertSystem._evaluate({ smoothed: 30, level: 'calm', color: '#22c55e' });
      expect(listener).not.toHaveBeenCalled();
    });

    it('should respect cooldown period', () => {
      const listener = vi.fn();
      eventBus.on('alert:triggered', listener);

      alertSystem._evaluate({ smoothed: 85, level: 'rage' });
      expect(listener).toHaveBeenCalledTimes(1);

      alertSystem._evaluate({ smoothed: 90, level: 'rage' });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should allow alert after cooldown expires', () => {
      const listener = vi.fn();
      eventBus.on('alert:triggered', listener);

      alertSystem._evaluate({ smoothed: 85, level: 'rage' });
      expect(listener).toHaveBeenCalledTimes(1);

      alertSystem._lastAlertTime = Date.now() - 60000;

      alertSystem._evaluate({ smoothed: 85, level: 'rage' });
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('should infer level via getRageLevel when level field is missing', () => {
      const listener = vi.fn();
      eventBus.on('alert:triggered', listener);

      alertSystem._evaluate({ smoothed: 70, color: '#f97316' });

      expect(listener).toHaveBeenCalled();
      const alert = listener.mock.calls[0][0];
      expect(alert.level).toBe('angry');
    });
  });

  describe('updateConfig', () => {
    it('should update threshold in real-time', () => {
      const listener = vi.fn();
      eventBus.on('alert:triggered', listener);

      alertSystem._evaluate({ smoothed: 60, level: 'tense' });
      expect(listener).not.toHaveBeenCalled();

      alertSystem.updateConfig({ threshold: 50 });
      alertSystem._lastAlertTime = 0;

      alertSystem._evaluate({ smoothed: 60, level: 'tense' });
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe('sound', () => {
    beforeEach(() => {
      installMockAudioContext();
    });

    it('should play alert sound and emit alert:triggered', () => {
      alertSystem.destroy();
      const withSound = new AlertSystem({ threshold: 50, soundEnabled: true, cooldownMs: 100 });
      withSound._lastAlertTime = 0;

      const listener = vi.fn();
      eventBus.on('alert:triggered', listener);

      expect(() => {
        eventBus.emit('fusion:score', { smoothed: 80, level: 'angry', color: '#f97316' });
      }).not.toThrow();

      expect(listener).toHaveBeenCalled();
      withSound.destroy();
    });

    it('should handle suspended audio context by resuming', () => {
      window.AudioContext = class {
        constructor() {
          this.state = 'suspended';
          this.currentTime = 0;
        }
        createOscillator() {
          return Object.create({ type: '', frequency: { value: 0 }, connect: vi.fn().mockReturnThis(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn(), onended: null });
        }
        createGain() {
          return Object.create({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() });
        }
        resume() { this.state = 'running'; }
        close() { return Promise.resolve(); }
      };

      alertSystem.destroy();
      const withSound = new AlertSystem({ threshold: 50, soundEnabled: true, cooldownMs: 100 });
      withSound._lastAlertTime = 0;

      const listener = vi.fn();
      eventBus.on('alert:triggered', listener);

      expect(() => {
        eventBus.emit('fusion:score', { smoothed: 80, level: 'angry', color: '#f97316' });
      }).not.toThrow();

      expect(listener).toHaveBeenCalled();
      withSound.destroy();
    });

    it('should use alarm sound type', () => {
      alertSystem.destroy();
      const withSound = new AlertSystem({ threshold: 50, soundEnabled: true, cooldownMs: 100, soundType: 'alarm' });
      withSound._lastAlertTime = 0;

      const listener = vi.fn();
      eventBus.on('alert:triggered', listener);

      expect(() => {
        eventBus.emit('fusion:score', { smoothed: 80, level: 'angry', color: '#f97316' });
      }).not.toThrow();

      expect(listener).toHaveBeenCalled();
      withSound.destroy();
    });

    it('should use gaming sound type', () => {
      alertSystem.destroy();
      const withSound = new AlertSystem({ threshold: 50, soundEnabled: true, cooldownMs: 100, soundType: 'gaming' });
      withSound._lastAlertTime = 0;

      const listener = vi.fn();
      eventBus.on('alert:triggered', listener);

      expect(() => {
        eventBus.emit('fusion:score', { smoothed: 80, level: 'angry', color: '#f97316' });
      }).not.toThrow();

      expect(listener).toHaveBeenCalled();
      withSound.destroy();
    });

    it('should close AudioContext on destroy when present', () => {
      alertSystem.destroy();
      const withSound = new AlertSystem({ threshold: 50, soundEnabled: true, cooldownMs: 100 });
      withSound._lastAlertTime = 0;

      withSound._evaluate({ smoothed: 80, level: 'angry' });

      const closeSpy = vi.spyOn(withSound._audioContext, 'close');
      withSound.destroy();

      expect(closeSpy).toHaveBeenCalled();
      expect(withSound._audioContext).toBeNull();
    });

    it('should fail silently when AudioContext constructor throws', () => {
      delete window.AudioContext;

      alertSystem.destroy();
      const withSound = new AlertSystem({ threshold: 50, soundEnabled: true, cooldownMs: 100 });
      withSound._lastAlertTime = 0;

      const listener = vi.fn();
      eventBus.on('alert:triggered', listener);

      expect(() => {
        eventBus.emit('fusion:score', { smoothed: 80, level: 'angry', color: '#f97316' });
      }).not.toThrow();

      expect(listener).toHaveBeenCalled();
      withSound.destroy();
    });
  });

  describe('destroy', () => {
    it('should unsubscribe from fusion:score events', () => {
      const listener = vi.fn();
      eventBus.on('alert:triggered', listener);

      alertSystem.destroy();

      eventBus.emit('fusion:score', { smoothed: 90, level: 'rage', color: '#ef4444' });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('integration via event bus', () => {
    beforeEach(() => {
      alertSystem._lastAlertTime = 0;
    });

    it('should respond to fusion:score events', () => {
      const listener = vi.fn();
      eventBus.on('alert:triggered', listener);

      eventBus.emit('fusion:score', { smoothed: 85, level: 'rage', color: '#ef4444' });

      expect(listener).toHaveBeenCalledOnce();
    });

    it('should play sound and emit alert when sound is enabled', () => {
      installMockAudioContext();
      alertSystem.destroy();

      const withSound = new AlertSystem({ threshold: 50, soundEnabled: true, cooldownMs: 100 });
      withSound._lastAlertTime = 0;

      const listener = vi.fn();
      eventBus.on('alert:triggered', listener);

      expect(() => {
        eventBus.emit('fusion:score', { smoothed: 80, level: 'angry', color: '#f97316' });
      }).not.toThrow();

      expect(listener).toHaveBeenCalled();
      withSound.destroy();
    });
  });
});
