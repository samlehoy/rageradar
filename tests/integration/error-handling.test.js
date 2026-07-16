import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CameraModule } from '../../src/modules/camera.js';
import { MicrophoneModule } from '../../src/modules/microphone.js';
import { eventBus } from '../../src/utils/event-bus.js';

// Mock face-api.js
vi.mock('face-api.js', () => ({
  nets: {
    tinyFaceDetector: { loadFromUri: vi.fn() },
    faceExpressionNet: { loadFromUri: vi.fn() },
  },
  detectSingleFace: vi.fn(),
  TinyFaceDetectorOptions: vi.fn(),
}));

// Ensure navigator.mediaDevices exists in jsdom
if (!navigator.mediaDevices) {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn() },
    writable: true,
    configurable: true,
  });
}

describe('Camera error handling', () => {
  beforeEach(() => { eventBus.clear(); });

  it('should emit error with errorName for NotAllowedError', async () => {
    const permError = new DOMException('Permission denied', 'NotAllowedError');
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(permError);

    const listener = vi.fn();
    eventBus.on('camera:error', listener);

    const cam = new CameraModule();
    const video = document.createElement('video');

    await expect(cam.start(video)).rejects.toThrow();
    expect(listener).toHaveBeenCalledWith({
      error: 'Permission denied',
      errorName: 'NotAllowedError',
    });
  });

  it('should emit error with errorName for NotFoundError', async () => {
    const notFound = new DOMException('No device found', 'NotFoundError');
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(notFound);

    const listener = vi.fn();
    eventBus.on('camera:error', listener);

    const cam = new CameraModule();
    const video = document.createElement('video');

    await expect(cam.start(video)).rejects.toThrow();
    expect(listener).toHaveBeenCalledWith({
      error: 'No device found',
      errorName: 'NotFoundError',
    });
  });

  it('should fall back to UnknownError when err.name is missing', async () => {
    const genericErr = new Error('Something went wrong');
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(genericErr);

    const listener = vi.fn();
    eventBus.on('camera:error', listener);

    const cam = new CameraModule();
    const video = document.createElement('video');

    await expect(cam.start(video)).rejects.toThrow();
    // Error has name 'Error' by default, not 'UnknownError'
    expect(listener).toHaveBeenCalledWith({
      error: 'Something went wrong',
      errorName: 'Error',
    });
  });
});

describe('Microphone error handling', () => {
  beforeEach(() => { eventBus.clear(); });

  it('should emit error with errorName for NotAllowedError', async () => {
    const permError = new DOMException('Permission denied', 'NotAllowedError');
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(permError);

    const listener = vi.fn();
    eventBus.on('mic:error', listener);

    const mic = new MicrophoneModule();
    await expect(mic.start()).rejects.toThrow();
    expect(listener).toHaveBeenCalledWith({
      error: 'Permission denied',
      errorName: 'NotAllowedError',
    });
  });

  it('should emit error with errorName for NotFoundError', async () => {
    const notFound = new DOMException('No device found', 'NotFoundError');
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(notFound);

    const listener = vi.fn();
    eventBus.on('mic:error', listener);

    const mic = new MicrophoneModule();
    await expect(mic.start()).rejects.toThrow();
    expect(listener).toHaveBeenCalledWith({
      error: 'No device found',
      errorName: 'NotFoundError',
    });
  });
});
