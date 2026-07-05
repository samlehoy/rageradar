import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FusionEngine } from '../../src/modules/fusion.js';
import { eventBus } from '../../src/utils/event-bus.js';

// Mock helper: create an EmotionSnapshot
function makeFace(overrides = {}) {
  return {
    timestamp: Date.now(),
    expressions: {
      angry: 0, disgusted: 0, fearful: 0,
      happy: 0, neutral: 1, sad: 0, surprised: 0,
      ...overrides,
    },
    dominant: 'neutral',
    confidence: 1.0,
  };
}

// Mock helper: create an AudioSnapshot
function makeAudio(overrides = {}) {
  return {
    timestamp: Date.now(),
    volumeRMS: 0.0,
    volumeDB: -100,
    pitchHz: 0,
    spectralCentroid: 0,
    isSpeaking: false,
    ...overrides,
  };
}

describe('FusionEngine', () => {
  let engine;

  beforeEach(() => {
    eventBus.clear();
    engine = new FusionEngine();
  });

  afterEach(() => {
    engine.destroy();
  });

  describe('calculateFaceScore', () => {
    it('should return low score for neutral face', () => {
      const face = makeFace({ neutral: 1.0 });
      const score = engine.calculateFaceScore(face);
      expect(score).toBeLessThan(20);
    });

    it('should return high score for angry face', () => {
      const face = makeFace({ angry: 0.9, neutral: 0.1 });
      const score = engine.calculateFaceScore(face);
      expect(score).toBeGreaterThan(50);
    });

    it('should return low score for happy face', () => {
      const face = makeFace({ happy: 0.9, neutral: 0.1 });
      const score = engine.calculateFaceScore(face);
      expect(score).toBeLessThan(10);
    });

    it('should return 0 for null face', () => {
      expect(engine.calculateFaceScore(null)).toBe(0);
    });

    it('should handle mixed expressions', () => {
      const face = makeFace({ angry: 0.5, disgusted: 0.3, neutral: 0.2 });
      const score = engine.calculateFaceScore(face);
      expect(score).toBeGreaterThan(30);
      expect(score).toBeLessThan(80);
    });

    it('should return 0 when all expressions are 0', () => {
      const face = makeFace({ neutral: 0, angry: 0, happy: 0, sad: 0, surprised: 0, fearful: 0, disgusted: 0 });
      const score = engine.calculateFaceScore(face);
      expect(score).toBe(0);
    });
  });

  describe('calculateAudioScore', () => {
    it('should return 0 for silence', () => {
      const audio = makeAudio({ isSpeaking: false });
      expect(engine.calculateAudioScore(audio)).toBe(0);
    });

    it('should return higher score for loud speech', () => {
      const quiet = makeAudio({ volumeRMS: 0.1, isSpeaking: true, pitchHz: 150 });
      const loud = makeAudio({ volumeRMS: 0.8, isSpeaking: true, pitchHz: 150 });
      expect(engine.calculateAudioScore(loud)).toBeGreaterThan(engine.calculateAudioScore(quiet));
    });

    it('should return higher score for high pitch', () => {
      const lowPitch = makeAudio({ volumeRMS: 0.3, isSpeaking: true, pitchHz: 120 });
      const highPitch = makeAudio({ volumeRMS: 0.3, isSpeaking: true, pitchHz: 400 });
      expect(engine.calculateAudioScore(highPitch)).toBeGreaterThan(engine.calculateAudioScore(lowPitch));
    });

    it('should return 0 for null audio', () => {
      expect(engine.calculateAudioScore(null)).toBe(0);
    });

    it('should return moderate score with isSpeaking but minimal volume', () => {
      const audio = makeAudio({ volumeRMS: 0.01, isSpeaking: true, pitchHz: 150, spectralCentroid: 500 });
      const score = engine.calculateAudioScore(audio);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(20);
    });

    it('should cap volume score at 100 for very high RMS', () => {
      const audio = makeAudio({ volumeRMS: 2.0, isSpeaking: true, pitchHz: 150, spectralCentroid: 1000 });
      const score = engine.calculateAudioScore(audio);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('applyEMA', () => {
    it('should smooth rapid changes', () => {
      engine.applyEMA(0); // Initialize
      const result1 = engine.applyEMA(100); // Sudden spike
      expect(result1).toBeLessThan(100); // Should be smoothed
      expect(result1).toBeGreaterThan(0);
    });

    it('should converge to stable input over time', () => {
      let smoothed = 0;
      for (let i = 0; i < 50; i++) {
        smoothed = engine.applyEMA(75);
      }
      expect(smoothed).toBeCloseTo(75, 0); // Should converge
    });

    it('should reach within 1 of constant 75 after 50 iterations', () => {
      engine.applyEMA(0);
      let smoothed = 0;
      for (let i = 0; i < 50; i++) {
        smoothed = engine.applyEMA(75);
      }
      expect(Math.abs(smoothed - 75)).toBeLessThan(1);
    });

    it('should converge to 0 when input drops to 0', () => {
      engine.applyEMA(0);
      for (let i = 0; i < 10; i++) engine.applyEMA(100);
      let smoothed = 100;
      for (let i = 0; i < 50; i++) {
        smoothed = engine.applyEMA(0);
      }
      expect(smoothed).toBeCloseTo(0, 0);
    });

    it('should handle rapid alternating 0 and 100 (jitter test)', () => {
      engine.applyEMA(0);
      let smoothed = 0;
      // Alternating extremes should produce a moderate value
      for (let i = 0; i < 20; i++) {
        smoothed = engine.applyEMA(i % 2 === 0 ? 100 : 0);
      }
      // With alpha=0.3, 20 iterations of alternating input should converge to ~50
      expect(smoothed).toBeGreaterThan(30);
      expect(smoothed).toBeLessThan(70);
    });
  });

  describe('applyHysteresis', () => {
    it('should not change level immediately at boundary', () => {
      engine._currentLevel = 'calm';
      const level = engine.applyHysteresis(25); // Just into 'focused' zone
      expect(level).toBe('calm'); // Should stay
    });

    it('should change level after hysteresis timeout', () => {
      engine._currentLevel = 'calm';
      engine._pendingLevel = 'focused';
      engine._pendingLevelSince = Date.now() - 3000; // 3s ago (> 2s threshold)
      const level = engine.applyHysteresis(30);
      expect(level).toBe('focused');
    });

    it('should cross calm -> focused -> calm with rapid fluctuation', () => {
      // Start calm
      engine._currentLevel = 'calm';
      engine._pendingLevel = null;
      engine._pendingLevelSince = 0;

      // First attempt to go focused: should stay calm (pending)
      const first = engine.applyHysteresis(30);
      expect(first).toBe('calm');
      expect(engine._pendingLevel).toBe('focused');

      // Check that pending timer was set
      const pendingSince1 = engine._pendingLevelSince;
      expect(pendingSince1).toBeGreaterThan(0);

      // Now score drops back to calm before timeout — should reset pending
      const second = engine.applyHysteresis(15);
      expect(second).toBe('calm');
      expect(engine._pendingLevel).toBeNull();
    });

    it('should stay at current level when pending level is overwritten by a different level', () => {
      engine._currentLevel = 'calm';
      engine.applyHysteresis(25); // starts pending → focused
      expect(engine._pendingLevel).toBe('focused');

      // Now go even higher to tense — should overwrite pending
      const result = engine.applyHysteresis(45);
      expect(result).toBe('calm'); // still current
      expect(engine._pendingLevel).toBe('tense'); // overwritten
    });
  });

  describe('calculateRawScore', () => {
    it('should combine face and audio with configured weights', () => {
      engine._lastFace = makeFace({ angry: 0.8, neutral: 0.2 });
      engine._lastAudio = makeAudio({ volumeRMS: 0.5, isSpeaking: true, pitchHz: 300 });
      const score = engine.calculateRawScore();
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should work with face only (no audio)', () => {
      engine._lastFace = makeFace({ angry: 0.9 });
      engine._lastAudio = null;
      const score = engine.calculateRawScore();
      expect(score).toBeGreaterThan(0);
    });

    it('should return 0 when _lastFace is null (audio only)', () => {
      engine._lastFace = null;
      engine._lastAudio = makeAudio({ volumeRMS: 0.8, isSpeaking: true, pitchHz: 400 });
      const score = engine.calculateRawScore();
      expect(score).toBeGreaterThan(0); // Audio contributes
    });

    it('should return 0 when both face and audio are null', () => {
      engine._lastFace = null;
      engine._lastAudio = null;
      const score = engine.calculateRawScore();
      expect(score).toBe(0);
    });
  });

  describe('updateConfig', () => {
    it('should update faceWeight and affect calculateRawScore', () => {
      engine._lastFace = makeFace({ angry: 1.0 });
      engine._lastAudio = null;

      const scoreWithDefaultWeight = engine.calculateRawScore();

      engine.updateConfig({ faceWeight: 1.0, audioWeight: 0.0 });

      // With face weight = 1.0, raw score should be exactly the face score
      const faceScore = engine.calculateFaceScore(engine._lastFace);
      const scoreWithNewWeight = engine.calculateRawScore();

      expect(scoreWithNewWeight).toBe(faceScore);
      // Score with different weights should differ from default weighting
      expect(scoreWithNewWeight).toBeGreaterThanOrEqual(scoreWithDefaultWeight);
    });

    it('should update emaAlpha and affect smoothing', () => {
      engine.config.emaAlpha = 0.3; // default
      engine.applyEMA(0);
      const defaultSmoothed = engine.applyEMA(100);

      engine.updateConfig({ emaAlpha: 0.9 }); // much faster response
      engine.applyEMA(0); // re-initialize
      const fastSmoothed = engine.applyEMA(100);

      // Higher alpha means less smoothing (closer to raw)
      expect(fastSmoothed).toBeGreaterThan(defaultSmoothed);
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      engine._lastFace = makeFace({ angry: 0.9 });
      engine._lastAudio = makeAudio({ volumeRMS: 0.8, isSpeaking: true });
      engine._smoothedScore = 75;
      engine._momentum = 12.5;
      engine._currentLevel = 'angry';
      engine._pendingLevel = 'rage';

      engine.reset();

      expect(engine._smoothedScore).toBe(0);
      expect(engine._momentum).toBe(0);
      expect(engine._currentLevel).toBe('calm');
      expect(engine._lastFace).toBeNull();
      expect(engine._lastAudio).toBeNull();
      expect(engine._pendingLevel).toBeNull();
    });

    it('should allow clean restart after reset', () => {
      // Simulate a full session
      engine._lastFace = makeFace({ angry: 0.9 });
      const score1 = engine.calculateRawScore();
      expect(score1).toBeGreaterThan(0);

      engine.reset();

      // After reset, rawScore with no data should be 0
      const score2 = engine.calculateRawScore();
      expect(score2).toBe(0);

      // And should work normally again after providing data
      engine._lastFace = makeFace({ neutral: 1.0 });
      const score3 = engine.calculateRawScore();
      expect(score3).toBeLessThan(20);
    });
  });

  describe('updateMomentum', () => {
    it('should compute positive momentum when raw exceeds smoothed', () => {
      engine.updateMomentum(80, 50);
      expect(engine._momentum).toBeGreaterThan(0);
    });

    it('should compute negative momentum when raw is below smoothed', () => {
      engine.updateMomentum(20, 50);
      expect(engine._momentum).toBeLessThan(0);
    });

    it('should decay momentum over successive calls', () => {
      engine.updateMomentum(100, 0); // delta = 100, momentum = 0.9*0 + 0.1*100 = 10
      const first = engine._momentum;
      engine.updateMomentum(50, 50); // delta = 0, momentum = 0.9*10 + 0.1*0 = 9
      const second = engine._momentum;
      expect(second).toBeLessThan(first);
    });
  });

  describe('destroy', () => {
    it('should unsubscribe from camera:expression events', () => {
      const listener = vi.fn();
      eventBus.on('fusion:score', listener);

      engine.destroy();

      eventBus.emit('camera:expression', makeFace({ angry: 0.9 }));
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('event integration', () => {
    it('should emit fusion:score on camera:expression event', () => {
      const listener = vi.fn();
      eventBus.on('fusion:score', listener);

      eventBus.emit('camera:expression', makeFace({ angry: 0.5 }));

      expect(listener).toHaveBeenCalledOnce();
      const score = listener.mock.calls[0][0];
      expect(score).toHaveProperty('raw');
      expect(score).toHaveProperty('smoothed');
      expect(score).toHaveProperty('momentum');
      expect(score).toHaveProperty('level');
      expect(score).toHaveProperty('color');
    });

    it('should store but not fuse on mic:audio alone (wait for face)', () => {
      const listener = vi.fn();
      eventBus.on('fusion:score', listener);

      eventBus.emit('mic:audio', makeAudio({ volumeRMS: 0.8, isSpeaking: true, pitchHz: 400 }));

      // Audio alone should not trigger fusion:score
      expect(listener).not.toHaveBeenCalled();
      // But audio should be stored
      expect(engine._lastAudio).not.toBeNull();
      expect(engine._lastAudio.volumeRMS).toBe(0.8);
    });

    it('should emit fusion:level-change when hysteresis threshold passes', () => {
      // Simulate the level-change path
      const levelChangeListener = vi.fn();
      eventBus.on('fusion:level-change', levelChangeListener);

      // Set up engine to have pending level timeout
      engine._currentLevel = 'calm';
      engine._pendingLevel = 'focused';
      engine._pendingLevelSince = Date.now() - 3000;

      const level = engine.applyHysteresis(30);
      expect(level).toBe('focused');
      expect(levelChangeListener).toHaveBeenCalledOnce();
      expect(levelChangeListener.mock.calls[0][0]).toHaveProperty('level', 'focused');
      expect(levelChangeListener.mock.calls[0][0]).toHaveProperty('score');
      expect(levelChangeListener.mock.calls[0][0]).toHaveProperty('timestamp');
    });

    it('should emit fusion:score with all expected properties on a full cycle', () => {
      const listener = vi.fn();
      eventBus.on('fusion:score', listener);

      // First, send audio so it's stored
      eventBus.emit('mic:audio', makeAudio({ volumeRMS: 0.5, isSpeaking: true, pitchHz: 300 }));
      expect(engine._lastAudio).not.toBeNull();

      // Then send face expression to trigger fusion
      eventBus.emit('camera:expression', makeFace({ angry: 0.6, neutral: 0.4 }));

      expect(listener).toHaveBeenCalledOnce();
      const score = listener.mock.calls[0][0];
      expect(score.raw).toBeGreaterThan(20);
      expect(score.smoothed).toBeGreaterThan(0);
      expect(typeof score.momentum).toBe('number');
      expect(typeof score.level).toBe('string');
      expect(typeof score.color).toBe('string');
      expect(score.face).not.toBeNull();
      expect(score.audio).not.toBeNull(); // Audio was stored
    });
  });
});
