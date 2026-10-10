/**
 * Certificates and the pós-graduação ladder. A certificate is issued inside
 * the mutation that records its qualifying core breach, with a snapshot of the
 * numbers at that moment, and presented later by its ceremony. Tier state is
 * derived from certificates, so nothing about tiers is stored apart.
 */

import { MINIGAME_AREAS, type MinigameId } from '../data/nodes';
import { getTier, tierOfCityType, TIERS, type Tier, type TierCityType, type TierId } from '../data/tiers';
import { CONCEPTS, type ConceptId } from './minigames';
import type { GameState } from './state';
import { appendLog } from './log';
import { areaStats } from './stats';

export type CertificateId = 'conclusao' | TierId;

/** One area's line on a certificate. */
export interface AreaRecord {
  answered: number;
  correct: number;
  /** Concepts answered right at least once and not weak now. */
  learned: number;
  /** Concepts the reteach history marks as weak. */
  weak: number;
  /** The area's side-job level. */
  level: number;
}

export interface CertificateSnapshot {
  lessons: string[];
  /** Only areas with at least one answered round. */
  areas: Partial<Record<MinigameId, AreaRecord>>;
}

export interface Certificate {
  id: CertificateId;
  /** False until its ceremony runs; a reload resumes the ceremony. */
  presented: boolean;
  /** The student's name, copied when the certificate is presented. */
  name: string | null;
  snapshot: CertificateSnapshot;
}

export function certificateTitle(id: CertificateId): string {
  return id === 'conclusao' ? 'Certificado de conclusão' : getTier(id).title;
}

/** What the certificate covers: the lab for the conclusão one, the topic for a tier. */
export function certificateTopic(id: CertificateId): string {
  return id === 'conclusao' ? 'Laboratório de segurança' : getTier(id).topic;
}

const AREAS = Object.keys(MINIGAME_AREAS) as MinigameId[];

/** The certificate numbers as they are now, for every area played so far. */
export function areaRecords(state: GameState): Partial<Record<MinigameId, AreaRecord>> {
  const records: Partial<Record<MinigameId, AreaRecord>> = {};
  for (const area of AREAS) {
    const stats = areaStats(state, area);
    if (!stats) continue;
    const inArea = (concept: ConceptId) => CONCEPTS[concept].area === area;
    const weak = (Object.keys(state.concepts) as ConceptId[]).filter((c) => inArea(c) && state.concepts[c]!.weak);
    const learned = state.correctConcepts.filter((c) => inArea(c) && !weak.includes(c));
    records[area] = { answered: stats.answered, correct: stats.correct, learned: learned.length, weak: weak.length, level: state.areaLevels[area] };
  }
  return records;
}

export function getCertificate(state: GameState, id: CertificateId): Certificate | undefined {
  return state.certificates.find((c) => c.id === id);
}

function isPresented(state: GameState, id: CertificateId): boolean {
  return getCertificate(state, id)?.presented === true;
}

/** Issues a certificate with today's numbers. Returns false when it already exists. */
export function issueCertificate(state: GameState, id: CertificateId): boolean {
  if (getCertificate(state, id)) return false;
  state.certificates.push({
    id, presented: false, name: null,
    snapshot: { lessons: [...state.lessonsCompleted], areas: areaRecords(state) },
  });
  appendLog(state, { kind: 'certificate', id });
  return true;
}

/** Ends a certificate's ceremony. The formatura passes the name; later certificates reuse it. */
export function presentCertificate(state: GameState, id: CertificateId, name?: string): void {
  const certificate = getCertificate(state, id);
  if (!certificate) throw new Error(`Certificate not issued: ${id}`);
  if (name !== undefined) state.studentName = name;
  certificate.name = state.studentName;
  certificate.presented = true;
}

/** The certificate whose ceremony still has to run, if any. */
export function pendingCertificate(state: GameState): Certificate | null {
  return state.certificates.find((c) => !c.presented) ?? null;
}

/** A tier opens once the certificate before it has been presented. */
export function isTierOpen(state: GameState, id: TierId): boolean {
  const index = TIERS.findIndex((t) => t.id === id);
  return isPresented(state, index === 0 ? 'conclusao' : TIERS[index - 1].id);
}

/** A tier's city type opens with its tier and its whole lecture pack. */
export function isCityTypeUnlocked(state: GameState, type: TierCityType): boolean {
  const tier = tierOfCityType(type);
  return isTierOpen(state, tier.id) && tier.lessons.every((id) => state.lessonsCompleted.includes(id));
}

/** The one pós-graduação step to show: the open tier's lectures, then its city. */
export type NextGoal = { kind: 'lectures' | 'city'; tier: Tier };

/**
 * The student's next pós-graduação goal, or null when there is none to show:
 * before the formatura, while a ceremony is pending, and after Doutorado.
 * Scenes draw what this plan adds only when it is available or is this goal.
 */
export function nextGoal(state: GameState): NextGoal | null {
  const tier = TIERS.find((t) => !getCertificate(state, t.id));
  if (!tier || !isTierOpen(state, tier.id)) return null;
  return { kind: isCityTypeUnlocked(state, tier.cityType) ? 'city' : 'lectures', tier };
}

export type NameIssueCode = 'name-short' | 'name-long' | 'name-chars';

export type NameCheck = { ok: true; name: string } | { ok: false; code: NameIssueCode; message: string };

const NAME_MIN = 2;
const NAME_MAX = 30;

/**
 * The name printed on certificates: trimmed, single-spaced, 2-30 characters,
 * letters (accents included), spaces, hyphens and apostrophes.
 */
export function validateStudentName(text: string): NameCheck {
  const name = text.trim().replace(/\s+/g, ' ');
  if (name.length < NAME_MIN) return { ok: false, code: 'name-short', message: `O nome precisa ter pelo menos ${NAME_MIN} letras.` };
  if (name.length > NAME_MAX) return { ok: false, code: 'name-long', message: `O nome pode ter no máximo ${NAME_MAX} caracteres.` };
  if (!/^\p{L}[\p{L} '’-]*$/u.test(name)) return { ok: false, code: 'name-chars', message: 'Use só letras, espaços, hífen e apóstrofo.' };
  return { ok: true, name };
}

export interface CertificateRow {
  area: MinigameId;
  /** Null when the area was first played after the certificate was issued. */
  earned: AreaRecord | null;
  current: AreaRecord | null;
}

/** The areas on either side of a certificate, in area order. */
export function certificateRows(state: GameState, certificate: Certificate): CertificateRow[] {
  const current = areaRecords(state);
  return AREAS
    .filter((area) => certificate.snapshot.areas[area] || current[area])
    .map((area) => ({ area, earned: certificate.snapshot.areas[area] ?? null, current: current[area] ?? null }));
}
