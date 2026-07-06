import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { SessionManager } from '../../src/modules/session.js';
import { SessionHistory } from '../../src/ui/session-history.js';
import { SessionSummaryModal } from '../../src/ui/session-summary.js';
import { eventBus } from '../../src/utils/event-bus.js';

// Mock Chart.js to prevent JSDOM canvas draw errors
vi.mock('chart.js/auto', () => {
  return {
    Chart: vi.fn().mockImplementation(function() {
      return {
        update: vi.fn(),
        destroy: vi.fn(),
        data: {
          datasets: [
            { data: [], borderColor: '' },
            { data: [], borderColor: '' }
          ]
        },
        options: {
          scales: {
            x: { min: 0, max: 0 }
          }
        }
      };
    })
  };
});

describe('Session UI Components Integration', () => {
  let manager;
  let historyComponent;
  let summaryComponent;
  let confirmMock;

  beforeEach(async () => {
    eventBus.clear();

    // Mock confirm dialog to auto-approve deletes
    confirmMock = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    manager = new SessionManager();
    await manager.init();

    historyComponent = new SessionHistory(manager);
    summaryComponent = new SessionSummaryModal(manager);
  });

  afterEach(async () => {
    historyComponent.destroy();
    summaryComponent.destroy();
    confirmMock.mockRestore();

    if (manager.db) {
      manager.db.close();
      await new Promise((resolve, reject) => {
        const req = indexedDB.deleteDatabase('rageradar');
        req.onsuccess = resolve;
        req.onerror = reject;
      });
    }
  });

  // Create helper to insert a completed session into IndexedDB
  async function createFakeSession(id, gameName, startedAt, duration, scores = []) {
    const endedAt = startedAt + duration;
    const dataPoints = scores.map((val, idx) => ({
      timestamp: startedAt + idx * 1000,
      smoothed: val,
      raw: val,
      level: 'calm'
    }));

    // Calculate histogram (10 bins)
    const histogram = Array(10).fill(0);
    scores.forEach(s => {
      const bin = Math.min(9, Math.floor(s / 10));
      histogram[bin]++;
    });

    const sessionObj = {
      id,
      gameName,
      startedAt,
      endedAt,
      status: 'completed',
      dataPoints,
      stats: {
        avg: scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0,
        max: scores.length > 0 ? Math.max(...scores) : 0,
        spikes: scores.filter(s => s >= 80).length,
        duration,
        spikesPercent: scores.length > 0 ? Math.round((scores.filter(s => s >= 80).length / scores.length) * 100) : 0,
        maxTime: startedAt,
        histogram
      }
    };

    const tx = manager.db.transaction('sessions', 'readwrite');
    await tx.store.put(sessionObj);
    await tx.done;
    return sessionObj;
  }

  describe('SessionHistory Panel', () => {
    it('should create and append container elements to document body', () => {
      const wrapper = document.querySelector('.history-wrapper');
      expect(wrapper).toBeTruthy();
      expect(wrapper.style.visibility).toBe('hidden');
    });

    it('should render empty state when no sessions exist', async () => {
      historyComponent.open();
      // Wait for async load
      await new Promise(r => setTimeout(r, 50));

      const emptyEl = document.querySelector('.history-body').textContent;
      expect(emptyEl).toContain('No sessions found');
    });

    it('should list sessions in reverse chronological order', async () => {
      const now = Date.now();
      await createFakeSession('session-1', 'Cyberpunk 2077', now - 100000, 5000, [10, 20, 30]);
      await createFakeSession('session-2', 'Valorant', now, 10000, [40, 50, 60]);

      historyComponent.open();
      await new Promise(r => setTimeout(r, 50));

      const cards = document.querySelectorAll('.history-item-card');
      expect(cards).toHaveLength(2);
      expect(cards[0].querySelector('h3').textContent).toBe('Valorant');
      expect(cards[1].querySelector('h3').textContent).toBe('Cyberpunk 2077');
    });

    it('should open details view on session card click', async () => {
      const now = Date.now();
      await createFakeSession('session-1', 'Cyberpunk 2077', now, 5000, [15, 25, 35]);

      historyComponent.open();
      await new Promise(r => setTimeout(r, 50));

      const card = document.querySelector('.history-item-card');
      card.click();

      // Verify detail page elements are rendered
      const backBtn = document.querySelector('.history-back');
      expect(backBtn).toBeTruthy();
      expect(document.querySelector('.history-body').innerHTML).toContain('Rage Distribution');
      expect(document.querySelector('#history-detail-canvas')).toBeTruthy();
    });

    it('should delete a session when clicking delete button', async () => {
      const now = Date.now();
      await createFakeSession('session-1', 'Cyberpunk 2077', now, 5000, [15, 25, 35]);

      historyComponent.open();
      await new Promise(r => setTimeout(r, 50));

      const deleteBtn = document.querySelector('.delete-session-btn');
      deleteBtn.click();

      await new Promise(r => setTimeout(r, 50));

      // Verify session was deleted
      expect(confirmMock).toHaveBeenCalledOnce();
      const sessions = await manager.getAllSessions();
      expect(sessions).toHaveLength(0);
    });
  });

  describe('SessionSummaryModal', () => {
    it('should open and render stats when show() is called', async () => {
      const now = Date.now();
      const session = await createFakeSession('session-1', 'Cyberpunk 2077', now, 5000, [15, 25, 35]);

      const showPromise = summaryComponent.show(session);

      const wrapper = document.querySelector('.summary-wrapper');
      expect(wrapper.style.visibility).not.toBe('hidden');

      expect(document.getElementById('summary-avg').textContent).toBe('25');
      expect(document.getElementById('summary-peak').textContent).toBe('35');
      expect(document.getElementById('summary-timeline-canvas')).toBeTruthy();

      // Resolve the promise via Save button click
      const saveBtn = document.querySelector('.summary-save');
      saveBtn.click();

      const result = await showPromise;
      expect(result).toBe('save');
    });

    it('should delete the session and resolve with discard when Discard is clicked', async () => {
      const now = Date.now();
      const session = await createFakeSession('session-1', 'Cyberpunk 2077', now, 5000, [15, 25, 35]);

      const showPromise = summaryComponent.show(session);

      const discardBtn = document.querySelector('.summary-discard');
      discardBtn.click();

      const result = await showPromise;
      expect(result).toBe('discard');
      expect(confirmMock).toHaveBeenCalledOnce();

      // Verify session deleted from db
      const sessions = await manager.getAllSessions();
      expect(sessions).toHaveLength(0);
    });
  });
});
