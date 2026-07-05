/**
 * Mobile navigation menu panel component.
 * Slides in from the left on mobile screens.
 */
import { eventBus } from '../utils/event-bus.js';

export class MobileMenu {
  /**
   * @param {Object} callbacks
   * @param {Function} callbacks.onHistory
   * @param {Function} callbacks.onSettings
   */
  constructor(callbacks = {}) {
    this._isOpen = false;
    this._callbacks = callbacks;
    this._boundHandleKeydown = this._handleKeydown.bind(this);
    this._boundHandleBackdrop = this._handleBackdropClick.bind(this);

    this._render();
    this._bindEvents();
  }

  _render() {
    const wrapper = document.createElement('div');
    wrapper.className = 'mobile-menu-wrapper fixed inset-0 z-[100] pointer-events-none';
    wrapper.style.cssText = 'visibility: hidden;';

    wrapper.innerHTML = `
      <div class="mobile-menu-backdrop absolute inset-0 bg-slate-900/30 backdrop-blur-sm opacity-0 transition-opacity duration-300 pointer-events-none z-[100]"></div>
      <div class="mobile-menu-drawer absolute top-0 bottom-0 left-0 w-[280px] max-w-[80vw] bg-[#E0E5EC] shadow-[10px_0_30px_rgba(0,0,0,0.15)] z-[101] -translate-x-full transition-transform duration-300 flex flex-col p-6 rounded-r-[32px] pointer-events-auto">
        <div class="flex items-center justify-between mb-8">
          <span class="font-jakarta font-extrabold text-xl text-fg tracking-tight">Rage<span class="text-violet">Radar</span></span>
          <button class="mobile-menu-close neu-btn w-10 h-10 rounded-full flex items-center justify-center" aria-label="Close menu">
            <iconify-icon icon="lucide:x" class="text-muted text-lg"></iconify-icon>
          </button>
        </div>
        <nav class="flex flex-col gap-4">
          <button class="menu-item neu-btn justify-start px-4 h-12 rounded-[14px] w-full flex items-center gap-3 text-fg font-dm text-sm font-bold" id="menu-dashboard">
            <iconify-icon icon="lucide:layout-dashboard" class="text-lg"></iconify-icon>
            Dashboard
          </button>
          <button class="menu-item neu-btn justify-start px-4 h-12 rounded-[14px] w-full flex items-center gap-3 text-fg font-dm text-sm font-bold" id="menu-history">
            <iconify-icon icon="lucide:history" class="text-lg"></iconify-icon>
            Session History
          </button>
          <button class="menu-item neu-btn justify-start px-4 h-12 rounded-[14px] w-full flex items-center gap-3 text-fg font-dm text-sm font-bold" id="menu-settings">
            <iconify-icon icon="lucide:settings" class="text-lg"></iconify-icon>
            Settings
          </button>
        </nav>
        <div class="mt-auto flex flex-col gap-1.5 font-dm text-[11px] text-muted font-medium">
          <span>RageRadar v1.0.0</span>
          <span>100% Local processing</span>
        </div>
      </div>
    `;

    this._wrapper = wrapper;
    this._drawer = wrapper.querySelector('.mobile-menu-drawer');
    this._backdrop = wrapper.querySelector('.mobile-menu-backdrop');
    this._closeBtn = wrapper.querySelector('.mobile-menu-close');
    this._dashboardBtn = wrapper.querySelector('#menu-dashboard');
    this._historyBtn = wrapper.querySelector('#menu-history');
    this._settingsBtn = wrapper.querySelector('#menu-settings');

    document.body.appendChild(wrapper);
  }

  _bindEvents() {
    this._closeBtn.addEventListener('click', () => this.close());
    this._backdrop.addEventListener('click', this._boundHandleBackdrop);

    this._dashboardBtn.addEventListener('click', () => {
      this.close();
    });

    this._historyBtn.addEventListener('click', () => {
      this.close();
      this._callbacks.onHistory?.();
    });

    this._settingsBtn.addEventListener('click', () => {
      this.close();
      this._callbacks.onSettings?.();
    });
  }

  _handleKeydown(e) {
    if (e.key === 'Escape' && this._isOpen) {
      this.close();
    }
  }

  _handleBackdropClick() {
    this.close();
  }

  open() {
    if (this._isOpen) return;
    this._isOpen = true;
    this._previouslyFocused = document.activeElement;

    this._wrapper.style.visibility = 'visible';
    this._wrapper.className = 'mobile-menu-wrapper fixed inset-0 z-[100] pointer-events-auto';
    document.body.classList.add('no-scroll');

    requestAnimationFrame(() => {
      this._backdrop.classList.remove('opacity-0', 'pointer-events-none');
      this._backdrop.classList.add('opacity-100', 'pointer-events-auto');
      this._drawer.classList.remove('-translate-x-full');
      this._drawer.classList.add('translate-x-0');
    });

    document.addEventListener('keydown', this._boundHandleKeydown);
    requestAnimationFrame(() => {
      this._closeBtn?.focus();
    });
  }

  close() {
    if (!this._isOpen) return;
    this._isOpen = false;

    this._backdrop.classList.remove('opacity-100', 'pointer-events-auto');
    this._backdrop.classList.add('opacity-0', 'pointer-events-none');
    this._drawer.classList.remove('translate-x-0');
    this._drawer.classList.add('-translate-x-full');

    document.body.classList.remove('no-scroll');
    document.removeEventListener('keydown', this._boundHandleKeydown);

    setTimeout(() => {
      if (!this._isOpen) {
        this._wrapper.style.visibility = 'hidden';
        this._wrapper.className = 'mobile-menu-wrapper fixed inset-0 z-[100] pointer-events-none';
      }
    }, 300);

    if (this._previouslyFocused && typeof this._previouslyFocused.focus === 'function') {
      this._previouslyFocused.focus();
      this._previouslyFocused = null;
    }
  }

  destroy() {
    this.close();
    this._wrapper.remove();
  }
}
