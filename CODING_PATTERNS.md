# Standing Coding Patterns for openisd

This file maintains version-controlled coding patterns and design systems for the OpenISD application.

## 1. Domain-Specific Testing
- Core TS logic (`packages/engine/src/`): unit tests in vitest (`npm run test:unit`)
- UI and E2E integration: Playwright tests (`npx playwright test`)
