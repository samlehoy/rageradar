/**
 * Settings panel component.
 * Slide-in panel from the right with all configuration options.
 * Persists via localStorage and emits settings:changed events.
 */
import { eventBus } from '../utils/event-bus.js';
import { debounce } from '../utils/helpers.js';
import { loadSettings, saveSettings, resetSettings } from '../utils/settings-store.js';

const PANEL_WIDTH = 420;

// ─── Helpers ───────────────────────────────────────────

function escAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function rangeSlider({ section, key, label, min, max, step, value, unit }) {
  const id = `setting-${section}-${key}`;
  const val = value ?? 0;
  return `
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <label for="${escAttr(id)}" class="font-dm text-xs font-bold text-fg uppercase tracking-wider">${escAttr(label)}</label>
        <span class="font-mono text-xs font-bold text-violet bg-white/40 px-2 py-0.5 rounded-[6px] neu-inset-sm" data-for="${escAttr(id)}">${escAttr(val)}${unit ?? ''}</span>
      </div>
      <div class="relative flex items-center">
        <input type="range" id="${escAttr(id)}"
          class="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer range-accent-violet neu-inset-sm"
          min="${escAttr(min)}" max="${escAttr(max)}" step="${escAttr(step)}"
          value="${escAttr(val)}"
          data-section="${escAttr(section)}" data-key="${escAttr(key)}"
          aria-label="${escAttr(label)}" />
      </div>
    </div>`;
}

function toggleSwitch({ section, key, label, value }) {
  const id = `setting-${section}-${key}`;
  return `
    <div class="flex items-center justify-between py-1">
      <label for="${escAttr(id)}" class="font-dm text-xs font-bold text-fg uppercase tracking-wider">${escAttr(label)}</label>
      <button type="button" id="${escAttr(id)}" role="checkbox" aria-checked="${value}"
        class="neu-inset-sm w-10 h-5 rounded-full p-[2px] relative flex items-center transition-all duration-300 setting-toggle-btn"
        data-section="${escAttr(section)}" data-key="${escAttr(key)}" data-checked="${value}">
        <span class="w-4 h-4 rounded-full transition-all duration-300 ${value ? 'bg-teal-400 absolute right-[2px]' : 'bg-gray-400 absolute left-[2px]'} setting-toggle-dot"></span>
      </button>
    </div>`;
}

function selectDropdown({ section, key, label, value, options }) {
  const id = `setting-${section}-${key}`;
  return `
    <div class="space-y-1.5">
      <label for="${escAttr(id)}" class="font-dm text-xs font-bold text-fg uppercase tracking-wider">${escAttr(label)}</label>
      <div class="relative">
        <select id="${escAttr(id)}"
          class="w-full px-3.5 py-2.5 rounded-[12px] bg-[#E0E5EC] text-fg font-dm text-xs font-bold border-none outline-none neu-inset-sm appearance-none cursor-pointer"
          data-section="${escAttr(section)}" data-key="${escAttr(key)}"
          aria-label="${escAttr(label)}">
          ${options.map(opt => `<option value="${escAttr(opt.value)}" ${opt.value === value ? 'selected' : ''}>${escAttr(opt.label)}</option>`).join('')}
        </select>
        <div class="absolute inset-y-0 right-3 flex items-center pointer-events-none text-muted">
          <iconify-icon icon="lucide:chevron-down"></iconify-icon>
        </div>
      </div>
    </div>`;
}

// ─── HTML builders ─────────────────────────────────────

function buildSectionHTML(sectionId, title, controls) {
  return `
    <section class="space-y-4 p-5 rounded-[24px] neu-inset-deep bg-[#E0E5EC]/50" data-section="${escAttr(sectionId)}">
      <h3 class="font-jakarta font-bold text-xs uppercase tracking-widest text-muted border-b border-black/5 pb-2">${escAttr(title)}</h3>
      <div class="space-y-4">
        ${controls.join('')}
      </div>
    </section>`;
}

function buildPanelHTML() {
  const s = loadSettings();

  const cameraHTML = buildSectionHTML('camera', 'Camera Config', [
    rangeSlider({ section: 'camera', key: 'detectionFps', label: 'Detection FPS', min: 1, max: 60, step: 1, value: s.camera.detectionFps, unit: ' fps' }),
    toggleSwitch({ section: 'camera', key: 'showPreview', label: 'Show Preview', value: s.camera.showPreview }),
    toggleSwitch({ section: 'camera', key: 'showOverlay', label: 'Show Overlay', value: s.camera.showOverlay }),
  ]);

  const micHTML = buildSectionHTML('microphone', 'Audio Detection', [
    rangeSlider({ section: 'microphone', key: 'volumeWeight', label: 'Volume Weight', min: 0, max: 1, step: 0.05, value: s.microphone.volumeWeight }),
    rangeSlider({ section: 'microphone', key: 'pitchWeight', label: 'Pitch Weight', min: 0, max: 1, step: 0.05, value: s.microphone.pitchWeight }),
    rangeSlider({ section: 'microphone', key: 'noiseGateDB', label: 'Noise Gate', min: -100, max: 0, step: 1, value: s.microphone.noiseGateDB, unit: ' dB' }),
  ]);

  const fusionHTML = buildSectionHTML('fusion', 'EMA Fusion Engine', [
    rangeSlider({ section: 'fusion', key: 'faceWeight', label: 'Face Weight', min: 0, max: 1, step: 0.05, value: s.fusion.faceWeight }),
    rangeSlider({ section: 'fusion', key: 'audioWeight', label: 'Audio Weight', min: 0, max: 1, step: 0.05, value: s.fusion.audioWeight }),
    rangeSlider({ section: 'fusion', key: 'emaAlpha', label: 'EMA Alpha (Smoothing)', min: 0.05, max: 1, step: 0.05, value: s.fusion.emaAlpha }),
    rangeSlider({ section: 'fusion', key: 'momentumDecay', label: 'Momentum Decay', min: 0.5, max: 0.99, step: 0.01, value: s.fusion.momentumDecay }),
  ]);

  const alertsHTML = buildSectionHTML('alerts', 'Smart Alerts & Sound', [
    toggleSwitch({ section: 'alerts', key: 'enabled', label: 'Enable Alerts', value: s.alerts.enabled }),
    rangeSlider({ section: 'alerts', key: 'threshold', label: 'Rage Threshold', min: 0, max: 100, step: 1, value: s.alerts.threshold, unit: '%' }),
    rangeSlider({ section: 'alerts', key: 'cooldownMs', label: 'Alert Cooldown', min: 5000, max: 120000, step: 1000, value: s.alerts.cooldownMs, unit: ' ms' }),
    toggleSwitch({ section: 'alerts', key: 'soundEnabled', label: 'Play Alert Sound', value: s.alerts.soundEnabled }),
    selectDropdown({
      section: 'alerts', key: 'soundType', label: 'Alert Sound Preset', value: s.alerts.soundType,
      options: [
        { value: 'beep', label: 'Digital Beep' },
        { value: 'alarm', label: 'Warning Siren' },
        { value: 'gaming', label: 'Synth Chime' },
      ],
    }),
    rangeSlider({ section: 'alerts', key: 'volume', label: 'Master Volume', min: 0, max: 1, step: 0.05, value: s.alerts.volume }),
  ]);

  const sensitivityHTML = buildSectionHTML('sensitivity', 'App Sensitivity', [
    rangeSlider({ section: 'sensitivity', key: 'overall', label: 'Overall Gain', min: 0.1, max: 2, step: 0.1, value: s.sensitivity.overall }),
    rangeSlider({ section: 'sensitivity', key: 'decaySpeed', label: 'Decay Momentum', min: 0.5, max: 0.99, step: 0.01, value: s.sensitivity.decaySpeed }),
  ]);

  return `
    <div class="settings-panel fixed top-0 right-0 bottom-0 w-full max-w-[420px] bg-[#E0E5EC] shadow-[-10px_0_30px_rgba(0,0,0,0.1)] translate-x-full transition-transform duration-300 pointer-events-auto flex flex-col z-[101]" role="dialog" aria-modal="true" aria-hidden="true"
      aria-label="Settings" style="--panel-width: ${PANEL_WIDTH}px;">
      
      <!-- Header -->
      <div class="p-5 border-b border-[rgba(163,177,198,0.2)] flex items-center justify-between">
        <div class="flex items-center gap-2">
          <iconify-icon icon="lucide:sliders-horizontal" class="text-violet text-lg"></iconify-icon>
          <h2 class="font-jakarta font-extrabold text-lg text-fg tracking-tight">Configuration</h2>
        </div>
        <button class="settings-close neu-btn w-8 h-8 rounded-full flex items-center justify-center" aria-label="Close settings">
          <iconify-icon icon="lucide:x" class="text-muted text-sm"></iconify-icon>
        </button>
      </div>

      <!-- Body -->
      <div class="settings-body flex-1 overflow-y-auto p-5 space-y-6 neu-scroll">
        ${cameraHTML}
        ${micHTML}
        ${fusionHTML}
        ${alertsHTML}
        ${sensitivityHTML}
      </div>

      <!-- Footer -->
      <div class="p-5 border-t border-[rgba(163,177,198,0.2)] flex gap-3">
        <button class="settings-reset w-full neu-btn py-2.5 rounded-full font-dm text-xs font-bold text-muted flex items-center justify-center gap-1.5">
          <iconify-icon icon="lucide:rotate-ccw" class="text-sm"></iconify-icon>
          Reset to Defaults
        </button>
      </div>
    </div>
    <div class="settings-backdrop absolute inset-0 bg-slate-900/30 backdrop-blur-sm opacity-0 transition-opacity duration-300 pointer-events-auto z-[100]"></div>`;
}

// ─── Component ─────────────────────────────────────────

export class SettingsPanel {
  constructor() {
    this._isOpen = false;
    this._settings = loadSettings();
    this._boundHandleKeydown = this._handleKeydown.bind(this);
    this._boundHandleBackdrop = this._handleBackdropClick.bind(this);
    this._notifyDebounced = debounce((settings) => {
      eventBus.emit('settings:changed', settings);
    }, 100);

    this._render();
    this._bindEvents();
  }

  _render() {
    const wrapper = document.createElement('div');
    wrapper.className = 'settings-wrapper fixed inset-0 z-[100] pointer-events-none';
    wrapper.innerHTML = buildPanelHTML();
    this._wrapper = wrapper;
    this._panel = wrapper.querySelector('.settings-panel');
    this._backdrop = wrapper.querySelector('.settings-backdrop');
    this._closeBtn = wrapper.querySelector('.settings-close');
    this._resetBtn = wrapper.querySelector('.settings-reset');

    // Cache value displays
    this._valueDisplays = {};
    wrapper.querySelectorAll('[data-for]').forEach(el => {
      this._valueDisplays[el.dataset.for] = el;
    });

    document.body.appendChild(wrapper);
  }

  _bindEvents() {
    this._closeBtn.addEventListener('click', () => this.close());
    this._backdrop.addEventListener('click', this._boundHandleBackdrop);
    this._resetBtn.addEventListener('click', () => this._handleReset());

    if (!this._wrapperEventsSetup) {
      this._wrapper.addEventListener('input', (e) => {
        const input = e.target;
        if (input.matches('input[type="range"], select')) {
          this._handleChange(input);
        }
      });

      this._wrapper.addEventListener('change', (e) => {
        const input = e.target;
        if (input.matches('input[type="range"], select')) {
          this._handleChange(input);
        }
      });

      // Handle custom toggle buttons
      this._wrapper.addEventListener('click', (e) => {
        const btn = e.target.closest('.setting-toggle-btn');
        if (btn) {
          const checked = btn.getAttribute('data-checked') === 'true';
          const newVal = !checked;
          btn.setAttribute('data-checked', String(newVal));
          btn.setAttribute('aria-checked', String(newVal));
          const dot = btn.querySelector('.setting-toggle-dot');
          if (dot) {
            if (newVal) {
              dot.className = 'w-4 h-4 rounded-full bg-teal-400 absolute right-[2px] transition-all setting-toggle-dot';
            } else {
              dot.className = 'w-4 h-4 rounded-full bg-gray-400 absolute left-[2px] transition-all setting-toggle-dot';
            }
          }
          
          this._handleChange({
            id: btn.id,
            type: 'checkbox',
            checked: newVal,
            dataset: btn.dataset
          });
        }
      });

      this._wrapperEventsSetup = true;
    }
  }

  _handleChange(input) {
    const section = input.dataset.section || input.dataset?.section;
    const key = input.dataset.key || input.dataset?.key;
    if (!section || !key) return;

    let value;
    if (input.type === 'checkbox') {
      value = input.checked;
    } else if (input.tagName === 'SELECT' || input.tagName === 'select') {
      value = input.value;
    } else {
      value = parseFloat(input.value);
    }

    const display = this._valueDisplays[input.id];
    if (display) {
      const unit = display.textContent.replace(/[\d.-]/g, '');
      display.textContent = value + unit;
    }

    if (!this._settings[section]) this._settings[section] = {};
    this._settings[section][key] = value;

    saveSettings(this._settings);
    this._notifyDebounced(this._settings);
  }

  _handleReset() {
    this._settings = resetSettings();
    this._reloadUI();
    saveSettings(this._settings);
    eventBus.emit('settings:changed', this._settings);
  }

  _reloadUI() {
    const oldPanel = this._panel;
    const oldBackdrop = this._backdrop;
    const newWrapper = document.createElement('div');
    newWrapper.className = 'settings-wrapper fixed inset-0 z-[100]';
    newWrapper.innerHTML = buildPanelHTML();

    oldPanel.replaceWith(newWrapper.querySelector('.settings-panel'));
    oldBackdrop.replaceWith(newWrapper.querySelector('.settings-backdrop'));

    this._panel = this._wrapper.querySelector('.settings-panel');
    this._backdrop = this._wrapper.querySelector('.settings-backdrop');
    this._closeBtn = this._wrapper.querySelector('.settings-close');
    this._resetBtn = this._wrapper.querySelector('.settings-reset');

    this._valueDisplays = {};
    this._wrapper.querySelectorAll('[data-for]').forEach(el => {
      this._valueDisplays[el.dataset.for] = el;
    });

    this._bindEvents();

    if (this._isOpen) {
      this._wrapper.className = 'settings-wrapper fixed inset-0 z-[100] pointer-events-auto';
      const panel = this._panel;
      const backdrop = this._backdrop;
      if (panel) {
        panel.classList.remove('translate-x-full');
        panel.classList.add('translate-x-0');
        panel.setAttribute('aria-hidden', 'false');
      }
      if (backdrop) {
        backdrop.classList.remove('opacity-0');
        backdrop.classList.add('opacity-100');
      }
    }
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
    
    this._wrapper.className = 'settings-wrapper fixed inset-0 z-[100] pointer-events-auto';
    
    const panel = this._panel;
    const backdrop = this._backdrop;
    if (panel) {
      panel.classList.remove('translate-x-full');
      panel.classList.add('translate-x-0');
      panel.setAttribute('aria-hidden', 'false');
    }
    if (backdrop) {
      backdrop.classList.remove('opacity-0');
      backdrop.classList.add('opacity-100');
    }
    
    document.addEventListener('keydown', this._boundHandleKeydown);
    requestAnimationFrame(() => {
      this._closeBtn?.focus();
    });
    eventBus.emit('settings:open');
  }

  close() {
    if (!this._isOpen) return;
    this._isOpen = false;
    
    this._wrapper.className = 'settings-wrapper fixed inset-0 z-[100] pointer-events-none';
    
    const panel = this._panel;
    const backdrop = this._backdrop;
    if (panel) {
      panel.classList.remove('translate-x-0');
      panel.classList.add('translate-x-full');
      panel.setAttribute('aria-hidden', 'true');
    }
    if (backdrop) {
      backdrop.classList.remove('opacity-100');
      backdrop.classList.add('opacity-0');
    }
    
    document.removeEventListener('keydown', this._boundHandleKeydown);
    if (this._previouslyFocused && typeof this._previouslyFocused.focus === 'function') {
      this._previouslyFocused.focus();
      this._previouslyFocused = null;
    }
    eventBus.emit('settings:close');
  }

  toggle() {
    if (this._isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  destroy() {
    this.close();
    this._wrapper.remove();
  }
}
