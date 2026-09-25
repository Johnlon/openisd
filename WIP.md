# Work In Progress

---

## Open — do these next

### 1. Signal chain / EQ (P1 in backlog)

Filters panel (HP, LP, Linkwitz, Peaking EQ) is already fully implemented in the UI
(`FiltersPanel.vue`) and engine (`filters.ts`). High-shelf and low-shelf are NOT yet
built. Listening distance is fixed at 1 m (not user-configurable yet).

---

## Reference — architecture decisions

- `matt/` collection is human-curated — never touch without explicit per-session permission.
- All calculation changes require explicit human approval before touching `packages/engine/src/`.
