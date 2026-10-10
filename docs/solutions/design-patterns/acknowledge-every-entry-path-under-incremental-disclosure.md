---
title: Adding a screen or control under incremental disclosure means acknowledging it on every entry path and checking what its card covers
date: 2026-10-10
category: design-patterns
module: interface disclosure (src/core/disclosure.ts, src/ui/widgets.ts)
problem_type: design_pattern
component: frontend
severity: medium
applies_when:
  - Adding a Hub entry, an in-screen tab or any control that should be introduced through the disclosure queue
  - Adding a second way into an existing screen (a shortcut button, a "continue" link, a scene.start from another scene)
  - Giving a screen a first-open card when the screen has a running timer, an HTML (DOM) field, or other live state
  - Logging a new game event to the desk message log
tags:
  - disclosure
  - introduction
  - onboarding
  - phaser
  - dom-element
  - modal-card
  - timer
  - save-ids
related_components:
  - service_layer
---

# Adding a screen or control under incremental disclosure means acknowledging it on every entry path and checking what its card covers

## Context

The game shows its interface one piece at a time (plan `docs/plans/2026-10-09-1903-feat-incremental-disclosure-plan.md`, concept "Introduction" in `CONCEPTS.md`). `src/core/disclosure.ts` keeps an ordered registry of elements (Hub entries, the NOC and Pós-graduação tabs, Conquistas) with availability predicates. At most one element is `current`: drawn, pulsing, its log line already written. Using it calls `acknowledge`, which promotes the next available one (`src/core/disclosure.ts:85`, `:94`). Every screen passes a card id to `header()`, which shows a one-time card and a "?" to reopen it (`src/ui/widgets.ts:147`, `:201`, `:226`).

The unit tests passed and a browser walkthrough of the first minutes looked right. A multi-agent code review then confirmed four defects, all of the same kind: the happy path (the desk button, the first-time card) was correct, and a second path into the same state was not. None of them would show up in `tests/` because scenes are untested by design.

## Guidance

**1. Acknowledge the element on every path that opens its screen, not only from the desk.**
Desk entries were acknowledged only from their Hub buttons (`advance` runs in `HubScene.create`, `useElement` on the button press); in-screen tabs are acknowledged in `StudyScene` and `WorkbenchScene`. `NetSetupScene` has an "Abrir Mapa da Rede" button that starts `NetMap` directly. A player who used it, then went back to the desk, found the Net Map introduced again: pulsing, logged, the goal line telling them to open a map they had already used, and the NOC tab stuck behind it in the queue. Any shortcut into a screen must do what the Hub does:

```ts
// src/scenes/NetSetupScene.ts:102-103
advance(game());
useElement('net-map');
this.scene.start('NetMap');
```

When you add a `scene.start(...)` into a screen that is a disclosure element, grep for the element id and check each entry path.

**2. A card's events fire for "?" reopens too. Decide whether live state should react to both.**
`introCard` emits `card-open` and `card-close` on every open (`src/ui/widgets.ts:215`, `:219`). `MinigameScene` paused its round clock on `card-open` so the first-time card would not eat the first round's time. Because "?" emits the same event, a player could reopen the card mid-round and think for as long as they liked. That broke the CPU-to-round-time link the game teaches. Fix: pause only when no round is running, which is true only for the first-time card shown during `create`:

```ts
// src/scenes/MinigameScene.ts:120-121
private pause() {
  if (!this.running) this.paused = true;
}
```

Register such listeners before `header()` (which may open the card synchronously), and remove them on `shutdown` so a restarted scene does not stack duplicates (`src/scenes/MinigameScene.ts:87-90`).

**3. The card is a canvas object. HTML (DOM) elements draw above it whatever its depth.**
The Formatura name field is `textInput`, a real `<input>` added with `scene.add.dom` (`src/ui/widgets.ts:122`). The card's full-screen blocker at depth 2000 neither covered it nor stopped its Enter handler, so "?" on the name step showed the field over the card text and still let Enter submit behind it. Fix: expose `setVisible` on the field (`src/ui/widgets.ts:128`) and hide it on `card-open`, showing it again on `card-close` (`src/scenes/FormaturaScene.ts:27`, `:38`). Any screen that mixes a card with a DOM element needs the same.

**4. Passive elements need a different acknowledgement and must not own the goal line.**
The money counter cannot be clicked, and "Apagar progresso" must not be pressed just to advance the queue. Elements marked `passive` (`src/core/disclosure.ts:40`, `:42`) count as introduced after `PASSIVE_MS` (3 s) on the desk (`src/scenes/HubScene.ts:20`, `:103-104`). Leaving the desk cancels the timer, so it starts over. In the first browser pass, the goal line said "use Apagar progresso" while the player was inside the Shop. `goalLine` now skips passive elements and falls back to the normal objective (`src/core/disclosure.ts:105`).

**5. Log entries are ids, rendered at draw time.**
The first version saved finished Portuguese sentences in `disclosure.log`. That breaks the CLAUDE.md rule that saves keep only ids so text can change freely: a wording fix would never reach existing saves. Entries are now `LogEntry` values (`src/core/state.ts:69`) rendered by `logLine` (`src/core/disclosure.ts:148`). An entry naming something this build does not know renders as nothing. In the same spirit, `restore()` drops a `current` element id this build does not know (`src/core/store.ts:36`), because every query on it would throw.

## Why This Matters

Disclosure state persists in the save and drives what the player sees next. A missed entry path or a misfiring card event does not crash anything: the game re-explains something the student already used, freezes a timer, or lets a hidden control act. Those failures happen at the change site only on a path nobody tested, so they read as polish bugs. They contradict the feature's purpose, which is that everything on screen is something the student was shown how to use. Unit tests cover the queue in `src/core/disclosure.ts` (`tests/disclosure.test.ts`). They cannot see scene wiring, so this checklist is the guard.

## When to Apply

- Adding a new element to `ELEMENTS` (a desk entry, a tab, a new system's button such as Conquistas, added this way at `src/core/disclosure.ts:53`).
- Adding any `scene.start` into a screen that belongs to an element.
- Adding a card to a screen with a timer, animation-driven state, a DOM element, or anything else that keeps running behind a modal.
- Logging a new event: add a `LogEntry` kind and a template in `src/data/intros.ts`, never a pre-rendered string.

## Examples

Checklist for a new element, using the existing ones as the pattern:

1. Add it to `ELEMENTS` in queue order with a predicate built from existing rules. Mark it `passive` if the player cannot or should not click it.
2. Add its `log` (and `goal`, unless passive) to `ELEMENT_TEXT` and its card to `CARD_TEXT` (both in `src/data/intros.ts`), and register the card in `CARDS` in `src/core/disclosure.ts`. `tests/disclosure.test.ts` fails if an id lacks text.
3. Draw it only when `isVisible`, call `pulseIfCurrent`, and call `useElement` on click (`src/ui/widgets.ts:184`, `:189`).
4. Grep for every other `scene.start` into its screen and acknowledge there too.
5. If its screen has live state, decide what a "?" reopen should do to it.
6. Browser-check a fresh save and an old save (`docs/solutions/developer-experience/manual-ui-check-phaser-scenes.md`).

## Related

- `docs/solutions/design-patterns/cross-scene-ui-needs-an-overlay-scene.md`: the conquista pop-up is an overlay scene and is not part of the disclosure queue. The Conquistas button is.
- `docs/solutions/conventions/ptbr-text-native-not-calque.md`: all log lines, goal lines and cards are player text.
