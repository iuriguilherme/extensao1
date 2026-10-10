---
title: Cyber Range Framing and Ethics Lesson - Plan
type: feat
date: 2026-10-03
topic: cyber-range-ethics
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# Cyber Range Framing and Ethics Lesson - Plan

## Goal Capsule

- **Objective:** Before a student breaches their first machine, they know three things: invading a real computer without permission is a crime in Brazil, what makes security testing legal, and where these skills lead legally. The game's targets read as lab exercises, not real victims.
- **Means:** one game-wide lesson gate in the shared node-requirement check (KTD1), a new Field Knowledge lesson (KTD3), and a wording pass over the screens that describe breaching (U4).
- **Product authority:** the user (project owner) settled the scope in dialogue. This plan covers the cyber range framing and the law-and-ethics lesson from ideation idea 4. Mining gating, a proof-of-work lecture and switch/oversubscription content are not active scope here. The Product Contract wins on behavior; the Planning Contract wins on mechanism within it.
- **Product Contract preservation:** Product Contract unchanged; the Outstanding Questions it deferred to planning are now answered by KTD1-KTD5.
- **Execution profile:** game logic in `src/core` and lesson data in `src/data` are built and tested first; scenes follow and are checked by typecheck, build and a manual playthrough.
- **Stop conditions:** stop and ask if the PT-BR conversion has not landed when work starts, or if the user's review of the legal text asks for content outside R6.
- **Who finishes:** `ce-work` (or a human) implements U1-U4 in order on one branch.
- **Open blockers:** none.

---

## Product Contract

### Summary

The game's network becomes a school cyber range: an isolated training lab where every target is a simulated machine. A short required lesson on the law, authorization, responsible disclosure and security careers stands between the student and their first breach. The game still plays as it does today.

### Problem Frame

Rootkit Academy teaches 14-15-year-old students of the Técnico em Informática para Internet (IFRS Campus Veranópolis) to "breach" machines, and nothing in the game says where the legal line is. The title reads "build it · wire it · breach it". The targets carry the names of real kinds of victims: a museum archive, a university lab, an online store, a company's firewall and mail server. The ending announces "DATA CENTER CORE BREACHED — YOU WIN". No text anywhere mentions law, authorization or ethics.

No player, teacher or reviewer has complained. The concern comes from serious-games ethics research, which warns that hacking games can normalize harm and recommends a sanctioned-lab framing. For a university extension project, shipping a game that rewards breaching with no comment is a reputational risk. It is also a missed teaching moment: Lei 12.737/2012 is directly relevant to what these students are learning.

### Key Decisions

- **Scope is the framing plus one law-and-ethics lesson.** The parts of idea 4 that depend on mining cannot be specified before mining has a design. Governs R1-R11. (session-settled: user-approved — chosen over the whole of idea 4, framing only, and new lectures only: framing and the law lesson work on today's game with no dependency on mining)
- **The network is a school cyber range.** All targets are simulated machines in a training lab the school runs. Governs R1, R3. (session-settled: user-directed — chosen over pentest contracts with clients, and over keeping the story with a legal notice)
- **Node names stay, marked as simulated.** Realistic scenarios keep their flavor, and nothing reads as a real victim. Governs R2. (session-settled: user-approved — chosen over renaming nodes to lab host names and over leaving names unmarked)
- **The lesson is required before the first breach.** Every student meets the legal line once, right when it starts to matter. Governs R4, R5, R9. (session-settled: user-approved — chosen over an optional lesson with a cash reward and over requiring it only for the Data Center Core)
- **The lesson covers four topics plus the ADS security course.** The law, authorization and scope, responsible disclosure, and careers, with a pointer to the security course in the last semester of the ADS program. Governs R6. (session-settled: user-directed — the user picked all four offered topics and added the ADS course reminder)
- **The framing stays light.** The risk is anticipated from research, not observed, so the game must not turn into a lecture. Beyond R1-R3 and the lesson, no extra notices or popups are added.
- **Existing saves are not exempt.** Saves that already hold breached nodes keep them, but must pass the lesson before the next breach. Governs R9.

### Requirements

**Cyber range framing**

- R1. The Title intro tells the player, in one or two lines, that the network they will explore is a school cyber range where every target is a simulated machine set up for practice.
- R2. Wherever a node's details are shown, every node except the player's own PC is marked as simulated; node names themselves do not change.
- R3. Text that describes breaching treats it as a lab exercise, and the ending message says the player completed the cyber range's final exercise instead of announcing a breach and a win.

**Law-and-ethics lesson**

- R4. No node can be breached or re-breached until the player has passed the law-and-ethics lesson.
- R5. The lesson is open to the player no later than the moment the ISP Edge Router (always the first breachable node) would otherwise become breachable, so it never adds a dead end to progression.
- R6. The lesson covers:
  - Lei 12.737/2012: invading a computer device is a crime under art. 154-A of the Código Penal, with penalties raised by Lei 14.155/2021.
  - Authorization and scope: written permission, an agreed scope, and stopping at its limits make security testing legal. This is why the cyber range exists.
  - Responsible disclosure: when you find a flaw in a real system, report it to its owner and do not exploit it. Bug bounty programs are one channel.
  - Security careers: pentester, SOC analyst and CTF competitions, and the security course in the last semester of the ADS program.
- R7. The lesson has the same shape and size as existing lessons: pages, a quiz where every question has an explanation, and a cash reward for passing the first time.
- R8. The law is described in plain words a 14-15-year-old can follow, without long quotations of legal text.
- R9. A save that already holds breached nodes keeps them and everything they provide; only the next breach or re-breach waits for the lesson.

**Integrity and language**

- R10. Automated content checks fail if any node other than the player's own PC can be breached without the law-and-ethics lesson.
- R11. All new and changed text is Brazilian Portuguese that follows the PT-BR plan's rules for terms, voice, numbers, plurals and gender (`docs/plans/2026-10-03-0358-feat-ptbr-style-system-plan.md`, R3-R10).

### Acceptance Examples

- AE1. **Covers R4, R5.** **Given** a player who passed `ip-addressing` but not the law-and-ethics lesson, **when** they select the ISP Edge Router on the Net Map, **then** they cannot start the breach, the reason names the lesson, and the lesson is open to them in Study. After they pass it, the breach can start.
- AE2. **Covers R9.** **Given** a save with three breached nodes and no law-and-ethics lesson, **when** the player loads it, **then** the three nodes stay breached, and any new breach or re-breach waits until the lesson is passed.
- AE3. **Covers R2.** **Given** the player opens the details of MegaCorp Mail and then of their own PC, **when** each panel shows, **then** MegaCorp Mail is marked as simulated and the player's PC is not.
- AE4. **Covers R3.** **Given** the player breaches the Data Center Core, **when** the ending shows, **then** it says they completed the cyber range's final exercise, and it does not say "breached" or "you win".

### Success Criteria

- The user plays from a new game and meets the cyber range framing on the Title, the lesson before the first breach, and lab wording through to the ending. None of it feels like a lecture.
- The user, as reviewer of the legal text, confirms that the lesson's account of Lei 12.737/2012 and Lei 14.155/2021 is accurate.
- After the lesson, a student can answer, through its quiz, whether invading a machine without permission is legal in Brazil, and what makes a security test legal.

### Scope Boundaries

- Mining gating, the proof-of-work and energy lecture, and naming cryptojacking belong to the mining work, which must follow this plan's rule that new systems unlock through a lesson.
- Switch ports and oversubscription content is already covered by the swarm plan (`docs/plans/2026-10-03-0339-feat-swarm-noc-capacity-plan.md`, KTD12, Networks 101).
- The formatura certificate and post-ending tiers (ideation idea 7) are separate work; R3 changes only the ending's wording.
- Renaming nodes, disclaimer popups, and extra legal notices outside the lesson are out of scope.
- Other laws, such as the Marco Civil da Internet and the LGPD, are not covered.
- Considered and not built: a second guard inside the breach-recording mutation in `src/core/state.ts`. The only path to it is the Net Map's Connect button, which the gate already disables (KTD2). A new path that reaches it without the Net Map would change this call.
- Considered and not built: a save version bump or migration. The gate reads the lessons the save already records, so old saves work unchanged (KTD5).

### Dependencies / Assumptions

- The PT-BR conversion lands before this work starts, so the game never shows a mix of languages (R11).
- The user is the only reviewer of the lesson's legal content.
- The ADS reference assumes students at this campus can reach an ADS program with a security course in its last semester. The user checks the exact course and semester wording.
- The ethical risk is an assumption drawn from serious-games ethics research. No complaint has been observed.

### Outstanding Questions

**Deferred to Implementation**

- The lesson's title, page count and quiz questions, drafted in PT-BR for the user's review within R6-R8.
- The exact PT-BR wording of the "simulated" tag and of each reworded string in U4.

### Sources / Research

- `docs/ideation/2026-09-27-release-hardening-ideation.html`: idea 4, the origin of this plan. Its external basis is the DiGRA serious-games ethics and ethical-hacking education literature, and Lei 12.737/2012.
- Lei 14.155/2021 rewrote art. 154-A: the crime no longer requires "violação indevida de mecanismo de segurança", and the base penalty became reclusão of 1 to 4 years plus a fine (previously detenção of 3 months to 1 year). Sources: [Dizer o Direito](https://www.dizerodireito.com.br/2021/05/lei-141552021-promove-alteracoes-nos.html), [MPBA, crimes eletrônicos e a Lei 14.155/2021](https://mpba.mp.br/sites/default/files/biblioteca/criminal/artigos/codigo_penal_-_parte_especial/crimes_eletronicos_e_lei_14.155-2021.pdf).
- `src/scenes/TitleScene.ts:15-17`: subtitle "build it · wire it · breach it — learn IT the hands-on way" and intro "You inherited an empty computer case and $300."
- `src/scenes/HubScene.ts:48`: ending line `*** DATA CENTER CORE BREACHED — YOU WIN ***`.
- `src/data/nodes.ts:17-23`: `NodeRequirements` holds at most one `lesson`, plus optional `cpuPower`, `ramGB`, `storageGB` and `linkMbps`.
- `src/data/nodes.ts:44-104`: ten nodes. `home` has no requirements and links only to `isp`. `isp` and `uni` both require `ip-addressing`.
- `src/data/lessons.ts:16-28`: `LessonTrack` is `'Hardware' | 'Networking' | 'Field Knowledge'`. A lesson has `requires`, `reward`, `pages` and `quiz`, and nothing marks a lesson optional.
- `src/scenes/NetMapScene.ts:80,97`: the details panel shows name and IP, plus a `Connect` / `Re-breach` button.
- `tests/core.test.ts:130-133`: the "every referenced lesson exists" integrity test.
- `src/core/state.ts:7-16`: `GameState` tracks `lessonsCompleted` and `breached`.
- No text in `src` mentions law, crime, authorization, ethics, pentesting or cryptojacking.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **One game-wide lesson gate inside `checkRequirements`, not a per-node field.** Every node except `HOME_NODE_ID` gets the law-and-ethics check from a single exported lesson-id constant, listed first among its checks, so `canConnect` inherits it unchanged. `NodeRequirements.lesson` holds one id and nine nodes already use it; changing it to a list would touch every node and still let a future node forget the gate. Generated nodes from later work are gated with no extra data. Governs R4, R10.
- KTD2. **The gate lives in `canConnect`; `breach()` gets no guard.** `MinigameScene` calls `breach()` only after the Net Map's Connect button, which `canConnect` disables. See Scope Boundaries for why a second guard is not built. Governs R4.
- KTD3. **The lesson sits in Field Knowledge and requires only `network-basics`.** It is inserted before `ports` in `LESSONS`, so the Study screen shows it as the first row of the Field Knowledge column (rows are 88px from y=110, and that column holds two lessons today). `ip-addressing` itself requires `network-basics`, so the lesson is always open before the ISP Edge Router can be breached. Its reward follows the Field Knowledge level (`ports` and `http` pay 100). Governs R5, R7.
- KTD4. **"Simulated" is a tag in the Net Map details header, and the panel fits a sixth check row.** The Data Center Core already shows five check rows, and the button sits at y+192 in a 244px panel. The gate adds a sixth row, and the panel must not grow over the map nodes below it (U3). The tag sits beside the name/IP line and is skipped by `HOME_NODE_ID`, not by name. Governs R2.
- KTD5. **Existing saves need no migration.** The gate reads `lessonsCompleted`, and `breached` is left untouched, so an old save keeps its nodes and only meets the gate on its next Connect. The save key `rootkit-academy-save-v1` and `GameState.version` stay as they are. Governs R9.
- KTD6. **The Hub hint points to the lesson until it is passed.** In the `explore` phase, `objective()` names the lesson before telling the player to open the Net Map. The `won` hint ("certified root") is reworded with the other R3 strings. Governs R3, R5.
- KTD7. **R10 is proven by behavior, not by scanning node data.** Because the gate lives in code (KTD1), a scan of `NODES[].requires.lesson` would pass whether or not it works. The test sets up a state that meets every other requirement of each non-home node and asserts that `canConnect` changes only when the lesson is added. Governs R10.

### Assumptions

- The swarm plan (`docs/plans/2026-10-03-0339-feat-swarm-noc-capacity-plan.md`, U5-U6) also edits `checkRequirements` and the Net Map details panel. Whichever plan lands second rebases onto the other; KTD1 and KTD4 stay valid either way.

### Sequencing

U1 adds the lesson the gate points at. U2 adds the gate and the hint and updates the tests. U3 and U4 are screen work that depends on U2's check order; they can land in either order.

---

## Implementation Units

### U1. Law-and-ethics lesson

- **Goal:** Add the law-and-ethics lesson to the lesson catalog in PT-BR.
- **Requirements:** R5, R6, R7, R8, R11; KTD3.
- **Dependencies:** none (PT-BR conversion merged, per Dependencies / Assumptions).
- **Files:** `src/data/lessons.ts`, `tests/core.test.ts`.
- **Approach:**
  1. Insert a Field Knowledge lesson before `ports`, with `requires: ['network-basics']` and a reward of 100 (KTD3).
  2. Write pages covering the four R6 topics in order, describing art. 154-A in plain words with the post-2021 penalty (Sources / Research).
  3. Write a quiz where each question has an `explain`, including the two questions Success Criteria names: is invading a machine without permission legal, and what makes a security test legal.
  4. Export the lesson id as the constant U2 imports.
- **Patterns to follow:** the `ports` and `http` lessons in `src/data/lessons.ts` for size, page style and `explain` tone; the PT-BR term list and voice from the PT-BR plan.
- **Test scenarios:**
  - The existing integrity tests ("every referenced lesson exists", "quiz answers point at real options") pass with the new lesson included.
  - The lesson opens for a state that has only `network-basics`, and not for a fresh game.
  - The lesson is in the Field Knowledge track and comes before `ports` in `LESSONS`.
- **Verification:** the lesson appears first in the Field Knowledge column after Networks 101, and its quiz can be passed for the cash reward once.

### U2. Game-wide gate and Hub hint

- **Goal:** Block every breach and re-breach of every non-home node until the lesson is passed, and point the Hub hint at the lesson.
- **Requirements:** R4, R5, R9, R10; AE1, AE2; KTD1, KTD2, KTD5, KTD6, KTD7.
- **Dependencies:** U1.
- **Files:** `src/core/state.ts`, `tests/core.test.ts`.
- **Approach:**
  1. In `checkRequirements`, prepend the lesson check for every node whose id is not `HOME_NODE_ID`, using the same "Knowledge: <title>" label shape as node lessons (KTD1). Leave `canConnect` and `breach()` unchanged (KTD2).
  2. In `objective()`, in the `explore` phase, return a hint naming the lesson while it is not passed (KTD6).
  3. Update the `progression` test: after `dns` and the net config, `canConnect(isp)` is false; after the lesson it is true.
- **Execution note:** write the R10 and save tests first; they fail until the gate exists.
- **Patterns to follow:** existing `RequirementCheck` entries in `checkRequirements`; the `connect`-phase lesson hints in `objective()`.
- **Test scenarios:**
  - Covers AE1. Online state with `ip-addressing` done but not the lesson: `canConnect(isp)` is false and the first check is the unmet lesson check; after `completeLesson` for the lesson, it is true.
  - R10: for each non-home node, build a state that is online, has every lesson and enough hardware for its other requirements, and has every neighbor breached; `canConnect` is false without the lesson and true with it.
  - Covers AE2. A state with three breached nodes and no lesson keeps all three in `breached` and `nodeStatus` reports them as breached, while `canConnect` on a breached node (re-breach) and on a newly reachable node is false.
  - `checkRequirements(home)` contains no lesson check.
  - `objective()` in the `explore` phase names the lesson before it is passed and stops naming it after.
- **Verification:** all tests pass, and a player online without the lesson sees every Connect button disabled with the lesson listed as the unmet requirement.

### U3. Simulated tag and panel layout

- **Goal:** Mark every non-home node as simulated in the Net Map details panel, and fit the extra check row.
- **Requirements:** R2, R11; AE3; KTD4.
- **Dependencies:** U2.
- **Files:** `src/scenes/NetMapScene.ts`.
- **Approach:**
  1. In `showInfo`, add the simulated tag to the header line for nodes other than `HOME_NODE_ID`.
  2. Fit six check rows above the button while keeping the panel's bottom edge above the Your PC and ISP Edge Router nodes (y≈350), tightening row spacing or the button offset if needed. The panel spans y 100-344 today and those nodes sit at y 380.
- **Patterns to follow:** the existing header text and `STATUS_COLOR` use in `showInfo`.
- **Test expectation:** none -- scene layout has no unit test harness in this repo; covered by the manual check below.
- **Verification:** opening MegaCorp Mail shows the tag and opening Your PC does not (AE3); the Data Center Core's six check rows and the button do not overlap, and Your PC and the ISP Edge Router stay fully visible with that panel open.

### U4. Cyber range wording pass

- **Goal:** Reword every screen that frames breaching, so the game reads as a school cyber range.
- **Requirements:** R1, R3, R11; AE4.
- **Dependencies:** U2.
- **Files:** `src/scenes/TitleScene.ts`, `src/scenes/HubScene.ts`, `src/core/state.ts`, `src/scenes/MinigameScene.ts`, `src/scenes/NetMapScene.ts`, `src/data/nodes.ts`, `src/data/lessons.ts`.
- **Approach:** work through this inventory, adjusting each string to lab-exercise framing:
  1. Title subtitle and intro: add the one-or-two-line cyber range statement (R1).
  2. Hub win line (`HubScene.ts:48`) and the `won` hint in `objective()`: the player completed the cyber range's final exercise (AE4).
  3. `MinigameScene.finish` success and failure messages, the minigame title "Connecting to …", and the "Intrusion crashed" button label.
  4. Net Map: the home panel text, the Connect / Re-breach button labels and the status legend.
  5. Node `flavor` lines that describe getting "in" or "through" a machine.
  6. "Intrusion" wording during play: the Hub CPU stat line (`HubScene.ts:37`) and the CPU and memory lesson pages (`lessons.ts:107,140`). In PT-BR this word becomes "invasão", the same word the lesson uses for the crime, so it must read as a lab exercise.
  7. A final search of `src` for the PT-BR terms the PT-BR plan's term list uses for breach, intrusion, access granted and winning (for example invadir/invasão, acesso liberado, vitória), plus the English breach, intrusion, win, root and "ACCESS GRANTED", so nothing is missed.
- **Patterns to follow:** PT-BR plan voice and term list; keep each string's length close to the current one so buttons and panels still fit (PT-BR plan R11).
- **Test expectation:** none -- wording only, and the PT-BR plan's tests check by problem identity, not wording; covered by the manual playthrough.
- **Verification:** a playthrough from a new game shows the cyber range framing on the Title and lab wording on every inventoried screen, through to the ending.

---

## Verification Contract

| Check | Command | Proves |
| --- | --- | --- |
| Unit and integrity tests | `npm test` | U1 and U2 scenarios, R10, AE1, AE2 |
| Types | `npm run typecheck` | no type errors in changed data and scenes |
| Build | `npm run build` | the game bundles |
| Manual playthrough | `npm run dev` | R1, R2, R3, AE3, AE4, panel layout, no text overflow |

The user reviews the lesson's legal text and the ADS reference before the branch ships (Success Criteria).

---

## Definition of Done

- U1-U4 are implemented, and every check in the Verification Contract passes.
- A new game cannot breach the ISP Edge Router until the lesson is passed, and an old save keeps its breached nodes.
- The user has approved the lesson's legal content and the ADS wording.
- No abandoned-attempt code or stray English strings remain in the diff.

---

<!-- ce-section: work-relationships -->
## How This Work Fits Together

This plan covers the cyber range framing and the law-and-ethics lesson from ideation idea 4. The rest of the release-hardening work below is the current understanding, not a committed roadmap.

- PT-BR style system (`docs/plans/2026-10-03-0358-feat-ptbr-style-system-plan.md`)
  - This plan depends on it for language and writing rules.
- Swarm and NOC capacity (`docs/plans/2026-10-03-0339-feat-swarm-noc-capacity-plan.md`)
  - Shares the rule that new systems unlock through a lesson. Its switch content already lives in Networks 101.
  - Shares `checkRequirements` and the Net Map details panel with this plan (see Assumptions).
- Mining economy that replaces breach cash
  - Shares this plan's lesson-gating rule, and must name cryptojacking and cover proof-of-work and its energy cost.
  - Still to decide: how mining on cyber range machines is framed.
- Formatura ending and post-ending tiers
  - Builds on R3's reworded ending.
