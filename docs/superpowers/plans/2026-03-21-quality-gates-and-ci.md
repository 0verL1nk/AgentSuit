# Quality Gates And CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen the repository's local quality gates and add a GitHub Actions workflow that runs lint, typecheck, test, and build across Linux, macOS, and Windows.

**Architecture:** Keep the source of truth in root Bun scripts and make CI reuse those exact commands. Add regression tests that validate the quality gate contract and the workflow shape so future edits cannot silently weaken them.

**Tech Stack:** Bun, TypeScript, Biome, Bun test, GitHub Actions

---

### Task 1: Add failing regression tests for quality gates

**Files:**
- Create: `tests/quality-gates.test.js`
- Test: `tests/quality-gates.test.js`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run `bun test tests/quality-gates.test.js` to verify it fails because the workflow/config is missing**
- [ ] **Step 3: Implement the minimal config changes required to satisfy the assertions**
- [ ] **Step 4: Re-run `bun test tests/quality-gates.test.js` and verify it passes**

### Task 2: Tighten root scripts and workspace checks

**Files:**
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Update root scripts so lint, typecheck, test, and build form a coherent local quality gate**
- [ ] **Step 2: Document the quality gate commands in `README.md`**
- [ ] **Step 3: Run the targeted regression tests and fix any script contract issues**

### Task 3: Add cross-platform GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`
- Test: `tests/quality-gates.test.js`

- [ ] **Step 1: Add a CI workflow with a three-OS matrix**
- [ ] **Step 2: Make the workflow install Bun and run lint, typecheck, test, and build**
- [ ] **Step 3: Re-run the workflow regression tests**

### Task 4: Verify the full repository gate

**Files:**
- Modify: `package.json` if verification exposes script issues

- [ ] **Step 1: Run `bun run lint`**
- [ ] **Step 2: Run `bun run typecheck`**
- [ ] **Step 3: Run `bun run test`**
- [ ] **Step 4: Run `bun run build`**
