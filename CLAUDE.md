# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Rootkit Academy is a browser game (Phaser 4 + TypeScript + Vite) that teaches IT basics to Brazilian students of a technical high-school IT course (IFRS). The player builds a PC, gets it online, then breaches network nodes by passing knowledge mini-games. All player-facing text is Brazilian Portuguese; code, ids and comments are English.

## Commands

```bash
npm install
npm run dev                                   # Vite dev server with hot reload
npm test                                      # Vitest, all tests
npx vitest run tests/fmt.test.ts              # one test file
npx vitest run tests/core.test.ts -t "ip"     # tests whose name matches
npm run typecheck                             # tsc --noEmit (covers src and tests)
npm run build                                 # typecheck + production build into dist/
```

There is no linter; `tsc` runs with `strict`, `noUnusedLocals` and `noUnusedParameters`.

## Architecture

Three layers, with a strict dependency direction `scenes -> core -> data`:

- `src/data/` is content (lessons with quizzes, the parts catalog, network nodes, the PT-BR glossary). Content is linked by **ids**: parts and nodes name the lesson that unlocks them (`requiresLesson`), lessons name prerequisite lessons, nodes name linked nodes and a `MinigameId`.
- `src/core/` is pure game logic with no Phaser imports, and is what the tests exercise. `state.ts` holds `GameState` and every rule (buy, install, progression, breach, objectives); `hardware.ts` derives specs from the installed build (`computeSpecs`) and turns CPU power and RAM into intrusion time and allowed mistakes; `ip.ts` does IPv4 math and network-config validation; `minigames.ts` generates rounds per knowledge area from a seeded RNG; `fmt.ts` formats PT-BR text; `store.ts` keeps the single shared state in localStorage.
- `src/scenes/` are Phaser scenes (UI only), registered in `src/main.ts`; `src/ui/widgets.ts` has the shared button/panel/header/toast helpers. Scenes call `game()` from `store.ts`, mutate through `state.ts` functions, call `save()`, and redraw.

Things that span files:

- **Saves store only ids.** `GameState` (version 1) keeps part, lesson and node ids plus money and the IP config; `store.ts` merges a loaded save over `newGame()`. Renaming an id breaks existing saves and the content-integrity tests; display text can change freely.
- **Problem codes, not wording.** Hardware issues (`Issue.code`), network-config errors (`NetIssue.code`) and purchase checks (`canBuy().code`) carry stable kebab-case codes. Tests and logic (e.g. the shop's locked state) branch on codes, never on message text.
- **Adding a mini-game area:** add the id to `MinigameId` and `MINIGAME_AREAS` in `src/data/nodes.ts` and a generator in `src/core/minigames.ts` returning `choice` or `bits` rounds; `MinigameScene` renders it without changes.
- **Layout:** the canvas is fixed at 1280x720 (`WIDTH`/`HEIGHT` in `widgets.ts`). Buttons and fixed-frame text auto-shrink their font with `fitText`, since Portuguese runs longer than English.

## PT-BR text rules

- Write Portuguese natively from meaning, never by translating English sentence structure. See `docs/solutions/conventions/ptbr-text-native-not-calque.md`; only a native reader catches calques, tests do not.
- `src/data/termos.ts` is the glossary: the one term per concept (with grammatical gender) and the IT words kept in English the way Brazilian technicians use them. `CONCEPTS.md` defines Glossary, Kept term and Calque.
- Informal "você". Never build numbers, money, plurals or gender agreement by hand: use `money`, `decimal`, `linkSpeed`, `plural` (singular only for exactly 1) and `agree` from `src/core/fmt.ts`. Parts and slots carry a `gender` for agreeing messages.
- Technical notation stays as-is: IPs, masks, CIDR, binary, ports, HTTP status codes and reason phrases ("404 Not Found"), DNS record types.
- `tests/content.test.ts` fails when player-visible text contains common English words outside the glossary's allowed list. It scans runtime data, generated rounds and scene string literals that contain a space; single-word labels are not covered.

## Planning docs

`docs/plans/` holds feature plans (requirements, decisions, implementation units) and `docs/ideation/` the ideation that produced them. `docs/solutions/` holds documented learnings (conventions, past problems), organized by category with YAML frontmatter (`module`, `tags`, `problem_type`); relevant when writing player text or working in a documented area. `README.md` describes gameplay in English and predates the PT-BR conversion.
