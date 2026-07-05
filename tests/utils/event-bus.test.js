import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus, eventBus } from '../../src/utils/event-bus.js';

describe('EventBus', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('should emit and receive events', () => {
    const results = [];
    bus.on('test', (data) => results.push(data));
    bus.emit('test', 'hello');
    expect(results).toEqual(['hello']);
  });

  it('should allow unsubscribing via returned function', () => {
    const results = [];
    const off = bus.on('test', (data) => results.push(data));
    off();
    bus.emit('test', 'hello');
    expect(results).toEqual([]);
  });

  it('should work with singleton instance', () => {
    expect(eventBus).toBeInstanceOf(EventBus);
  });
});
