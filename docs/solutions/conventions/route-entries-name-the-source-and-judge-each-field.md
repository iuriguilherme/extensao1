---
title: Teach a route from a named source host, and judge each field against the real target
date: 2026-10-06
category: conventions
module: routing lesson and city route entries
problem_type: convention
component: service_layer
severity: medium
applies_when:
  - Writing a lesson page, quiz question or explanation about routes, next hop or gateways
  - Adding a gate that asks the player for a route or a similar multi-field network entry (NAT port forwarding, VLAN, IPv6 routes)
  - Writing or changing a validator that returns teaching errors for a multi-field entry
tags:
  - routing
  - next-hop
  - quiz
  - teaching-errors
  - validation
  - city-routes
related_components:
  - documentation
---

# Teach a route from a named source host, and judge each field against the real target

## Context

The seeded-cities feature asks students to write a route (destination network, prefix, next hop) to open the subnet behind a router. It shipped with a routing lesson (`routing` in `src/data/lessons.ts`) and a validator (`validateRoute` in `src/core/routing.ts`). Two teaching defects surfaced after the code was correct and its tests passed:

- **The quiz question had no source host.** The next-hop question read "Um roteador usa 10.4.1.1 na sua rede e 10.4.2.1 na rede do outro lado. Para chegar a 10.4.2.0/24, qual é o próximo salto?" The project owner pointed out that "next hop" only has an answer relative to the machine whose routing table holds the route. Without saying the source is the student's PC on the router's near network, "the router's address on your network" reads as arbitrary. The fixed question names the source: "Seu PC está na rede 10.4.1.0/24, ligado a um roteador que usa o endereço 10.4.1.1 nessa rede e 10.4.2.1 na rede do outro lado. Para o seu PC chegar a 10.4.2.0/24, qual é o próximo salto?" (`src/data/lessons.ts:340`). The explanation also says why the far-side address is wrong: the PC cannot reach it directly.
- **One mistake produced two errors, one of them false.** The first `validateRoute` classified the destination under the prefix the player picked. A correct child network with a wrong prefix (for example `10.x.92.0` entered as /23 when the network is /24) was reported both as `prefix-mismatch` and as `destination-host`: "this is a host address". The second message was false for what the student meant, and it pointed them at the wrong field. The fix judges the destination against the real target subnet behind the router, so that case is only a prefix mistake (`src/core/routing.ts:64-76`). `tests/routing.test.ts:94` pins it across every sampled router and every wrong prefix the form offers.

Neither defect shows in a passing test suite or a correct implementation: the route rules were right both times. What was wrong was what the student is told.

## Guidance

1. **Name the source host in every route question, page and error.** A route belongs to some machine's routing table. Say which one ("seu PC", "o roteador R1"), which network it sits on, and only then ask for the next hop. The next hop is always the router's address on the source's own network. Far-side addresses are wrong because the source cannot reach them directly. Say that reason in the explanation, not just the right answer.
2. **Judge each field against the real target, independently.** Classify the player's destination relative to the subnet the route must reach, not relative to the player's other answers. One wrong field should produce one error, on that field:
   - destination inside the target subnet but not its network address: host or broadcast error;
   - destination outside the target subnet: wrong-network error;
   - prefix different from the target's: prefix error, and nothing else;
   - next hop outside the source's subnet: unreachable error; inside it but not the router: not-this-router error.
3. **Errors name the concept to recheck and never print the correct value.** Echoing what the player entered is fine. `tests/routing.test.ts` checks that no message contains a correct value the player did not type.
4. **Build every distractor to trip a specific check.** `routeChoices` builds each wrong option to exercise a particular error code. A test that every distractor triggers at least one error, and that together they cover every code, keeps the form and the validator in sync.

## Why This Matters

Route entry is a teaching gate. A student who gets a wrong or extra error learns the wrong rule ("a /24 network address is a host?") or stops trusting the messages. A question without a source host teaches "memorize which address goes in the box" instead of "the next hop is the router I can reach". Code review and tests did not catch either issue. The quiz was caught by the project owner reading it; the validator issue was caught while integrating the worker's code, by asking what one specific mistake would display.

## When to Apply

- Any new lesson, quiz or explanation about routes, gateways or next hop, including the routing lesson in `src/data/lessons.ts`.
- New gate types that extend city route entries, such as the NAT, VLAN and IPv6 gates planned in `docs/plans/2026-10-03-1608-feat-formatura-pos-graduacao-plan.md` (R12-R15). Each one asks for several fields about one target, so the same per-field judging applies.
- Changing `validateRoute` or `routeChoices` in `src/core/routing.ts`.

## Examples

Question without and with a source host:

| Without (rejected) | With (current) |
|---|---|
| Um roteador usa 10.4.1.1 na sua rede e 10.4.2.1 na rede do outro lado. Para chegar a 10.4.2.0/24, qual é o próximo salto? | Seu PC está na rede 10.4.1.0/24, ligado a um roteador que usa o endereço 10.4.1.1 nessa rede e 10.4.2.1 na rede do outro lado. Para o seu PC chegar a 10.4.2.0/24, qual é o próximo salto? |

Judging the destination (directional):

```ts
// Before: judged under the player's own prefix, so a right network with a
// wrong prefix also became "a host address".
if (destination !== networkAddress(destination, entry.prefix)) fail('destination-host', ...);

// After: judged against the subnet the route must reach.
if (sameSubnet(destination, childNet, child.prefix)) {
  if (destination === broadcastAddress(childNet, child.prefix)) fail('destination-broadcast', ...);
  else if (destination !== childNet) fail('destination-host', ...);
} else {
  fail('destination-other-network', ...);
}
if (entry.prefix !== child.prefix) fail('prefix-mismatch', ...);
```

## Related

- `docs/solutions/conventions/ptbr-text-native-not-calque.md`: rules for writing the PT-BR text of these questions and errors.
- `docs/solutions/design-patterns/extend-seeded-generators-without-changing-old-rounds.md`: the other city-feature change to teaching content (round context in `src/core/minigames.ts`).
- Plan: `docs/plans/2026-10-03-1513-feat-seeded-ip-plan-cities-plan.md` (KTD7 and KTD8 define the next hop and the validator).
