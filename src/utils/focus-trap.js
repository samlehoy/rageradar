/**
 * Lightweight focus trap utility.
 * Traps Tab/Shift+Tab cycling within a container element.
 *
 * @param {HTMLElement} container - The element to trap focus within
 * @returns {{ activate: () => void, deactivate: () => void }}
 */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function createFocusTrap(container) {
  let _handler = null;

  function _isVisible(el) {
    // offsetParent works in real browsers but is always null in jsdom
    if (el.offsetParent !== null) return true;
    // Fallback: check for explicit hidden states
    if (el.hidden) return false;
    const style = el.style;
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    // In jsdom, offsetParent is null for all elements – treat as visible
    return true;
  }

  function _getFocusable() {
    return [...container.querySelectorAll(FOCUSABLE_SELECTOR)].filter(_isVisible);
  }

  function _onKeydown(e) {
    if (e.key !== 'Tab') return;

    const focusable = _getFocusable();
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first || !container.contains(document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last || !container.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  return {
    activate() {
      _handler = _onKeydown;
      container.addEventListener('keydown', _handler);
    },
    deactivate() {
      if (_handler) {
        container.removeEventListener('keydown', _handler);
        _handler = null;
      }
    },
  };
}
