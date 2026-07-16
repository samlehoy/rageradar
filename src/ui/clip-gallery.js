/**
 * Clip Gallery Component.
 * Slide-in panel that displays saved rage clips with thumbnails,
 * playback modal, delete confirmation, and storage usage.
 */
import { eventBus } from '../utils/event-bus.js';
import { getRageColor, getRageLevel } from '../utils/rage-levels.js';
import { createFocusTrap } from '../utils/focus-trap.js';

/** Maximum storage budget in bytes (50 MB). */
const MAX_STORAGE_BYTES = 50 * 1024 * 1024;

/* ─── Helpers ──────────────────────────────────────── */

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '0s';
  const s = Math.round(seconds);
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  }
  return `${s}s`;
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export class ClipGallery {
  /**
   * @param {Object} clipRecorder — ClipRecorder instance with
   *   getAllClips(), getClip(id), deleteClip(id), getStorageUsed()
   */
  constructor(clipRecorder) {
    this._clipRecorder = clipRecorder;
    this._isOpen = false;
    this._previouslyFocused = null;
    this._playerOverlay = null;
    this._clipBlobUrls = new Map(); // id → objectURL (for cleanup)

    this._boundHandleKeydown = this._handleKeydown.bind(this);
    this._boundHandleBackdrop = this._handleBackdropClick.bind(this);
    this._boundOnClipSaved = this._onClipSaved.bind(this);

    this._render();
    this._focusTrap = createFocusTrap(this._panel);
  }

  /* ═══ Lifecycle ══════════════════════════════════ */

  async open() {
    if (this._isOpen) return;
    this._isOpen = true;
    this._previouslyFocused = document.activeElement;

    this._showLoading();

    // Show panel
    this._wrapper.classList.add('clips-wrapper--open');
    requestAnimationFrame(() => {
      this._backdrop.classList.add('clips-backdrop--visible');
      this._panel.classList.add('clips-panel--open');
      this._panel.setAttribute('aria-hidden', 'false');
    });

    document.addEventListener('keydown', this._boundHandleKeydown);
    this._backdrop.addEventListener('click', this._boundHandleBackdrop);
    this._focusTrap.activate();

    // Listen for new clips while open
    eventBus.on('clip:saved', this._boundOnClipSaved);

    await this._loadClips();
  }

  close() {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._focusTrap.deactivate();

    // Close player if open
    this._closePlayer();

    this._backdrop.classList.remove('clips-backdrop--visible');
    this._panel.classList.remove('clips-panel--open');
    this._panel.setAttribute('aria-hidden', 'true');

    document.removeEventListener('keydown', this._boundHandleKeydown);
    this._backdrop.removeEventListener('click', this._boundHandleBackdrop);
    eventBus.off('clip:saved', this._boundOnClipSaved);

    setTimeout(() => {
      if (!this._isOpen) {
        this._wrapper.classList.remove('clips-wrapper--open');
      }
    }, 300);

    if (this._previouslyFocused && typeof this._previouslyFocused.focus === 'function') {
      this._previouslyFocused.focus();
      this._previouslyFocused = null;
    }
  }

  destroy() {
    this.close();
    this._revokeAllBlobUrls();
    this._wrapper.remove();
  }

  /* ═══ DOM Scaffold ══════════════════════════════ */

  _render() {
    const wrapper = document.createElement('div');
    wrapper.className = 'clips-wrapper';

    wrapper.innerHTML = `
      <div class="clips-backdrop"></div>
      <div class="clips-panel" role="dialog" aria-modal="true" aria-hidden="true" aria-label="Rage Clips Gallery">
        <!-- Header -->
        <div class="clips-header">
          <div class="clips-header__title-group">
            <span class="clips-header__icon">🎬</span>
            <h2 class="clips-header__title">Rage Clips</h2>
          </div>
          <button class="clips-close-btn neu-btn" style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;" aria-label="Close clips gallery">
            <iconify-icon icon="lucide:x" style="font-size:14px;color:var(--muted);"></iconify-icon>
          </button>
        </div>

        <!-- Storage -->
        <div class="clips-storage">
          <div class="clips-storage__label">
            <span class="clips-storage__text">Storage: —</span>
          </div>
          <div class="clips-storage__track">
            <div class="clips-storage__fill" style="width: 0%"></div>
          </div>
        </div>

        <!-- Body -->
        <div class="clips-body neu-scroll" id="clips-body-container"></div>
      </div>
    `;

    this._wrapper = wrapper;
    this._panel = wrapper.querySelector('.clips-panel');
    this._backdrop = wrapper.querySelector('.clips-backdrop');
    this._bodyContainer = wrapper.querySelector('#clips-body-container');
    this._storageText = wrapper.querySelector('.clips-storage__text');
    this._storageFill = wrapper.querySelector('.clips-storage__fill');

    wrapper.querySelector('.clips-close-btn').addEventListener('click', () => this.close());

    document.body.appendChild(wrapper);
  }

  /* ═══ Data Loading ═════════════════════════════ */

  _showLoading() {
    this._bodyContainer.innerHTML = `
      <div class="clips-loading">
        <iconify-icon icon="lucide:loader" style="animation:spin 1s linear infinite;"></iconify-icon>
      </div>
    `;
  }

  async _loadClips() {
    try {
      const [clips, storageUsed] = await Promise.all([
        this._clipRecorder.getAllClips(),
        this._clipRecorder.getStorageUsed(),
      ]);

      this._updateStorageBar(storageUsed);

      if (!clips || clips.length === 0) {
        this._showEmpty();
        return;
      }

      // Sort newest first
      clips.sort((a, b) => b.timestamp - a.timestamp);
      this._renderClipGrid(clips);
    } catch (err) {
      console.error('[ClipGallery] Failed to load clips:', err);
      this._bodyContainer.innerHTML = `
        <div style="padding:2rem;text-align:center;font-family:var(--font-body);font-size:var(--text-small);color:var(--error);">
          Failed to load clips.
        </div>
      `;
    }
  }

  _updateStorageBar(usedBytes) {
    const pct = Math.min(100, (usedBytes / MAX_STORAGE_BYTES) * 100);
    this._storageText.textContent = `Storage: ${formatBytes(usedBytes)} / ${formatBytes(MAX_STORAGE_BYTES)}`;
    this._storageFill.style.width = `${pct.toFixed(1)}%`;

    // Color thresholds
    this._storageFill.classList.remove('clips-storage__fill--warning', 'clips-storage__fill--critical');
    if (pct >= 90) {
      this._storageFill.classList.add('clips-storage__fill--critical');
    } else if (pct >= 70) {
      this._storageFill.classList.add('clips-storage__fill--warning');
    }
  }

  _showEmpty() {
    this._bodyContainer.innerHTML = `
      <div class="clips-empty">
        <div class="clips-empty__icon">🎬</div>
        <p class="clips-empty__title">No rage clips yet</p>
        <p class="clips-empty__subtitle">High rage moments will be automatically captured here.</p>
      </div>
    `;
  }

  /* ═══ Grid Rendering ═══════════════════════════ */

  _renderClipGrid(clips) {
    this._revokeAllBlobUrls();
    this._bodyContainer.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'clips-grid';

    clips.forEach(clip => {
      grid.appendChild(this._createClipCard(clip));
    });

    this._bodyContainer.appendChild(grid);
  }

  _createClipCard(clip) {
    const card = document.createElement('div');
    card.className = 'clip-card';
    card.dataset.clipId = clip.id;

    const rageColor = getRageColor(clip.peakScore ?? clip.triggerScore ?? 0);
    const rageLevel = getRageLevel(clip.peakScore ?? clip.triggerScore ?? 0);
    const score = clip.peakScore ?? clip.triggerScore ?? 0;

    // Build thumbnail URL
    let thumbContent = '';
    if (clip.thumbnailBlob) {
      const thumbUrl = URL.createObjectURL(clip.thumbnailBlob);
      this._clipBlobUrls.set(`thumb-${clip.id}`, thumbUrl);
      thumbContent = `<img src="${thumbUrl}" alt="Clip thumbnail" loading="lazy" />`;
    } else {
      thumbContent = `
        <div class="clip-card__thumbnail-placeholder">
          <iconify-icon icon="lucide:film"></iconify-icon>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="clip-card__thumbnail">
        ${thumbContent}
        <span class="clip-card__score-badge" style="background:${rageColor};">${Math.round(score)}</span>
        <span class="clip-card__duration-badge">${formatDuration(clip.duration)}</span>
        <div class="clip-card__play-overlay">
          <div class="clip-card__play-icon">
            <iconify-icon icon="lucide:play" style="margin-left:2px;"></iconify-icon>
          </div>
        </div>
      </div>
      <div class="clip-card__info">
        <span class="clip-card__meta">${formatRelativeTime(clip.timestamp)}</span>
      </div>
      <div class="clip-card__actions">
        <button class="clip-card__action-btn clip-card__action-btn--play" aria-label="Play clip" data-action="play">
          <iconify-icon icon="lucide:play"></iconify-icon>
        </button>
        <button class="clip-card__action-btn clip-card__action-btn--delete" aria-label="Delete clip" data-action="delete">
          <iconify-icon icon="lucide:trash-2"></iconify-icon>
        </button>
      </div>
    `;

    // Click thumbnail to play
    card.querySelector('.clip-card__thumbnail').addEventListener('click', () => {
      this._openPlayer(clip);
    });

    // Play button
    card.querySelector('[data-action="play"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this._openPlayer(clip);
    });

    // Delete button
    card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
      e.stopPropagation();
      this._showDeleteConfirmation(card, clip);
    });

    return card;
  }

  /* ═══ Delete Confirmation ══════════════════════ */

  _showDeleteConfirmation(card, clip) {
    // Prevent double overlay
    if (card.querySelector('.clip-card__confirm-overlay')) return;

    const overlay = document.createElement('div');
    overlay.className = 'clip-card__confirm-overlay';
    overlay.innerHTML = `
      <p class="clip-card__confirm-text">Delete this clip?</p>
      <div class="clip-card__confirm-actions">
        <button class="clip-card__confirm-btn clip-card__confirm-btn--cancel" data-confirm="cancel">Cancel</button>
        <button class="clip-card__confirm-btn clip-card__confirm-btn--delete" data-confirm="delete">Delete</button>
      </div>
    `;

    overlay.querySelector('[data-confirm="cancel"]').addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.remove();
    });

    overlay.querySelector('[data-confirm="delete"]').addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await this._clipRecorder.deleteClip(clip.id);
        // Revoke any blob URLs for this clip
        this._revokeBlobUrl(`thumb-${clip.id}`);
        this._revokeBlobUrl(`video-${clip.id}`);
        // Reload
        await this._loadClips();
      } catch (err) {
        console.error('[ClipGallery] Failed to delete clip:', err);
        overlay.remove();
      }
    });

    card.appendChild(overlay);
  }

  /* ═══ Video Player Modal ═══════════════════════ */

  _openPlayer(clip) {
    this._closePlayer();

    let videoUrl;
    if (clip.blob) {
      videoUrl = URL.createObjectURL(clip.blob);
      this._clipBlobUrls.set(`video-${clip.id}`, videoUrl);
    } else {
      console.warn('[ClipGallery] No blob available for clip', clip.id);
      return;
    }

    const score = clip.peakScore ?? clip.triggerScore ?? 0;
    const rageColor = getRageColor(score);

    const overlay = document.createElement('div');
    overlay.className = 'clip-player-overlay';
    overlay.innerHTML = `
      <div class="clip-player-modal">
        <button class="clip-player-close" aria-label="Close player">&times;</button>
        <video controls autoplay src="${videoUrl}" ${clip.mimeType ? `type="${clip.mimeType}"` : ''}></video>
        <div class="clip-player-info">
          <span class="clip-player-info__stat">
            Rage Score: <span class="clip-player-info__stat-value" style="color:${rageColor}">${Math.round(score)}</span>
          </span>
          <span class="clip-player-info__stat">
            Duration: <span class="clip-player-info__stat-value">${formatDuration(clip.duration)}</span>
          </span>
          <button class="clip-player-download" aria-label="Download clip">
            <iconify-icon icon="lucide:download" style="font-size:14px;"></iconify-icon>
            Download
          </button>
        </div>
      </div>
    `;

    // Close button
    overlay.querySelector('.clip-player-close').addEventListener('click', () => {
      this._closePlayer();
    });

    // Clicking backdrop closes
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this._closePlayer();
      }
    });

    // Download
    overlay.querySelector('.clip-player-download').addEventListener('click', () => {
      this._downloadClip(clip, videoUrl);
    });

    this._playerOverlay = overlay;
    document.body.appendChild(overlay);
  }

  _closePlayer() {
    if (this._playerOverlay) {
      // Pause video to stop playback
      const video = this._playerOverlay.querySelector('video');
      if (video) {
        video.pause();
        video.src = '';
      }
      this._playerOverlay.remove();
      this._playerOverlay = null;
    }
  }

  _downloadClip(clip, blobUrl) {
    const a = document.createElement('a');
    a.href = blobUrl;
    const ext = clip.mimeType && clip.mimeType.includes('webm') ? 'webm' : 'mp4';
    const dateStr = new Date(clip.timestamp).toISOString().replace(/[:.]/g, '-');
    a.download = `rage-clip-${Math.round(clip.peakScore ?? clip.triggerScore ?? 0)}-${dateStr}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /* ═══ Event Handlers ═══════════════════════════ */

  _handleKeydown(e) {
    if (e.key === 'Escape') {
      if (this._playerOverlay) {
        this._closePlayer();
      } else if (this._isOpen) {
        this.close();
      }
    }
  }

  _handleBackdropClick() {
    this.close();
  }

  _onClipSaved() {
    if (this._isOpen) {
      this._loadClips();
    }
  }

  /* ═══ Blob URL Management ═════════════════════ */

  _revokeBlobUrl(key) {
    const url = this._clipBlobUrls.get(key);
    if (url) {
      URL.revokeObjectURL(url);
      this._clipBlobUrls.delete(key);
    }
  }

  _revokeAllBlobUrls() {
    for (const url of this._clipBlobUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this._clipBlobUrls.clear();
  }
}
