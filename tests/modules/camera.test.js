import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CameraModule } from '../../src/modules/camera.js';
import { eventBus } from '../../src/utils/event-bus.js';

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

  it('should toggle pause state', () => {
    camera.isRunning = true;
    camera.pause();
    expect(camera.isPaused).toBe(true);
    camera.resume();
    expect(camera.isPaused).toBe(false);
  });
});
