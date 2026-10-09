---
title: Give a new mini-game area enough question shapes, and let city context vary the address
date: 2026-10-09
category: design-patterns
module: mini-game generators
problem_type: design_pattern
component: testing_framework
severity: medium
applies_when:
  - Adding a mini-game area or a concept to src/core/minigames.ts
  - Passing a city or node context into round generators (RoundContext or TypedContext)
  - A playtester says an area asks the same few questions or repeats one back to back
tags:
  - minigames
  - build-rounds
  - round-variety
  - question-shapes
  - typed-context
  - dedupe
  - seeded-rng
related_components:
  - service_layer
---

# Give a new mini-game area enough question shapes, and let city context vary the address

## Context

The pós-graduação plan added three areas (NAT, VLAN, IPv6). Their tests all passed: the right number of rounds, distinct options, an in-range answer, three lenses per concept, and the English scan. In play the owner reported two problems, one after the other:

1. "In the first NAT city I got the same four questions over and over, sometimes the same question twice in a row."
2. After the first fix: "The problem is happening in VLAN and IPv6 too: feels like there's too few questions."

These were two separate causes. Neither test suite nor the in-browser layout check could see either one.

**Cause 1: the city context pinned every round to one address.** A typed city node passes a `TypedContext` (`src/core/city.ts:269`, `typedContext`) holding its NAT site, its VLAN or its IPv6 address. The first generators used that context's single host in every round of the node. At level 1 a NAT node could produce about three distinct prompts for five rounds. `buildRounds` dedupes on prompt plus detail and gives up after 200 duplicate draws (`src/core/minigames.ts:139`, `if (seen.has(key) && repeats++ < 200) continue;`), so it then accepted repeats. Those repeats could land back to back. A failing test printed exactly the owner's run: 3 distinct prompts in 5 rounds.

**Cause 2: one or two templates per concept.** Even with varied numbers, every concept had only one or two prompt templates. Counting question *shapes* (each prompt with numbers, addresses and names stripped out) over 200 seeds showed the gap. These are this session's measurements; the test below enforces only minimums:

| Area | Level 1 | Level 2 | Level 3 |
|---|---|---|---|
| NAT, VLAN, IPv6 (before) | 2-3 | 3-4 | 4-5 |
| ports, HTTP, DNS (existing) | 6-15 | 12-19 | 21-32 |
| NAT / VLAN / IPv6 (after) | 8 / 5 / 13 | 20 / 29 / 19 | 23 / 32 / 19 |

Binary and subnet also have few shapes, but they are numeric drills where the numbers are the exercise. Concept areas like these are not.

A third, smaller flaw sat inside cause 1. IPv6 nodes forced half of the address-type rounds onto the city's own address, so the answer was always "Global".

## Guidance

1. **Context supplies the network, not the answer.** Pass the node's site or prefix into the generator, then draw a fresh host inside it for each round. The NAT generator draws `sitePc` inside the site /24 (`src/core/minigames.ts:576`), and IPv6 draws `cityV6Host` inside the node's /64 (`src/core/minigames.ts:958`). Use the exact node address only where the question needs that specific machine, such as the port-forward rule naming the published host.
2. **Do not force a context-driven answer.** If half the rounds of a kind always resolve to the same option, the context has become the answer key. Let the context value be one candidate among the normal draws.
3. **Write three to six templates per concept, opened by level,** before calling an area done. Mix computing a value, classifying an item, picking the odd one out, a "what happens if" scenario, and a fact question. Static fact prompts are fine; dedupe keeps each to once per intrusion.
4. **Measure shapes against the existing areas,** not against a feeling. Strip numbers, IPv4 and IPv6 addresses, VLAN names, device names and service names from prompts over 200 seeds, then count the distinct remainder per level. Aim for parity with ports, HTTP and DNS at the same levels.
5. **Test both properties for every context the area accepts.** Varied numbers do not prove variety, and a single context does not prove none repeats.

## Why This Matters

The existing generator tests check that rounds are *valid*. They pass for an area that asks the same question every round. The dedupe loop hides the problem until its retry budget runs out. Then it degrades silently into repeats instead of failing. Low variety matters for a teaching game: the student memorizes the answer position for the few shapes instead of the concept, and the area feels broken. Both causes only surfaced through a playtester. That was a full release cycle after tests, review and a browser check had all passed.

## When to Apply

- Adding a new area, concept or level to `src/core/minigames.ts`.
- Feeding any per-node context (`RoundContext`, `TypedContext`) into generators. The more a context fixes, the fewer distinct prompts it leaves.
- Before reporting an area as done: run the shape count, not only the validity tests.

## Examples

The guard tests live in `tests/areas.test.ts`:

- "a typed city node never repeats a question within one intrusion" (line 82) builds NAT, VLAN and IPv6 rounds with a typed context at levels 1-3 for seeds 1-30. It asserts that the number of distinct prompt-plus-detail keys equals the round count. Before the fix it failed with `nat level 1 seed 1: ... expected 3 to be 5`.
- "offers as many question shapes as the other level 1-3 areas" (line 99) sets minimums of 6, 10 and 12 shapes for levels 1-3 (line 104). VLAN at level 1 needs only 5, because only two of its three concepts open there.

Before and after, for the context:

```ts
// Before: every round of the node asked about the same PC.
const host = formatIp(nat.privateHost);

// After (src/core/minigames.ts:568): the site is the city's; the PC varies inside it.
return outsideAddressRound(rng, d, nat, typed?.nat ? sitePc(rng, nat) : nat.privateHost);
```

The "before" form still exists in the port-forward round on purpose, because a forwarding rule names one published host.

A new area should get its own entry in both tests. Neither test discovers areas on its own.

## Related

- `docs/solutions/design-patterns/extend-seeded-generators-without-changing-old-rounds.md`: the companion rule for the same module. New templates and draws belong only on the new area's path, so existing areas keep their pinned rounds (`tests/minigames-context.test.ts`).
- `docs/solutions/conventions/ptbr-text-native-not-calque.md` and `docs/solutions/conventions/ptbr-keep-field-jargon-in-english.md`: new templates are player text. The owner corrected "local única" to "local" (unique local IPv6 address) in this same round of work.
