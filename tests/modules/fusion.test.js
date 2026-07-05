import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FusionEngine } from '../../src/modules/fusion.js';
import { eventBus } from '../../src/utils/event-bus.js';
import { getRageLevel } from '../../src/utils/rage-levels.js';

// ------------------------------------------------------------------
//  Factory helpers
// ------------------------------------------------------------------

function makeExpression(overrides = {}) {
  return {
    angry: 0,
    disgusted: 0,
    fearful: 0,
    happy: 0,
    neutral: 0,
    sad: 0,
    surprised: 0,
    ...overrides,
  };
}

function makeEmotionSnapshot(expressions) {
  return {
    timestamp: Date.now(),
    expressions: makeExpression(expressions),
    dominant: 'angry',
    confidence: 0.95,
  };
}

function makeAudioSnapshot(overrides = {}) {
  return {
    timestamp: Date.now(),
    volumeRMS: 0,
    volumeDB: -100,
    pitchHz: 0,
    spectralCentroid: 0,
    isSpeaking: false,
    ...overrides,
  };
}

// ------------------------------------------------------------------
//  Tests
// ------------------------------------------------------------------

describe('FusionEngine — calculateFaceScore', () => {
  it('returns 0 for null / undefined input', () => {
    const engine = new FusionEngine();
    expect(engine.calculateFaceScore(null)).toBe(0);
    expect(engine.calculateFaceScore(undefined)).toBe(0);
  });

  it('returns 0 when all expressions are 0', () => {
    const engine = new FusionEngine();
    expect(engine.calculateFaceScore(makeExpression())).toBe(0);
  });

  it('returns > 0 for angry expression', () => {
    const engine = new FusionEngine();
    const score = engine.calculateFaceScore(makeExpression({ angry: 1 }));
    // angry=1 * 1.0 / 3.1 * 100 ≈ 32.26
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it('returns 100 for maximum rage input', () => {
    const engine = new FusionEngine();
    const score = engine.calculateFaceScore(makeExpression({
      angry: 1, disgusted: 1, fearful: 1, sad: 1, surprised: 1,
    }));
    expect(score).toBe(100);
  });

  it('reduces score when happy / neutral are high', () => {
    const engine = new FusionEngine();
    const angryOnly = engine.calculateFaceScore(makeExpression({ angry: 1 }));
    const happyAndAngry = engine.calculateFaceScore(makeExpression({ angry: 1, happy: 1 }));
    expect(happyAndAngry).toBeLessThan(angryOnly);
  });

  it('clamps negative scores to 0', () => {
    const engine = new FusionEngine();
    const score = engine.calculateFaceScore(makeExpression({ happy: 1, neutral: 1 }));
    expect(score).toBe(0);
  });
});

describe('FusionEngine — calculateAudioScore', () => {
  it('returns 0 for null / undefined input', () => {
    const engine = new FusionEngine();
    expect(engine.calculateAudioScore(null)).toBe(0);
    expect(engine.calculateAudioScore(undefined)).toBe(0);
  });

  it('returns 0 when not speaking', () => {
    const engine = new FusionEngine();
    const audio = makeAudioSnapshot({ isSpeaking: false, volumeRMS: 0.8 });
    expect(engine.calculateAudioScore(audio)).toBe(0);
  });

  it('returns > 0 when speaking', () => {
    const engine = new FusionEngine();
    // volumeRMS * 100 * 0.5 = 40*0.5=20, plus some pitch and centroid
    const audio = makeAudioSnapshot({ isSpeaking: true, volumeRMS: 0.4, pitchHz: 250, spectralCentroid: 2000 });
    const score = engine.calculateAudioScore(audio);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('returns at most 100', () => {
    const engine = new FusionEngine();
    const audio = makeAudioSnapshot({ isSpeaking: true, volumeRMS: 1.0, pitchHz: 1000, spectralCentroid: 8000 });
    expect(engine.calculateAudioScore(audio)).toBe(100);
  });
});

describe('FusionEngine — calculateRawScore', () => {
  it('weighted combination of face and audio', () => {
    const engine = new FusionEngine();
    const result = engine.calculateRawScore(60, 40);
    expect(result).toBeCloseTo(60 * 0.65 + 40 * 0.35, 5);
  });

  it('clamps to 0-100', () => {
    const engine = new FusionEngine();
    expect(engine.calculateRawScore(200, 200)).toBe(100);
    expect(engine.calculateRawScore(-10, -10)).toBe(0);
  });

  it('face only (audio 0) equals face * faceWeight', () => {
    const engine = new FusionEngine();
    expect(engine.calculateRawScore(50, 0)).toBeCloseTo(50 * 0.65, 5);
  });
});

describe('FusionEngine — applyEMA', () => {
  it('smooths a step input over multiple iterations', () => {
    const engine = new FusionEngine();
    // Start at 0
    let smoothed = 0;
    // With alpha=0.3, on first 100: smoothed = 0 + 0.3*(100-0) = 30
    smoothed = engine.applyEMA(100, smoothed);
    expect(smoothed).toBeCloseTo(30, 5);
    // Second: 30 + 0.3*(100-30) = 30 + 21 = 51
    smoothed = engine.applyEMA(100, smoothed);
    expect(smoothed).toBeCloseTo(51, 5);
  });

  it('converges to constant input over many iterations', () => {
    const engine = new FusionEngine();
    let smoothed = 0;
    for (let i = 0; i < 50; i++) {
      smoothed = engine.applyEMA(100, smoothed);
    }
    // After 50 iterations at alpha=0.3, should be very close to 100
    expect(smoothed).toBeGreaterThan(99.9);
    expect(smoothed).toBeLessThanOrEqual(100);
  });
});

describe('FusionEngine — updateMomentum', () => {
  it('starts at 0 on first update', () => {
    const engine = new FusionEngine();
    // momentum = 0.9*0 + (50 - 0) = 50
    const m = engine.updateMomentum(50, 0);
    expect(m).toBe(50);
  });

  it('decays over time', () => {
    const engine = new FusionEngine();
    engine.updateMomentum(50, 0); // 50
    // 0.9 * 50 + (50 - 50) = 45
    const m = engine.updateMomentum(50, 50);
    expect(m).toBe(45);
  });

  it('detects large positive rate of change (anger spike)', () => {
    const engine = new FusionEngine();
    engine.updateMomentum(20, 0); // 20
    engine.updateMomentum(30, 20); // 0.9*20 + 10 = 28
    engine.updateMomentum(80, 30); // 0.9*28 + 50 = 75.2
    const m = engine.updateMomentum(90, 80); // 0.9*75.2 + 10 = 77.68
    expect(m).toBeCloseTo(77.68, 2);
  });
});

describe('FusionEngine — applyHysteresis', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns current level without change initially', () => {
    const engine = new FusionEngine();
    // Score 10 → calm
    const level = engine.applyHysteresis(10);
    expect(level).toBe('calm');
  });

  it('does not switch level immediately (within hysteresis timeout)', () => {
    const engine = new FusionEngine();
    engine.applyHysteresis(10); // calm
    engine.applyHysteresis(90); // wants rage, but should still return calm
    expect(engine.getState().currentRageLevel).toBe('calm');
    expect(engine.getState().pendingLevel).toBe('rage');
  });

  it('switches level after hysteresis timeout elapses', () => {
    const engine = new FusionEngine();
    engine.applyHysteresis(10); // calm

    // Set pending level
    engine.applyHysteresis(90); // pending rage
    expect(engine.getState().pendingLevel).toBe('rage');

    // Advance past hysteresis timeout
    vi.advanceTimersByTime(2000);
    const level = engine.applyHysteresis(90);
    expect(level).toBe('rage');
    expect(engine.getState().pendingLevel).toBeNull();
  });

  it('cancels pending level if score returns to original level', () => {
    const engine = new FusionEngine();
    engine.applyHysteresis(10); // calm
    engine.applyHysteresis(90); // pending rage

    // Score drops back before timeout
    vi.advanceTimersByTime(1000);
    const level = engine.applyHysteresis(5); // back to calm
    expect(level).toBe('calm');
    expect(engine.getState().pendingLevel).toBeNull();
  });
});

describe('FusionEngine — end-to-end fusion pipeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset the singleton eventBus
    eventBus.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits fusion:update on camera:expression event', () => {
    const engine = new FusionEngine();
    const updates = [];

    const unsub = eventBus.on('fusion:update', (data) => updates.push(data));

    // Emit a face expression with high anger
    eventBus.emit('camera:expression', makeEmotionSnapshot({ angry: 1 }));

    expect(updates).toHaveLength(1);
    expect(updates[0]).toHaveProperty('rawScore');
    expect(updates[0]).toHaveProperty('smoothedScore');
    expect(updates[0]).toHaveProperty('faceScore');
    expect(updates[0]).toHaveProperty('audioScore');
    expect(updates[0]).toHaveProperty('level');
    expect(updates[0]).toHaveProperty('momentum');

    unsub();
    engine.destroy();
  });

  it('buffers audio and combines on next face detection', () => {
    const engine = new FusionEngine();
    const updates = [];

    eventBus.on('fusion:update', (data) => updates.push(data));

    // No audio yet — pure face
    eventBus.emit('camera:expression', makeEmotionSnapshot({ angry: 1 }));
    expect(updates[0].audioScore).toBe(0);

    // Send audio data
    eventBus.emit('mic:audio', makeAudioSnapshot({ isSpeaking: true, volumeRMS: 0.5, pitchHz: 250, spectralCentroid: 1500 }));

    // Next face — audio is now combined
    eventBus.emit('camera:expression', makeEmotionSnapshot({ angry: 0.5 }));
    expect(updates[1].audioScore).toBeGreaterThan(0);

    engine.destroy();
  });

  it('updates momentum and smoothed scores across multiple detections', () => {
    const engine = new FusionEngine();
    const updates = [];

    eventBus.on('fusion:update', (data) => updates.push(data));

    // Ramp up anger over 5 detections
    const angerValues = [0.2, 0.4, 0.6, 0.8, 1.0];
    for (const a of angerValues) {
      eventBus.emit('camera:expression', makeEmotionSnapshot({ angry: a }));
    }

    expect(updates).toHaveLength(5);
    // Smoothed scores should be increasing
    for (let i = 1; i < updates.length; i++) {
      expect(updates[i].smoothedScore).toBeGreaterThanOrEqual(updates[i - 1].smoothedScore);
    }
    // Momentum should be positive (increasing trend)
    expect(updates[updates.length - 1].momentum).toBeGreaterThan(0);

    engine.destroy();
  });

  it('handles rapid score fluctuations with EMA smoothing', () => {
    const engine = new FusionEngine();
    const updates = [];

    eventBus.on('fusion:update', (data) => updates.push(data));

    // Alternating high/low anger
    const values = [1.0, 0, 1.0, 0, 1.0, 0];
    for (const v of values) {
      eventBus.emit('camera:expression', makeEmotionSnapshot({ angry: v }));
    }

    // Every pair: rawScore jumps, but smoothed changes more gradually
    for (let i = 1; i < updates.length; i++) {
      // EMA smooths — difference between consecutive smoothed scores
      // should be at most alpha * 100 = 30 (plus accumulation)
      const diff = Math.abs(updates[i].smoothedScore - updates[i - 1].smoothedScore);
      expect(diff).toBeLessThanOrEqual(32);
    }

    engine.destroy();
  });

  it('face only (no audio buffered) works correctly — audio score is 0', () => {
    const engine = new FusionEngine();
    const updates = [];

    eventBus.on('fusion:update', (data) => updates.push(data));

    eventBus.emit('camera:expression', makeEmotionSnapshot({ angry: 1 }));
    eventBus.emit('camera:expression', makeEmotionSnapshot({ angry: 0.5 }));

    for (const u of updates) {
      expect(u.audioScore).toBe(0);
    }

    engine.destroy();
  });

  it('hysteresis prevents flickering at level boundaries', () => {
    const engine = new FusionEngine();
    const updates = [];

    eventBus.on('fusion:update', (data) => updates.push(data));

    // Start calm (score 10)
    eventBus.emit('camera:expression', makeEmotionSnapshot({ angry: 0.3 })); // ~9.7 raw
    expect(updates[0].level).toBe('calm');

    // Jump to rage-level score but should not switch immediately (hysteresis)
    eventBus.emit('camera:expression', makeEmotionSnapshot({
      angry: 1, disgusted: 1, fearful: 1, sad: 1, surprised: 1,
    }));
    expect(updates[1].level).toBe('calm');

    engine.destroy();
  });

  it('accepts custom config via constructor', () => {
    const engine = new FusionEngine({ faceWeight: 0.5, audioWeight: 0.5, emaAlpha: 0.1 });
    expect(engine.config.faceWeight).toBe(0.5);
    expect(engine.config.audioWeight).toBe(0.5);
    expect(engine.config.emaAlpha).toBe(0.1);
    engine.destroy();
  });
});

describe('FusionEngine — destroy', () => {
  it('unsubscribes from event bus', () => {
    const engine = new FusionEngine();
    engine.destroy();

    // After destroy, emitting should not cause errors or produce updates
    const updates = [];
    eventBus.on('fusion:update', (data) => updates.push(data));

    eventBus.emit('camera:expression', makeEmotionSnapshot({ angry: 1 }));
    expect(updates).toHaveLength(0);
  });
});

describe('FusionEngine — getState', () => {
  it('returns current internal state', () => {
    const engine = new FusionEngine();
    const state = engine.getState();
    expect(state).toHaveProperty('smoothedScore');
    expect(state).toHaveProperty('momentum');
    expect(state).toHaveProperty('currentRageLevel');
    expect(state).toHaveProperty('pendingLevel');
    engine.destroy();
  });
});
