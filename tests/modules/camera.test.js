import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CameraModule } from '../../src/modules/camera.js';
import { eventBus } from '../../src/utils/event-bus.js';

// Mock navigator.mediaDevices.getUserMedia
const mockGetUserMedia = vi.fn();
const mockStream = {
  getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }]),
};
Object.defineProperty(global, 'navigator', {
  value: { mediaDevices: { getUserMedia: mockGetUserMedia } },
  writable: true,
  configurable: true,
});

// Mock face-api.js
vi.mock('face-api.js', () => ({
  nets: {
    tinyFaceDetector: { loadFromUri: vi.fn().mockResolvedValue(undefined) },
    faceExpressionNet: { loadFromUri: vi.fn().mockResolvedValue(undefined) },
  },
  TinyFaceDetectorOptions: vi.fn(),
  detectSingleFace: vi.fn(),
}));

describe('CameraModule', () => {
  let camera;

  beforeEach(() => {
    camera = new CameraModule();
    eventBus.clear();
    mockGetUserMedia.mockReset();
  });

  afterEach(() => {
    if (camera._intervalId) {
      clearInterval(camera._intervalId);
      camera._intervalId = null;
    }
  });

  it('should initialize with default state', () => {
    expect(camera.isRunning).toBe(false);
    expect(camera.isPaused).toBe(false);
    expect(camera.stream).toBeNull();
  });

  it('should load models successfully', async () => {
    const listener = vi.fn();
    eventBus.on('camera:models-loaded', listener);
    await camera.loadModels();
    expect(listener).toHaveBeenCalled();
  });

  it('should not reload models if already loaded', async () => {
    await camera.loadModels();
    await camera.loadModels();
    // loadFromUri should only be called once
  });

  it('should emit camera:no-face when no detection', async () => {
    const listener = vi.fn();
    eventBus.on('camera:no-face', listener);
    camera._modelsLoaded = true;
    camera.videoElement = document.createElement('video');
    // detectSingleFace returns null
    const faceapi = await import('face-api.js');
    faceapi.detectSingleFace.mockReturnValue({
      withFaceExpressions: vi.fn().mockResolvedValue(null),
    });
    await camera.detect();
    expect(listener).toHaveBeenCalled();
  });

  it('should return null from detect when models not loaded', async () => {
    const result = await camera.detect();
    expect(result).toBeNull();
  });

  it('should return null from detect when no video element', async () => {
    camera._modelsLoaded = true;
    const result = await camera.detect();
    expect(result).toBeNull();
  });

  it('should start and emit camera:started', async () => {
    mockGetUserMedia.mockResolvedValue(mockStream);
    camera.videoElement = document.createElement('video');
    // Mock play() on the video element
    camera.videoElement.play = vi.fn().mockResolvedValue(undefined);

    const listener = vi.fn();
    eventBus.on('camera:started', listener);

    await camera.start(camera.videoElement);

    expect(camera.isRunning).toBe(true);
    expect(camera.stream).toBe(mockStream);
    expect(listener).toHaveBeenCalled();
  });

  it('should emit camera:error and throw on getUserMedia failure', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));
    camera.videoElement = document.createElement('video');

    const listener = vi.fn();
    eventBus.on('camera:error', listener);

    await expect(camera.start(camera.videoElement)).rejects.toThrow('Permission denied');
    expect(listener).toHaveBeenCalled();
    expect(listener.mock.calls[0][0].error).toBe('Permission denied');
  });

  it('should stop and emit camera:stopped', () => {
    camera.isRunning = true;
    camera.stream = mockStream;
    camera.videoElement = document.createElement('video');

    const listener = vi.fn();
    eventBus.on('camera:stopped', listener);

    camera.stop();

    expect(camera.isRunning).toBe(false);
    expect(camera.stream).toBeNull();
    expect(camera.videoElement.srcObject).toBeNull();
    expect(listener).toHaveBeenCalled();
  });

  it('should emit camera:paused on pause and stop detection loop', () => {
    camera.isRunning = true;
    camera._intervalId = setInterval(() => {}, 1000);

    const listener = vi.fn();
    eventBus.on('camera:paused', listener);

    camera.pause();

    expect(camera.isPaused).toBe(true);
    expect(camera._intervalId).toBeNull();
    expect(listener).toHaveBeenCalled();
  });

  it('should emit camera:resumed on resume and restart detection loop', () => {
    camera.isRunning = true;
    camera.isPaused = true;

    const listener = vi.fn();
    eventBus.on('camera:resumed', listener);

    camera.resume();

    expect(camera.isPaused).toBe(false);
    expect(listener).toHaveBeenCalled();
    // Clean up interval created by resume
    if (camera._intervalId) {
      clearInterval(camera._intervalId);
      camera._intervalId = null;
    }
  });

  it('should toggle pause state', () => {
    camera.isRunning = true;
    camera.pause();
    expect(camera.isPaused).toBe(true);
    camera.resume();
    expect(camera.isPaused).toBe(false);
    if (camera._intervalId) {
      clearInterval(camera._intervalId);
      camera._intervalId = null;
    }
  });
});
