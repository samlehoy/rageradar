/**
 * Toast notification system.
 * Slide-in notifications for rage alerts and system messages.
 */
import { eventBus } from '../utils/event-bus.js';

const MAX_VISIBLE = 4;
const AUTO_DISMISS_MS = 5000;

export class ToastManager {
  constructor() {
    this._toasts = new Map(); // id -> { element, timer, data }
    this._counter = 0;

    this._container = document.createElement('div');
    this._container.className = 'toast-container';
    document.body.appendChild(this._container);

    this._unsubAlert = eventBus.on('alert:triggered', (data) => {
      this.show(data);
    });
  }

  /**
   * Show a toast notification.
   * @param {Object} opts
   * @param {number} opts.score
   * @param {string} opts.level
   * @param {string} opts.color
   * @param {string} opts.emoji
   * @param {number} opts.timestamp
   * @param {string} opts.message
   * @returns {number} Toast ID
   */
  show({ score, level, color, emoji, timestamp, message } = {}) {
    const id = ++this._counter;

    // Enforce max visible — dismiss oldest
    if (this._toasts.size >= MAX_VISIBLE) {
      const oldest = this._toasts.keys().next().value;
      if (oldest != null) this._dismiss(oldest, true);
    }

    const elapsed = timestamp ? this._formatTime(new Date(timestamp)) : '';
    const variantClass = `toast--${level || 'calm'}`;

    const el = document.createElement('div');
    el.className = `toast ${variantClass}`;
    el.dataset.toastId = id;

    el.innerHTML = `
      <div class="toast__icon">${emoji || '⚠️'}</div>
      <div class="toast__body">
        <div class="toast__title">${level ? level.charAt(0).toUpperCase() + level.slice(1) : 'Alert'}</div>
        <div class="toast__message">${message || ''}</div>
        <div class="toast__time">${elapsed}</div>
        <div class="toast__progress"></div>
      </div>
      <button class="toast__close" aria-label="Dismiss"><iconify-icon icon="lucide:x"></iconify-icon></button>
    `;

    // Close button handler
    const closeBtn = el.querySelector('.toast__close');
    closeBtn.addEventListener('click', () => this._dismiss(id));

    // Auto-dismiss
    const timer = setTimeout(() => this._dismiss(id), AUTO_DISMISS_MS);

    this._container.appendChild(el);
    this._toasts.set(id, { element: el, timer, data: { score, level, color, emoji, timestamp, message } });

    return id;
  }

  /**
   * Dismiss a toast by ID.
   * @param {number} id
   * @param {boolean} [immediate=false]
   */
  _dismiss(id, immediate = false) {
    const entry = this._toasts.get(id);
    if (!entry) return;

    clearTimeout(entry.timer);

    if (immediate) {
      entry.element.remove();
      this._toasts.delete(id);
      return;
    }

    const el = entry.element;
    el.classList.add('toast--dismissing');

    setTimeout(() => {
      if (el.parentNode) el.remove();
      this._toasts.delete(id);
    }, 300); // match CSS animation duration
  }

  /**
   * Clean up all toasts and subscriptions.
   */
  destroy() {
    this._unsubAlert?.();
    for (const [id, entry] of this._toasts) {
      clearTimeout(entry.timer);
      entry.element.remove();
    }
    this._toasts.clear();
    if (this._container.parentNode) {
      this._container.remove();
    }
  }

  /**
   * Format a Date to HH:MM:SS.
   * @param {Date} date
   * @returns {string}
   */
  _formatTime(date) {
    return date.toLocaleTimeString('en-US', { hour12: false });
  }
}
