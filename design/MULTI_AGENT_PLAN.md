# Multi-Agent Goals & Task List

This document acts as a coordinate plan for multiple agents working concurrently or sequentially on the `dev` branch. It details the task lists, quality constraints, and specific file boundaries for each goal.

---

## 🔒 Mandatory Compliance Guidelines (All Agents)
Before starting any work, **every** active agent must read and strictly comply with:
1. [~/.claude/behavioral_instructions.md](file:///home/john/.claude/behavioral_instructions.md) — The centralized global behavioral instructions (covering roles, storage policies, and zero-attribution rules).
2. [~/.claude/functional.md](file:///home/john/.claude/functional.md) — The active functional log.
3. [CLAUDE.md](file:///home/john/work/winisd/openisd/CLAUDE.md) — Project-specific quality gates and rules (specifically the strict TDD red-green cycle and ESLint rules).

---

## 🎯 Goal 1: Build & Lint Unblock (Compiler Fixes)
* **Assigned to:** *Compiler Agent*
* **Tasks:**
  * **Task 1.1:** Add missing fields (`Hg`, `no`, `SPLref`, `USPL`, `Vd`) to the `Driver` interface in [packages/engine/src/types.ts](file:///home/john/work/winisd/openisd/packages/engine/src/types.ts).
  * **Task 1.2:** Clean up unused imports and syntax errors in [DriverBrowser.vue](file:///home/john/work/winisd/openisd/packages/ui/src/components/DriverBrowser.vue), [useDesignIO.ts](file:///home/john/work/winisd/openisd/packages/ui/src/composables/useDesignIO.ts), [OriginalShell.vue](file:///home/john/work/winisd/openisd/packages/ui/src/shells/original/OriginalShell.vue), and [store.ts](file:///home/john/work/winisd/openisd/packages/ui/src/store.ts).
  * **Task 1.3:** Clean up mothballed Classic tests in [save-export.browser.spec.ts](file:///home/john/work/winisd/openisd/packages/ui/test/save-export.browser.spec.ts).

---

## 🎯 Goal 2: First-Class Store Projects & Switcher (GAP #1, #2, #3)
* **Assigned to:** *State Model Agent*
* **Tasks:**
  * **Task 2.1:** Centralize the open project list and active project pointer directly in [packages/ui/src/store.ts](file:///home/john/work/winisd/openisd/packages/ui/src/store.ts).
  * **Task 2.2:** Update `serialize()` and state restoration in [packages/ui/src/utils/persist.ts](file:///home/john/work/winisd/openisd/packages/ui/src/utils/persist.ts) to carry the full row context `{ id, project, box, P, driver, _ground, isModified, visible }`.
  * **Task 2.3:** Update [packages/ui/test/project-load-gate.test.ts](file:///home/john/work/winisd/openisd/packages/ui/test/project-load-gate.test.ts) to assert full context restoration.

---

## 🎯 Goal 3: Modern Skin Switcher Integration (GAP #4)
* **Assigned to:** *UI Shell Agent*
* **Tasks:**
  * **Task 3.1:** Add the open projects list and active project switching into the Modern Skin UI layout ([ModernShell.vue](file:///home/john/work/winisd/openisd/packages/ui/src/shells/modern/ModernShell.vue) / [SidePanel.vue](file:///home/john/work/winisd/openisd/packages/ui/src/components/SidePanel.vue)), wired to the store projects list.

---

## 🎯 Goal 4: Complete Driver Editor Parity & Calculations
* **Assigned to:** *Driver Physics Agent*
* **Tasks:**
  * **Task 4.1:** Map the remaining decorative parameters (`Xlim`, `hvc`, `hag`, `tc`, `Rth`, `Cth`, `loss`, and physical sizes) through serialization to prevent metadata stripping.
  * **Task 4.2:** Compute and display read-only properties for $\eta_0$, USPL, SPL, and $V_d$ using standard Thiele/Small formulas in [DriverEditorModal.vue](file:///home/john/work/winisd/openisd/packages/ui/src/components/DriverEditorModal.vue).

---

## 🎯 Goal 5: PR Browser Visual Fixes
* **Assigned to:** *UI Polish Agent*
* **Tasks:**
  * **Task 5.1:** Fix the CSS overlap bugs during scroll in [PRBrowser.vue](file:///home/john/work/winisd/openisd/packages/ui/src/components/PRBrowser.vue).

---

## 🕵️ Goal 6: Adversarial Critique & Compliance Review
* **Assigned to:** *Compliance Critique Agent*
* **Tasks:**
  * **Task 6.1:** Critically audit all PRs, modified files, and code changes for absolute compliance with both the project-specific goals and all ambient/stated constraints.
  * **Task 6.2:** Verify that all changes strictly follow `~/.claude/behavioral_instructions.md` (no AI commit attributions, zero data-loss rule, WSL environment rules, correct folder storage policies) and `~/.claude/functional.md` guidelines.
  * **Task 6.3:** Enforce TDD loop execution and run `bash scripts/health-check.sh` on the branch, returning detailed critique reports and blocking merge on any compliance failure or warnings.
