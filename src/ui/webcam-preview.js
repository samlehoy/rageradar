/**
 * Webcam preview component.
 * Displays video feed with face detection overlay,
 * expression label, status badge, and toggle visibility.
 */
import { eventBus } from '../utils/event-bus.js';

const SVG_EYE =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';

const SVG_EYE_OFF =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

const SVG_CAMERA =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';

export class WebcamPreview {
  /**
   * @param {HTMLElement} container - Parent element to render into
   * @param {HTMLVideoElement} [videoElement] - Optional external video element
   */
  constructor(container, videoElement = null) {
    this.container = container;
    this._visible = true;
    this._status = 'inactive';
    this._detection = null;

    // Create or use video element
    this._video = videoElement || document.createElement('video');

    this._render();
    this._cacheRefs();
    this._bindEvents();
    this._subscribe();
  }

  // ─── Render ────────────────────────────────────────────

  _render() {
    this.container.classList.add('webcam-preview');
    this.container.setAttribute('role', 'region');
    this.container.setAttribute('aria-label', 'Webcam preview');

    this.container.innerHTML = `
      <video class="webcam-preview__video" autoplay playsinline muted></video>
      <canvas class="webcam-preview__overlay" aria-hidden="true"></canvas>
      <div class="webcam-preview__status" aria-live="polite">
        <span class="webcam-preview__status-dot"></span>
        <span class="webcam-preview__status-label">Inactive</span>
      </div>
      <div class="webcam-preview__expression" aria-live="off">
        <span class="webcam-preview__expression-icon">${SVG_CAMERA}</span>
        <span class="webcam-preview__expression-text">Waiting...</span>
      </div>
      <div class="webcam-preview__banner" role="status" aria-live="polite" hidden></div>
      <button class="webcam-preview__toggle" aria-label="Toggle webcam preview">
        <span class="webcam-preview__toggle-icon">${SVG_EYE}</span>
      </button>
    `;
  }

  _cacheRefs() {
    this._videoEl = this.container.querySelector('.webcam-preview__video');
    this._canvas = this.container.querySelector('.webcam-preview__overlay');
    this._ctx = this._canvas.getContext('2d');
    this._statusDot = this.container.querySelector('.webcam-preview__status-dot');
    this._statusLabel = this.container.querySelector('.webcam-preview__status-label');
    this._expressionText = this.container.querySelector('.webcam-preview__expression-text');
    this._toggleBtn = this.container.querySelector('.webcam-preview__toggle');
    this._toggleIcon = this.container.querySelector('.webcam-preview__toggle-icon');
    this._banner = this.container.querySelector('.webcam-preview__banner');
  }

  _bindEvents() {
    this._toggleBtn.addEventListener('click', () => this._toggleVisibility());
  }

  _subscribe() {
    // Loading banner while models download
    this._unsubModelsLoaded = eventBus.on('camera:models-loaded', () => {
      this._hideBanner();
    });

    // Camera started → loading done, show video
    this._unsubStarted = eventBus.on('camera:started', () => {
      this._hideBanner();
    });

    // Camera error → show inline message
    this._unsubError = eventBus.on('camera:error', ({ error }) => {
      const msgs = {
        'NotAllowedError': 'Camera permission denied. Allow camera access in browser settings.',
        'NotFoundError': 'No camera found. Connect a webcam and try again.',
        'NotReadableError': 'Camera is in use by another app. Close other apps and try again.',
      };
      let msg = error;
      for (const [err, label] of Object.entries(msgs)) {
        if (error?.includes?.(err) || error?.name === err) { msg = label; break; }
      }
      // If the error object has a .message, use it; prefer mapped labels
      if (typeof error === 'string' && !error.startsWith('Camera permission')) msg = 'Camera error: ' + error;
      this._showBanner(msg, 'error');
      this._setStatus('error');
    });

    // Expression detection → draw overlay + update label
    this._unsubExpression = eventBus.on('camera:expression', (snapshot) => {
      this._detection = snapshot;
      this._setStatus('active');
      this._updateExpressionLabel(snapshot);
      this._drawOverlay(snapshot);
      this._hideBanner();
    });

    // No face detected → clear overlay
    this._unsubNoFace = eventBus.on('camera:no-face', () => {
      this._detection = null;
      this._setStatus('no-face');
      this._clearOverlay();
      this._updateExpressionLabel(null);
    });

    // Camera stopped → inactive
    this._unsubStopped = eventBus.on('camera:stopped', () => {
      this._detection = null;
      this._setStatus('inactive');
      this._clearOverlay();
      this._updateExpressionLabel(null);
      this._hideBanner();
    });

    this._unsubPaused = eventBus.on('camera:paused', () => {
      this._detection = null;
      this._setStatus('paused');
    });

    this._unsubResumed = eventBus.on('camera:resumed', () => {
      if (this._detection) {
        this._setStatus('active');
      } else {
        this._setStatus('no-face');
      }
    });
  }

  _showBanner(msg, type) {
    if (!this._banner) return;
    this._banner.textContent = msg;
    this._banner.className = 'webcam-preview__banner webcam-preview__banner--' + (type || 'info');
    this._banner.hidden = false;
  }

  _hideBanner() {
    if (!this._banner) return;
    this._banner.hidden = true;
  }

  // ─── Status ─────────────────────────────────────────────

  /**
   * @param {'active'|'no-face'|'paused'|'inactive'} status
   */
  _setStatus(status) {
    this._status = status;
    const labels = {
      active: 'Active',
      'no-face': 'No Face Detected',
      paused: 'Paused',
      inactive: 'Inactive',
    };

    this._statusLabel.textContent = labels[status] || 'Inactive';
    this._statusDot.className = 'webcam-preview__status-dot';
    this._statusDot.classList.add(`webcam-preview__status-dot--${status}`);
  }

  _updateExpressionLabel(snapshot) {
    if (!snapshot) {
      this._expressionText.textContent = 'No face';
      return;
    }
    const confidence = (snapshot.confidence * 100).toFixed(0);
    this._expressionText.textContent = `${snapshot.dominant} (${confidence}%)`;
  }

  // ─── Canvas overlay ─────────────────────────────────────

  _drawOverlay(snapshot) {
    if (!this._canvas || !this._visible) return;

    const video = this._videoEl;
    if (!video || video.readyState < 2) return;

    // Size canvas to match video dimensions
    this._canvas.width = video.videoWidth || 640;
    this._canvas.height = video.videoHeight || 480;

    const ctx = this._ctx;
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    if (!snapshot || !snapshot.detection) return;

    // Draw bounding box if detection rect available
    const det = snapshot.detection;
    if (det.box) {
      const { x, y, width, height } = det.box;
      ctx.strokeStyle = '#2dd4bf';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);

      // Label above box
      const label = `${snapshot.dominant} ${(snapshot.confidence * 100).toFixed(0)}%`;
      ctx.fillStyle = 'rgba(45, 212, 191, 0.8)';
      ctx.font = '12px Inter, sans-serif';
      const textW = ctx.measureText(label).width;
      ctx.fillRect(x, y - 24, textW + 10, 20);
      ctx.fillStyle = '#0a0a0f';
      ctx.fillText(label, x + 5, y - 10);
    }
  }

  _clearOverlay() {
    if (!this._canvas) return;
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  // ─── Visibility toggle ──────────────────────────────────

  _toggleVisibility() {
    this._visible = !this._visible;
    this.container.classList.toggle('webcam-preview--hidden', !this._visible);
    this._toggleIcon.innerHTML = this._visible ? SVG_EYE : SVG_EYE_OFF;
    this._toggleBtn.setAttribute(
      'aria-label',
      this._visible ? 'Hide webcam preview' : 'Show webcam preview'
    );

    if (!this._visible) {
      this._clearOverlay();
    } else if (this._detection) {
      this._drawOverlay(this._detection);
    }
  }

  /**
   * Get the video element for attaching camera stream.
   * @returns {HTMLVideoElement}
   */
  getVideoElement() {
    return this._videoEl;
  }

  /**
   * Show the preview (in case hidden).
   */
  show() {
    if (!this._visible) this._toggleVisibility();
  }

  /**
   * Hide the preview.
   */
  hide() {
    if (this._visible) this._toggleVisibility();
  }

  // ─── Cleanup ────────────────────────────────────────────

  destroy() {
    this._unsubModelsLoaded?.();
    this._unsubStarted?.();
    this._unsubError?.();
    this._unsubExpression?.();
    this._unsubNoFace?.();
    this._unsubStopped?.();
    this._unsubPaused?.();
    this._unsubResumed?.();
    this._ctx?.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }
}
