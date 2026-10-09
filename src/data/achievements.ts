/**
 * Conquistas: optional Steam-style achievements. They give no reward and never
 * steer the campaign; certificates are the game's goal. Ids are stored in the
 * achievement save, so renaming one loses existing unlocks. Each id has its
 * unlock rule in src/core/achievements.ts.
 */

export type AchievementKind = 'story' | 'skill' | 'counter' | 'secret';

export interface Achievement {
  id: string;
  kind: AchievementKind;
  /** One glyph drawn inside the achievement's colored square. */
  symbol: string;
  name: string;
  description: string;
  /** Counter achievements: the total that unlocks it. */
  target?: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  // ─── Campanha ───────────────────────────────────────────────────────────
  { id: 'first-boot', kind: 'story', symbol: '⏻', name: 'Primeiro boot', description: 'Monte um PC que dê boot.' },
  { id: 'first-lesson', kind: 'story', symbol: '✎', name: 'Primeira aula', description: 'Conclua sua primeira aula.' },
  { id: 'online', kind: 'story', symbol: '⇄', name: 'Conectado', description: 'Configure a rede e coloque seu PC online.' },
  { id: 'first-breach', kind: 'story', symbol: '⚑', name: 'Primeira invasão', description: 'Invada uma máquina do laboratório.' },
  { id: 'swarm', kind: 'story', symbol: '⁂', name: 'Swarm formado', description: 'Ligue uma máquina invadida ao seu swarm.' },
  { id: 'noc', kind: 'story', symbol: '▦', name: 'NOC no ar', description: 'Instale um switch no NOC.' },
  { id: 'formatura', kind: 'story', symbol: '★', name: 'Diploma na mão', description: 'Conclua a formatura.' },
  { id: 'especializacao', kind: 'story', symbol: '★', name: 'Especialização concluída', description: 'Receba o certificado da Especialização.' },
  { id: 'mestrado', kind: 'story', symbol: '★', name: 'Mestrado concluído', description: 'Receba o certificado do Mestrado.' },
  { id: 'doutorado', kind: 'story', symbol: '★', name: 'Doutorado concluído', description: 'Receba o certificado do Doutorado.' },
  { id: 'first-city', kind: 'story', symbol: '⌂', name: 'Primeira cidade', description: 'Invada o núcleo de uma cidade.' },

  // ─── Desafios ───────────────────────────────────────────────────────────
  { id: 'all-lessons', kind: 'skill', symbol: '✎', name: 'Caderno completo', description: 'Conclua todas as aulas.' },
  { id: 'area-max', kind: 'skill', symbol: '▲', name: 'Especialista', description: 'Leve uma área ao nível máximo nos trabalhos extras.' },
  { id: 'all-areas-max', kind: 'skill', symbol: '▲', name: 'Domínio total', description: 'Leve todas as áreas ao nível máximo nos trabalhos extras.' },
  { id: 'top-rig', kind: 'skill', symbol: '⚙', name: 'Máquina dos sonhos', description: 'Instale a peça mais cara em cada slot da bancada.' },
  { id: 'flawless', kind: 'skill', symbol: '✓', name: 'Sem nenhum erro', description: 'Termine uma invasão ou um trabalho extra sem errar nenhuma vez.' },
  { id: 'on-the-edge', kind: 'skill', symbol: '!', name: 'Por um fio', description: 'Vença usando todos os erros que sua memória RAM permite.' },
  { id: 'core-flawless', kind: 'skill', symbol: '◆', name: 'Invasão perfeita', description: 'Invada o Núcleo do Data Center pela primeira vez sem errar.' },

  // ─── Contadores ─────────────────────────────────────────────────────────
  { id: 'rounds-100', kind: 'counter', symbol: '#', name: 'Cem respostas', description: 'Responda 100 etapas de invasão.', target: 100 },
  { id: 'rounds-500', kind: 'counter', symbol: '#', name: 'Quinhentas respostas', description: 'Responda 500 etapas de invasão.', target: 500 },
  { id: 'rounds-1000', kind: 'counter', symbol: '#', name: 'Mil respostas', description: 'Responda 1000 etapas de invasão.', target: 1000 },
  { id: 'correct-250', kind: 'counter', symbol: '✓', name: 'Na mosca', description: 'Acerte 250 etapas de invasão.', target: 250 },
  { id: 'runs-50', kind: 'counter', symbol: '↻', name: 'Rotina de pentester', description: 'Termine 50 invasões ou trabalhos extras.', target: 50 },
  { id: 'cities-10', kind: 'counter', symbol: '⌂', name: 'Dez cidades', description: 'Conclua 10 cidades.', target: 10 },

  // ─── Secretas ───────────────────────────────────────────────────────────
  { id: 'last-gasp', kind: 'secret', symbol: '✗', name: 'Na trave', description: 'Perca a conexão bem na última etapa.' },
  { id: 'timeout-crash', kind: 'secret', symbol: '⌛', name: 'Cadê você?', description: 'Perca uma invasão só por deixar o tempo acabar.' },
  { id: 'broke', kind: 'secret', symbol: '¢', name: 'Liso', description: 'Fique sem nenhum centavo.' },
  { id: 'unplugged', kind: 'secret', symbol: '⏻', name: 'Quem desligou?', description: 'Deixe seu PC sem dar boot depois de configurar a rede.' },
  { id: 'core-again', kind: 'secret', symbol: '◆', name: 'De novo?!', description: 'Invada o Núcleo do Data Center mais uma vez.' },
  { id: 'fresh-start', kind: 'secret', symbol: '↺', name: 'Do zero', description: 'Recomece o jogo mantendo suas conquistas.' },
];

const ACHIEVEMENT_INDEX = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export function getAchievement(id: string): Achievement {
  const achievement = ACHIEVEMENT_INDEX.get(id);
  if (!achievement) throw new Error(`Unknown achievement: ${id}`);
  return achievement;
}
