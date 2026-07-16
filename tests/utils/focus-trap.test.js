import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createFocusTrap } from '../../src/utils/focus-trap.js';

describe('createFocusTrap', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.innerHTML = `
      <button id="btn1">First</button>
      <input id="input1" type="text" />
      <a id="link1" href="#">Link</a>
      <button id="btn2">Last</button>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('should return activate and deactivate functions', () => {
    const trap = createFocusTrap(container);
    expect(trap).toHaveProperty('activate');
    expect(trap).toHaveProperty('deactivate');
  });

  it('should wrap focus from last to first element on Tab', () => {
    const trap = createFocusTrap(container);
    trap.activate();

    const btn2 = container.querySelector('#btn2');
    btn2.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
    container.dispatchEvent(event);

    expect(document.activeElement.id).toBe('btn1');
    trap.deactivate();
  });

  it('should wrap focus from first to last element on Shift+Tab', () => {
    const trap = createFocusTrap(container);
    trap.activate();

    const btn1 = container.querySelector('#btn1');
    btn1.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
    Object.defineProperty(event, 'preventDefault', { value: vi.fn() });
    container.dispatchEvent(event);

    expect(document.activeElement.id).toBe('btn2');
    trap.deactivate();
  });

  it('should stop trapping after deactivate', () => {
    const trap = createFocusTrap(container);
    trap.activate();
    trap.deactivate();

    const btn2 = container.querySelector('#btn2');
    btn2.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    container.dispatchEvent(event);

    // Focus should NOT have been manipulated (still on btn2)
    expect(document.activeElement.id).toBe('btn2');
  });
});
