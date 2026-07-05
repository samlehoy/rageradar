import { describe, it, expect, beforeEach, vi } from 'vitest';
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

  it('should allow explicit unsubscribe via off()', () => {
    const fn = vi.fn();
    bus.on('test', fn);
    bus.off('test', fn);
    bus.emit('test', 'data');
    expect(fn).not.toHaveBeenCalled();
  });

  it('should not throw when unsubscribing a non-existent listener', () => {
    const fn = vi.fn();
    expect(() => bus.off('nonexistent', fn)).not.toThrow();
  });

  it('should support multiple listeners on the same event', () => {
    const a = vi.fn();
    const b = vi.fn();
    bus.on('test', a);
    bus.on('test', b);
    bus.emit('test', 'hello');
    expect(a).toHaveBeenCalledWith('hello');
    expect(b).toHaveBeenCalledWith('hello');
  });

  it('should not emit to listeners of other events', () => {
    const fn = vi.fn();
    bus.on('event1', fn);
    bus.emit('event2', 'data');
    expect(fn).not.toHaveBeenCalled();
  });

  it('should handle no listeners for an event gracefully', () => {
    expect(() => bus.emit('unknown', {})).not.toThrow();
  });

  it('should clear all listeners', () => {
    const fn = vi.fn();
    bus.on('test', fn);
    bus.clear();
    bus.emit('test', 'data');
    expect(fn).not.toHaveBeenCalled();
  });

  it('should work with singleton instance', () => {
    expect(eventBus).toBeInstanceOf(EventBus);
  });

  it('should support multiple events with independent listener lists', () => {
    const events = [];
    bus.on('a', (d) => events.push(`a:${d}`));
    bus.on('b', (d) => events.push(`b:${d}`));
    bus.emit('a', 1);
    bus.emit('b', 2);
    expect(events).toEqual(['a:1', 'b:2']);
  });
});
