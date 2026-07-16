# Remaining Goals — Phase 1 MVP Gaps

> **Last Audited:** 2026-07-06
> **Status:** Phase 1 core engine complete (155 tests passing). Two user stories have placeholder implementations.
> **Reference:** [PRD.md](./PRD.md) (User Stories) · [ROADMAP.md](./ROADMAP.md) (Milestones)

---

## Summary

| # | Goal | Source | Status |
|---|------|--------|--------|
| 1 | Session History Browse UI | US-05, Milestone 1.4 | ❌ Placeholder |
| 2 | End-of-Session Summary Modal | US-09, Milestone 1.5 | ❌ Not implemented |
| 3 | "View full history" button wiring | Milestone 1.4 | ❌ No click handler |

---

## Goal 1: Session History Browse/View/Delete UI

**User Story:** US-05 — *"As a returning user, I want to browse a list of my past sessions with summary statistics, so that I can track my emotional trends over time."*

**Current State:**
The `History` button in `src/ui/controls.js` and the `View full history` button in the Alert Log (`src/main.js` line 375) both call `_onSessionHistory()`, which is a placeholder:

`javascript
// src/main.js line 735-738
_onSessionHistory() {
  this._announce('Opening session history...');
  // Placeholder — real implementation would show a modal/overlay with past sessions
}
`

**Backend Ready:** `SessionManager` (`src/modules/session.js`) already has:
- `getAllSessions()` — returns all sessions from IndexedDB sorted by `startedAt`
- `getSession(id)` — returns a single session by UUID
- `deleteSession(id)` — removes a session from IndexedDB

**Acceptance Criteria (from PRD.md):**
- [ ] A session history overlay/modal lists all saved sessions in reverse chronological order
- [ ] Each session card shows: date, duration, average rage score, peak rage score, and a mini sparkline
- [ ] Sessions can be clicked to view the full timeline (reuse `SessionTimeline` component)
- [ ] Sessions can be deleted individually (with confirmation)
- [ ] Sessions persist across browser refreshes (already working via IndexedDB)
- [ ] Empty state shown when no sessions exist

**Files to modify:**
- `src/main.js` — replace `_onSessionHistory()` placeholder
- `src/ui/` — new component file (e.g., `session-history.js`)
- `src/styles/components/` — new CSS file if needed
- `tests/` — new or extended integration tests

---

## Goal 2: End-of-Session Summary Modal

**User Story:** US-09 — *"As a gamer finishing a play session, I want to stop the session and immediately see a summary of my emotional performance, so that I can quickly assess how I did before closing the app."*

**Current State:**
When stopping a session, `_onSessionStop()` immediately saves to IndexedDB and resets the dashboard without showing any summary:

`javascript
// src/main.js line 720-733
async _onSessionStop() {
  try {
    this._controls.setState('stopping');
    this._camera.stop();
    this._microphone.stop();
    await this._sessionManager.stop();
    this._isActive = false;
    this._announce('Session stopped.');
  } catch (err) {
    console.error('Failed to stop session:', err);
    this._controls.setState('idle');
  }
}
`

**Data Available:** `sessionManager.stop()` returns a complete `SessionData` object with computed `stats`:
`javascript
stats: {
  avg: number,          // Average rage score
  max: number,          // Peak rage score
  spikes: number,       // Count of scores >= 80
  duration: number,     // Total duration in ms
  spikesPercent: number, // Percentage of time in spike zone
  maxTime: number,      // Timestamp of peak rage
  histogram: number[],  // 10-bin distribution array
}
`

**Acceptance Criteria (from PRD.md):**
- [ ] An end-of-session summary modal displays upon clicking Stop
- [ ] Modal shows: total duration, average rage, peak rage, time spent in each zone, number of alerts triggered
- [ ] The summary includes a mini-timeline preview of the completed session
- [ ] User can choose **"Save & Close"** (keep the auto-saved session) or **"Discard Session"** (delete from IndexedDB)
- [ ] Camera and microphone streams are released after stopping (already working)

**Files to modify:**
- `src/main.js` — intercept `_onSessionStop()` to show modal before reset
- `src/ui/` — new component file (e.g., `session-summary.js`)
- `src/styles/components/` — new CSS file if needed
- `tests/` — new or extended integration tests

---

## Goal 3: Wire "View full history" Button in Alert Log

**Current State:**
The `View full history` button rendered in the Alert Log section (`src/main.js` line 375-378) has no click event listener attached:

`html
<button class="mt-3 w-full neu-inset rounded-[12px] py-2.5 ...">
  <iconify-icon icon="lucide:list" class="text-sm"></iconify-icon>
  View full history
</button>
`

**Fix:**
- [ ] Add an `id` attribute to this button (e.g., `id="alert-view-history"`)
- [ ] Bind a click listener that calls the same `_onSessionHistory()` method (once Goal 1 is implemented)

---

## Design & Quality Requirements

All UI work for these goals must follow the project's neumorphic design system:

| Constraint | Detail |
|---|---|
| **Background** | Clay color `#E0E5EC` (from `src/styles/tokens.css`) |
| **Shadows** | Use `neu-extruded`, `neu-inset`, `neu-flat` classes (from `src/styles/neu.css`) |
| **Typography** | `font-jakarta` for headings, `font-dm` for labels, `font-mono` for data |
| **Icons** | Iconify with `lucide:` prefix (consistent with existing UI) |
| **Buttons** | Active state `active:scale-[0.98]` + shadow transitions |
| **A11y** | ARIA labels, keyboard trap in modals, `Escape` to close, focus management |
| **Testing** | Vitest + `fake-indexeddb` for IndexedDB mocking |

> **📌 Taste Skills Policy:** Before implementing any UI component, invoke `design-taste-frontend` and `high-end-visual-design` skills to ensure premium output that passes the anti-AI-slop pre-flight check.

> **📌 RTK & Context7 Policy:** Use RTK for all CLI operations. Consult Context7 for Chart.js and idb API patterns before implementation.
