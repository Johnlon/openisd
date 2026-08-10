# Project Context

## Purpose

Open, community-owned loudspeaker enclosure simulator that runs in any browser.

## Tech Stack

### Frontend

- Vue 3, TypeScript, Vanilla CSS, Vite
- Playwright for browser testing

### Backend

- `@openisd/engine`: Electro-acoustic calculation library in TypeScript/JS
- `@openisd/winisd`: Parser/writer for WinISD driver files (.wdr) and project files (.wpr) in TypeScript/JS

### Infrastructure

- Static HTML/JS deployable to Github Pages

## Project Conventions

### Code Style

- ESLint (strict type-aware linting)
- Prettier for formatting
- TypeScript with strict compiler checks (`tsc` / `vue-tsc`)

### Architecture Patterns

- Decoupled core engine: calculations are kept isolated from presentation adaptors
- Vue reactive stores for state management
- Classic and Original UI skin variants wrapping the core components

### Testing Strategy

- Unit tests: logic verified by `vitest` in `test/` subdirectories
- Browser tests: UI and solver flows verified by `playwright`

### Git Workflow

- Working branch: `dev`
- Release branch: `main` (only release processes commit here)
- All commits require automated health checks to be green (lint + typecheck + unit)

## Important Constraints

- calculation logic cannot be changed without explicit user permission
- 4000 is the only application port allowed for live previews and builds
