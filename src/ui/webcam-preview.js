/**
 * Webcam preview component.
 * Displays video feed with face detection overlay,
 * expression label, status badge, and toggle visibility.
 */
import { eventBus } from '../utils/event-bus.js';

const ICON_EYE     = '<iconify-icon icon="lucide:eye"></iconify-icon>';
const ICON_EYE_OFF = '<iconify-icon icon="lucide:eye-off"></iconify-icon>';
const ICON_CAMERA  = '<iconify-icon icon="lucide:camera"></iconify-icon>';

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
    // Set custom tailwind and neumorphic classes directly on the container
    this.container.className = 'neu-extruded rounded-[20px] lg:rounded-[24px] p-3 lg:p-4 panel relative flex flex-col w-full';
    this.container.setAttribute('role', 'region');
    this.container.setAttribute('aria-label', 'Webcam preview');

    this.container.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <span class="font-dm text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Webcam Preview</span>
          <span class="neu-inset-sm rounded-full px-2 py-[2px] flex items-center gap-1" id="webcam-status-pill">
            <span class="status-dot w-1.5 h-1.5 rounded-full bg-gray-400"></span>
            <span class="font-dm text-[9px] font-bold uppercase tracking-wider text-muted" id="webcam-status-label">Inactive</span>
          </span>
        </div>
        <button class="webcam-preview__toggle neu-btn w-8 h-8 rounded-full flex items-center justify-center" aria-label="Toggle webcam preview">
          <span class="webcam-preview__toggle-icon flex items-center justify-center">${ICON_EYE}</span>
        </button>
      </div>

      <!-- Video feed container -->
      <div class="webcam-video-container-well neu-inset rounded-[24px] p-2 relative aspect-[4/3] bg-[rgba(163,177,198,0.06)] overflow-hidden group">
        <div class="absolute inset-2 rounded-[18px] bg-slate-800 overflow-hidden flex items-center justify-center">
          <video class="webcam-preview__video w-full h-full object-cover opacity-80 mix-blend-luminosity" autoplay playsinline muted></video>
          <canvas class="webcam-preview__overlay absolute top-0 left-0 w-full h-full pointer-events-none" aria-hidden="true"></canvas>
          
          <!-- Waiting placeholder overlay -->
          <div id="webcam-placeholder-overlay" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 text-muted gap-2 text-center p-4">
            <iconify-icon icon="lucide:video-off" class="text-3xl"></iconify-icon>
            <span class="font-dm text-xs font-medium">Camera is inactive</span>
          </div>

          <!-- Face Tracking HUD (renders when active) -->
          <div id="webcam-hud" class="absolute border-2 border-teal-400 rounded-md top-[25%] left-[30%] w-[40%] h-[50%] shadow-[0_0_15px_rgba(45,212,191,0.3)] pointer-events-none transition-all duration-300 opacity-0">
            <!-- Target corner markers -->
            <span class="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-teal-400"></span>
            <span class="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-teal-400"></span>
            <span class="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-teal-400"></span>
            <span class="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-teal-400"></span>
            
            <!-- Live tracking labels -->
            <div class="absolute -top-8 left-0 flex flex-col gap-0.5 pointer-events-none">
              <span class="bg-teal-500 text-slate-900 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Face 1</span>
              <span class="text-teal-400 font-mono text-[8px] font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" id="webcam-confidence-label">98% Conf</span>
            </div>
            <div class="absolute -bottom-10 left-0 flex flex-col pointer-events-none" id="webcam-expressions-hud-label">
              <span class="text-teal-400 font-mono text-[8px] font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">Angry: 0%</span>
              <span class="text-teal-400 font-mono text-[8px] font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">Sad: 0%</span>
            </div>
          </div>
        </div>
      </div>

      <div class="webcam-preview__banner absolute bottom-4 left-4 right-4 z-[2] text-xs font-dm p-2.5 rounded-[12px] bg-red-100 text-red-700 shadow-md text-center" role="status" aria-live="polite" hidden></div>
    `;
  }

  _cacheRefs() {
    this._videoEl = this.container.querySelector('.webcam-preview__video');
    this._canvas = this.container.querySelector('.webcam-preview__overlay');
    this._ctx = this._canvas.getContext('2d');
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
      if (typeof error === 'string' && !error.startsWith('Camera permission')) msg = 'Camera error: ' + error;
      this._showBanner(msg, 'error');
      this._setStatus('error');
    });

    // Expression detection → draw overlay + update HUD
    this._unsubExpression = eventBus.on('camera:expression', (snapshot) => {
      this._detection = snapshot;
      this._setStatus('active');
      this._drawOverlay(snapshot);
      this._hideBanner();

      const hud = this.container.querySelector('#webcam-hud');
      const placeholder = this.container.querySelector('#webcam-placeholder-overlay');
      if (hud) hud.style.opacity = '1';
      if (placeholder) placeholder.style.display = 'none';

      const confEl = this.container.querySelector('#webcam-confidence-label');
      if (confEl) {
        confEl.textContent = `${(snapshot.confidence * 100).toFixed(0)}% Conf`;
      }

      const expressionsEl = this.container.querySelector('#webcam-expressions-hud-label');
      if (expressionsEl && snapshot.expressions) {
        const angry = (snapshot.expressions.angry * 100).toFixed(0);
        const sad = (snapshot.expressions.sad * 100).toFixed(0);
        expressionsEl.innerHTML = `
          <span class="text-teal-400 font-mono text-[8px] font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">Angry: ${angry}%</span>
          <span class="text-teal-400 font-mono text-[8px] font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">Sad: ${sad}%</span>
        `;
      }
    });

    // No face detected → clear overlay, hide HUD
    this._unsubNoFace = eventBus.on('camera:no-face', () => {
      this._detection = null;
      this._setStatus('no-face');
      this._clearOverlay();
      const hud = this.container.querySelector('#webcam-hud');
      if (hud) hud.style.opacity = '0';
    });

    // Camera stopped → inactive
    this._unsubStopped = eventBus.on('camera:stopped', () => {
      this._detection = null;
      this._setStatus('inactive');
      this._clearOverlay();
      this._hideBanner();

      const hud = this.container.querySelector('#webcam-hud');
      const placeholder = this.container.querySelector('#webcam-placeholder-overlay');
      if (hud) hud.style.opacity = '0';
      if (placeholder) placeholder.style.display = 'flex';
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

  _setStatus(status) {
    this._status = status;
    const labels = {
      active: 'Active',
      'no-face': 'No Face',
      paused: 'Paused',
      inactive: 'Inactive',
      error: 'Error',
    };

    const labelEl = this.container.querySelector('#webcam-status-label');
    const pill = this.container.querySelector('#webcam-status-pill');
    const dot = this.container.querySelector('#webcam-status-pill .status-dot');

    if (labelEl) labelEl.textContent = labels[status] || 'Inactive';

    if (pill) {
      if (status === 'active') {
        pill.className = 'neu-inset-sm rounded-full px-2 py-[2px] flex items-center gap-1';
        if (labelEl) labelEl.className = 'font-dm text-[9px] font-bold uppercase tracking-wider text-teal-600';
        if (dot) dot.className = 'status-dot w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse';
      } else {
        pill.className = 'neu-inset-sm rounded-full px-2 py-[2px] flex items-center gap-1';
        if (labelEl) labelEl.className = 'font-dm text-[9px] font-bold uppercase tracking-wider text-muted';
        if (dot) dot.className = 'status-dot w-1.5 h-1.5 rounded-full bg-gray-400';
      }
    }
  }

  _drawOverlay(snapshot) {
    if (!this._canvas || !this._visible) return;

    const video = this._videoEl;
    if (!video || video.readyState < 2) return;

    this._canvas.width = video.videoWidth || 640;
    this._canvas.height = video.videoHeight || 480;

    const ctx = this._ctx;
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    if (!snapshot || !snapshot.detection) return;

    const det = snapshot.detection;
    if (det.box) {
      const { x, y, width, height } = det.box;
      ctx.strokeStyle = '#2dd4bf';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);

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

  _toggleVisibility() {
    this._visible = !this._visible;
    
    const videoWell = this.container.querySelector('.webcam-video-container-well');
    if (videoWell) {
      videoWell.style.display = this._visible ? 'block' : 'none';
    }

    this._toggleIcon.innerHTML = this._visible ? ICON_EYE : ICON_EYE_OFF;
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

  getVideoElement() {
    return this._videoEl;
  }

  show() {
    if (!this._visible) this._toggleVisibility();
  }

  hide() {
    if (this._visible) this._toggleVisibility();
  }

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
