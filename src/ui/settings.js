/**
 * Settings panel component.
 * Slide-in panel from the right with all configuration options.
 * Presists via localStorage and emits settings:changed events.
 */
import { eventBus } from '../utils/event-bus.js';
import { debounce } from '../utils/helpers.js';
import { loadSettings, saveSettings, resetSettings, DEFAULT_SETTINGS } from '../utils/settings-store.js';

const PANEL_WIDTH = 360;

// ─── Helpers ───────────────────────────────────────────

function escAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function kebabCase(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function rangeSlider({ section, key, label, min, max, step, value, unit }) {
  const id = `setting-${section}-${key}`;
  const val = value ?? 0;
  return `
    <div class="setting-row">
      <label for="${escAttr(id)}" class="setting-label">${escAttr(label)}</label>
      <div class="setting-range-group">
        <input type="range" id="${escAttr(id)}"
          class="setting-slider"
          min="${escAttr(min)}" max="${escAttr(max)}" step="${escAttr(step)}"
          value="${escAttr(val)}"
          data-section="${escAttr(section)}" data-key="${escAttr(key)}"
          aria-label="${escAttr(label)}" />
        <span class="setting-value" data-for="${escAttr(id)}">${escAttr(val)}${unit ?? ''}</span>
      </div>
    </div>`;
}

function toggleSwitch({ section, key, label, value }) {
  const id = `setting-${section}-${key}`;
  return `
    <div class="setting-row setting-row--toggle">
      <label for="${escAttr(id)}" class="setting-label">${escAttr(label)}</label>
      <div class="setting-toggle-group">
        <input type="checkbox" id="${escAttr(id)}"
          class="setting-toggle"
          data-section="${escAttr(section)}" data-key="${escAttr(key)}"
          ${value ? 'checked' : ''}
          aria-label="${escAttr(label)}" />
        <span class="setting-toggle-track">
          <span class="setting-toggle-thumb"></span>
        </span>
      </div>
    </div>`;
}

function selectDropdown({ section, key, label, value, options }) {
  const id = `setting-${section}-${key}`;
  return `
    <div class="setting-row">
      <label for="${escAttr(id)}" class="setting-label">${escAttr(label)}</label>
      <div class="setting-select-group">
        <select id="${escAttr(id)}"
          class="setting-select"
          data-section="${escAttr(section)}" data-key="${escAttr(key)}"
          aria-label="${escAttr(label)}">
          ${options.map(opt => `<option value="${escAttr(opt.value)}" ${opt.value === value ? 'selected' : ''}>${escAttr(opt.label)}</option>`).join('')}
        </select>
      </div>
    </div>`;
}

// ─── HTML builders ─────────────────────────────────────

function buildSectionHTML(sectionId, title, controls) {
  return `
    <section class="settings-section" data-section="${escAttr(sectionId)}">
      <h3 class="settings-section-title">${escAttr(title)}</h3>
      <div class="settings-section-body">
        ${controls.join('')}
      </div>
    </section>`;
}

function buildPanelHTML() {
  const s = loadSettings();

  const cameraHTML = buildSectionHTML('camera', 'Camera', [
    rangeSlider({ section: 'camera', key: 'detectionFps', label: 'Detection FPS', min: 1, max: 60, step: 1, value: s.camera.detectionFps, unit: ' fps' }),
    toggleSwitch({ section: 'camera', key: 'showPreview', label: 'Show Preview', value: s.camera.showPreview }),
    toggleSwitch({ section: 'camera', key: 'showOverlay', label: 'Show Overlay', value: s.camera.showOverlay }),
  ]);

  const micHTML = buildSectionHTML('microphone', 'Microphone', [
    rangeSlider({ section: 'microphone', key: 'volumeWeight', label: 'Volume Weight', min: 0, max: 1, step: 0.05, value: s.microphone.volumeWeight }),
    rangeSlider({ section: 'microphone', key: 'pitchWeight', label: 'Pitch Weight', min: 0, max: 1, step: 0.05, value: s.microphone.pitchWeight }),
    rangeSlider({ section: 'microphone', key: 'noiseGateDB', label: 'Noise Gate (dB)', min: -100, max: 0, step: 1, value: s.microphone.noiseGateDB, unit: ' dB' }),
  ]);

  const fusionHTML = buildSectionHTML('fusion', 'Fusion', [
    rangeSlider({ section: 'fusion', key: 'faceWeight', label: 'Face Weight', min: 0, max: 1, step: 0.05, value: s.fusion.faceWeight }),
    rangeSlider({ section: 'fusion', key: 'audioWeight', label: 'Audio Weight', min: 0, max: 1, step: 0.05, value: s.fusion.audioWeight }),
    rangeSlider({ section: 'fusion', key: 'emaAlpha', label: 'EMA Alpha', min: 0.05, max: 1, step: 0.05, value: s.fusion.emaAlpha }),
    rangeSlider({ section: 'fusion', key: 'momentumDecay', label: 'Momentum Decay', min: 0.5, max: 0.99, step: 0.01, value: s.fusion.momentumDecay }),
  ]);

  const alertsHTML = buildSectionHTML('alerts', 'Alerts', [
    toggleSwitch({ section: 'alerts', key: 'enabled', label: 'Enable Alerts', value: s.alerts.enabled }),
    rangeSlider({ section: 'alerts', key: 'threshold', label: 'Threshold', min: 0, max: 100, step: 1, value: s.alerts.threshold, unit: '%' }),
    rangeSlider({ section: 'alerts', key: 'cooldownMs', label: 'Cooldown', min: 5000, max: 120000, step: 1000, value: s.alerts.cooldownMs, unit: ' ms' }),
    toggleSwitch({ section: 'alerts', key: 'soundEnabled', label: 'Alert Sound', value: s.alerts.soundEnabled }),
    selectDropdown({
      section: 'alerts', key: 'soundType', label: 'Sound', value: s.alerts.soundType,
      options: [
        { value: 'beep', label: 'Beep' },
        { value: 'alarm', label: 'Alarm' },
        { value: 'gaming', label: 'Gaming' },
      ],
    }),
    rangeSlider({ section: 'alerts', key: 'volume', label: 'Sound Volume', min: 0, max: 1, step: 0.05, value: s.alerts.volume }),
  ]);

  const sensitivityHTML = buildSectionHTML('sensitivity', 'Sensitivity', [
    rangeSlider({ section: 'sensitivity', key: 'overall', label: 'Overall', min: 0.1, max: 2, step: 0.1, value: s.sensitivity.overall }),
    rangeSlider({ section: 'sensitivity', key: 'decaySpeed', label: 'Decay Speed', min: 0.5, max: 0.99, step: 0.01, value: s.sensitivity.decaySpeed }),
  ]);

  return `
    <div class="settings-panel" role="dialog" aria-modal="true" aria-hidden="true"
      aria-label="Settings" style="--panel-width: ${PANEL_WIDTH}px;">
      <div class="settings-header">
        <h2 class="settings-title">Settings</h2>
        <button class="settings-close" aria-label="Close settings">&times;</button>
      </div>
      <div class="settings-body">
        ${cameraHTML}
        ${micHTML}
        ${fusionHTML}
        ${alertsHTML}
        ${sensitivityHTML}
      </div>
      <div class="settings-footer">
        <button class="settings-reset">Reset to Defaults</button>
      </div>
    </div>
    <div class="settings-backdrop"></div>`;
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
    wrapper.className = 'settings-wrapper';
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

    // Force layout before adding open class for transition
    requestAnimationFrame(() => {
      wrapper.classList.add('settings-wrapper--ready');
    });
  }

  _bindEvents() {
    this._closeBtn.addEventListener('click', () => this.close());

    this._backdrop.addEventListener('click', this._boundHandleBackdrop);

    this._resetBtn.addEventListener('click', () => this._handleReset());

    // Wrapper input/change listeners guarded against rebinding
    if (!this._wrapperEventsSetup) {
      this._wrapper.addEventListener('input', (e) => {
        const input = e.target;
        if (input.matches('.setting-slider, .setting-toggle, .setting-select')) {
          this._handleChange(input);
        }
      });

      this._wrapper.addEventListener('change', (e) => {
        const input = e.target;
        if (input.matches('.setting-slider, .setting-toggle, .setting-select')) {
          this._handleChange(input);
        }
      });

      this._wrapperEventsSetup = true;
    }
  }

  _handleChange(input) {
    const section = input.dataset.section;
    const key = input.dataset.key;
    let value;

    if (input.type === 'checkbox') {
      value = input.checked;
    } else if (input.tagName === 'SELECT') {
      value = input.value;
    } else {
      value = parseFloat(input.value);
    }

    // Update value display for sliders
    const display = this._valueDisplays[input.id];
    if (display) {
      const unit = display.textContent.replace(/[\d.-]/g, '');
      display.textContent = value + unit;
    }

    // Update in-memory settings
    if (!this._settings[section]) this._settings[section] = {};
    this._settings[section][key] = value;

    // Persist and notify
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
    // Regenerate the panel HTML and replace
    const oldPanel = this._panel;
    const oldBackdrop = this._backdrop;
    const newWrapper = document.createElement('div');
    newWrapper.className = 'settings-wrapper';
    newWrapper.innerHTML = buildPanelHTML();

    oldPanel.replaceWith(newWrapper.querySelector('.settings-panel'));
    oldBackdrop.replaceWith(newWrapper.querySelector('.settings-backdrop'));

    // Re-cache refs
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
      this._wrapper.classList.add('settings-wrapper--ready');
      requestAnimationFrame(() => {
        this._panel.classList.add('settings-panel--open');
        this._backdrop.classList.add('settings-backdrop--visible');
      });
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

  /**
   * Open the settings panel.
   */
  open() {
    if (this._isOpen) return;
    this._isOpen = true;
    // Remember the element that triggered the open, so we can return focus on close
    this._previouslyFocused = document.activeElement;
    this._panel.classList.add('settings-panel--open');
    this._backdrop.classList.add('settings-backdrop--visible');
    this._panel.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', this._boundHandleKeydown);
    // Move focus into the panel — prefer the close button (always present)
    requestAnimationFrame(() => {
      this._closeBtn?.focus();
    });
    eventBus.emit('settings:open');
  }

  /**
   * Close the settings panel.
   */
  close() {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._panel.classList.remove('settings-panel--open');
    this._backdrop.classList.remove('settings-backdrop--visible');
    this._panel.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', this._boundHandleKeydown);
    // Return focus to the trigger element if it's still focusable
    if (this._previouslyFocused && typeof this._previouslyFocused.focus === 'function') {
      this._previouslyFocused.focus();
      this._previouslyFocused = null;
    }
    eventBus.emit('settings:close');
  }

  /**
   * Toggle open/closed state.
   */
  toggle() {
    if (this._isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Clean up DOM nodes and event listeners.
   */
  destroy() {
    this.close();
    this._wrapper.remove();
  }
}
