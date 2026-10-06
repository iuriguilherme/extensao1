---
title: Write PT-BR game text natively from meaning, not by translating English structure
module: game text (PT-BR)
date: 2026-10-05
last_updated: 2026-10-06
problem_type: convention
component: frontend
severity: medium
applies_when:
  - Writing or editing any player-facing text (lessons, quizzes, toasts, errors, buttons, part and node descriptions)
  - Converting English source text or an English draft into Portuguese
  - Delegating Portuguese text to an agent or subagent
  - Adding text for new systems (swarm, mining, lectures, cities)
tags:
  - pt-br
  - localization
  - calque
  - translation
  - game-text
  - glossary
related_components:
  - documentation
---

# Write PT-BR game text natively from meaning, not by translating English structure

## Context

Rootkit Academy is Portuguese-only (no i18n layer) and is played by Brazilian students aged 14-15. The first conversion pass translated every English string sentence by sentence. Grammar, plurals, gender agreement, number formatting and the English-word scan all passed, and the native-speaker owner still rejected the text: it read like English written with Portuguese words (calque). Examples the owner flagged:

- "ROOTKIT ACADEMY — sua mesa" for "your desk": "mesa" does not evoke the player's computer corner.
- "Um link só é tão rápido quanto sua ponta mais lenta" for "a link is only as fast as its slowest end": grammatical, but meaningless to a Brazilian reader.
- "Sem processador: nada consegue executar instruções" and "o processador não tem espaço de trabalho": structure and nouns copied from English.
- "A placa-mãe é a placa de circuito principal": "main circuit board" mapped word-for-word, saying nothing.
- "as trilhas dela levam dados e energia": the natural verb is "carregam".
- "corrente alternada (CA)" / "CC": Brazilian technicians say AC and DC.
- "antes de a invasão cair": not how a native speaker describes losing access.

None of these were caught by tests, because every word is Portuguese. Only a native reader catches calques.

## Guidance

1. **Start from intent, not from the English sentence.** For each string, first decide what it must teach or tell the player. Use the English (or an earlier draft) only as a source of meaning, then write the Portuguese from scratch.
2. **Use the collocations Brazilians use:** rodar um programa, encaixar peças, carregar dados, dar boot, conectar à internet, perder o acesso. Restructure sentences freely; do not keep English word order, idioms or sentence boundaries.
3. **Follow the glossary in `src/data/termos.ts`.** It records which IT terms stay in English the way Brazilian technicians use them (switch, firewall, boot, uplink, NOC, swarm, and AC/DC, written "corrente alternada (AC)" on first mention, then "corrente AC"). Add new kept terms there, not ad hoc in text. The opposite mistake, coining a Portuguese word for jargon the field says in English, has its own learning (see Related).
4. **Read every sentence aloud as a check:** would a Brazilian IT teacher say exactly this to a 15-year-old? If it only makes sense after mentally translating it back to English, rewrite it.
5. **When delegating text to an agent,** give it the English as *intent*, the glossary, these rules and a table of bad→native examples like the one below, and tell it explicitly to restructure. A prompt that frames the English as "the text to translate" produces calques even with strong grammar rules.
6. **Gate on a native reader.** Automated checks (the English scan in `tests/content.test.ts`, plural and gender helpers in `src/core/fmt.ts`) prevent English leftovers and agreement errors, but they cannot detect a calque. Plan a native-speaker playthrough for every batch of new text.

## Why This Matters

The game teaches IT concepts. Text that is grammatical but unnatural fails twice: students read it as "translated", which undermines trust in an extension-project game, and sentences like the "slowest end" one stop teaching the concept at all. The failure is invisible to code review and tests, so without this rule every new feature's text (swarm, mining, lectures) would repeat it.

## When to Apply

Any time Portuguese player-facing text is written or changed: new content, rewording, error messages built from templates, and text produced by agents. It also applies to templated sentences: write templates that read naturally for every value they receive (for example, the part-swap message uses `agree()` for both articles, "Você trocou o X pelo Y").

## Examples

| Calque (rejected) | Native (current text) |
|---|---|
| ROOTKIT ACADEMY — sua mesa | ROOTKIT ACADEMY — sua estação (`src/scenes/HubScene.ts:19`) |
| Um link só é tão rápido quanto sua ponta mais lenta. | Portas Gigabit. Mas a conexão nunca passa da velocidade do equipamento mais lento do caminho. (`src/data/parts.ts:219`) |
| Sem processador: nada consegue executar instruções. | Sem processador: não há quem execute os programas. (`src/core/hardware.ts:32`) |
| …o processador não tem espaço de trabalho para carregar o sistema. | Sem memória RAM: o processador não tem onde carregar o sistema operacional. (`src/core/hardware.ts:33`) |
| A PLACA-MÃE é a placa de circuito principal… as trilhas dela levam dados… | A PLACA-MÃE é a placa principal do computador: todas as outras peças são encaixadas nela, e as trilhas dela carregam dados e energia… (`src/data/lessons.ts:48`) |
| …converte a CA da tomada em CC… | …transforma a corrente AC da tomada na corrente DC… (`src/data/parts.ts:173`) |
| …antes de a invasão cair. / A invasão caiu | …antes de perder o acesso. / Acesso perdido (`src/data/lessons.ts:148`, `src/scenes/MinigameScene.ts:158`) |
| X trocado por Y. | Você trocou o X pelo Y. (`src/core/state.ts:214`) |

## Related

- Plan: `docs/plans/2026-10-03-0358-feat-ptbr-style-system-plan.md` (PT-BR style system: glossary, formatters, problem codes, English scan).
- Glossary: `src/data/termos.ts`.
- `docs/solutions/conventions/ptbr-keep-field-jargon-in-english.md`: the inverse failure, translating jargon that Brazilian technicians keep in English ("enxame" for swarm).
