---
title: Drive Phaser scenes from a browser tool by seeding the save and clicking in game coordinates
module: manual UI verification
date: 2026-10-06
last_updated: 2026-10-08
problem_type: developer_experience
component: development_workflow
severity: medium
applies_when:
  - Manually verifying a scene change (layout, text fit, new labels) in a real browser from an agent session
  - Needing the game in a specific state (online, lessons done, nodes breached, ending reached) without playing to it
  - Playwright MCP refuses to start with "Browser is already in use"
tags:
  - phaser
  - manual-testing
  - browser
  - playwright
  - chrome-devtools
  - localstorage
  - canvas
related_components:
  - frontend
  - testing_framework
---

# Drive Phaser scenes from a browser tool by seeding the save and clicking in game coordinates

## Context

Scenes have no automated tests here (`tests/` covers `src/core` and data only), so layout and text-fit changes are checked by looking at the running game. Two sessions in a row had to work out how to do that from an agent:

- The swarm/NOC session (2026-10-05) scripted Playwright with `page.mouse.click` and a save written to localStorage (session history).
- The cyber-range ethics session (2026-10-06) rediscovered the same approach. Playwright then failed with `Browser is already in use for C:\Users\iuri\AppData\Local\ms-playwright-mcp\mcp-chrome-a372f0c, use --isolated to run multiple instances of the same browser`, which the swarm session had also hit (session history), so it switched to Chrome DevTools MCP.

The game itself is all canvas: there are no DOM buttons to target, and `src/main.ts` creates `new Phaser.Game({...})` without keeping a handle, so there is no `window.game` to call `scene.start` on.

## Guidance

1. **Start a server** with `npx vite --port <port> --strictPort` (or `npm run preview` after a build). Run it in the background and stop it when done.
2. **Reach the state through the save, not through play.** Write the save to localStorage and reload. `load()` in `src/core/store.ts` spreads the saved object over `newGame()`, so a partial save works. However, **it must carry `version: 1`**: any other version is silently ignored and the game starts fresh.

   ```js
   localStorage.setItem('rootkit-academy-save-v1', JSON.stringify({
     version: 1, money: 5000,
     installed: { motherboard: 'mb_x5', cpu: 'cpu_s2_16c', ram: 'ram_64_ddr5', storage: 'nvme_2tb',
                  psu: 'psu_450', nic: 'nic_10g', router: 'router_10g' },
     lessonsCompleted: ['computer-basics', 'power', 'cpu', 'memory', 'storage', 'binary',
                        'network-basics', 'ip-addressing', 'dns', 'ports', 'http'],
     netConfig: { ip: '192.168.0.42', mask: '255.255.255.0', gateway: '192.168.0.1', dns: '192.168.0.1' },
     breached: ['isp', 'museum', 'resolver', 'uni', 'corp-fw'],
   }));
   location.reload();
   ```

   Ids come from `src/data/` (parts, lessons, nodes). The example above is online with every lesson except `ethics` and `routing`, and has the Data Center Core reachable. To reach the cities, add `'ethics'` and `'routing'` to `lessonsCompleted` and `'core'` to `breached`; a `cities` entry such as `{ level: 3, seed: 4821, breached: [], opened: [], finished: false }` opens straight onto a known city.

   Conquistas have their own key, `rootkit-academy-conquistas-v1` (`src/core/achievementStore.ts`). It also needs `version: 1` and an `unlocked` array, for example `{ version: 1, unlocked: ['first-boot'], totals: { answered: 312, correct: 0, runs: 0, cities: 0 }, last: { answered: 312, correct: 0, runs: 0, cities: 0 }, popups: true }`. Keep `last` equal to what the seeded game save shows, or the first check adds the difference to `totals`. When the key is missing, the load seeds the counters from the game save and silently unlocks whatever that save proves, so remove the key to test a first load.
3. **Click in game coordinates.** The canvas is a fixed 1280x720 game scaled with `Scale.FIT` (`src/main.ts`), so screen pixels differ from game pixels unless the viewport is exactly 1280x720. Convert from the canvas rect:

   ```js
   const c = document.querySelector('canvas');
   const r = c.getBoundingClientRect(), s = r.width / 1280;
   window.__click = (gx, gy) => {
     const x = r.left + gx * s, y = r.top + gy * s;
     for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup'])
       c.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: y, bubbles: true, pointerId: 1, isPrimary: true, button: 0 }));
   };
   ```

   With Playwright at a 1280x720 viewport, `page.mouse.click(gx, gy)` does the same with no scaling. Wait about 300-600 ms after a click that changes scene before taking the next screenshot.
4. **Take button centers from the scene source**, not from screenshots. A screenshot is in page pixels, which are offset and scaled. Reading a target off a screenshot and clicking it as a game coordinate misses: a "Voltar" click did nothing in this session for that reason. Centers that hold today:
   - Title "Continuar" (shown when a save exists): `(640, 447)`. "Novo jogo" without a save: `(640, 467)`.
   - Hub menu (`HubScene`, x 800, w 440, rows from y 76, 78 apart, 48 tall): Estudar `(1020, 100)`, Loja `(1020, 178)`, Bancada `(1020, 256)`, Configuração de Rede `(1020, 334)`, Mapa da Rede `(1020, 412)`, Cidades `(1020, 490)`. The menu was tightened to six rows when Cidades was added; recompute from `src/scenes/HubScene.ts` if the rows change again.
   - "< Voltar" from `header()` in `src/ui/widgets.ts`: `(67, 28)`.
   - Net Map nodes: their `x`/`y` in `src/data/nodes.ts`.
   - City map nodes (`CityMapScene`): the diagram is drawn by a second camera whose viewport starts at y 56 and which is scrolled 60 px down and sideways, so a node's `x`/`y` from `generateCity` is not a screen coordinate. Click at `(node.x - scrollX, node.y - 4)`; `scrollX` is 0 when the map opens, until the arrows, a drag or a focus scroll move it. Header and info-panel buttons are on the main camera and use plain game coordinates.
5. **If Playwright MCP is locked by another session, use Chrome DevTools MCP** `new_page` with an `isolatedContext` name. It gets its own storage, so seeding the save there does not touch other sessions. Use `evaluate_script` for steps 2-3 and `take_screenshot` to look. Close the page afterwards.

## Why This Matters

Without this, an agent either skips the visual check (a layout bug ships, since tests cannot see the canvas) or spends many tool calls playing through lessons and purchases to reach a state. The visual check is what caught real bugs: this session found the Your PC panel text running past the panel edge, which no test could catch.

## When to Apply

- After any change to a scene's text, layout or panel sizing, before claiming it works.
- When a requirement only shows in a late-game state (Net Map panels with many checks, the ending, NOC with nodes attached).

## Examples

To check the Data Center Core panel before the ethics lesson:

1. Seed the save from step 2 and reload.
2. Run `__click(640, 447)` (Continuar), then `__click(1020, 412)` (Mapa da Rede), then `__click(1170, 330)` (the Core node).
3. Take a screenshot.

To check the ending, add `'core'` to `breached`, reload and click Continuar. The Hub shows the won line.
