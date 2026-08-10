# Project Context

## Purpose

Open, community-owned loudspeaker enclosure simulator that runs in any browser.

## Tech Stack

### Client-Side UI App (`@ui`)

- Vue 3, TypeScript, Vanilla CSS, Vite
- Covers tightly coupled UI aspects, views, styling, layouts, and DOM-specific components

### Client-Side View/Controller Logic (`@logic`)

- Reactive stores, driver libraries, and controller logic divorced of direct UI dependencies to enable easy unit testing

### Core Calculation Engine (`@engine`)

- `@openisd/engine`: A distinct module for electro-acoustic calculations and equivalent circuit solving
- All mathematical/acoustical calculations MUST live in this module; no math logic is permitted in `@ui` or `@logic`
- Parameter inputs are passed to `@engine` strictly via argument/parameter parsing

### Classic WinISD Storage (`@wdr` / `@wpr`)

- `@openisd/winisd`: A distinct module for parsing legacy WinISD driver (.wdr) and project (.wpr) files into in-memory model objects, and writing/creating them from in-memory model objects

### Native OpenISD Storage (`@owdr` / `@owpr`)

- Distinct modules/serializers for parsing native OpenISD driver (.owdr) and project (.owpr) files into in-memory model objects, and writing/creating them from in-memory model objects

### Database Management (`@db`)

- Logic module for indexing, searching, and managing the local driver library and project databases (e.g. My Drivers store, favorites, and project lists)

### Logging (`@logging`)

- Application event logging and tracing services

### Diagnostics and Error Tracking (`@diagnostics`)

- Ancillary services for error reporting, issue tracking channels, data quality rules validation, solver troubleshooting, and diagnostic assertions

### Infrastructure

- Static HTML/JS deployable to GitHub Pages

## Project Conventions

### Code Style

- ESLint (strict type-aware linting)
- Prettier for formatting
- TypeScript with strict compiler checks (`tsc` / `vue-tsc`)

### Architecture Patterns

- Strict separation of concern boundaries between `@ui`, `@logic`, `@engine`, `@wdr`, `@wpr`, `@owdr`, `@owpr`, `@db`, `@logging`, and `@diagnostics`
- Avoid all global variables: globals are prohibited to prevent side effects and ensure code remains maintainable and testable
- Classic and Original UI skin variants wrapping the core components

### Testing Strategy

- **Functional UI Tests**: `@ui` components and presentation layers MUST be verified via Playwright functional/browser tests, not unit tests
- **Unit Tests**: `@logic`, `@engine`, and `@wdr` logic are covered by unit tests using `vitest`
- **Multi-Level Coverage**: Each feature requires a functional test at the UI level and supporting unit tests at the component and function level

### Git Workflow

- Working branch: `dev`
- Release branch: `main` (only release processes commit here)
- All commits require automated health checks to be green (lint + typecheck + unit + OpenSpec)

## Important Constraints

- Calculation logic cannot be changed without explicit user permission
- 4000 is the only application port allowed for live previews and builds
- Avoid any mathematical or acoustic calculation logic in `@ui` or `@logic`
- Global variables are prohibited to guarantee testability and maintainability
