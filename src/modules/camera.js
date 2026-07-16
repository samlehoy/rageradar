import * as faceapi from 'face-api.js';
import { eventBus } from '../utils/event-bus.js';

const MODEL_URL = '/models';

export class CameraModule {
  constructor(options = {}) {
    this.videoElement = null;
    this.stream = null;
    this.isRunning = false;
    this.isPaused = false;
    this._intervalId = null;
    this._modelsLoaded = false;
    this.detectionFps = options.detectionFps || 10;
  }

  /**
   * Load face-api.js models from public directory.
   */
  async loadModels() {
    if (this._modelsLoaded) return;
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
    this._modelsLoaded = true;
    eventBus.emit('camera:models-loaded');
  }

  /**
   * Start webcam stream and begin detection loop.
   * @param {HTMLVideoElement} videoElement - Video element to attach stream to
   */
  async start(videoElement) {
    if (this.isRunning) return; // Already started
    this.videoElement = videoElement;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      this.videoElement.srcObject = this.stream;
      await this.videoElement.play();

      await this.loadModels();
      this.isRunning = true;
      this._startDetectionLoop();

      const track = typeof this.stream.getVideoTracks === 'function' ? this.stream.getVideoTracks()[0] : null;
      const label = track ? track.label : 'Webcam';
      eventBus.emit('camera:started', { label });
    } catch (err) {
      eventBus.emit('camera:error', { error: err.message, errorName: err.name || 'UnknownError' });
      throw err;
    }
  }

  /**
   * Stop webcam stream and detection loop.
   */
  stop() {
    this.isRunning = false;
    this._stopDetectionLoop();

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    eventBus.emit('camera:stopped');
  }

  pause() {
    this.isPaused = true;
    this._stopDetectionLoop();
    eventBus.emit('camera:paused');
  }

  resume() {
    if (!this.isRunning) return;
    this.isPaused = false;
    this._startDetectionLoop();
    eventBus.emit('camera:resumed');
  }

  /**
   * Run a single face detection and emit result.
   * @returns {EmotionSnapshot|null}
   */
  async detect() {
    if (!this.videoElement || !this._modelsLoaded) return null;

    const detection = await faceapi
      .detectSingleFace(this.videoElement, new faceapi.TinyFaceDetectorOptions())
      .withFaceExpressions();

    if (!detection) {
      eventBus.emit('camera:no-face');
      return null;
    }

    const expressions = detection.expressions;
    const sorted = Object.entries(expressions).sort((a, b) => b[1] - a[1]);
    const [dominant, confidence] = sorted[0];

    // Include detection box for canvas overlay
    const box = detection.detection ? detection.detection.box : null;

    /** @type {EmotionSnapshot} */
    const snapshot = {
      timestamp: Date.now(),
      expressions: {
        angry: expressions.angry,
        disgusted: expressions.disgusted,
        fearful: expressions.fearful,
        happy: expressions.happy,
        neutral: expressions.neutral,
        sad: expressions.sad,
        surprised: expressions.surprised,
      },
      dominant,
      confidence,
      detection: box ? { box: { x: box.x, y: box.y, width: box.width, height: box.height } } : null,
    };

    eventBus.emit('camera:expression', snapshot);
    return snapshot;
  }

  /** @private */
  _startDetectionLoop() {
    const interval = Math.round(1000 / this.detectionFps);
    this._intervalId = setInterval(async () => {
      if (!this.isPaused && this.isRunning) {
        await this.detect();
      }
    }, interval);
  }

  /** @private */
  _stopDetectionLoop() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }
}
