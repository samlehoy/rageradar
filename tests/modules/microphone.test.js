import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MicrophoneModule } from '../../src/modules/microphone.js';
import { eventBus } from '../../src/utils/event-bus.js';

// Mock navigator.mediaDevices.getUserMedia
const mockGetUserMedia = vi.fn();
const mockTrack = { stop: vi.fn() };
const mockStream = {
  getTracks: vi.fn().mockReturnValue([mockTrack]),
};
Object.defineProperty(global, 'navigator', {
  value: { mediaDevices: { getUserMedia: mockGetUserMedia } },
  writable: true,
  configurable: true,
});

// Mock AudioContext
const mockAudioContext = {
  createAnalyser: vi.fn().mockReturnValue({
    fftSize: 2048,
    frequencyBinCount: 1024,
    smoothingTimeConstant: 0,
  }),
  createMediaStreamSource: vi.fn().mockReturnValue({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
  state: 'running',
  close: vi.fn().mockResolvedValue(undefined),
};

describe('MicrophoneModule', () => {
  let mic;

  beforeEach(() => {
    mic = new MicrophoneModule();
    mockGetUserMedia.mockReset();
    mockTrack.stop.mockClear();
    // Set a plain constructor for AudioContext
    window.AudioContext = class {
      constructor() {
        return Object.assign(this, {
          createAnalyser: vi.fn().mockReturnValue({
            fftSize: 2048,
            frequencyBinCount: 1024,
            smoothingTimeConstant: 0,
          }),
          createMediaStreamSource: vi.fn().mockReturnValue({
            connect: vi.fn(),
            disconnect: vi.fn(),
          }),
          state: 'running',
          close: vi.fn().mockResolvedValue(undefined),
        });
      }
    };
  });

  afterEach(() => {
    if (mic._intervalId) {
      clearInterval(mic._intervalId);
      mic._intervalId = null;
    }
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
      // Alternating 0 and 255 in max amplitude
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

    it('should compute exact centroid for single-bin spectrum', () => {
      mic.audioContext = { sampleRate: 44100 };
      const data = new Uint8Array(1024).fill(0);
      data[256] = 255; // Single bin at index 256

      const centroid = mic._calculateSpectralCentroid(data);
      const binWidth = 44100 / (2 * 1024);  // ~21.53 Hz
      const expectedFreq = 256 * binWidth;
      expect(centroid).toBeCloseTo(expectedFreq, 0);
    });
  });

  describe('_estimatePitch', () => {
    beforeEach(() => {
      mic.audioContext = { sampleRate: 44100 };
    });

    it('should return 0 for silent input', () => {
      const data = new Uint8Array(2048).fill(128);
      expect(mic._estimatePitch(data)).toBe(0);
    });

    it('should detect a periodic signal', () => {
      // Create a low-frequency sine signal at 44100 sample rate
      // 150 Hz signal, period = 44100/150 ≈ 294 samples
      const data = new Uint8Array(2048);
      for (let i = 0; i < data.length; i++) {
        data[i] = 128 + Math.round(100 * Math.sin(2 * Math.PI * 150 * i / 44100));
      }
      const pitch = mic._estimatePitch(data);
      expect(pitch).toBeGreaterThan(50);
      expect(pitch).toBeLessThan(350);
    });
  });

  describe('start / stop', () => {
    it('should start and emit mic:started', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);

      const listener = vi.fn();
      eventBus.on('mic:started', listener);

      await mic.start();

      expect(mic.isRunning).toBe(true);
      expect(listener).toHaveBeenCalled();
    });

    it('should emit mic:error and throw on getUserMedia failure', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));

      const listener = vi.fn();
      eventBus.on('mic:error', listener);

      await expect(mic.start()).rejects.toThrow('Permission denied');
      expect(listener).toHaveBeenCalled();
      expect(listener.mock.calls[0][0].error).toBe('Permission denied');
    });

    it('should stop and emit mic:stopped', () => {
      mic.isRunning = true;
      mic.source = { disconnect: vi.fn() };
      mic.audioContext = mockAudioContext;
      mic.stream = mockStream;

      const listener = vi.fn();
      eventBus.on('mic:stopped', listener);

      mic.stop();

      expect(mic.isRunning).toBe(false);
      expect(mic.stream).toBeNull();
      expect(listener).toHaveBeenCalled();
    });

    it('should not close AudioContext if already closed', () => {
      mic.isRunning = false;
      const closedCtx = { state: 'closed', close: vi.fn() };
      mic.audioContext = closedCtx;

      mic.stop();

      expect(closedCtx.close).not.toHaveBeenCalled();
    });
  });

  describe('pause / resume', () => {
    it('should emit mic:paused on pause', () => {
      const listener = vi.fn();
      eventBus.on('mic:paused', listener);

      mic.pause();

      expect(mic.isPaused).toBe(true);
      expect(listener).toHaveBeenCalled();
    });

    it('should emit mic:resumed on resume', () => {
      mic.isPaused = true;

      const listener = vi.fn();
      eventBus.on('mic:resumed', listener);

      mic.resume();

      expect(mic.isPaused).toBe(false);
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('analyse', () => {
    it('should return null when analyser is not set', () => {
      expect(mic.analyse()).toBeNull();
    });

    it('should produce a snapshot and emit mic:audio', () => {
      // Set up internal state as if started
      mic.analyser = {
        getByteTimeDomainData: vi.fn().mockImplementation((data) => {
          // Fill with silence (all 128)
          for (let i = 0; i < data.length; i++) data[i] = 128;
        }),
        getByteFrequencyData: vi.fn().mockImplementation((data) => {
          for (let i = 0; i < data.length; i++) data[i] = 0;
        }),
        fftSize: 2048,
        frequencyBinCount: 1024,
      };
      mic._timeDomainData = new Uint8Array(2048);
      mic._frequencyData = new Uint8Array(1024);
      mic.audioContext = { sampleRate: 44100 };

      const listener = vi.fn();
      eventBus.on('mic:audio', listener);

      const snapshot = mic.analyse();

      expect(snapshot).not.toBeNull();
      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('volumeRMS', 0);
      expect(snapshot).toHaveProperty('volumeDB', -100);
      expect(snapshot).toHaveProperty('pitchHz', 0);
      expect(snapshot).toHaveProperty('spectralCentroid', 0);
      expect(snapshot).toHaveProperty('isSpeaking', false);
      expect(listener).toHaveBeenCalledWith(snapshot);
    });

    it('should detect speaking when volume exceeds noise gate', () => {
      mic.analyser = {
        getByteTimeDomainData: vi.fn().mockImplementation((data) => {
          // Loud signal (alternating 0 and 255)
          for (let i = 0; i < data.length; i++) {
            data[i] = i % 2 === 0 ? 0 : 255;
          }
        }),
        getByteFrequencyData: vi.fn().mockImplementation((data) => {
          for (let i = 0; i < data.length; i++) data[i] = 128;
        }),
        fftSize: 2048,
        frequencyBinCount: 1024,
      };
      mic._timeDomainData = new Uint8Array(2048);
      mic._frequencyData = new Uint8Array(1024);
      mic.audioContext = { sampleRate: 44100 };

      const snapshot = mic.analyse();
      expect(snapshot.isSpeaking).toBe(true);
      expect(snapshot.volumeRMS).toBeGreaterThan(0);
      expect(snapshot.volumeDB).toBeGreaterThan(-100);
    });
  });
});
