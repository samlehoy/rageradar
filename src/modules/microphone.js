import { eventBus } from '../utils/event-bus.js';

const FFT_SIZE = 2048;
const ANALYSIS_INTERVAL_MS = 33; // ~30fps

export class MicrophoneModule {
  constructor(options = {}) {
    this.stream = null;
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.isRunning = false;
    this.isPaused = false;
    this._intervalId = null;

    // Buffers
    this._timeDomainData = null;
    this._frequencyData = null;

    // Config
    this.noiseGateDB = options.noiseGateDB ?? -50;
  }

  /**
   * Start microphone stream and audio analysis.
   */
  async start() {
    if (this.stream) return; // Already started
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });

      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = FFT_SIZE;
      this.analyser.smoothingTimeConstant = 0.8;

      this.source = this.audioContext.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);

      this._timeDomainData = new Uint8Array(this.analyser.fftSize);
      this._frequencyData = new Uint8Array(this.analyser.frequencyBinCount);

      this.isRunning = true;
      this._startAnalysisLoop();

      const track = typeof this.stream.getAudioTracks === 'function' ? this.stream.getAudioTracks()[0] : null;
      const label = track ? track.label : 'Microphone';
      eventBus.emit('mic:started', { label });
    } catch (err) {
      eventBus.emit('mic:error', { error: err.message });
      throw err;
    }
  }

  /**
   * Stop microphone stream and analysis.
   */
  stop() {
    this.isRunning = false;
    this._stopAnalysisLoop();

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    eventBus.emit('mic:stopped');
  }

  pause() {
    this.isPaused = true;
    eventBus.emit('mic:paused');
  }

  resume() {
    if (!this.isRunning) return;
    this.isPaused = false;
    eventBus.emit('mic:resumed');
  }

  /**
   * Perform a single audio analysis and return snapshot.
   * @returns {AudioSnapshot}
   */
  analyse() {
    if (!this.analyser) return null;

    this.analyser.getByteTimeDomainData(this._timeDomainData);
    this.analyser.getByteFrequencyData(this._frequencyData);

    const volumeRMS = this._calculateRMS(this._timeDomainData);
    const volumeDB = this._rmsToDecibels(volumeRMS);
    const pitchHz = this._estimatePitch(this._timeDomainData);
    const spectralCentroid = this._calculateSpectralCentroid(this._frequencyData);
    const isSpeaking = volumeDB > this.noiseGateDB;

    /** @type {AudioSnapshot} */
    const snapshot = {
      timestamp: Date.now(),
      volumeRMS,
      volumeDB,
      pitchHz,
      spectralCentroid,
      isSpeaking,
    };

    eventBus.emit('mic:audio', snapshot);
    return snapshot;
  }

  /**
   * Calculate RMS volume from time-domain data.
   * @param {Uint8Array} timeDomainData
   * @returns {number} RMS volume 0.0 to 1.0
   */
  _calculateRMS(timeDomainData) {
    let sumSquares = 0;
    for (let i = 0; i < timeDomainData.length; i++) {
      const normalized = (timeDomainData[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    return Math.sqrt(sumSquares / timeDomainData.length);
  }

  /**
   * Convert RMS to decibels.
   * @param {number} rms - RMS volume 0.0 to 1.0
   * @returns {number} Volume in dB (-100 to 0)
   */
  _rmsToDecibels(rms) {
    if (rms === 0) return -100;
    return 20 * Math.log10(rms);
  }

  /**
   * Estimate fundamental frequency using autocorrelation.
   * @param {Uint8Array} timeDomainData
   * @returns {number} Estimated pitch in Hz (0 if undetectable)
   */
  _estimatePitch(timeDomainData) {
    const sampleRate = this.audioContext?.sampleRate || 44100;
    const bufferLength = timeDomainData.length;

    // Normalize
    const normalized = new Float32Array(bufferLength);
    for (let i = 0; i < bufferLength; i++) {
      normalized[i] = (timeDomainData[i] - 128) / 128;
    }

    // Autocorrelation
    const minPeriod = Math.floor(sampleRate / 1000); // 1000 Hz max
    const maxPeriod = Math.floor(sampleRate / 60);   // 60 Hz min

    let bestCorrelation = 0;
    let bestPeriod = 0;

    for (let period = minPeriod; period < maxPeriod && period < bufferLength; period++) {
      let correlation = 0;
      for (let i = 0; i < bufferLength - period; i++) {
        correlation += normalized[i] * normalized[i + period];
      }
      correlation /= (bufferLength - period);

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }

    if (bestCorrelation < 0.01 || bestPeriod === 0) return 0;
    return sampleRate / bestPeriod;
  }

  /**
   * Calculate spectral centroid (center of mass of frequency spectrum).
   * @param {Uint8Array} frequencyData
   * @returns {number} Spectral centroid in Hz
   */
  _calculateSpectralCentroid(frequencyData) {
    const sampleRate = this.audioContext?.sampleRate || 44100;
    const binWidth = sampleRate / (2 * frequencyData.length);
    let weightedSum = 0;
    let totalMagnitude = 0;

    for (let i = 0; i < frequencyData.length; i++) {
      const magnitude = frequencyData[i];
      const frequency = i * binWidth;
      weightedSum += magnitude * frequency;
      totalMagnitude += magnitude;
    }

    return totalMagnitude === 0 ? 0 : weightedSum / totalMagnitude;
  }

  /** @private */
  _startAnalysisLoop() {
    this._intervalId = setInterval(() => {
      if (!this.isPaused && this.isRunning) {
        this.analyse();
      }
    }, ANALYSIS_INTERVAL_MS);
  }

  /** @private */
  _stopAnalysisLoop() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }
}
