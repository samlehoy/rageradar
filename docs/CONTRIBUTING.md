# 🤝 Contributing to RageRadar

First off, **thank you** for considering contributing to RageRadar! Every contribution — whether it's a bug fix, a new feature, improved documentation, or even a typo correction — makes RageRadar better for gamers everywhere.

This document provides guidelines and best practices for contributing. Please read it carefully before submitting your first contribution.

---

## 📋 Table of Contents

- [Code of Conduct](#-code-of-conduct)
- [Getting Started](#-getting-started)
- [Development Workflow](#-development-workflow)
- [Code Style Guide](#-code-style-guide)
- [Testing Requirements](#-testing-requirements)
- [Pull Request Process](#-pull-request-process)
- [RTK Usage](#-rtk-usage)
- [Context7 Usage](#-context7-usage)
- [Need Help?](#-need-help)

---

## 📜 Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you are expected to uphold this code. Please report unacceptable behavior via [GitHub Issues](https://github.com/yourusername/rageradar/issues).

We are committed to providing a **welcoming, inclusive, and harassment-free** environment for everyone, regardless of experience level, gender identity, sexual orientation, disability, personal appearance, body size, race, ethnicity, age, religion, or nationality.

---

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

| Tool | Version | Purpose |
|---|---|---|
| **Node.js** | 18+ | JavaScript runtime |
| **npm** | 9+ | Package manager (bundled with Node.js) |
| **Git** | 2.30+ | Version control |
| **Modern Browser** | Latest Chrome, Firefox, or Edge | Development & testing |
| **Webcam** | Any USB/built-in | Testing emotion detection |
| **Microphone** | Any USB/built-in | Testing audio analysis |

### Setup Steps

```bash
# 1. Fork the repository on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/rageradar.git

# 2. Navigate to the project directory
cd rageradar

# 3. Install dependencies
npm install

# 4. Start the development server
npm run dev
```

The development server will start at `http://localhost:5173` (Vite default).

### Verifying Your Setup

After running `npm run dev`, verify that:

1. ✅ The app loads in your browser without errors
2. ✅ The browser prompts for camera/microphone permissions
3. ✅ The rage meter appears and responds to facial expressions
4. ✅ No console errors appear in DevTools

---

## 🔄 Development Workflow

### Branch Naming Convention

Always create a new branch from `main` for your work. Use the following prefixes:

| Prefix | Use Case | Example |
|---|---|---|
| `feature/*` | New features or enhancements | `feature/cooldown-timer` |
| `bugfix/*` | Bug fixes | `bugfix/rage-meter-overflow` |
| `docs/*` | Documentation changes | `docs/api-reference-update` |
| `test/*` | Test additions or fixes | `test/fusion-engine-edge-cases` |
| `refactor/*` | Code refactoring (no behavior change) | `refactor/audio-module-cleanup` |
| `chore/*` | Build, CI, dependency updates | `chore/update-vitest-config` |

```bash
# Create a new feature branch
git checkout -b feature/your-feature-name
```

### Commit Message Format

We follow **[Conventional Commits](https://www.conventionalcommits.org/)** for all commit messages:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

#### Types

| Type | Description |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only changes |
| `test` | Adding or correcting tests |
| `chore` | Build process, CI, or auxiliary tool changes |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `style` | Formatting, missing semicolons, etc. (no code logic change) |
| `perf` | Performance improvement |

#### Examples

```bash
feat(fusion): add weighted scoring for voice + face inputs
fix(audio): resolve microphone permission denial crash
docs(readme): update quick start instructions
test(scoring): add edge case tests for 0-100 clamping
chore(deps): update face-api.js to v0.22.3
```

### Test-Driven Development (TDD)

> [!IMPORTANT]
> RageRadar follows a **TDD-first** approach. Write your tests **before** writing implementation code.

**TDD Workflow:**

1. **Red** — Write a failing test that describes the desired behavior
2. **Green** — Write the minimum code to make the test pass
3. **Refactor** — Clean up the code while keeping tests green

```bash
# Run tests in watch mode while developing
npm run test

# Run tests once (CI mode)
npm run test:run

# Run tests with coverage
npm run test:coverage
```

---

## 🎨 Code Style Guide

### Language & Modules

- **Vanilla JavaScript** with **ES Modules** (`import`/`export`)
- No TypeScript (MVP phase) — may be introduced in Phase 2
- No framework dependencies (React, Vue, etc.)
- Prefer native browser APIs over third-party libraries when possible

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Functions | `camelCase` | `calculateRageScore()` |
| Variables | `camelCase` | `currentRageLevel` |
| Classes | `PascalCase` | `FusionEngine` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_RAGE_SCORE` |
| Files (modules) | `camelCase.js` | `fusionEngine.js` |
| Files (classes) | `PascalCase.js` | `SessionManager.js` |
| CSS custom properties | `--kebab-case` | `--rage-color-high` |
| CSS classes | `kebab-case` | `.rage-meter-container` |
| HTML IDs | `kebab-case` | `#session-timeline` |

### File Organization

```
src/
├── modules/          # Core logic modules
│   ├── faceDetector.js       # Webcam + face-api.js integration
│   ├── audioAnalyzer.js      # Microphone + Web Audio API
│   ├── fusionEngine.js       # Combine face + audio → rage score
│   ├── sessionManager.js     # Session lifecycle management
│   └── alertSystem.js        # Sound/visual alert triggers
├── ui/               # UI components
│   ├── rageMeter.js          # Rage meter display
│   ├── timeline.js           # Session timeline chart
│   └── settings.js           # Settings panel
├── utils/            # Shared utilities
│   ├── constants.js          # App-wide constants
│   ├── storage.js            # IndexedDB/localStorage helpers
│   └── helpers.js            # General utility functions
├── styles/           # CSS files
│   ├── index.css             # Main stylesheet + design tokens
│   ├── components.css        # Component-specific styles
│   └── animations.css        # Transitions and animations
├── main.js           # App entry point
└── index.html        # HTML shell
```

**Principles:**
- **One module per file** — each file should have a single, clear responsibility
- **Clear separation of concerns** — logic, UI, and utilities in separate directories
- **No circular dependencies** — modules should form a clean dependency tree

### CSS Guidelines

- Use **CSS custom properties** (variables) for theming and design tokens
- Use **Vanilla CSS** — no preprocessors (Sass, Less) or utility frameworks (Tailwind)
- Organize styles with clear comments and logical grouping
- Prefer `rem`/`em` units for responsive sizing
- Use CSS animations/transitions for micro-interactions

```css
/* ✅ Good — using design tokens */
.rage-meter {
  background: var(--bg-surface);
  color: var(--text-primary);
  border-radius: var(--radius-lg);
  transition: background-color var(--transition-normal);
}

/* ❌ Bad — hardcoded values */
.rage-meter {
  background: #1a1a2e;
  color: #ffffff;
  border-radius: 12px;
  transition: background-color 0.3s;
}
```

### JavaScript Best Practices

```javascript
// ✅ Good — clear, documented, testable
/**
 * Calculate composite rage score from face and audio inputs.
 * @param {number} faceScore - Emotion score from facial analysis (0-1)
 * @param {number} audioScore - Volume/pitch score from audio analysis (0-1)
 * @param {Object} weights - Weight configuration { face: number, audio: number }
 * @returns {number} Composite rage score (0-100)
 */
export function calculateRageScore(faceScore, audioScore, weights = { face: 0.6, audio: 0.4 }) {
  const raw = (faceScore * weights.face) + (audioScore * weights.audio);
  return Math.round(Math.min(100, Math.max(0, raw * 100)));
}

// ❌ Bad — unclear, undocumented, magic numbers
export function calc(f, a) {
  return Math.round(Math.min(100, Math.max(0, (f * 0.6 + a * 0.4) * 100)));
}
```

---

## 🧪 Testing Requirements

### What Needs Tests

| Module Category | Test Requirement | Priority |
|---|---|---|
| **Fusion Engine** (scoring logic) | Unit tests **required** | 🔴 Critical |
| **Scoring / Calculations** | Unit tests **required** | 🔴 Critical |
| **Session Manager** | Unit + integration tests **required** | 🔴 Critical |
| **Alert System** (trigger logic) | Unit tests **required** | 🟡 High |
| **Storage Helpers** | Unit tests **required** | 🟡 High |
| **Module Communication** | Integration tests **required** | 🟡 High |
| **UI Components** | Integration tests recommended | 🟢 Medium |
| **Utility Functions** | Unit tests **required** | 🟢 Medium |

### Coverage Requirements

- **Minimum 80% coverage** for core modules (`modules/` directory)
- **100% coverage target** for `fusionEngine.js` and scoring logic
- Coverage reports generated via `npm run test:coverage`

### Test File Naming

```
tests/
├── unit/
│   ├── fusionEngine.test.js
│   ├── audioAnalyzer.test.js
│   ├── scoring.test.js
│   └── storage.test.js
├── integration/
│   ├── sessionFlow.test.js
│   └── moduleComm.test.js
└── setup.js          # Test setup and mocks
```

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode (recommended during development)
npm run test -- --watch

# Run tests with coverage report
npm run test:coverage

# Run a specific test file
npm run test -- tests/unit/fusionEngine.test.js
```

### Writing Good Tests

```javascript
import { describe, it, expect } from 'vitest';
import { calculateRageScore } from '../../src/modules/fusionEngine.js';

describe('calculateRageScore', () => {
  it('should return 0 when both inputs are 0', () => {
    expect(calculateRageScore(0, 0)).toBe(0);
  });

  it('should return 100 when both inputs are at maximum', () => {
    expect(calculateRageScore(1, 1)).toBe(100);
  });

  it('should clamp values above 100', () => {
    expect(calculateRageScore(1.5, 1.5)).toBe(100);
  });

  it('should clamp values below 0', () => {
    expect(calculateRageScore(-0.5, -0.5)).toBe(0);
  });

  it('should weight face input higher by default (60/40)', () => {
    const faceOnly = calculateRageScore(1, 0);
    const audioOnly = calculateRageScore(0, 1);
    expect(faceOnly).toBeGreaterThan(audioOnly);
  });
});
```

---

## 📝 Pull Request Process

### Step-by-Step

1. **Fork** the repository on GitHub
2. **Clone** your fork locally
3. **Branch** from `main` using the naming conventions above
4. **Develop** your changes following the code style guide
5. **Test** thoroughly — all existing tests must pass, new code must have tests
6. **Commit** using conventional commit messages
7. **Push** your branch to your fork
8. **Open a Pull Request** against `main`

### PR Template

When opening a PR, please include the following sections:

```markdown
## 📝 Description
Brief description of what this PR does and why.

## 🔄 Changes
- [ ] Change 1
- [ ] Change 2
- [ ] Change 3

## 🧪 Testing
- [ ] All existing tests pass
- [ ] New tests added for new functionality
- [ ] Manual testing performed (describe what you tested)

## 📸 Screenshots
If applicable, add screenshots or GIFs showing the change.

## ✅ Checklist
- [ ] Tests pass (`npm run test`)
- [ ] No console errors or warnings
- [ ] Code follows the style guide
- [ ] Documentation updated (if applicable)
- [ ] Responsive design verified
- [ ] Accessibility considered (keyboard nav, screen readers)
- [ ] Privacy-preserving (no external data transmission)
```

### Review Checklist

Reviewers will verify the following before approving:

- ✅ All tests pass (`npm run test`)
- ✅ No console errors or warnings in DevTools
- ✅ UI is responsive across screen sizes
- ✅ Accessibility standards are met (WCAG 2.1 AA minimum)
- ✅ Code follows established style guide and naming conventions
- ✅ No hardcoded values — uses constants and design tokens
- ✅ Privacy policy is respected — no external data transmission
- ✅ New code has adequate test coverage
- ✅ Commit messages follow conventional commit format
- ✅ Documentation is updated where applicable

### Review Timeline

- PRs are typically reviewed within **48 hours**
- Please be responsive to review feedback
- A minimum of **1 approval** is required before merging

---

## ⚡ RTK Usage

This project uses **RTK** (Rust Token Killer) for CLI operation optimization. RTK hooks are configured in the project and will automatically optimize CLI commands.

```bash
# RTK is configured via hooks — CLI commands are automatically optimized
# No manual prefixing needed in most cases

# Check RTK savings
rtk gain

# View command history with optimization stats
rtk gain --history
```

> [!TIP]
> When contributing, ensure your local RTK installation is up to date. RTK provides 60-90% token savings on typical dev operations. See the project's development docs for full RTK configuration details.

---

## 📚 Context7 Usage

Before integrating **any** new library or updating an existing library integration, you **must** query Context7 for up-to-date documentation and best practices.

### Context7 Workflow

```
1. resolve-library-id  →  Find the correct Context7 library identifier
2. query-docs          →  Retrieve latest API patterns and best practices
3. Implement           →  Code against the verified, current API
```

### Key Libraries to Query

| Library | Context7 Identifier |
|---|---|
| face-api.js | `/justadudewhohacks/face-api.js` |
| MediaPipe | `/google-ai-edge/mediapipe` |
| Web Audio API | `/websites/webaudio_github_io_web-audio-api` |
| Chart.js | Query via `resolve-library-id` |
| idb (IndexedDB) | Query via `resolve-library-id` |

> [!WARNING]
> **No library integration should begin without first consulting Context7.** This ensures we use current API patterns and avoid deprecated methods. If Context7 returns no results, consult the library's official documentation directly and document the reference in your PR.

---

## ❓ Need Help?

- **Questions?** Open a [Discussion](https://github.com/yourusername/rageradar/discussions)
- **Found a bug?** Open an [Issue](https://github.com/yourusername/rageradar/issues) with the `bug` label
- **Feature idea?** Open an [Issue](https://github.com/yourusername/rageradar/issues) with the `enhancement` label
- **First time contributing?** Look for issues labeled [`good first issue`](https://github.com/yourusername/rageradar/issues?q=label%3A%22good+first+issue%22)

We're happy to help you get started. Don't hesitate to ask! 🎮

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

---

*Last updated: July 2026*
