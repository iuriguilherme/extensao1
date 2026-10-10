---
title: Conquistas Reachable List - Plan
type: feat
date: 2026-10-10
topic: conquistas-reachable-list
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# Conquistas Reachable List - Plan

## Goal Capsule

- **Objective:** A student opening Conquistas sees only the conquistas they have earned and the ones they can work toward right now, never a wall of far-off or placeholder entries.
- **Product authority:** the project owner (the user) settled this scope in dialogue. It completes R15 of `docs/plans/2026-10-09-1903-feat-incremental-disclosure-plan.md` and answers the "close to" question left open in `docs/plans/2026-10-09-1801-feat-steam-achievements-plan.md`.
- **Means:** a pure core listing rule decides which conquistas the screen shows (KTD1); the screen draws only those (U2).
- **Execution profile:** two small units in `src/core` and `src/scenes` with Vitest coverage; ships by local merge into `main`, no PR.
- **Open blockers:** none.

---

## Product Contract

Product Contract preservation note: changed R9 and AE1 — Caderno completo and Domínio total now list only once the Doutorado tier opens, because finishing them needs pós-graduação lessons and areas that stay hidden until then (owner decision at document review).

### Summary

The Conquistas screen lists the conquistas the student has unlocked, plus the locked ones they could work toward with what the game has already opened to them. A tiered counter shows only its next tier. Every other conquista stays off the list until it becomes reachable, and the screen's total still counts all of them.

### Problem Frame

The screen shipped listing all 30 conquistas from a new game, with "???" rows for the secret ones. That contradicts the game's incremental-disclosure rule: everything on screen is something the student can act on now (`docs/plans/2026-10-09-1903-feat-incremental-disclosure-plan.md`, Key Decisions). A student two lessons in sees goals about doutorado degrees and ten finished cities. Those can't be pursued, and seeing them breeds the anxiety the disclosure work removes.

### Key Decisions

- **Locked conquistas list only when reachable with what the student has now.** Governs R2, R7-R10. (session-settled: user-directed — chosen over showing only the next step in each line and over showing only conquistas past a progress threshold: it mirrors the disclosure rule that "available" includes what the student can work toward now.)
- **A tiered counter shows only its next tier.** Governs R10. (session-settled: user-directed — chosen over listing every reachable tier at once: one goal per line, and a far-off tier appears when the one before it is done.)
- **The list holds unlocked plus close conquistas, not the full catalogue.** Governs R1. (session-settled: user-approved — chosen over a Steam-style full list: carried from the incremental-disclosure brainstorm, R15.)
- **Locked secrets are not listed at all.** Governs R3. (session-settled: user-approved — chosen over "???" rows: a placeholder for something the student cannot pursue is what disclosure removes; carried from the achievements plan's revised R7.)

### Requirements

**What the list shows**

- R1. The Conquistas screen lists every unlocked conquista and every locked conquista that is reachable now, and nothing else.
- R2. A locked conquista is reachable when everything it needs is already open to the student, as R7-R10 define per family.
- R3. A locked secret conquista is never listed; once unlocked it shows in full.
- R4. A locked conquista that can no longer be earned is never listed.
- R5. The screen's total still counts every conquista, listed or not.
- R6. A conquista that becomes reachable simply appears in the list, with no pulse or log line, like a new lesson or part.

**When each family becomes reachable**

- R7. A campaign milestone is reachable once the part of the game it needs has been introduced:
  - Primeira aula from the start.
  - Primeiro boot with the Bancada.
  - Conectado with Configuração de Rede.
  - Primeira invasão and Diploma na mão with the Mapa da Rede.
  - Swarm formado and NOC no ar with the NOC tab.
  - Primeira cidade with Cidades.
- R8. Each pós-graduação degree conquista is reachable once its tier opens.
- R9. A challenge is reachable as follows:
  - Caderno completo once every lesson is open to the student, which is when the Doutorado tier opens.
  - Especialista once Trabalhos extras is open.
  - Domínio total once Trabalhos extras is open and every area exists, which is when the Doutorado tier opens.
  - Máquina dos sonhos once the Shop sells the most expensive part of every slot.
  - Sem nenhum erro and Por um fio once the student can start an intrusion.
  - Invasão perfeita once the Data Center Core is reachable, until its first breach.
- R10. A counter is reachable as follows, and of the three answer counters (100, 500, mil) only the lowest locked one is reachable:
  - The answer, correct-answer and finished-run counters once the student can start an intrusion.
  - Dez cidades with Cidades.

### Acceptance Examples

- AE1. Early game
  - **Covers R1, R3, R7, R9.**
  - **Given** a student who has passed their first lesson and has the Bancada but no network yet, **when** they open Conquistas, **then** the list shows Primeira aula (unlocked) and Primeiro boot (locked), and no network, intrusion, city, degree, all-lessons or secret conquista.
- AE2. Counter tiers
  - **Covers R5, R10.**
  - **Given** a student with 120 answers who has unlocked Cem respostas, **when** they open Conquistas, **then** Cem respostas shows as unlocked, Quinhentas respostas shows 120/500, Mil respostas is not listed, and the total still counts all conquistas.
- AE3. A challenge that closed
  - **Covers R4, R9.**
  - **Given** a student whose first Data Center Core breach had a mistake, **when** they open Conquistas, **then** Invasão perfeita is not listed.
- AE4. A secret
  - **Covers R3.**
  - **Given** a student who has not lost a run on the last round, **when** they open Conquistas, **then** Na trave is not listed. **Given** they then lose a run on the last round, **then** Na trave shows with its name and description.

### Scope Boundaries

- The Conquistas button, the pop-up, the reset question and the unlock rules stay as they are; only which conquistas the screen lists changes.
- Highlighting a newly reachable conquista (a badge, a pulse, a log line) is out of scope (R6).
- Changing conquista names, descriptions or targets is out of scope.

### Dependencies / Assumptions

- Assumption: "can start an intrusion" means the Mapa da Rede or Trabalhos extras has been introduced, since both lead to the intrusion screen.
- Assumption: Diploma na mão is reachable with the Mapa da Rede because the campaign the formatura closes runs through it, even though its final machine is many breaches away.

### Sources / Research

- Conquista list and kinds: `src/data/achievements.ts`. Unlock rules and counter progress: `src/core/achievements.ts`. Current screen: `src/scenes/ConquistasScene.ts`, which lists all conquistas and shows "???" for locked secrets.
- Disclosure elements the reachability rules refer to: `src/core/disclosure.ts` (`ELEMENTS`).
- Adding to the disclosure system: `docs/solutions/design-patterns/acknowledge-every-entry-path-under-incremental-disclosure.md`.

<!-- ce-section: work-relationships -->
### How This Work Fits Together

This plan covers only which conquistas the Conquistas screen lists. The relationships below are the current understanding, not a committed roadmap.

- Incremental disclosure (`docs/plans/2026-10-09-1903-feat-incremental-disclosure-plan.md`): this plan completes its R15. Shares its rule that what shows is what the student can act on now.
- Steam-style achievements (`docs/plans/2026-10-09-1801-feat-steam-achievements-plan.md`): this plan answers its deferred "close to" question and replaces the full-list behavior that shipped. Depends on its unlock rules unchanged.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **The listing rule lives in its own pure core module.** It needs the disclosure state (which elements are introduced) and the achievement state, and `src/core/disclosure.ts` already imports `src/core/achievementStore.ts`, so putting the rule in `src/core/achievements.ts` would close an import cycle. A new `src/core/conquistaList.ts` imports both and is imported only by the screen. Governs R1-R10.
- KTD2. **"Introduced" means `isVisible` from `src/core/disclosure.ts`.** That already folds in availability and the old-save rule, so a save from before disclosure lists what it has reached. Governs R7.
- KTD3. **Reachability is one predicate per conquista id, kept next to the list it judges.** The rules in R7-R10 map each id to a check over the game and achievement state, the same shape `RULES` in `src/core/achievements.ts` uses for unlocks. A test fails when an id in `ACHIEVEMENTS` has no reachability predicate, so a new conquista cannot ship unlisted by accident.
- KTD4. **Tiers are derived, not hand-listed.** Among locked counter conquistas sharing a metric, only the lowest target is reachable (R10). Today that affects the three answer counters only.

### Assumptions

- "The student can start an intrusion" is `isVisible` of the Mapa da Rede or Trabalhos extras element (Dependencies / Assumptions above).
- "The Data Center Core is reachable" is the campaign node status `reachable` for the final node; once that node is breached, Invasão perfeita is either unlocked or can no longer be earned (R4, R9).

---

## Implementation Units

### U1. Listing rule and its tests

- **Goal:** a pure function that returns the conquistas the screen lists, in catalogue order.
- **Requirements:** R1-R10; KTD1-KTD4; AE1-AE4.
- **Dependencies:** none.
- **Files:** `src/core/conquistaList.ts` (new), `src/core/achievements.ts` (export the top part per slot), `tests/conquistaList.test.ts` (new).
- **Approach:**
  1. Export a function taking the game state and the achievement state, returning the listed `Achievement`s: unlocked ones always, locked ones only when their reachability predicate holds and they are not secret.
  2. Write one predicate per id per R7-R9, built from `isVisible` (`src/core/disclosure.ts`), `isTierOpen` (`src/core/certificates.ts`), `hasLesson` and `nodeStatus` (`src/core/state.ts`), and the top part per slot that `src/core/achievements.ts` already computes for Máquina dos sonhos, exported rather than duplicated so the listing and the unlock rule cannot drift.
  3. Apply the counter tier rule (R10, KTD4) after the predicates.
- **Patterns to follow:** `RULES` in `src/core/achievements.ts`; `isLessonListed` and `isPartListed` in `src/core/disclosure.ts`.
- **Test scenarios:**
  - Covers AE1. After `computer-basics` with a part bought (the Bancada introduced) and no network, the list is Primeira aula and Primeiro boot.
  - Covers AE2. With Cem respostas unlocked and 120 answers, Cem respostas and Quinhentas respostas are listed and Mil respostas is not.
  - Covers AE3. With the Core breached and Invasão perfeita locked, it is not listed. With the Core reachable and not yet breached, it is listed.
  - Covers AE4. A locked secret is never listed. The same id listed once unlocked.
  - Every pós-graduação degree is listed only once its tier opens (R8).
  - Máquina dos sonhos is listed only once the Shop sells the most expensive part of every slot, that is, every such part's lesson is done (R9).
  - Every id in `ACHIEVEMENTS` has a reachability predicate (KTD3).
- **Verification:** the listing tests pass and the existing achievement tests stay green.

### U2. The screen lists only what U1 returns

- **Goal:** the Conquistas screen draws and pages only the listed conquistas.
- **Requirements:** R1, R3, R5, R6.
- **Dependencies:** U1.
- **Files:** `src/scenes/ConquistasScene.ts`.
- **Approach:** page over U1's result instead of `ACHIEVEMENTS`. Keep the total line counting every conquista (R5), and drop the "???" branch for locked secrets, since they no longer reach the cell (R3).
- **Patterns to follow:** the existing paging and `cell` drawing in `src/scenes/ConquistasScene.ts`.
- **Test expectation:** none in Vitest, since this is a Phaser scene; U1's tests carry the behavior. Browser-check it with a seeded save per `docs/solutions/developer-experience/manual-ui-check-phaser-scenes.md`.
- **Verification:** a fresh game with the first lesson done and a part bought (the Bancada introduced) shows only the AE1 entries and "1 de 30", and no "???" row appears in any state.

---

## Verification Contract

| Gate | Command or check | Proves |
|---|---|---|
| Unit tests | `npm test` | U1 scenarios; existing achievement and content tests unchanged |
| Types | `npm run typecheck` | the new module and screen change under `strict` and `noUnusedLocals` |
| Build | `npm run build` | the deploy workflow will pass |
| Browser check | dev server with a seeded save and a seeded conquista key | U2: AE1 listing, a counter at 120/500, no "???" rows |

---

## Definition of Done

- Every unit's Verification holds and every gate above passes.
- No conquista reaches the screen except through U1's function.
- No abandoned-attempt code remains in the diff.
