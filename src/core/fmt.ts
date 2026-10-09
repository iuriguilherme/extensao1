/**
 * Brazilian Portuguese formatting and grammar helpers.
 *
 * Every number, amount of money, count and gendered word the player reads goes
 * through here, so text stays consistent: "R$ 1.200", "4,8 GHz", "1 erro" /
 * "2 erros", "Placa-mãe instalada". Technical notation (IPs, masks, CIDR,
 * binary) never passes through these helpers and keeps its standard form.
 */

export type Gender = 'm' | 'f';

const MONEY_WHOLE = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0,
});
const MONEY_CENTS = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const DECIMAL = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2, useGrouping: false });

/** Intl separates "R$" from the amount with a non-breaking space; use a plain one. */
const plainSpaces = (text: string) => text.replace(/ /g, ' ');

/** "R$ 1.200" for whole amounts, "R$ 4,50" otherwise. */
export function money(amount: number): string {
  return plainSpaces((Number.isInteger(amount) ? MONEY_WHOLE : MONEY_CENTS).format(amount));
}

/** "4,8" — a decimal comma and no thousands grouping, for stats in readable text. */
export function decimal(value: number): string {
  return DECIMAL.format(value);
}

/** "80%", "83,3%": a share of a total, to one decimal place. */
export function percent(part: number, total: number): string {
  return `${decimal(Math.round((part / total) * 1000) / 10)}%`;
}

/** "100 Mbps", "2,5 Gbps". */
export function linkSpeed(mbps: number): string {
  return mbps >= 1000 ? `${decimal(mbps / 1000)} Gbps` : `${decimal(mbps)} Mbps`;
}

/**
 * "1 erro", "0 erros", "2 erros". Singular only for exactly 1: Intl's pt-BR
 * rule would say "0 erro", which reads wrong to Brazilian players.
 */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Lines up "label  value" rows in a monospace column, padding from the longest
 * label so the column survives PT-BR labels of any length.
 */
export function alignColumns(rows: [string, string][], gap: number): string[] {
  const width = Math.max(...rows.map(([label]) => label.length)) + gap;
  return rows.map(([label, value]) => `${label.padEnd(width)}${value}`);
}

/** "A, B e C": commas between items and "e" before the last one. */
export function listJoin(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

/** Picks the word form that agrees with a noun's gender ("instalado"/"instalada"). */
export function agree(gender: Gender, masculine: string, feminine: string): string {
  return gender === 'f' ? feminine : masculine;
}
