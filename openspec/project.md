# Project Context

## Purpose

Open, community-owned loudspeaker enclosure simulator that runs in any browser.

## Tech Stack

### Client-Side UI App

- Vue 3, TypeScript, Vanilla CSS, Vite
- Playwright for browser testing
- Incorporates the application's client-side backend logic directly within the frontend app bundle

### Core Calculation Engine

- `@openisd/engine`: A distinct module for electro-acoustic calculations and equivalent circuit solving

### WDR File Projection

- `@openisd/winisd`: A distinct module for parsing, writing, and projecting legacy WinISD driver (.wdr) and project (.wpr) files

### Infrastructure

- Static HTML/JS deployable to GitHub Pages

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
