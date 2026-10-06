---
title: Keep IT jargon in English when Brazilian technicians do; never coin a Portuguese term
module: game text (PT-BR)
date: 2026-10-06
problem_type: convention
component: frontend
severity: medium
applies_when:
  - Naming a new game system, mechanic or part that has an English IT name (swarm, mining, NOC, uplink)
  - Adding a concept to the glossary in src/data/termos.ts
  - Delegating Portuguese text that contains IT jargon to an agent or subagent
symptoms:
  - Player text uses a dictionary translation of an IT term that no Brazilian technician uses
root_cause: over_translation
tags:
  - pt-br
  - localization
  - glossary
  - kept-term
  - jargon
  - game-text
related_components:
  - documentation
---

# Keep IT jargon in English when Brazilian technicians do; never coin a Portuguese term

## Context

The swarm/NOC feature lets breached network nodes lend their CPU, RAM and storage to the player's PC. The agent that wrote its player text translated "swarm" as "enxame" everywhere: the Workbench tab ("NOC e enxame"), the Hub line, the Net Map legend, the join and leave messages, part descriptions, and the glossary entry, which recorded it as a translated term (`mantido: false`). Every check passed. "Enxame" is correct Portuguese, so the English-word scan in `tests/content.test.ts` had nothing to flag, and the plurals and gender agreement were all right.

The native-speaker owner rejected it: Brazilian IT does not call pooled machines an "enxame". The term stays in English. The only full Portuguese form, "arquitetura computacional para redes orgânicas e heterogêneas", is something no one uses in practice.

This is the opposite failure from a calque (see the related learning below). A calque keeps English structure under Portuguese words. Here the agent replaced the field's own word with a Portuguese word the field does not use. Both read as "translated" to a Brazilian student, and neither is caught by tests.

## Guidance

1. **Default to the word technicians actually say.** For an IT term with no well-established Portuguese equivalent in Brazilian technical use, keep the English term. Do not reach for a dictionary translation (enxame for swarm, comutador for switch, enlace ascendente for uplink) just because one exists.
2. **Record the decision in the glossary, not in text.** Add the term to `src/data/termos.ts` with `mantido: true` and its grammatical gender. Kept terms feed the allowed-word list the English scan uses (`src/data/termos.ts:90`, `...TERMOS.filter((t) => t.mantido)`), so text that uses them passes the scan. The swarm entry is the model: `termo: 'swarm', genero: 'm', mantido: true`, with a `nota` saying why it stays in English (`src/data/termos.ts:65`).
3. **Give the kept term a gender and use it consistently.** "Swarm" is masculine ("o swarm", "do swarm", "no swarm"), like "switch" and "uplink", so agreement needs no special handling.
4. **When unsure, ask the native-speaker owner before inventing a translation.** A Portuguese coinage costs a rename across every string, the glossary and the plan docs once a native reader sees it. Asking costs one question.
5. **Translate when Brazilian technicians do.** The rule is "use the field's word", not "keep everything in English". Established Portuguese terms win: "roteador", "placa de rede", "provedor", "registro DNS".

## Why This Matters

The game teaches the vocabulary students will meet in their technical course and at work. A coined term teaches a word they will never hear, and it hides the one they will. It is invisible to automated checks, because the coined word is valid Portuguese, so only a native reader catches it, usually after the term has spread through many strings.

## When to Apply

Whenever a feature introduces an IT concept that has an English name: new systems (swarm, mining, lectures), new hardware (switches, uplinks), new screens or tabs, and glossary additions. Apply it before writing the text, so the glossary decision comes first and the strings follow it.

## Examples

| Coined (rejected) | Field term (current text) |
|---|---|
| NOC e enxame (Workbench tab) | NOC e swarm (`src/scenes/WorkbenchScene.ts`) |
| Enxame: 3 nós, +X de processamento… (Hub) | Swarm: 3 nós, +X de processamento… (`src/scenes/HubScene.ts`) |
| O nó X entrou no enxame | O nó X entrou no swarm (`src/core/swarm.ts`) |
| Glossary: `termo: 'enxame', mantido: false` | Glossary: `termo: 'swarm', mantido: true` (`src/data/termos.ts:65`) |

## Related

- `docs/solutions/conventions/ptbr-text-native-not-calque.md`: the opposite failure, Portuguese words arranged in English structure. Read both before writing player text.
- Glossary and kept-term list: `src/data/termos.ts`. The concepts Kept term and Calque are defined in `CONCEPTS.md`.
