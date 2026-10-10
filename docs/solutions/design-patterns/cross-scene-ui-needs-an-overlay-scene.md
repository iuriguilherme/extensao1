---
title: UI that must survive a scene change lives in its own overlay scene, not in a toast
date: 2026-10-10
category: design-patterns
module: Phaser scenes and UI widgets
problem_type: design_pattern
component: frontend
severity: medium
applies_when:
  - Showing a notice that is triggered by a state change, where the next thing that happens is often a scene change
  - Adding any UI that must stay on screen across scenes (pop-ups, banners, a global indicator)
  - A core module needs to tell the UI that something happened, and core cannot import Phaser
tags:
  - phaser
  - scenes
  - overlay-scene
  - pop-up
  - toast
  - scene-start
  - conquistas
---

# UI that must survive a scene change lives in its own overlay scene, not in a toast

## Context

The conquistas (achievements) feature needed a small corner card for each unlock. The first idea was the existing `toast()` helper in `src/ui/widgets.ts`. It adds a text object to the scene that calls it and fades it with that scene's tweens (`src/ui/widgets.ts:155-161`).

That cannot work for unlocks. Navigation in this game is always `this.scene.start(key)`, which shuts down the current scene and destroys every object it owns, a toast included. Unlocks are checked on every `save()` (`src/core/store.ts:42`), and many saves come right before a scene change. A mini-game result saves and then returns to the network map, city map or job board, and the first Core breach goes straight to the formatura instead (`src/scenes/MinigameScene.ts:296-309`, via `src/scenes/CertificateScene.ts:180`). A toast from the scene that saved would vanish within a frame, before anyone saw it.

The code had no overlay scene, registry or event bus to build on, so this was a new pattern for the repo.

## Guidance

Put cross-scene UI in a dedicated scene that runs alongside the others for the whole session:

1. **Register it last** in the `scene` list in `src/main.ts`. Phaser draws scenes in list order, so the last scene draws over every other one (`src/main.ts:35-36`).
2. **Launch it once, never start or stop it.** `TitleScene` runs `if (!this.scene.isActive('ConquistaPopup')) this.scene.launch('ConquistaPopup')` (`src/scenes/TitleScene.ts:16`). `launch` runs it in parallel, so other scenes' `scene.start` calls never shut it down. The `isActive` guard keeps a returning visit to the title screen from relaunching it.
3. **Give it no interactive objects.** With nothing interactive on the top scene, pointer input falls through to the scene underneath. The card never blocks a button, even one it covers. This was checked in the browser: a click under the card still opened "Estudar".
4. **Subscribe from the UI side, once.** Core may not import Phaser, so `src/core/achievementStore.ts` exposes `onUnlock(listener)` (`src/core/achievementStore.ts:131`). The overlay scene subscribes in `create()` behind a static `subscribed` flag (`src/scenes/ConquistaPopupScene.ts:16, 26-27`), because `create()` runs again if the scene is ever relaunched. The queue is static for the same reason.
5. **Queue and show one card at a time,** and defer while a scene that needs that screen space is active. The pop-up waits while `Minigame` is running, so it never covers the round timer or the integrity status (`src/scenes/ConquistaPopupScene.ts:40-41`).

## Why This Matters

A per-scene toast silently loses exactly the notices that matter most, the ones triggered by milestones, because milestones are what lead to a new scene. Nothing fails: no error is thrown and every test passes. The card just never appears, and only someone watching the screen at that moment would notice. The overlay scene also means notices no longer depend on which scene happens to be active. Any core event can reach the player without each scene wiring its own display.

## When to Apply

- Any notice fired from a `save()` or other state change that may be followed by `scene.start`.
- Any persistent on-screen element: a global banner, a connection or progress indicator, a debug overlay.
- Not for messages about the current scene only, such as the purchase confirmation in the Shop (`src/scenes/ShopScene.ts:50`). A toast is still the right tool there, because the message should go away with the scene.

## Examples

Before (a hypothetical first attempt), the unlock notice dies with the scene that saved:

```ts
// MinigameScene, after the final save
toast(this, 'Conquista desbloqueada: Primeira invasão');
this.scene.start('NetMap'); // destroys the toast on the next frame
```

After, core notifies and the overlay scene owns the display:

```ts
// src/core/achievementStore.ts — core, no Phaser
export function onUnlock(listener: (ids: string[]) => void): void { listeners.push(listener); }

// src/scenes/ConquistaPopupScene.ts — registered last in src/main.ts, launched once from TitleScene
create() {
  if (!ConquistaPopupScene.subscribed) {
    ConquistaPopupScene.subscribed = true;
    onUnlock((ids) => { /* queue ids, then showNext() */ });
  }
}
```

Verify a new overlay by hand, since scenes have no automated tests. Trigger the event, then change scene while the card is up. The card must still be visible on the new scene, and a click under it must reach that scene. `docs/solutions/developer-experience/manual-ui-check-phaser-scenes.md` describes how to drive scenes from a browser tool.
