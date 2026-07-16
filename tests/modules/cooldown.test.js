import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CooldownEngine } from '../../src/modules/cooldown.js';
import { eventBus } from '../../src/utils/event-bus.js';

beforeEach(() => {
  vi.useFakeTimers();
  eventBus.clear();
});

afterEach(() => {
  vi.useRealTimers();
  eventBus.clear();
});

/**
 * Helper: emit a fusion:score event with the given smoothed value.
 */
function emitScore(smoothed) {
  eventBus.emit('fusion:score', {
    smoothed,
    raw: smoothed,
    level: smoothed >= 80 ? 'rage' : smoothed >= 60 ? 'angry' : 'calm',
    color: '#f97316',
    timestamp: Date.now(),
  });
}

describe('CooldownEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new CooldownEngine({
      sustainedDurationMs: 60000,
      suggestionCooldownMs: 300000,
      threshold: 70,
    });
  });

  afterEach(() => {
    engine.destroy();
  });

  // ── 1. Does not emit when disabled ──────────────────────────────────

  describe('disabled state', () => {
    it('should not emit cooldown:suggestion when disabled', () => {
      engine.updateConfig({ enabled: false });
      engine.start();

      const handler = vi.fn();
      eventBus.on('cooldown:suggestion', handler);

      // Emit high scores for longer than sustained duration
      emitScore(90);
      vi.advanceTimersByTime(70000);
      emitScore(90);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ── 2. Does not emit when score is below threshold ──────────────────

  describe('below threshold', () => {
    it('should not emit cooldown:suggestion for scores below threshold', () => {
      engine.start();

      const handler = vi.fn();
      eventBus.on('cooldown:suggestion', handler);

      emitScore(50);
      vi.advanceTimersByTime(70000);
      emitScore(50);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ── 3. Does not emit if rage duration < sustainedDurationMs ─────────

  describe('insufficient sustained duration', () => {
    it('should not emit if rage has not been sustained long enough', () => {
      engine.start();

      const handler = vi.fn();
      eventBus.on('cooldown:suggestion', handler);

      // First score starts the timer
      emitScore(80);
      // Advance less than sustained duration
      vi.advanceTimersByTime(30000);
      emitScore(80);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ── 4. Emits cooldown:suggestion after sustained high rage ──────────

  describe('sustained high rage', () => {
    it('should emit cooldown:suggestion after sustained high rage', () => {
      engine.start();

      const handler = vi.fn();
      eventBus.on('cooldown:suggestion', handler);

      // First score starts tracking
      emitScore(80);
      // Advance past sustained duration
      vi.advanceTimersByTime(61000);
      // Second score triggers emission
      emitScore(80);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.any(String),
          message: expect.any(String),
          timestamp: expect.any(Number),
        }),
      );
    });
  });

  // ── 5. Respects suggestion cooldown period ──────────────────────────

  describe('suggestion cooldown', () => {
    it('should not emit a second suggestion within suggestionCooldownMs', () => {
      engine.start();

      const handler = vi.fn();
      eventBus.on('cooldown:suggestion', handler);

      // Trigger first suggestion
      emitScore(80);
      vi.advanceTimersByTime(61000);
      emitScore(80);
      expect(handler).toHaveBeenCalledTimes(1);

      // Try to trigger again before cooldown expires
      emitScore(80);
      vi.advanceTimersByTime(61000);
      emitScore(80);
      expect(handler).toHaveBeenCalledTimes(1); // still 1

      // Advance past suggestion cooldown
      vi.advanceTimersByTime(300000);
      emitScore(80);
      vi.advanceTimersByTime(61000);
      emitScore(80);
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  // ── 6. Resets timer when score drops below threshold ────────────────

  describe('threshold reset', () => {
    it('should reset sustained timer when score drops below threshold', () => {
      engine.start();

      const handler = vi.fn();
      eventBus.on('cooldown:suggestion', handler);

      // Start tracking
      emitScore(80);
      vi.advanceTimersByTime(50000);
      // Drop below threshold — resets the timer
      emitScore(40);

      // Start over
      emitScore(80);
      vi.advanceTimersByTime(50000);
      // Still not past sustained duration since reset
      emitScore(80);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ── 7. updateConfig() changes behavior ──────────────────────────────

  describe('updateConfig', () => {
    it('should use updated threshold after updateConfig()', () => {
      engine.start();

      const handler = vi.fn();
      eventBus.on('cooldown:suggestion', handler);

      // Raise threshold so 80 is no longer above it
      engine.updateConfig({ threshold: 90 });

      emitScore(80);
      vi.advanceTimersByTime(61000);
      emitScore(80);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should use updated sustainedDurationMs after updateConfig()', () => {
      engine.start();

      const handler = vi.fn();
      eventBus.on('cooldown:suggestion', handler);

      // Shorten sustained duration to 10s
      engine.updateConfig({ sustainedDurationMs: 10000 });

      emitScore(80);
      vi.advanceTimersByTime(11000);
      emitScore(80);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ── 8. recordStart / recordCompletion / recordDismissal ─────────────

  describe('effectiveness tracking', () => {
    it('recordStart() should emit cooldown:started with startRage', () => {
      engine.start();

      // Trigger a suggestion first to set _rageAtSuggestion
      emitScore(85);
      vi.advanceTimersByTime(61000);
      emitScore(85);

      const handler = vi.fn();
      eventBus.on('cooldown:started', handler);

      engine.recordStart('breathing');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'breathing',
          startRage: 85,
        }),
      );
    });

    it('recordCompletion() should emit cooldown:completed with rage reduction', () => {
      engine.start();

      // Trigger suggestion
      emitScore(90);
      vi.advanceTimersByTime(61000);
      emitScore(90);

      const handler = vi.fn();
      eventBus.on('cooldown:completed', handler);

      engine.recordCompletion('breathing', 40);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'breathing',
          startRage: 90,
          endRage: 40,
          rageReduction: 50,
        }),
      );
    });

    it('recordDismissal() should emit cooldown:dismissed', () => {
      engine.start();

      const handler = vi.fn();
      eventBus.on('cooldown:dismissed', handler);

      engine.recordDismissal('breathing');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'breathing' }),
      );
    });

    it('recordCompletion() should clear _rageAtSuggestion', () => {
      engine.start();

      emitScore(85);
      vi.advanceTimersByTime(61000);
      emitScore(85);

      engine.recordCompletion('breathing', 40);

      // After completion, _rageAtSuggestion should be null
      const handler = vi.fn();
      eventBus.on('cooldown:started', handler);
      engine.recordStart('breathing');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ startRage: null }),
      );
    });
  });

  // ── 9. Suggestion type starts with 'breathing' ─────────────────────

  describe('suggestion types', () => {
    it('should emit type "breathing" for the first suggestion', () => {
      engine.start();

      const handler = vi.fn();
      eventBus.on('cooldown:suggestion', handler);

      emitScore(80);
      vi.advanceTimersByTime(61000);
      emitScore(80);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'breathing' }),
      );
    });

    it('should emit type "break" after breathing is dismissed', () => {
      engine.start();

      const suggestionHandler = vi.fn();
      eventBus.on('cooldown:suggestion', suggestionHandler);

      // First suggestion (breathing)
      emitScore(80);
      vi.advanceTimersByTime(61000);
      emitScore(80);
      expect(suggestionHandler).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'breathing' }),
      );

      // User dismisses breathing
      engine.recordDismissal('breathing');

      // Advance past suggestion cooldown and trigger again
      vi.advanceTimersByTime(300000);
      emitScore(80);
      vi.advanceTimersByTime(61000);
      emitScore(80);

      expect(suggestionHandler).toHaveBeenCalledTimes(2);
      expect(suggestionHandler).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'break' }),
      );
    });

    it('should emit type "tip" for subsequent suggestions when breathing was not dismissed', () => {
      engine.start();

      const suggestionHandler = vi.fn();
      eventBus.on('cooldown:suggestion', suggestionHandler);

      // First suggestion (breathing)
      emitScore(80);
      vi.advanceTimersByTime(61000);
      emitScore(80);

      // Accept it (not dismiss)
      engine.recordStart('breathing');
      engine.recordCompletion('breathing', 40);

      // Advance past suggestion cooldown and trigger again
      vi.advanceTimersByTime(300000);
      emitScore(80);
      vi.advanceTimersByTime(61000);
      emitScore(80);

      expect(suggestionHandler).toHaveBeenCalledTimes(2);
      expect(suggestionHandler).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: 'tip' }),
      );
    });
  });

  // ── 10. start() / stop() manage subscription correctly ──────────────

  describe('start / stop lifecycle', () => {
    it('should not process scores before start() is called', () => {
      const handler = vi.fn();
      eventBus.on('cooldown:suggestion', handler);

      emitScore(80);
      vi.advanceTimersByTime(61000);
      emitScore(80);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should not process scores after stop() is called', () => {
      engine.start();
      engine.stop();

      const handler = vi.fn();
      eventBus.on('cooldown:suggestion', handler);

      emitScore(80);
      vi.advanceTimersByTime(61000);
      emitScore(80);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should resume processing after stop() then start()', () => {
      engine.start();
      engine.stop();
      engine.start();

      const handler = vi.fn();
      eventBus.on('cooldown:suggestion', handler);

      emitScore(80);
      vi.advanceTimersByTime(61000);
      emitScore(80);

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should reset _highRageSince on stop()', () => {
      engine.start();

      // Start tracking high rage
      emitScore(80);
      vi.advanceTimersByTime(50000);

      // Stop and start again — timer should be reset
      engine.stop();
      engine.start();

      const handler = vi.fn();
      eventBus.on('cooldown:suggestion', handler);

      // Only 15s after restart — not enough
      vi.advanceTimersByTime(15000);
      emitScore(80);

      expect(handler).not.toHaveBeenCalled();
    });

    it('start() should be idempotent — calling twice should not double-subscribe', () => {
      engine.start();
      engine.start();

      const handler = vi.fn();
      eventBus.on('cooldown:suggestion', handler);

      emitScore(80);
      vi.advanceTimersByTime(61000);
      emitScore(80);

      // Should only fire once, not twice
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
