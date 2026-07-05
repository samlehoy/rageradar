import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MicrophoneModule } from '../../src/modules/microphone.js';

describe('MicrophoneModule', () => {
  let mic;

  beforeEach(() => {
    mic = new MicrophoneModule();
  });

  it('should initialize with default state', () => {
    expect(mic.isRunning).toBe(false);
    expect(mic.isPaused).toBe(false);
    expect(mic.stream).toBeNull();
  });

  describe('_calculateRMS', () => {
    it('should return 0 for silent audio (all 128)', () => {
      const silentData = new Uint8Array(128).fill(128);
      expect(mic._calculateRMS(silentData)).toBe(0);
    });

    it('should return ~1.0 for max volume', () => {
      // Alternating 0 and 255 → max amplitude
      const loudData = new Uint8Array(128);
      for (let i = 0; i < loudData.length; i++) {
        loudData[i] = i % 2 === 0 ? 0 : 255;
      }
      const rms = mic._calculateRMS(loudData);
      expect(rms).toBeGreaterThan(0.9);
    });

    it('should return intermediate values for moderate volume', () => {
      const data = new Uint8Array(128);
      for (let i = 0; i < data.length; i++) {
        data[i] = 128 + Math.round(32 * Math.sin(i * 0.1));
      }
      const rms = mic._calculateRMS(data);
      expect(rms).toBeGreaterThan(0);
      expect(rms).toBeLessThan(1);
    });
  });

  describe('_rmsToDecibels', () => {
    it('should return -100 for silence', () => {
      expect(mic._rmsToDecibels(0)).toBe(-100);
    });

    it('should return 0 for max volume', () => {
      expect(mic._rmsToDecibels(1)).toBe(0);
    });

    it('should return negative values for normal volume', () => {
      expect(mic._rmsToDecibels(0.5)).toBeLessThan(0);
      expect(mic._rmsToDecibels(0.5)).toBeGreaterThan(-100);
    });
  });

  describe('_calculateSpectralCentroid', () => {
    it('should return 0 for empty spectrum', () => {
      const emptyData = new Uint8Array(128).fill(0);
      expect(mic._calculateSpectralCentroid(emptyData)).toBe(0);
    });

    it('should return higher value for high-frequency content', () => {
      const lowFreq = new Uint8Array(128).fill(0);
      lowFreq[1] = 255; // Low frequency bin

      const highFreq = new Uint8Array(128).fill(0);
      highFreq[100] = 255; // High frequency bin

      mic.audioContext = { sampleRate: 44100 };
      const lowCentroid = mic._calculateSpectralCentroid(lowFreq);
      const highCentroid = mic._calculateSpectralCentroid(highFreq);
      expect(highCentroid).toBeGreaterThan(lowCentroid);
    });
  });

  it('should toggle pause state', () => {
    mic.pause();
    expect(mic.isPaused).toBe(true);
    mic.resume();
    expect(mic.isPaused).toBe(false);
  });
});
