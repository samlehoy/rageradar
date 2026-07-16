/**
 * Profile Switcher Component.
 * Header indicator pill with quick-switch dropdown,
 * plus a full slide-in panel for managing game profiles.
 */
import { createFocusTrap } from '../utils/focus-trap.js';
import { eventBus } from '../utils/event-bus.js';

// ─── Constants ─────────────────────────────────────────

const EMOJI_OPTIONS = [
  '🎮', '🎯', '⚔️', '🏹', '🔫', '🎲', '🏎️', '🧩', '⚽', '🏀',
  '🎸', '🚀', '🐉', '💀', '🛡️', '⚡', '🔥', '🌟', '🎪', '🤖',
];

const COLOR_OPTIONS = [
  { name: 'violet', value: '#6C63FF' },
  { name: 'blue',   value: '#3B82F6' },
  { name: 'green',  value: '#22C55E' },
  { name: 'yellow', value: '#EAB308' },
  { name: 'orange', value: '#F97316' },
  { name: 'red',    value: '#EF4444' },
  { name: 'pink',   value: '#EC4899' },
];

// ─── Helpers ───────────────────────────────────────────

function escAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Never';
  const delta = Date.now() - timestamp;
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Component ─────────────────────────────────────────

export class ProfileSwitcher {
  /**
   * @param {GameProfileManager} gameProfileManager
   */
  constructor(gameProfileManager) {
    this._manager = gameProfileManager;
    this._isOpen = false;
    this._dropdownOpen = false;
    this._formMode = null; // null | 'add' | 'edit'
    this._editingId = null;
    this._previouslyFocused = null;

    // Bound handlers
    this._boundHandleKeydown = this._handleKeydown.bind(this);
    this._boundHandleBackdrop = this._handleBackdropClick.bind(this);
    this._boundCloseDropdown = this._closeDropdownOnOutside.bind(this);

    // Event bus listeners
    this._boundOnProfileChanged = this._onProfileChanged.bind(this);
    this._boundOnSessionStopped = this._onSessionStopped.bind(this);
    eventBus.on('profile:changed', this._boundOnProfileChanged);
    eventBus.on('session:stopped', this._boundOnSessionStopped);

    // Build panel (hidden until open())
    this._renderPanel();
    this._focusTrap = createFocusTrap(this._wrapper);
  }

  // ─── Header Indicator ──────────────────────────────

  /**
   * Render the profile indicator pill inside the given container.
   * @param {HTMLElement} container
   */
  renderHeaderIndicator(container) {
    this._indicatorContainer = container;
    const el = document.createElement('div');
    el.className = 'profile-indicator';
    el.id = 'profile-indicator';
    el.innerHTML = `
      <span class="profile-icon">🎮</span>
      <span class="profile-name">No Game Selected</span>
      <button class="profile-switch-btn" aria-label="Switch game profile">▾</button>
      <div class="profile-dropdown" id="profile-dropdown"></div>
    `;
    container.appendChild(el);

    this._indicator = el;
    this._dropdown = el.querySelector('.profile-dropdown');

    // Open dropdown on click
    el.addEventListener('click', (e) => {
      if (e.target.closest('.profile-dropdown')) return;
      e.stopPropagation();
      this._toggleDropdown();
    });

    this._refreshIndicator();
  }

  _refreshIndicator() {
    if (!this._indicator) return;
    const active = this._manager.getActiveProfile();
    const nameEl = this._indicator.querySelector('.profile-name');
    const iconEl = this._indicator.querySelector('.profile-icon');

    if (active) {
      nameEl.textContent = active.name;
      iconEl.textContent = active.icon || '🎮';
    } else {
      nameEl.textContent = 'No Game Selected';
      iconEl.textContent = '🎮';
    }
  }

  // ─── Dropdown ──────────────────────────────────────

  async _toggleDropdown() {
    if (this._dropdownOpen) {
      this._closeDropdown();
    } else {
      await this._openDropdown();
    }
  }

  async _openDropdown() {
    const profiles = await this._manager.getAllProfiles();
    const active = this._manager.getActiveProfile();

    let html = '';
    if (profiles.length === 0) {
      html = `
        <div class="profile-dropdown__item" style="color: var(--muted); cursor: default; pointer-events: none;">
          <span class="profile-dropdown__item-name">No profiles yet</span>
        </div>
      `;
    } else {
      html = profiles.map(p => {
        const isActive = active && active.id === p.id;
        return `
          <button class="profile-dropdown__item ${isActive ? 'profile-dropdown__item--active' : ''}"
                  data-profile-id="${escAttr(p.id)}">
            <span class="profile-dropdown__item-icon">${p.icon || '🎮'}</span>
            <span class="profile-dropdown__item-name">${escAttr(p.name)}</span>
            ${isActive ? '<span class="profile-dropdown__item-check">✓</span>' : ''}
          </button>
        `;
      }).join('');
    }

    html += `
      <div class="profile-dropdown__divider"></div>
      <button class="profile-dropdown__manage" id="dropdown-manage-btn">
        <span>⚙</span>
        <span>Manage Profiles</span>
      </button>
    `;

    this._dropdown.innerHTML = html;
    this._dropdown.classList.add('profile-dropdown--open');
    this._dropdownOpen = true;

    // Bind clicks
    this._dropdown.querySelectorAll('[data-profile-id]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.profileId;
        await this._manager.setActiveProfile(id);
        this._closeDropdown();
      });
    });

    this._dropdown.querySelector('#dropdown-manage-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this._closeDropdown();
      this.open();
    });

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', this._boundCloseDropdown);
    }, 0);
  }

  _closeDropdown() {
    this._dropdown.classList.remove('profile-dropdown--open');
    this._dropdownOpen = false;
    document.removeEventListener('click', this._boundCloseDropdown);
  }

  _closeDropdownOnOutside(e) {
    if (!this._indicator.contains(e.target)) {
      this._closeDropdown();
    }
  }

  // ─── Panel ─────────────────────────────────────────

  _renderPanel() {
    const wrapper = document.createElement('div');
    wrapper.className = 'profiles-wrapper';
    wrapper.innerHTML = `
      <div class="profiles-backdrop"></div>
      <div class="profiles-panel" role="dialog" aria-modal="true" aria-hidden="true" aria-label="Game Profiles">
        <!-- Dynamic content injected here -->
      </div>
    `;

    this._wrapper = wrapper;
    this._panel = wrapper.querySelector('.profiles-panel');
    this._backdrop = wrapper.querySelector('.profiles-backdrop');

    document.body.appendChild(wrapper);
  }

  async open() {
    if (this._isOpen) return;
    this._isOpen = true;
    this._formMode = null;
    this._editingId = null;
    this._previouslyFocused = document.activeElement;

    await this._showListView();

    this._wrapper.classList.add('profiles-wrapper--open');
    this._backdrop.classList.add('profiles-backdrop--visible');
    this._panel.classList.add('profiles-panel--open');
    this._panel.setAttribute('aria-hidden', 'false');

    document.addEventListener('keydown', this._boundHandleKeydown);
    this._backdrop.addEventListener('click', this._boundHandleBackdrop);
    this._focusTrap.activate();
  }

  close() {
    if (!this._isOpen) return;
    this._isOpen = false;
    this._focusTrap.deactivate();

    this._panel.classList.remove('profiles-panel--open');
    this._backdrop.classList.remove('profiles-backdrop--visible');
    this._panel.setAttribute('aria-hidden', 'true');

    // Delay hiding wrapper to allow transition
    setTimeout(() => {
      if (!this._isOpen) {
        this._wrapper.classList.remove('profiles-wrapper--open');
      }
    }, 300);

    document.removeEventListener('keydown', this._boundHandleKeydown);
    this._backdrop.removeEventListener('click', this._boundHandleBackdrop);

    if (this._previouslyFocused && typeof this._previouslyFocused.focus === 'function') {
      this._previouslyFocused.focus();
      this._previouslyFocused = null;
    }
  }

  // ─── Panel: List View ──────────────────────────────

  async _showListView() {
    this._formMode = null;
    this._editingId = null;

    const active = this._manager.getActiveProfile();

    this._panel.innerHTML = `
      <!-- Header -->
      <div class="profiles-header">
        <h2 class="profiles-title">
          <span>🎮</span>
          Game Profiles
        </h2>
        <button class="profiles-close" aria-label="Close profiles">
          <iconify-icon icon="lucide:x"></iconify-icon>
        </button>
      </div>

      ${active ? `
        <div class="profiles-active-banner">
          <span class="profiles-active-banner__icon">${active.icon || '🎮'}</span>
          <div>
            <div class="profiles-active-banner__label">Active</div>
            <div class="profiles-active-banner__text">${escAttr(active.name)}</div>
          </div>
          <button class="profiles-active-banner__clear" id="profiles-clear-active">Clear</button>
        </div>
      ` : ''}

      <!-- Body -->
      <div class="profiles-body">
        <div class="profiles-loading">
          <iconify-icon icon="lucide:loader"></iconify-icon>
        </div>
      </div>
    `;

    // Bind header events
    this._panel.querySelector('.profiles-close').addEventListener('click', () => this.close());

    const clearBtn = this._panel.querySelector('#profiles-clear-active');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this._manager.clearActiveProfile();
        this._showListView();
      });
    }

    await this._loadProfiles();
  }

  async _loadProfiles() {
    const body = this._panel.querySelector('.profiles-body');
    try {
      const profiles = await this._manager.getAllProfiles();
      const active = this._manager.getActiveProfile();

      if (profiles.length === 0) {
        body.innerHTML = `
          <div class="profiles-empty">
            <div class="profiles-empty__icon">🎮</div>
            <div class="profiles-empty__title">No profiles yet</div>
            <div class="profiles-empty__sub">Create a game profile to track per-game rage stats.</div>
          </div>
          <button class="profile-add-btn" id="profiles-add-btn">
            <iconify-icon icon="lucide:plus"></iconify-icon>
            Add New Profile
          </button>
        `;
        body.querySelector('#profiles-add-btn').addEventListener('click', () => this._showForm('add'));
        return;
      }

      // Load stats for each profile
      const statsMap = {};
      for (const p of profiles) {
        try {
          statsMap[p.id] = await this._manager.getProfileStats(p.id);
        } catch {
          statsMap[p.id] = { sessionCount: 0, avgRage: 0, maxRage: 0, lastPlayedAt: null };
        }
      }

      let cardsHTML = '';
      for (const p of profiles) {
        const isActive = active && active.id === p.id;
        const stats = statsMap[p.id] || {};
        const borderColor = p.color || 'var(--violet)';

        cardsHTML += `
          <div class="profile-card ${isActive ? 'profile-card--active' : ''}"
               style="border-left-color: ${isActive ? borderColor : 'transparent'}"
               data-profile-id="${escAttr(p.id)}">
            <div class="profile-card__header">
              <div class="profile-card__icon" style="background: ${borderColor}20;">${p.icon || '🎮'}</div>
              <span class="profile-card__name">${escAttr(p.name)}</span>
              ${isActive ? '<span class="profile-card__badge">Active</span>' : ''}
            </div>

            <div class="profile-card__stats">
              <span class="profile-card__stat">${stats.sessionCount ?? 0} sessions</span>
              <span class="profile-card__stat">Avg: ${stats.avgRage ?? 0}</span>
              <span class="profile-card__stat">Max: ${stats.maxRage ?? 0}</span>
            </div>

            <div class="profile-card__last-played">
              Last: ${formatRelativeTime(stats.lastPlayedAt)}
            </div>

            <div class="profile-card__actions">
              ${isActive
                ? '<button class="profile-card__action profile-card__action--select" disabled style="opacity:0.5">Selected</button>'
                : `<button class="profile-card__action profile-card__action--select" data-action="select" data-id="${escAttr(p.id)}">
                    <iconify-icon icon="lucide:check-circle"></iconify-icon> Select
                   </button>`
              }
              <button class="profile-card__action" data-action="edit" data-id="${escAttr(p.id)}">
                <iconify-icon icon="lucide:pencil"></iconify-icon> Edit
              </button>
              <button class="profile-card__action profile-card__action--delete" data-action="delete" data-id="${escAttr(p.id)}">
                <iconify-icon icon="lucide:trash-2"></iconify-icon> Delete
              </button>
            </div>
          </div>
        `;
      }

      cardsHTML += `
        <button class="profile-add-btn" id="profiles-add-btn">
          <iconify-icon icon="lucide:plus"></iconify-icon>
          Add New Profile
        </button>
      `;

      body.innerHTML = cardsHTML;

      // Bind card actions
      body.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          const id = btn.dataset.id;
          if (action === 'select') this._selectProfile(id);
          else if (action === 'edit') this._editProfile(id);
          else if (action === 'delete') this._deleteProfile(id);
        });
      });

      body.querySelector('#profiles-add-btn').addEventListener('click', () => this._showForm('add'));

    } catch (err) {
      console.error('Failed to load profiles:', err);
      body.innerHTML = `
        <div style="text-align:center; padding:2rem; color:var(--error); font-family:var(--font-body); font-size:var(--text-small);">
          Failed to load profiles.
        </div>
      `;
    }
  }

  // ─── Actions ───────────────────────────────────────

  async _selectProfile(id) {
    try {
      await this._manager.setActiveProfile(id);
      await this._showListView();
    } catch (err) {
      console.error('Failed to select profile:', err);
    }
  }

  async _editProfile(id) {
    try {
      const profile = await this._manager.getProfile(id);
      if (profile) {
        this._showForm('edit', profile);
      }
    } catch (err) {
      console.error('Failed to load profile for editing:', err);
    }
  }

  async _deleteProfile(id) {
    const profile = await this._manager.getProfile(id);
    const name = profile ? profile.name : 'this profile';
    if (confirm(`Delete "${name}"? This will remove the profile and all associated data.`)) {
      try {
        await this._manager.deleteProfile(id);
        await this._showListView();
      } catch (err) {
        console.error('Failed to delete profile:', err);
      }
    }
  }

  // ─── Add/Edit Form ────────────────────────────────

  _showForm(mode, profile = null) {
    this._formMode = mode;
    this._editingId = profile?.id || null;

    const body = this._panel.querySelector('.profiles-body');
    const isEdit = mode === 'edit' && profile;
    const selectedIcon = isEdit ? (profile.icon || '🎮') : '🎮';
    const selectedColor = isEdit ? (profile.color || COLOR_OPTIONS[0].value) : COLOR_OPTIONS[0].value;
    const nameValue = isEdit ? profile.name : '';

    const emojiGridHTML = EMOJI_OPTIONS.map(emoji => `
      <button type="button"
              class="profile-emoji-btn ${emoji === selectedIcon ? 'profile-emoji-btn--selected' : ''}"
              data-emoji="${emoji}"
              aria-label="Select ${emoji}">
        ${emoji}
      </button>
    `).join('');

    const colorRowHTML = COLOR_OPTIONS.map(c => `
      <button type="button"
              class="profile-color-swatch ${c.value === selectedColor ? 'profile-color-swatch--selected' : ''}"
              style="background: ${c.value}; color: ${c.value};"
              data-color="${escAttr(c.value)}"
              aria-label="Select ${c.name}">
      </button>
    `).join('');

    const formHTML = `
      <div class="profile-form">
        <div class="profile-form__title">${isEdit ? 'Edit Profile' : 'New Profile'}</div>

        <div class="profile-form__group">
          <label class="profile-form__label" for="profile-name-input">Profile Name</label>
          <input type="text"
                 class="profile-form__input"
                 id="profile-name-input"
                 placeholder="e.g. Valorant, League of Legends"
                 value="${escAttr(nameValue)}"
                 maxlength="50"
                 autocomplete="off" />
        </div>

        <div class="profile-form__group">
          <span class="profile-form__label">Icon</span>
          <div class="profile-emoji-grid" id="profile-emoji-grid">
            ${emojiGridHTML}
          </div>
        </div>

        <div class="profile-form__group">
          <span class="profile-form__label">Color</span>
          <div class="profile-color-row" id="profile-color-row">
            ${colorRowHTML}
          </div>
        </div>

        <div class="profile-form__actions">
          <button class="profile-form__save" id="profile-form-save" ${!nameValue ? 'disabled' : ''}>
            ${isEdit ? 'Save Changes' : 'Create Profile'}
          </button>
          <button class="profile-form__cancel" id="profile-form-cancel">Cancel</button>
        </div>
      </div>
    `;

    // Prepend form, keep existing cards below if adding
    if (mode === 'add') {
      body.insertAdjacentHTML('afterbegin', formHTML);
    } else {
      // Replace the specific card with the form
      const card = body.querySelector(`[data-profile-id="${this._editingId}"]`);
      if (card) {
        card.insertAdjacentHTML('beforebegin', formHTML);
        card.style.display = 'none';
      } else {
        body.insertAdjacentHTML('afterbegin', formHTML);
      }
    }

    // Form state
    let currentIcon = selectedIcon;
    let currentColor = selectedColor;
    const form = body.querySelector('.profile-form');
    const nameInput = form.querySelector('#profile-name-input');
    const saveBtn = form.querySelector('#profile-form-save');
    const cancelBtn = form.querySelector('#profile-form-cancel');

    // Auto-focus name input
    requestAnimationFrame(() => nameInput.focus());

    // Enable/disable save based on name
    nameInput.addEventListener('input', () => {
      saveBtn.disabled = nameInput.value.trim().length === 0;
    });

    // Emoji selection
    form.querySelector('#profile-emoji-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('.profile-emoji-btn');
      if (!btn) return;
      form.querySelectorAll('.profile-emoji-btn').forEach(b => b.classList.remove('profile-emoji-btn--selected'));
      btn.classList.add('profile-emoji-btn--selected');
      currentIcon = btn.dataset.emoji;
    });

    // Color selection
    form.querySelector('#profile-color-row').addEventListener('click', (e) => {
      const btn = e.target.closest('.profile-color-swatch');
      if (!btn) return;
      form.querySelectorAll('.profile-color-swatch').forEach(b => b.classList.remove('profile-color-swatch--selected'));
      btn.classList.add('profile-color-swatch--selected');
      currentColor = btn.dataset.color;
    });

    // Save
    saveBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) return;
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';

      try {
        if (isEdit) {
          await this._manager.updateProfile(this._editingId, {
            name,
            icon: currentIcon,
            color: currentColor,
          });
        } else {
          await this._manager.createProfile(name, {
            icon: currentIcon,
            color: currentColor,
          });
        }
        await this._showListView();
      } catch (err) {
        console.error('Failed to save profile:', err);
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? 'Save Changes' : 'Create Profile';
      }
    });

    // Cancel
    cancelBtn.addEventListener('click', () => {
      this._showListView();
    });
  }

  // ─── Event Handlers ───────────────────────────────

  _handleKeydown(e) {
    if (e.key === 'Escape' && this._isOpen) {
      this.close();
    }
  }

  _handleBackdropClick() {
    this.close();
  }

  _onProfileChanged() {
    this._refreshIndicator();
    if (this._isOpen) {
      this._showListView();
    }
  }

  _onSessionStopped() {
    if (this._isOpen && !this._formMode) {
      this._loadProfiles();
    }
  }

  // ─── Destroy ───────────────────────────────────────

  destroy() {
    this.close();
    eventBus.off('profile:changed', this._boundOnProfileChanged);
    eventBus.off('session:stopped', this._boundOnSessionStopped);
    document.removeEventListener('click', this._boundCloseDropdown);
    this._wrapper.remove();
    if (this._indicator) {
      this._indicator.remove();
    }
  }
}
