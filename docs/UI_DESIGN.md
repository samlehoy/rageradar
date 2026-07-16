# RageRadar — User Interface Design Specification

> **Version:** 1.0  
> **Last Updated:** 2026-07-05  
> **Status:** Draft — Ready for Implementation

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Color Palette](#color-palette)
3. [Typography](#typography)
4. [CSS Custom Properties (Design Tokens)](#css-custom-properties-design-tokens)
5. [Layout Wireframes](#layout-wireframes)
6. [Component Specifications](#component-specifications)
7. [Responsive Behavior](#responsive-behavior)
8. [Animation Specifications](#animation-specifications)
9. [Accessibility](#accessibility)
10. [Icon & Asset Guidelines](#icon--asset-guidelines)

---

## Design Philosophy

RageRadar's visual identity draws from **cyberpunk HUD aesthetics** and **gaming overlay UI** — the app should feel like a heads-up display from a sci-fi cockpit even when running inside a browser window.

### Core Principles

| Principle | Description |
|---|---|
| **Dark-first** | Deep blacks with high-contrast neon accents; reduces eye strain during long sessions |
| **Data as Drama** | Rage levels are communicated through color, glow intensity, and animation speed — not just numbers |
| **Gaming DNA** | Angular shapes, tech fonts, scan-line textures, subtle particle effects — it should feel native in a gamer's setup |
| **Glanceable** | Key information (rage score, session status) readable at a peripheral glance while gaming |
| **Alive** | Ambient animations, pulsing glows, and responsive transitions make the interface feel like a living system |

### Visual References

- Cyberpunk 2077 UI overlays
- Razer Synapse dashboard
- Discord's dark theme + accent color approach
- Stream Deck / OBS Studio control panels
- Sci-fi HUD interfaces (Iron Man, Halo)

---

## Color Palette

### Base Colors

| Token | Hex | Usage |
|---|---|---|
| `--bg-deep` | `#0a0a0f` | Page background, deepest layer |
| `--bg-card` | `#12121a` | Card surfaces, panels, containers |
| `--bg-elevated` | `#1a1a2e` | Elevated elements, hover states |
| `--bg-input` | `#0f0f1a` | Input fields, dropdowns |
| `--border-subtle` | `#1e1e3a` | Subtle borders between sections |
| `--border-active` | `#8b5cf6` | Active/focused borders |

### Primary Accent

| Token | Hex | Usage |
|---|---|---|
| `--accent-primary` | `#8b5cf6` | Primary buttons, links, active states |
| `--accent-primary-hover` | `#a78bfa` | Hover states for primary accent |
| `--accent-primary-dim` | `#8b5cf640` | Backgrounds, badges (40% opacity) |

### Rage Gradient (The Heart of the UI)

| Level | Range | Hex | Label | Glow Color |
|---|---|---|---|---|
| 1 — Calm | 0–20 | `#22c55e` | Calm | `rgba(34, 197, 94, 0.4)` |
| 2 — Focused | 21–40 | `#84cc16` | Focused | `rgba(132, 204, 22, 0.4)` |
| 3 — Tense | 41–60 | `#eab308` | Tense | `rgba(234, 179, 8, 0.4)` |
| 4 — Angry | 61–80 | `#f97316` | Angry | `rgba(249, 115, 22, 0.5)` |
| 5 — RAGE | 81–100 | `#ef4444` | RAGE | `rgba(239, 68, 68, 0.6)` |

### Text Colors

| Token | Hex | Usage |
|---|---|---|
| `--text-primary` | `#e2e8f0` | Headings, primary content |
| `--text-secondary` | `#94a3b8` | Labels, descriptions, timestamps |
| `--text-muted` | `#64748b` | Disabled text, placeholders |
| `--text-inverse` | `#0a0a0f` | Text on light/colored backgrounds |

### Semantic Colors

| Token | Hex | Usage |
|---|---|---|
| `--success` | `#22c55e` | Active indicators, successful connections |
| `--warning` | `#eab308` | Threshold warnings |
| `--error` | `#ef4444` | Errors, disconnected states |
| `--info` | `#3b82f6` | Informational badges |

---

## Typography

### Font Stack

| Role | Font Family | Fallback | Weight(s) | Source |
|---|---|---|---|---|
| **Headings** | `'Orbitron'` | `'Rajdhani', sans-serif` | 700, 900 | Google Fonts |
| **Body** | `'Inter'` | `system-ui, -apple-system, sans-serif` | 400, 500, 600 | Google Fonts |
| **Monospace** | `'JetBrains Mono'` | `'Fira Code', monospace` | 400 | Google Fonts |

### Type Scale

| Token | Size | Line Height | Weight | Usage |
|---|---|---|---|---|
| `--text-display` | `3rem` (48px) | 1.1 | 900 | Rage score number |
| `--text-h1` | `1.75rem` (28px) | 1.2 | 700 | Page title |
| `--text-h2` | `1.25rem` (20px) | 1.3 | 700 | Section headings |
| `--text-h3` | `1rem` (16px) | 1.4 | 600 | Card titles |
| `--text-body` | `0.875rem` (14px) | 1.5 | 400 | Body text |
| `--text-small` | `0.75rem` (12px) | 1.4 | 400 | Labels, captions |
| `--text-tiny` | `0.625rem` (10px) | 1.3 | 500 | Badges, chips |

### Font Loading Strategy

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&family=Orbitron:wght@700;900&display=swap" rel="stylesheet">
```

Use `font-display: swap` to prevent FOIT (flash of invisible text).

---

## CSS Custom Properties (Design Tokens)

All design tokens are defined as CSS custom properties on `:root`. This is the single source of truth for the design system.

```css
:root {
  /* ──────────────────────────────────────────────
     Colors — Base
     ────────────────────────────────────────────── */
  --bg-deep: #0a0a0f;
  --bg-card: #12121a;
  --bg-elevated: #1a1a2e;
  --bg-input: #0f0f1a;
  --border-subtle: #1e1e3a;
  --border-active: #8b5cf6;

  /* ──────────────────────────────────────────────
     Colors — Accent
     ────────────────────────────────────────────── */
  --accent-primary: #8b5cf6;
  --accent-primary-hover: #a78bfa;
  --accent-primary-dim: rgba(139, 92, 246, 0.25);

  /* ──────────────────────────────────────────────
     Colors — Rage Scale
     ────────────────────────────────────────────── */
  --rage-calm: #22c55e;
  --rage-focused: #84cc16;
  --rage-tense: #eab308;
  --rage-angry: #f97316;
  --rage-rage: #ef4444;

  --rage-calm-glow: rgba(34, 197, 94, 0.4);
  --rage-focused-glow: rgba(132, 204, 22, 0.4);
  --rage-tense-glow: rgba(234, 179, 8, 0.4);
  --rage-angry-glow: rgba(249, 115, 22, 0.5);
  --rage-rage-glow: rgba(239, 68, 68, 0.6);

  /* Dynamic — updated by JS based on current rage level */
  --rage-current-color: var(--rage-calm);
  --rage-current-glow: var(--rage-calm-glow);

  /* ──────────────────────────────────────────────
     Colors — Text
     ────────────────────────────────────────────── */
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --text-inverse: #0a0a0f;

  /* ──────────────────────────────────────────────
     Colors — Semantic
     ────────────────────────────────────────────── */
  --success: #22c55e;
  --warning: #eab308;
  --error: #ef4444;
  --info: #3b82f6;

  /* ──────────────────────────────────────────────
     Typography
     ────────────────────────────────────────────── */
  --font-heading: 'Orbitron', 'Rajdhani', sans-serif;
  --font-body: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  --text-display: 3rem;
  --text-h1: 1.75rem;
  --text-h2: 1.25rem;
  --text-h3: 1rem;
  --text-body: 0.875rem;
  --text-small: 0.75rem;
  --text-tiny: 0.625rem;

  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
  --weight-black: 900;

  /* ──────────────────────────────────────────────
     Spacing
     ────────────────────────────────────────────── */
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */

  /* ──────────────────────────────────────────────
     Border Radius
     ────────────────────────────────────────────── */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* ──────────────────────────────────────────────
     Shadows & Glows
     ────────────────────────────────────────────── */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.5);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.6);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.7);
  --shadow-glow: 0 0 20px var(--rage-current-glow), 0 0 60px var(--rage-current-glow);
  --shadow-glow-sm: 0 0 10px var(--rage-current-glow);
  --shadow-accent: 0 0 15px var(--accent-primary-dim);

  /* ──────────────────────────────────────────────
     Transitions & Animations
     ────────────────────────────────────────────── */
  --transition-fast: 150ms ease;
  --transition-base: 300ms ease;
  --transition-slow: 500ms ease;
  --transition-needle: 300ms ease-out;

  /* Dynamic — updated by JS based on rage level */
  --glow-pulse-duration: 2s;  /* calm=2s → rage=0.5s */

  /* ──────────────────────────────────────────────
     Z-Index Scale
     ────────────────────────────────────────────── */
  --z-base: 1;
  --z-card: 10;
  --z-sticky: 100;
  --z-overlay: 500;
  --z-modal: 1000;
  --z-toast: 1500;
  --z-tooltip: 2000;

  /* ──────────────────────────────────────────────
     Layout
     ────────────────────────────────────────────── */
  --sidebar-width: 300px;
  --header-height: 56px;
  --panel-width: 360px;
  --max-content-width: 1440px;
}
```

### Dynamic Token Updates (JS → CSS Bridge)

The following properties are updated in real-time by JavaScript based on the current rage score:

```javascript
// Called by the Fusion Engine on every rage score update
function updateRageTokens(rageScore) {
  const root = document.documentElement;
  const level = getRageLevel(rageScore); // returns { color, glow, pulseDuration }

  root.style.setProperty('--rage-current-color', level.color);
  root.style.setProperty('--rage-current-glow', level.glow);
  root.style.setProperty('--glow-pulse-duration', level.pulseDuration);
}
```

---

## Layout Wireframes

### Main Dashboard (Desktop ≥1200px)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  ⬢ RAGERADAR             [Session: 00:14:32]          [⚙ Settings]  [■ Stop]   │
├──────────────────┬───────────────────────────────────────┬───────────────────────┤
│                  │                                       │                       │
│  ┌────────────┐  │  ┌─────────────────────────────────┐  │  ╔═══════════════╗   │
│  │            │  │  │                                 │  │  ║  ALERT LOG    ║   │
│  │  WEBCAM    │  │  │                                 │  │  ╠═══════════════╣   │
│  │  PREVIEW   │  │  │     SESSION TIMELINE            │  │  ║ 🔴 14:32      ║   │
│  │  (16:9)    │  │  │     (Chart.js Line Graph)       │  │  ║ RAGE! (87)    ║   │
│  │            │  │  │                                 │  │  ║───────────────║   │
│  │  [😠 angry]│  │  │     ╱╲    ╱╲                    │  │  ║ 🟠 14:28      ║   │
│  └────────────┘  │  │    ╱  ╲╱╱  ╲╱╲                 │  │  ║ Angry (72)    ║   │
│                  │  │   ╱           ╲                 │  │  ║───────────────║   │
│  ┌────────────┐  │  │──╱─────────────╲────────────    │  │  ║ 🟡 14:15      ║   │
│  │    ╭───╮   │  │  │                                 │  │  ║ Tense (55)    ║   │
│  │   ╱     ╲  │  │  │  [green]  [yellow]  [red]       │  │  ║───────────────║   │
│  │  │  87   │ │  │  └─────────────────────────────────┘  │  ║ 🟢 14:01      ║   │
│  │  │ RAGE  │ │  │                                       │  ║ Calm (12)     ║   │
│  │   ╲     ╱  │  │  ┌──────────┬──────────┬──────────┐  │  ╚═══════════════╝   │
│  │    ╰───╯   │  │  │ AVG: 42  │ MAX: 87  │ SPIKES:3 │  │                       │
│  │  ┌──────┐  │  │  │  Tense   │  RAGE    │ >80      │  │  ┌───────────────┐   │
│  │  │▓▓▓▓▓▓│  │  │  └──────────┴──────────┴──────────┘  │  │ 🎤 Mic: ████░░│   │
│  │  │ MIC  │  │  │                                       │  │ 📷 Cam: Active│   │
│  │  └──────┘  │  │                                       │  │ ⏱  14:32      │   │
│  └────────────┘  │                                       │  └───────────────┘   │
├──────────────────┴───────────────────────────────────────┴───────────────────────┤
│  [▶ Start Session]  [⏸ Pause]  [⏹ Stop]  [📊 History]       💾 Auto-saving...  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Settings Panel (Slide-In from Right)

```
                                    ┌─────────────────────────────┐
                                    │  ⚙ SETTINGS            [✕] │
                                    ├─────────────────────────────┤
                                    │                             │
                                    │  📷 CAMERA                  │
                                    │  ├─ Source: [Dropdown ▾]    │
                                    │  ├─ Detection FPS: [15] ◄─► │
                                    │  ├─ Show Preview: [●] ON    │
                                    │  └─ Show Overlay: [●] ON   │
                                    │                             │
                                    │  🎤 MICROPHONE              │
                                    │  ├─ Source: [Dropdown ▾]    │
                                    │  ├─ Volume Weight: ◄██░░░►  │
                                    │  └─ Pitch Weight:  ◄███░░►  │
                                    │                             │
                                    │  ⚡ FUSION ENGINE            │
                                    │  ├─ Face Weight:  ◄████░►   │
                                    │  ├─ Audio Weight: ◄██░░░►   │
                                    │  ├─ Smoothing:    ◄███░░►   │
                                    │  └─ Momentum:     ◄██░░░►   │
                                    │                             │
                                    │  🔔 ALERTS                  │
                                    │  ├─ Enable Alerts: [●] ON  │
                                    │  ├─ Sound: [Dropdown ▾]    │
                                    │  │   ├─ Beep               │
                                    │  │   ├─ Alarm              │
                                    │  │   └─ Gaming SFX         │
                                    │  ├─ Alert Threshold: [70]  │
                                    │  ├─ Cooldown (sec): [30]   │
                                    │  └─ Volume: ◄████░░░►      │
                                    │                             │
                                    │  🎯 SENSITIVITY             │
                                    │  ├─ Low  ◄─────[●]──► High │
                                    │  └─ Rage Decay Speed:       │
                                    │     Slow ◄──[●]────► Fast  │
                                    │                             │
                                    │  ┌─────────────────────┐   │
                                    │  │   Reset to Defaults  │   │
                                    │  └─────────────────────┘   │
                                    └─────────────────────────────┘
```

### Tablet Layout (768px – 1199px)

```
┌────────────────────────────────────────────────────────┐
│  ⬢ RAGERADAR        [00:14:32]       [⚙]  [■ Stop]   │
├────────────────────────────────────────────────────────┤
│ ┌──────────┐  ┌────────────────────────────────────┐  │
│ │  WEBCAM  │  │         SESSION TIMELINE           │  │
│ │  PREVIEW │  │         (Chart.js Graph)            │  │
│ └──────────┘  └────────────────────────────────────┘  │
│ ┌─────────────────────┐  ┌─────────────────────────┐  │
│ │    ╭───╮            │  │     ALERT LOG           │  │
│ │   ╱ 87  ╲           │  │     ─────────           │  │
│ │  │ RAGE  │          │  │     🔴 14:32 RAGE (87)  │  │
│ │   ╲     ╱  MIC ████ │  │     🟠 14:28 Angry (72) │  │
│ │    ╰───╯            │  │     🟡 14:15 Tense (55) │  │
│ └─────────────────────┘  └─────────────────────────┘  │
├────────────────────────────────────────────────────────┤
│  [▶ Start]  [⏸ Pause]  [⏹ Stop]  [📊]   💾 Saving.. │
└────────────────────────────────────────────────────────┘
```

### Compact Layout (480px – 767px)

```
┌──────────────────────────────┐
│  ⬢ RAGERADAR     [⚙] [■]   │
├──────────────────────────────┤
│       ╭─────────╮            │
│      ╱    87     ╲           │
│     │   RAGE!     │          │
│      ╲           ╱           │
│       ╰─────────╯            │
│   🎤 ████████░░  📷 Active   │
├──────────────────────────────┤
│  ┌────────────────────────┐  │
│  │   SESSION TIMELINE     │  │
│  │   (Simplified chart)   │  │
│  └────────────────────────┘  │
├──────────────────────────────┤
│  Latest Alert: RAGE! (87)   │
│  14:32 — 3 spikes total     │
├──────────────────────────────┤
│  [▶ Start]  [⏸]  [⏹ Stop]  │
└──────────────────────────────┘
```

---

## Component Specifications

### 1. Rage Meter (Radial Gauge)

The centerpiece of the UI — a radial gauge visualizing the current rage score.

**Structure:**
- **SVG-based** 270-degree arc (from 135° to 405°)
- **Dimensions:** 240×240px (desktop), 180×180px (tablet), 200×200px (compact — takes center stage)
- **Arc track:** Dark stroke (`--bg-elevated`) at 12px width
- **Arc fill:** Colored stroke matching rage level, 12px width with rounded linecaps
- **Needle:** SVG line from center, rotated via CSS transform
- **Center display:** Numeric score (Orbitron, `--text-display` size) + rage level label below

**SVG Structure:**

```svg
<svg viewBox="0 0 240 240" class="rage-meter" role="img" aria-label="Rage meter showing current score">
  <!-- Background arc (track) -->
  <circle
    cx="120" cy="120" r="100"
    fill="none"
    stroke="var(--bg-elevated)"
    stroke-width="12"
    stroke-dasharray="471"
    stroke-dashoffset="157"
    transform="rotate(135, 120, 120)"
    stroke-linecap="round"
  />

  <!-- Foreground arc (fill — width varies by rage score) -->
  <circle
    cx="120" cy="120" r="100"
    fill="none"
    stroke="var(--rage-current-color)"
    stroke-width="12"
    stroke-dasharray="471"
    stroke-dashoffset="calc(471 - (314 * var(--rage-progress)))"
    transform="rotate(135, 120, 120)"
    stroke-linecap="round"
    class="rage-meter__fill"
    filter="url(#glow)"
  />

  <!-- Glow filter -->
  <defs>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- Needle -->
  <line
    x1="120" y1="120" x2="120" y2="35"
    stroke="var(--text-primary)"
    stroke-width="2"
    stroke-linecap="round"
    class="rage-meter__needle"
    transform="rotate(var(--needle-angle), 120, 120)"
  />

  <!-- Center dot -->
  <circle cx="120" cy="120" r="6" fill="var(--rage-current-color)" />

  <!-- Score text -->
  <text x="120" y="130" text-anchor="middle" class="rage-meter__score">87</text>
  <text x="120" y="155" text-anchor="middle" class="rage-meter__label">RAGE</text>
</svg>
```

**Visual States:**

| Score | Arc Color | Glow Intensity | Pulse Speed | Needle Angle (from 135°) |
|---|---|---|---|---|
| 0 | `--rage-calm` | Low | 2s | 135° (leftmost) |
| 25 | `--rage-focused` | Low-Medium | 1.5s | 202.5° |
| 50 | `--rage-tense` | Medium | 1.2s | 270° (top) |
| 75 | `--rage-angry` | High | 0.8s | 337.5° |
| 100 | `--rage-rage` | Maximum | 0.5s | 405° (rightmost) |

**CSS:**

```css
.rage-meter__fill {
  transition: stroke-dashoffset var(--transition-needle),
              stroke var(--transition-base);
}

.rage-meter__needle {
  transition: transform var(--transition-needle);
  transform-origin: 120px 120px;
}

.rage-meter__score {
  font-family: var(--font-heading);
  font-size: var(--text-display);
  font-weight: var(--weight-black);
  fill: var(--rage-current-color);
}

.rage-meter__label {
  font-family: var(--font-heading);
  font-size: var(--text-small);
  font-weight: var(--weight-bold);
  fill: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.2em;
}

/* Glow pulse animation */
.rage-meter {
  filter: drop-shadow(0 0 10px var(--rage-current-glow));
  animation: rage-pulse var(--glow-pulse-duration) ease-in-out infinite alternate;
}

@keyframes rage-pulse {
  0% { filter: drop-shadow(0 0 8px var(--rage-current-glow)); }
  100% { filter: drop-shadow(0 0 25px var(--rage-current-glow)); }
}
```

---

### 2. Webcam Preview

Small corner video feed with face detection overlay.

**Structure:**
- **Container:** 300×169px (16:9), rounded corners (`--radius-lg`), border matches rage color
- **Video element:** Mirrored (scaleX(-1)) for natural feel
- **Face detection overlay:** Canvas layer with bounding box + dominant expression label
- **Toggle button:** Eye icon to show/hide preview
- **Status badge:** Top-left corner, shows "Active" / "Paused" / "No Face Detected"

**HTML Structure:**

```html
<div class="webcam-preview" id="webcam-preview" role="region" aria-label="Webcam preview">
  <video id="webcam-video" autoplay playsinline muted></video>
  <canvas id="webcam-overlay" aria-hidden="true"></canvas>
  <div class="webcam-preview__status">
    <span class="status-dot status-dot--active"></span>
    <span class="status-label">Active</span>
  </div>
  <div class="webcam-preview__expression">😠 angry (0.72)</div>
  <button class="webcam-preview__toggle" aria-label="Toggle webcam preview">
    <svg><!-- eye icon --></svg>
  </button>
</div>
```

**CSS:**

```css
.webcam-preview {
  position: relative;
  width: var(--sidebar-width);
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 2px solid var(--rage-current-color);
  box-shadow: var(--shadow-glow-sm);
  transition: border-color var(--transition-base),
              box-shadow var(--transition-base);
}

.webcam-preview video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

.webcam-preview canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.webcam-preview__status {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  display: flex;
  align-items: center;
  gap: var(--space-1);
  background: rgba(0, 0, 0, 0.7);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-full);
  font-size: var(--text-tiny);
  color: var(--text-secondary);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot--active {
  background: var(--success);
  box-shadow: 0 0 6px var(--success);
  animation: dot-pulse 2s ease-in-out infinite;
}

@keyframes dot-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.webcam-preview__expression {
  position: absolute;
  bottom: var(--space-2);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-small);
  font-family: var(--font-mono);
  color: var(--text-primary);
  white-space: nowrap;
}
```

---

### 3. Session Timeline (Chart.js)

Real-time scrolling line chart showing rage score over time.

**Configuration:**

```javascript
const timelineConfig = {
  type: 'line',
  data: {
    datasets: [{
      label: 'Rage Score',
      borderColor: (ctx) => getRageColorForValue(ctx.raw),
      borderWidth: 2,
      fill: {
        target: 'origin',
        above: (ctx) => getRageGlowForValue(ctx.raw),
      },
      tension: 0.3,
      pointRadius: 0,
      pointHitRadius: 10,
    }],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 0 },
    scales: {
      x: {
        type: 'realtime',
        realtime: {
          duration: 120000,  // Show last 2 minutes
          refresh: 1000,     // Update every second
          delay: 500,
        },
        grid: {
          color: 'rgba(30, 30, 58, 0.5)',
        },
        ticks: {
          color: '#94a3b8',
          font: { family: 'Inter', size: 10 },
        },
      },
      y: {
        min: 0,
        max: 100,
        grid: {
          color: 'rgba(30, 30, 58, 0.3)',
        },
        ticks: {
          color: '#94a3b8',
          font: { family: 'Inter', size: 10 },
          stepSize: 20,
        },
      },
    },
    plugins: {
      legend: { display: false },
      annotation: {
        annotations: {
          rageZone:  { type: 'box', yMin: 80, yMax: 100, backgroundColor: 'rgba(239,68,68,0.08)' },
          angryZone: { type: 'box', yMin: 60, yMax: 80,  backgroundColor: 'rgba(249,115,22,0.06)' },
          tenseZone: { type: 'box', yMin: 40, yMax: 60,  backgroundColor: 'rgba(234,179,8,0.04)' },
        },
      },
    },
  },
};
```

**Container CSS:**

```css
.session-timeline {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  height: 280px;
}

.session-timeline__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.session-timeline__title {
  font-family: var(--font-heading);
  font-size: var(--text-h3);
  color: var(--text-primary);
}

.session-timeline canvas {
  width: 100% !important;
  height: calc(100% - 40px) !important;
}
```

---

### 4. Alert Toasts

Slide-in notifications triggered when rage exceeds configurable thresholds.

**Structure:**

```html
<div class="toast-container" id="toast-container" aria-live="polite" aria-atomic="true">
  <!-- Toasts are injected here dynamically -->
</div>

<!-- Toast template -->
<div class="toast toast--rage" role="alert">
  <div class="toast__icon">🔴</div>
  <div class="toast__content">
    <div class="toast__title">RAGE DETECTED!</div>
    <div class="toast__message">Score hit 87 — Consider a short break</div>
    <div class="toast__time">14:32:05</div>
  </div>
  <div class="toast__progress"></div>
  <button class="toast__close" aria-label="Dismiss alert">&times;</button>
</div>
```

**Toast Variants:**

| Variant | Border Color | Icon | Trigger |
|---|---|---|---|
| `toast--calm` | `--rage-calm` | 🟢 | Score returned to calm |
| `toast--tense` | `--rage-tense` | 🟡 | Score crossed 40 |
| `toast--angry` | `--rage-angry` | 🟠 | Score crossed 60 |
| `toast--rage` | `--rage-rage` | 🔴 | Score crossed 80 |

**CSS:**

```css
.toast-container {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-width: 380px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-card);
  border: 1px solid var(--rage-current-color);
  border-left: 4px solid var(--rage-current-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg), var(--shadow-glow-sm);
  pointer-events: all;
  position: relative;
  overflow: hidden;
  animation: toast-in 200ms ease-out forwards;
}

.toast--dismissing {
  animation: toast-out 300ms ease-in forwards;
}

.toast__title {
  font-family: var(--font-heading);
  font-size: var(--text-small);
  font-weight: var(--weight-bold);
  color: var(--rage-current-color);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.toast__message {
  font-size: var(--text-small);
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

.toast__time {
  font-family: var(--font-mono);
  font-size: var(--text-tiny);
  color: var(--text-muted);
  margin-top: var(--space-1);
}

.toast__progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  background: var(--rage-current-color);
  animation: progress-shrink 5s linear forwards;
}

.toast__close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: var(--text-h2);
  line-height: 1;
  padding: 0;
  transition: color var(--transition-fast);
}

.toast__close:hover {
  color: var(--text-primary);
}

@keyframes toast-in {
  from {
    transform: translateX(120%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes toast-out {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(120%);
    opacity: 0;
  }
}

@keyframes progress-shrink {
  from { width: 100%; }
  to { width: 0%; }
}
```

---

### 5. Session Controls

Gaming-inspired action buttons for session management.

**Structure:**

```html
<div class="session-controls" role="toolbar" aria-label="Session controls">
  <button class="btn btn--primary btn--start" id="btn-start" aria-label="Start session">
    <svg class="btn__icon"><!-- play icon --></svg>
    <span class="btn__label">Start Session</span>
  </button>
  <button class="btn btn--secondary btn--pause" id="btn-pause" disabled aria-label="Pause session">
    <svg class="btn__icon"><!-- pause icon --></svg>
    <span class="btn__label">Pause</span>
  </button>
  <button class="btn btn--danger btn--stop" id="btn-stop" disabled aria-label="Stop session">
    <svg class="btn__icon"><!-- stop icon --></svg>
    <span class="btn__label">Stop</span>
  </button>
  <button class="btn btn--ghost btn--history" id="btn-history" aria-label="View session history">
    <svg class="btn__icon"><!-- chart icon --></svg>
    <span class="btn__label">History</span>
  </button>
</div>
```

**CSS:**

```css
.session-controls {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--bg-card);
  border-top: 1px solid var(--border-subtle);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-family: var(--font-heading);
  font-size: var(--text-small);
  font-weight: var(--weight-bold);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
}

.btn::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%);
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.btn:hover::before {
  opacity: 1;
}

.btn--primary {
  background: var(--accent-primary);
  color: var(--text-primary);
  box-shadow: 0 0 15px var(--accent-primary-dim);
}

.btn--primary:hover {
  background: var(--accent-primary-hover);
  box-shadow: 0 0 25px var(--accent-primary-dim);
}

.btn--secondary {
  background: transparent;
  border-color: var(--border-subtle);
  color: var(--text-secondary);
}

.btn--secondary:hover {
  border-color: var(--accent-primary);
  color: var(--text-primary);
}

.btn--danger {
  background: transparent;
  border-color: var(--error);
  color: var(--error);
}

.btn--danger:hover {
  background: rgba(239, 68, 68, 0.1);
  box-shadow: 0 0 15px rgba(239, 68, 68, 0.2);
}

.btn--ghost {
  background: transparent;
  color: var(--text-muted);
}

.btn--ghost:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.btn__icon {
  width: 16px;
  height: 16px;
}
```

---

### 6. Settings Panel

Slide-in panel from the right edge with configuration options.

**Structure:**

```html
<div class="settings-backdrop" id="settings-backdrop" aria-hidden="true"></div>
<aside class="settings-panel" id="settings-panel" role="dialog" aria-label="Settings" aria-hidden="true">
  <div class="settings-panel__header">
    <h2 class="settings-panel__title">
      <svg><!-- gear icon --></svg>
      Settings
    </h2>
    <button class="settings-panel__close" id="settings-close" aria-label="Close settings">&times;</button>
  </div>

  <div class="settings-panel__body">
    <!-- Sections with setting groups -->
  </div>

  <div class="settings-panel__footer">
    <button class="btn btn--ghost" id="settings-reset">Reset to Defaults</button>
  </div>
</aside>
```

**Settings Control Types:**

| Control | Component | Example |
|---|---|---|
| **Slider** | `<input type="range">` with custom styling | Volume Weight: 0.0 – 1.0 |
| **Toggle** | Custom checkbox with switch appearance | Show Preview: ON / OFF |
| **Dropdown** | `<select>` with custom styling | Alert Sound: Beep / Alarm / SFX |
| **Number** | `<input type="number">` with stepper buttons | Detection FPS: 5–30 |

**CSS:**

```css
.settings-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: var(--panel-width);
  height: 100vh;
  background: var(--bg-card);
  border-left: 1px solid var(--border-subtle);
  z-index: var(--z-overlay);
  transform: translateX(100%);
  transition: transform var(--transition-base);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.settings-panel[aria-hidden="false"] {
  transform: translateX(0);
}

.settings-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: calc(var(--z-overlay) - 1);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--transition-base);
}

.settings-backdrop[aria-hidden="false"] {
  opacity: 1;
  pointer-events: all;
}

.settings-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--border-subtle);
}

.settings-panel__title {
  font-family: var(--font-heading);
  font-size: var(--text-h2);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.settings-section {
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--border-subtle);
}

.settings-section__title {
  font-family: var(--font-heading);
  font-size: var(--text-small);
  color: var(--accent-primary);
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-bottom: var(--space-3);
}

/* Custom range slider */
.setting-slider input[type="range"] {
  -webkit-appearance: none;
  width: 100%;
  height: 4px;
  background: var(--bg-elevated);
  border-radius: var(--radius-full);
  outline: none;
}

.setting-slider input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent-primary);
  cursor: pointer;
  box-shadow: 0 0 8px var(--accent-primary-dim);
}

/* Custom toggle switch */
.setting-toggle input[type="checkbox"] {
  appearance: none;
  width: 40px;
  height: 22px;
  background: var(--bg-elevated);
  border-radius: var(--radius-full);
  position: relative;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.setting-toggle input[type="checkbox"]::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: transform var(--transition-fast), background var(--transition-fast);
}

.setting-toggle input[type="checkbox"]:checked {
  background: var(--accent-primary);
}

.setting-toggle input[type="checkbox"]:checked::after {
  transform: translateX(18px);
  background: white;
}
```

---

## Responsive Behavior

### Breakpoints

| Breakpoint | Name | Layout Strategy |
|---|---|---|
| ≥1200px | **Desktop** | 3-column grid (sidebar + center + right panel) |
| ≥768px | **Tablet** | 2-column grid, stacked sections below |
| ≥480px | **Compact** | Single column, rage meter takes priority |
| <480px | **Mini** | Same as compact with reduced padding |

### CSS Grid Definition

```css
/* Desktop */
.dashboard {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr 280px;
  grid-template-rows: auto 1fr auto;
  gap: var(--space-4);
  height: 100vh;
  padding: var(--space-4);
  max-width: var(--max-content-width);
  margin: 0 auto;
}

/* Tablet */
@media (max-width: 1199px) and (min-width: 768px) {
  .dashboard {
    grid-template-columns: 200px 1fr;
    grid-template-rows: auto auto 1fr auto;
  }

  .alert-log {
    grid-column: 1 / -1;
  }
}

/* Compact */
@media (max-width: 767px) and (min-width: 480px) {
  .dashboard {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto auto auto;
    padding: var(--space-2);
  }

  .webcam-preview {
    display: none; /* Hidden by default, toggle to show */
  }

  .rage-meter {
    justify-self: center;
  }
}

/* Mini */
@media (max-width: 479px) {
  .dashboard {
    padding: var(--space-1);
    gap: var(--space-2);
  }

  :root {
    --text-display: 2.5rem;
    --sidebar-width: 100%;
  }
}
```

### Responsive Component Behavior

| Component | Desktop | Tablet | Compact |
|---|---|---|---|
| **Rage Meter** | 240px in sidebar | 180px in sidebar | 200px centered, hero |
| **Webcam Preview** | Always visible in sidebar | Collapsed above timeline | Hidden (toggle to show) |
| **Timeline** | Full width center column | Spans full width | Full width, reduced height |
| **Alert Log** | Right panel, scrollable | Below timeline, horizontal scroll | Latest alert only |
| **Controls** | Full bar at bottom | Condensed bar | Icon-only buttons |
| **Settings Panel** | 360px slide-in | 320px slide-in | Full-screen overlay |

---

## Animation Specifications

### 1. Rage Meter Needle

```css
.rage-meter__needle {
  transition: transform 300ms ease-out;
  transform-origin: center;
}
```

- **Trigger:** Every rage score update (~1s intervals)
- **Easing:** `ease-out` for snappy feel, slows as it reaches target
- **Duration:** 300ms — fast enough to feel real-time, slow enough to read

### 2. Glow Pulse

```css
@keyframes glow-pulse {
  0%   { filter: drop-shadow(0 0 8px var(--rage-current-glow)); }
  100% { filter: drop-shadow(0 0 25px var(--rage-current-glow)); }
}

.rage-meter {
  animation: glow-pulse var(--glow-pulse-duration) ease-in-out infinite alternate;
}
```

| Rage Level | `--glow-pulse-duration` | Visual Effect |
|---|---|---|
| Calm (0–20) | `2s` | Slow, subtle breathing |
| Focused (21–40) | `1.5s` | Gentle pulse |
| Tense (41–60) | `1.2s` | Noticeable pulse |
| Angry (61–80) | `0.8s` | Rapid pulse |
| RAGE (81–100) | `0.5s` | Frantic pulsing |

### 3. Alert Toast

```css
/* Enter */
@keyframes toast-in {
  from {
    transform: translateX(120%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Exit */
@keyframes toast-out {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(120%);
    opacity: 0;
  }
}

/* Auto-dismiss progress bar */
@keyframes progress-shrink {
  from { width: 100%; }
  to   { width: 0%; }
}
```

- **Enter:** 200ms slide from right
- **Exit:** 300ms slide + fade to right
- **Progress bar:** 5s linear countdown
- **Stacking:** Max 4 visible toasts, oldest auto-dismissed

### 4. Background Ambient Effect

```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background: radial-gradient(
    ellipse at 50% 50%,
    var(--rage-current-glow) 0%,
    transparent 70%
  );
  opacity: 0.03;
  pointer-events: none;
  z-index: 0;
  transition: background var(--transition-slow);
}
```

- **Effect:** Subtle radial gradient wash in the background shifts color based on rage level
- **Opacity:** 3% — barely perceptible but adds to atmosphere
- **Transition:** 500ms ease for smooth color shifts

### 5. Interactive States

```css
/* Card hover lift */
.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  border-color: var(--border-active);
  transition: all var(--transition-fast);
}

/* Button press */
.btn:active {
  transform: scale(0.97);
  transition: transform 50ms ease;
}

/* Focus ring */
:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}
```

### 6. Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .rage-meter {
    filter: drop-shadow(0 0 15px var(--rage-current-glow));
  }
}
```

---

## Accessibility

### WCAG AA Compliance

| Requirement | Implementation |
|---|---|
| **Color Contrast** | All text meets 4.5:1 contrast ratio against dark backgrounds. `#e2e8f0` on `#0a0a0f` = 15.4:1 ✓. `#94a3b8` on `#12121a` = 5.8:1 ✓ |
| **Color Not Sole Indicator** | Rage levels use color + label text + numeric score + glow intensity |
| **Focus Indicators** | 2px solid purple outline on all interactive elements when `:focus-visible` |
| **Keyboard Navigation** | Full tab order: Controls → Settings → Webcam toggle. Escape closes settings |
| **Motion Sensitivity** | `prefers-reduced-motion` disables all animations |

### ARIA Implementation

```html
<!-- Rage Meter — live region for screen readers -->
<div role="meter"
     aria-label="Rage meter"
     aria-valuemin="0"
     aria-valuemax="100"
     aria-valuenow="87"
     aria-valuetext="Rage level: 87 out of 100, RAGE zone">
</div>

<!-- Alert toasts — live region -->
<div id="toast-container"
     aria-live="polite"
     aria-atomic="true"
     role="status">
</div>

<!-- Session timer — live region -->
<time id="session-timer"
      aria-live="off"
      aria-label="Session duration: 14 minutes and 32 seconds">
  00:14:32
</time>

<!-- Settings panel — dialog -->
<aside role="dialog"
       aria-label="Settings"
       aria-modal="true"
       aria-hidden="true">
</aside>
```

### Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` / `Enter` | Activate focused button |
| `Escape` | Close settings panel / Dismiss top toast |
| `Tab` / `Shift+Tab` | Navigate interactive elements |
| `S` | Start/Stop session (when not in input) |
| `P` | Pause/Resume session |
| `Comma (,)` | Open settings |

### Screen Reader Announcements

```javascript
// Announce rage level changes (debounced to avoid spam)
function announceRageLevel(score, label) {
  const announcer = document.getElementById('sr-announcer');
  announcer.textContent = `Rage level changed to ${score}, ${label} zone`;
}

// Announce alerts
function announceAlert(message) {
  // Uses aria-live="polite" on toast-container
}
```

Hidden announcer element:

```html
<div id="sr-announcer" class="sr-only" aria-live="assertive" aria-atomic="true"></div>
```

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

---

## Icon & Asset Guidelines

### Icon System

Use inline SVG icons for maximum control and styling flexibility:

- **Size:** 16px (small), 20px (medium), 24px (large)
- **Stroke width:** 1.5px
- **Color:** `currentColor` (inherits from parent text color)
- **Source:** [Lucide Icons](https://lucide.dev/) (open-source, consistent style)

### Required Icons

| Icon | Usage | Lucide Name |
|---|---|---|
| Play | Start session | `play` |
| Pause | Pause session | `pause` |
| Square | Stop session | `square` |
| Settings | Open settings | `settings` |
| X | Close panel/toast | `x` |
| Eye / EyeOff | Toggle webcam | `eye` / `eye-off` |
| BarChart | History | `bar-chart-3` |
| Bell | Alert settings | `bell` |
| Camera | Camera settings | `camera` |
| Mic | Mic settings | `mic` |
| Volume | Volume control | `volume-2` |
| Timer | Session timer | `timer` |

### Scan-Line Overlay (Optional Aesthetic)

```css
.scanline-overlay::after {
  content: '';
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.03) 2px,
    rgba(0, 0, 0, 0.03) 4px
  );
  pointer-events: none;
  z-index: var(--z-tooltip);
}
```

---

## 📌 Development Reference

> **RTK & Context7 Policy**
>
> This project mandates the use of **RTK** (Rust Token Killer) for all CLI operations to optimize token usage (60-90% savings on dev operations). Always prefix commands through RTK hooks.
>
> **Context7** must be used as the primary source for up-to-date library documentation, best practices, and code examples before implementing any library integration. Query Context7 with `resolve-library-id` → `query-docs` workflow for:
> - face-api.js (`/justadudewhohacks/face-api.js`)
> - MediaPipe (`/google-ai-edge/mediapipe`)
> - Web Audio API (`/websites/webaudio_github_io_web-audio-api`)
> - Any other libraries added to the stack
>
> **No library integration should begin without first consulting Context7 for the latest API patterns and best practices.**
