---
title: Extend the seeded mini-game generators without changing the rounds old levels produce
date: 2026-10-06
last_updated: 2026-10-09
category: design-patterns
module: mini-game generators
problem_type: design_pattern
component: testing_framework
severity: medium
applies_when:
  - Adding a parameter, mode or level to buildRounds or an area generator in src/core/minigames.ts
  - Changing which helper a generator calls to pick a type, prefix, address or value
  - A plan says existing levels or seeds must keep producing the same rounds
tags:
  - seeded-rng
  - deterministic-generation
  - characterization-test
  - minigames
  - build-rounds
  - difficulty-levels
related_components:
  - service_layer
---

# Extend the seeded mini-game generators without changing the rounds old levels produce

## Context

Every mini-game round comes from one seeded PRNG: `createRng(seed)` in `src/core/random.ts:5` returns a function, and each generator in `src/core/minigames.ts` draws from it in sequence (`randInt`, `pick`, `shuffle`). Because the draws share one stream, a single extra, missing or reordered `rng()` call shifts every value drawn after it, in that round and in every later round of the build. Nothing errors; the rounds are still valid, just different.

The reteach plan (`docs/plans/2026-10-03-1446-feat-reteach-side-jobs-plan.md`, R15) required levels 1-3 to keep producing exactly today's rounds while the generators gained numeric levels above 3, a concept tag on every round, a focus-concept mode for review jobs, and three explanation texts per round. The existing generator tests only check that rounds are *valid* (option counts, answer index, bit targets), so they pass whether or not the content changed. A change that silently reshuffles the rounds of a seed passes the whole suite.

The seeded-cities plan (`docs/plans/2026-10-03-1513-feat-seeded-ip-plan-cities-plan.md`) changes the same generators again (round context from a city's addresses) and listed "without a context, rounds for seeds 1-30 in every area and difficulty equal the pinned rounds" as a test scenario. That test now exists: `tests/minigames-context.test.ts` ("leaves rounds without a context exactly as pinned") hashes every context-free round of the five original areas, at every level and seeds 1-30, unfocused and focused on each concept.

## Guidance

1. **Keep the old path making the identical sequence of rng calls.** Add new behavior on a branch the old inputs never take, and make sure that branch is the only place new draws happen.
   - `roundType` (`src/core/minigames.ts:155-158`) draws `randInt(rng, 0, maxType)` exactly as the generators did inline before, and only calls `pick(rng, forced)` when a focus concept is passed. Without a focus, the draw is the same call with the same range.
   - `randomPrivateIp(rng, prefix)` (`src/core/minigames.ts:251-252`) narrows the block choice only for prefixes shorter than /16. Every level 1-3 prefix is /16 or longer, so those levels still draw `randInt(rng, 0, 2)` as before.
   - New per-round work that needs no randomness (the explanation texts) is computed from values already drawn, never with new `rng()` calls.
   - The focus mode in `buildRounds` (`src/core/minigames.ts:124-152`) shuffles its result (`shuffle(rng, rounds)`), but only on the focus path; the unfocused path returns before that draw.
2. **Changing the stopping rule of a loop that draws is safe only if the old inputs never reach the changed branch.** `buildRounds` once stopped after 200 attempts; it now accepts a repeated prompt after 200 duplicates (`src/core/minigames.ts:139`). Without a context, levels 1-3 of the original areas never hit the duplicate limit, so the sequence of draws is unchanged; that is a property to verify, not assume. A context that narrows the possible prompts can hit it, and then the build repeats questions; see the related question-shapes doc.
3. **Prove it with a before/after snapshot, not by reading.** Before touching the generators, dump every build the requirement protects to JSON; after the change, dump again and byte-compare. Strip fields the change adds (here `concept`, and later the explanation object) so the comparison covers only what existed before.
4. **Write the dump as a temporary test and delete it.** Tests here cannot import `node:fs`: `tsconfig.json` sets `"types": ["vite/client"]`, so `typecheck` fails on Node imports while the file exists. Vitest still runs it. Create the file, run it with an env var naming the output path, and remove it before typechecking or committing.
5. **Keep the committed pinned test passing unmodified.** `tests/minigames-context.test.ts` now carries the guarantee for the five original areas. A change that needs a new hash there broke the promise; do not update the hash to make it pass. Areas added later (NAT, VLAN, IPv6) are not pinned, so their generators may change freely, and the temporary snapshot above stays the tool for protecting anything else.

## Why This Matters

Old rounds staying put is a product promise, not a nicety. Map nodes run at fixed difficulties 1-3, the reteach plan promised those levels unchanged content (R15), and the cities plan's pinned-rounds scenario depends on rounds without a context staying exactly as they are. A shifted rng stream breaks that promise silently. The suite stays green, the game still plays, and the only symptom is that a known seed now shows different questions. Reading the diff is not enough evidence either: in this session the change touched three draw sites (`roundType`, `randomPrivateIp`, the `buildRounds` loop), and the safety of each depended on which branch level 1-3 inputs take.

## When to Apply

- Before editing any generator, helper or loop in `src/core/minigames.ts` that draws from the rng.
- When adding a parameter (focus, context, level) to `buildRounds` or a generator.
- When a plan states that existing levels, nodes or seeds must keep their rounds.

## Examples

The temporary characterization test used in this session (written as `tests/zz_baseline.test.ts`, run, then deleted):

```ts
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { buildRounds } from '../src/core/minigames';
import { createRng } from '../src/core/random';

it('dump', () => {
  const out: unknown[] = [];
  for (const id of ['binary', 'subnet', 'ports', 'http', 'dns'] as const)
    for (const d of [1, 2, 3] as const)
      for (let seed = 1; seed <= 30; seed++)
        out.push(buildRounds(id, d, createRng(seed)).map(({ concept: _c, ...r }: any) => r));
  writeFileSync(process.env.DUMP_FILE!, JSON.stringify(out));
});
```

```bash
DUMP_FILE="$SCRATCH/baseline.json" npx vitest run tests/zz_baseline.test.ts   # before the change
# ...change the generators...
DUMP_FILE="$SCRATCH/after.json" npx vitest run tests/zz_baseline.test.ts      # after
cmp "$SCRATCH/baseline.json" "$SCRATCH/after.json" && echo IDENTICAL
rm tests/zz_baseline.test.ts
```

A draw added on the shared path, the kind of change that breaks this:

```ts
// Breaks old rounds: the forced type is drawn on every round, so rng moves
// one step further even when no focus concept is requested.
const forced = pick(rng, (focus && types[focus]) || [0]);
const type = focus ? forced : randInt(rng, 0, maxType);

// Keeps old rounds: only the focus path draws something new.
const type = focus && types[focus] ? pick(rng, types[focus]) : randInt(rng, 0, maxType);
```

## Related

- `docs/solutions/design-patterns/give-new-minigame-areas-enough-question-shapes.md`: the companion rule for the same module. Keeping old rounds identical is not enough for a new area; it also needs enough question shapes, and a city context must vary the address it asks about.
