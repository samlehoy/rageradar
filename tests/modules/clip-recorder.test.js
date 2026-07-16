import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { ClipRecorder } from '../../src/modules/clip-recorder.js';
import { eventBus } from '../../src/utils/event-bus.js';
import { _resetDBPromise } from '../../src/utils/db.js';

/* ------------------------------------------------------------------ */
/*  Mock MediaRecorder                                                 */
/* ------------------------------------------------------------------ */

class MockMediaRecorder {
  constructor(stream, options = {}) {
    this.stream = stream;
    this.mimeType = options.mimeType || 'video/webm';
    this.state = 'inactive';
    this.ondataavailable = null;
    this._interval = null;
  }

  start(timeslice) {
    this.state = 'recording';
    // Simulate chunks at roughly the requested interval
    if (timeslice) {
      this._interval = setInterval(() => {
        if (this.ondataavailable) {
          this.ondataavailable({
            data: new Blob(['test-chunk'], { type: this.mimeType }),
          });
        }
      }, timeslice);
    }
  }

  stop() {
    this.state = 'inactive';
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  requestData() {
    if (this.ondataavailable) {
      this.ondataavailable({
        data: new Blob(['requested-chunk'], { type: this.mimeType }),
      });
    }
  }
}

// Install global mock
globalThis.MediaRecorder = MockMediaRecorder;
globalThis.MediaRecorder.isTypeSupported = () => true;

/* ------------------------------------------------------------------ */
/*  Mock MediaStream                                                   */
/* ------------------------------------------------------------------ */

function createMockStream() {
  return {
    getVideoTracks: () => [],
    getAudioTracks: () => [],
    getTracks: () => [],
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('ClipRecorder', () => {
  let recorder;
  let db;

  beforeEach(async () => {
    eventBus.clear();
    recorder = new ClipRecorder({
      bufferDurationMs: 5000,
      postCaptureDurationMs: 1000,
      triggerThreshold: 80,
      maxTotalClipsCount: 3,
    });
    // Init DB with real timers — fake timers block IndexedDB
    await recorder.init();
    db = recorder._db;
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(async () => {
    recorder.destroy();
    vi.useRealTimers();

    // Clean up DB between tests
    if (db) {
      db.close();
    }
    _resetDBPromise();
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase('rageradar');
      req.onsuccess = resolve;
      req.onerror = reject;
    });
  });

  /* ---------------------------------------------------------------- */
  /*  init                                                             */
  /* ---------------------------------------------------------------- */

  it('should init and open IndexedDB', () => {
    expect(recorder._db).toBeTruthy();
  });

  it('should have clips object store after init', () => {
    expect(recorder._db.objectStoreNames.contains('clips')).toBe(true);
  });

  it('should also have sessions object store (v2 upgrade preserves v1)', () => {
    expect(recorder._db.objectStoreNames.contains('sessions')).toBe(true);
  });

  /* ---------------------------------------------------------------- */
  /*  startRecording / stopRecording lifecycle                         */
  /* ---------------------------------------------------------------- */

  describe('startRecording / stopRecording', () => {
    it('should start recording from a MediaStream', () => {
      const stream = createMockStream();
      recorder.startRecording(stream);

      expect(recorder._isRecording).toBe(true);
      expect(recorder._mediaRecorder).toBeTruthy();
      expect(recorder._mediaRecorder.state).toBe('recording');

      recorder.stopRecording();
    });

    it('should not start if stream is null', () => {
      recorder.startRecording(null);
      expect(recorder._isRecording).toBe(false);
    });

    it('should not start if already recording', () => {
      const stream = createMockStream();
      recorder.startRecording(stream);
      const firstRecorder = recorder._mediaRecorder;
      recorder.startRecording(stream);
      expect(recorder._mediaRecorder).toBe(firstRecorder);

      recorder.stopRecording();
    });

    it('should stop recording and clear state', () => {
      const stream = createMockStream();
      recorder.startRecording(stream);
      recorder.stopRecording();

      expect(recorder._isRecording).toBe(false);
      expect(recorder._mediaRecorder).toBeNull();
      expect(recorder._rollingChunks).toEqual([]);
    });

    it('should accumulate rolling chunks from ondataavailable', () => {
      const stream = createMockStream();
      recorder.startRecording(stream);

      // Manually fire ondataavailable
      recorder._mediaRecorder.ondataavailable({
        data: new Blob(['chunk1'], { type: 'video/webm' }),
      });
      recorder._mediaRecorder.ondataavailable({
        data: new Blob(['chunk2'], { type: 'video/webm' }),
      });

      expect(recorder._rollingChunks).toHaveLength(2);
      recorder.stopRecording();
    });

    it('should prune chunks older than bufferDurationMs', () => {
      const stream = createMockStream();
      recorder.startRecording(stream);

      // Add an "old" chunk
      recorder._rollingChunks.push({
        blob: new Blob(['old'], { type: 'video/webm' }),
        timestamp: Date.now() - 10000, // 10s ago, exceeds 5s buffer
      });

      // Trigger prune via ondataavailable
      recorder._mediaRecorder.ondataavailable({
        data: new Blob(['new'], { type: 'video/webm' }),
      });

      // Old chunk should have been pruned
      expect(recorder._rollingChunks.every((c) => c.timestamp >= Date.now() - 5000)).toBe(true);
      recorder.stopRecording();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  triggerCapture                                                   */
  /* ---------------------------------------------------------------- */

  describe('triggerCapture', () => {
    it('should create a clip with correct metadata', async () => {
      const stream = createMockStream();
      recorder.startRecording(stream);

      // Seed the rolling buffer with some chunks
      recorder._rollingChunks.push(
        { blob: new Blob(['a'], { type: 'video/webm' }), timestamp: Date.now() },
        { blob: new Blob(['b'], { type: 'video/webm' }), timestamp: Date.now() },
      );

      const capturePromise = recorder.triggerCapture({
        sessionId: 'test-session',
        triggerScore: 85,
      });

      // Advance past postCaptureDurationMs
      vi.advanceTimersByTime(1500);

      const clip = await capturePromise;

      expect(clip).toBeTruthy();
      expect(clip.id).toBeTruthy();
      expect(clip.sessionId).toBe('test-session');
      expect(clip.triggerScore).toBe(85);
      expect(clip.peakScore).toBe(85);
      expect(clip.blob).toBeInstanceOf(Blob);
      expect(clip.size).toBeGreaterThan(0);
      expect(clip.mimeType).toContain('video/webm');
      expect(clip.duration).toBe(6000); // 5000 + 1000

      recorder.stopRecording();
    });

    it('should return null if not recording', async () => {
      const result = await recorder.triggerCapture({ triggerScore: 90 });
      expect(result).toBeNull();
    });

    it('should not capture when already capturing', async () => {
      const stream = createMockStream();
      recorder.startRecording(stream);

      recorder._rollingChunks.push({
        blob: new Blob(['a'], { type: 'video/webm' }),
        timestamp: Date.now(),
      });

      // Start first capture
      const p1 = recorder.triggerCapture({ triggerScore: 85 });

      // Try second capture immediately — should be blocked
      const p2 = recorder.triggerCapture({ triggerScore: 90 });

      vi.advanceTimersByTime(1500);

      const [clip1, clip2] = await Promise.all([p1, p2]);

      expect(clip1).toBeTruthy();
      expect(clip2).toBeNull();

      recorder.stopRecording();
    });

    it('should save clip to IndexedDB', async () => {
      const stream = createMockStream();
      recorder.startRecording(stream);

      recorder._rollingChunks.push({
        blob: new Blob(['data'], { type: 'video/webm' }),
        timestamp: Date.now(),
      });

      const capturePromise = recorder.triggerCapture({ triggerScore: 80 });
      vi.advanceTimersByTime(1500);
      const clip = await capturePromise;

      const stored = await recorder.getClip(clip.id);
      expect(stored).toBeTruthy();
      expect(stored.id).toBe(clip.id);

      recorder.stopRecording();
    });

    it('should emit clip:saved event', async () => {
      const listener = vi.fn();
      eventBus.on('clip:saved', listener);

      const stream = createMockStream();
      recorder.startRecording(stream);

      recorder._rollingChunks.push({
        blob: new Blob(['data'], { type: 'video/webm' }),
        timestamp: Date.now(),
      });

      const capturePromise = recorder.triggerCapture({ triggerScore: 80 });
      vi.advanceTimersByTime(1500);
      await capturePromise;

      expect(listener).toHaveBeenCalledOnce();
      expect(listener.mock.calls[0][0]).toHaveProperty('id');
      expect(listener.mock.calls[0][0]).toHaveProperty('size');

      recorder.stopRecording();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Auto-trigger via fusion:score                                    */
  /* ---------------------------------------------------------------- */

  describe('auto-trigger on rage threshold', () => {
    it('should auto-capture when score exceeds threshold', async () => {
      const stream = createMockStream();
      recorder.startRecording(stream);

      recorder._rollingChunks.push({
        blob: new Blob(['data'], { type: 'video/webm' }),
        timestamp: Date.now(),
      });

      // Emit a score above threshold
      eventBus.emit('fusion:score', { smoothed: 90 });

      // The capture should now be in progress
      expect(recorder._isCapturing).toBe(true);

      // Advance timer to complete capture
      vi.advanceTimersByTime(1500);
      // Allow the promise to resolve
      await vi.advanceTimersByTimeAsync(0);

      // After capture completes, should have a clip stored
      const clips = await recorder.getAllClips();
      expect(clips.length).toBeGreaterThanOrEqual(1);

      recorder.stopRecording();
    });

    it('should not auto-capture below threshold', async () => {
      const stream = createMockStream();
      recorder.startRecording(stream);

      eventBus.emit('fusion:score', { smoothed: 50 });

      expect(recorder._isCapturing).toBe(false);
      recorder.stopRecording();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  CRUD: getAllClips, getClip, deleteClip, getStorageUsed            */
  /* ---------------------------------------------------------------- */

  describe('CRUD operations', () => {
    async function captureTestClip(rec, overrides = {}) {
      rec._rollingChunks.push({
        blob: new Blob(['test-data'], { type: 'video/webm' }),
        timestamp: Date.now(),
      });

      const capturePromise = rec.triggerCapture({ triggerScore: 80, ...overrides });
      vi.advanceTimersByTime(1500);
      return capturePromise;
    }

    it('getAllClips should return stored clips', async () => {
      const stream = createMockStream();
      recorder.startRecording(stream);

      await captureTestClip(recorder);

      // Need to reset isCapturing for next capture
      await captureTestClip(recorder);

      const clips = await recorder.getAllClips();
      expect(clips.length).toBeGreaterThanOrEqual(1);

      recorder.stopRecording();
    });

    it('getClip should return a single clip by id', async () => {
      const stream = createMockStream();
      recorder.startRecording(stream);

      const clip = await captureTestClip(recorder);
      const retrieved = await recorder.getClip(clip.id);

      expect(retrieved).toBeTruthy();
      expect(retrieved.id).toBe(clip.id);

      recorder.stopRecording();
    });

    it('deleteClip should remove clip from store', async () => {
      const stream = createMockStream();
      recorder.startRecording(stream);

      const clip = await captureTestClip(recorder);
      await recorder.deleteClip(clip.id);

      const retrieved = await recorder.getClip(clip.id);
      expect(retrieved).toBeUndefined();

      recorder.stopRecording();
    });

    it('getStorageUsed should sum all clip sizes', async () => {
      const stream = createMockStream();
      recorder.startRecording(stream);

      const clip = await captureTestClip(recorder);

      const used = await recorder.getStorageUsed();
      expect(used).toBe(clip.size);

      recorder.stopRecording();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Storage limit enforcement                                        */
  /* ---------------------------------------------------------------- */

  describe('storage limit enforcement', () => {
    it('should delete oldest clips when maxTotalClipsCount is reached', async () => {
      const stream = createMockStream();
      recorder.startRecording(stream);

      const clipIds = [];
      for (let i = 0; i < 4; i++) {
        recorder._rollingChunks.push({
          blob: new Blob([`data-${i}`], { type: 'video/webm' }),
          timestamp: Date.now(),
        });

        const capturePromise = recorder.triggerCapture({ triggerScore: 80 + i });
        vi.advanceTimersByTime(1500);
        const clip = await capturePromise;
        if (clip) clipIds.push(clip.id);
      }

      const allClips = await recorder.getAllClips();
      // maxTotalClipsCount is 3, so after 4 captures we should have at most 3
      expect(allClips.length).toBeLessThanOrEqual(3);

      recorder.stopRecording();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  destroy                                                          */
  /* ---------------------------------------------------------------- */

  describe('destroy', () => {
    it('should clean up everything', () => {
      const stream = createMockStream();
      recorder.startRecording(stream);

      recorder.destroy();

      expect(recorder._isRecording).toBe(false);
      expect(recorder._mediaRecorder).toBeNull();
      expect(recorder._db).toBeNull();
    });
  });
});
