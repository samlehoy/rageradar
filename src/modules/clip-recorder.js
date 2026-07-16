import { eventBus } from '../utils/event-bus.js';
import { getDB } from '../utils/db.js';

const STORE_NAME = 'clips';

/**
 * @typedef {Object} ClipData
 * @property {string} id                - crypto.randomUUID()
 * @property {string|null} sessionId    - Current session ID
 * @property {number} timestamp         - When clip was triggered
 * @property {number} duration          - Total duration ms
 * @property {number} triggerScore      - Rage score that triggered capture
 * @property {number} peakScore         - Max rage during clip
 * @property {Blob} blob                - Video/audio blob (webm)
 * @property {Blob|null} thumbnailBlob  - Snapshot at trigger moment
 * @property {number} size              - Blob size in bytes
 * @property {string} mimeType          - e.g., 'video/webm;codecs=vp9,opus'
 */

export class ClipRecorder {
  /**
   * @param {Object} config
   * @param {boolean}  [config.enabled=true]
   * @param {number}   [config.bufferDurationMs=15000]     Rolling buffer duration
   * @param {number}   [config.postCaptureDurationMs=5000] Extra recording after trigger
   * @param {number}   [config.triggerThreshold=80]        Auto-clip rage threshold
   * @param {number}   [config.maxClipSizeBytes=52428800]  50 MB per clip
   * @param {number}   [config.maxTotalClipsCount=50]      Max stored clips
   */
  constructor(config = {}) {
    this._config = {
      enabled: true,
      bufferDurationMs: 15000,
      postCaptureDurationMs: 5000,
      triggerThreshold: 80,
      maxClipSizeBytes: 50 * 1024 * 1024,
      maxTotalClipsCount: 50,
      ...config,
    };

    this._db = null;
    this._mediaRecorder = null;
    /** @type {Array<{blob: Blob, timestamp: number}>} */
    this._rollingChunks = [];
    this._isRecording = false;
    this._isCapturing = false;
    this._captureTimeout = null;
    this._chunkInterval = null;
    this._unsub = null;
    this._stream = null;
  }

  /* ------------------------------------------------------------------ */
  /*  Lifecycle                                                          */
  /* ------------------------------------------------------------------ */

  /** Open / upgrade the shared IndexedDB. */
  async init() {
    this._db = await getDB();
  }

  /**
   * Start the rolling buffer from a live MediaStream.
   * @param {MediaStream} stream
   */
  startRecording(stream) {
    if (!stream || this._isRecording) return;

    this._stream = stream;

    const mimeType =
      typeof MediaRecorder.isTypeSupported === 'function' &&
      MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';

    this._mediaRecorder = new MediaRecorder(stream, { mimeType });

    this._mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this._rollingChunks.push({ blob: e.data, timestamp: Date.now() });
        this._pruneOldChunks();
      }
    };

    this._mediaRecorder.start(1000); // chunk every 1 s
    this._isRecording = true;

    // Auto-trigger clip when rage exceeds threshold
    this._unsub = eventBus.on('fusion:score', (score) => {
      if (
        this._config.enabled &&
        score.smoothed >= this._config.triggerThreshold &&
        !this._isCapturing
      ) {
        this.triggerCapture({ triggerScore: score.smoothed });
      }
    });
  }

  /** Stop the MediaRecorder and clear the rolling buffer. */
  stopRecording() {
    if (this._unsub) {
      this._unsub();
      this._unsub = null;
    }
    if (this._captureTimeout) {
      clearTimeout(this._captureTimeout);
      this._captureTimeout = null;
    }
    if (this._mediaRecorder && this._mediaRecorder.state !== 'inactive') {
      this._mediaRecorder.stop();
    }
    this._mediaRecorder = null;
    this._rollingChunks = [];
    this._isRecording = false;
    this._isCapturing = false;
    this._stream = null;
  }

  /* ------------------------------------------------------------------ */
  /*  Clip capture                                                       */
  /* ------------------------------------------------------------------ */

  /**
   * Manually (or automatically) trigger a clip capture.
   * Combines the rolling buffer with a few extra seconds of post-capture.
   * @param {Object} metadata
   * @param {string} [metadata.sessionId]
   * @param {number} [metadata.triggerScore]
   * @returns {Promise<ClipData|null>}
   */
  async triggerCapture(metadata = {}) {
    if (this._isCapturing || !this._isRecording) return null;
    this._isCapturing = true;

    // Snapshot the current rolling buffer
    const bufferBlobs = this._rollingChunks.map((c) => c.blob);

    // Continue recording for postCaptureDurationMs
    await new Promise((resolve) => {
      this._captureTimeout = setTimeout(resolve, this._config.postCaptureDurationMs);
    });

    // Grab chunks that arrived during the post-capture window
    const postCaptureStart = Date.now() - this._config.postCaptureDurationMs;
    const postBlobs = this._rollingChunks
      .filter((c) => c.timestamp > postCaptureStart)
      .map((c) => c.blob);

    // Combine into a single blob
    const allBlobs = [...bufferBlobs, ...postBlobs];
    const mimeType = this._mediaRecorder?.mimeType || 'video/webm';
    const clipBlob = new Blob(allBlobs, { type: mimeType });

    // Create a thumbnail from the current video frame (best-effort)
    const thumbnailBlob = await this._captureThumbnail();

    // Build the ClipData record
    const clip = {
      id: crypto.randomUUID(),
      sessionId: metadata.sessionId || null,
      timestamp: Date.now(),
      duration: this._config.bufferDurationMs + this._config.postCaptureDurationMs,
      triggerScore: metadata.triggerScore || 0,
      peakScore: metadata.triggerScore || 0,
      blob: clipBlob,
      thumbnailBlob,
      size: clipBlob.size,
      mimeType,
    };

    // Enforce storage limits before saving
    await this._enforceStorageLimits();

    // Persist to IndexedDB
    const db = this._db || (await getDB());
    await db.put(STORE_NAME, clip);

    eventBus.emit('clip:saved', { id: clip.id, size: clip.size });
    this._isCapturing = false;
    return clip;
  }

  /* ------------------------------------------------------------------ */
  /*  CRUD helpers                                                       */
  /* ------------------------------------------------------------------ */

  /**
   * Return all stored clips (without the heavy blob data).
   * @returns {Promise<ClipData[]>}
   */
  async getAllClips() {
    const db = this._db || (await getDB());
    return db.getAllFromIndex(STORE_NAME, 'timestamp');
  }

  /**
   * Return a single clip (including blob) by ID.
   * @param {string} id
   * @returns {Promise<ClipData|undefined>}
   */
  async getClip(id) {
    const db = this._db || (await getDB());
    return db.get(STORE_NAME, id);
  }

  /**
   * Delete a clip.
   * @param {string} id
   */
  async deleteClip(id) {
    const db = this._db || (await getDB());
    await db.delete(STORE_NAME, id);
  }

  /**
   * Sum the size of all stored clips (bytes).
   * @returns {Promise<number>}
   */
  async getStorageUsed() {
    const clips = await this.getAllClips();
    return clips.reduce((total, c) => total + (c.size || 0), 0);
  }

  /* ------------------------------------------------------------------ */
  /*  Cleanup                                                            */
  /* ------------------------------------------------------------------ */

  /** Tear down recorder, listeners, and timeouts. */
  destroy() {
    this.stopRecording();
    this._db = null;
  }

  /* ------------------------------------------------------------------ */
  /*  Private helpers                                                     */
  /* ------------------------------------------------------------------ */

  /** Remove chunks older than bufferDurationMs. */
  _pruneOldChunks() {
    const cutoff = Date.now() - this._config.bufferDurationMs;
    this._rollingChunks = this._rollingChunks.filter((c) => c.timestamp >= cutoff);
  }

  /**
   * Best-effort thumbnail capture from the stream's video track.
   * Falls back to null when Canvas/Video APIs aren't available.
   * @returns {Promise<Blob|null>}
   * @private
   */
  async _captureThumbnail() {
    try {
      if (!this._stream) return null;
      const videoTrack = this._stream.getVideoTracks()[0];
      if (!videoTrack) return null;

      // Use ImageCapture if available
      if (typeof ImageCapture !== 'undefined') {
        const capture = new ImageCapture(videoTrack);
        const bitmap = await capture.grabFrame();
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Delete oldest clips if the total count exceeds maxTotalClipsCount.
   * @private
   */
  async _enforceStorageLimits() {
    const db = this._db || (await getDB());
    const allClips = await db.getAllFromIndex(STORE_NAME, 'timestamp');

    if (allClips.length >= this._config.maxTotalClipsCount) {
      // Oldest clips first — delete until we're under the limit
      const toDelete = allClips.slice(0, allClips.length - this._config.maxTotalClipsCount + 1);
      const tx = db.transaction(STORE_NAME, 'readwrite');
      for (const clip of toDelete) {
        tx.store.delete(clip.id);
      }
      await tx.done;
    }
  }
}
