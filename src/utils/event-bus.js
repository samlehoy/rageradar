/**
 * Lightweight custom event bus for module communication.
 * Modules emit events; UI and other modules subscribe.
 */
export class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    this._listeners.get(event)?.delete(callback);
  }

  emit(event, data) {
    this._listeners.get(event)?.forEach(cb => cb(data));
  }

  clear() {
    this._listeners.clear();
  }
}

// Singleton instance
export const eventBus = new EventBus();
