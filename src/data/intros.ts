/**
 * Player text for introducing the interface one piece at a time: the log line
 * an element gets when it appears, the goal line shown while it is being
 * introduced, and the card each screen shows the first time it opens. Keyed by
 * the stable ids in src/core/disclosure.ts.
 */

/** The single line a new game's log starts with, given the formatted starting money. */
export function openingLine(cash: string): string {
  return `Você herdou um gabinete vazio e ${cash}. Antes de comprar qualquer coisa, descubra o que vai dentro dele.`;
}

export interface ElementText {
  /** Log line written when the element appears: what it is for. */
  log: string;
  /** Goal line while the element is being introduced. */
  goal: string;
}

export const ELEMENT_TEXT = {
  study: {
    log: 'Estudar: cada aula ensina uma parte do computador ou da rede e libera peças e alvos novos.',
    goal: 'Abra Estudar e faça a primeira aula.',
  },
  money: {
    log: 'A aula pagou! O seu dinheiro agora aparece no alto da tela, à direita.',
    goal: 'O seu dinheiro fica no alto da tela. Aulas e invasões pagam; peças custam.',
  },
  shop: {
    log: 'Loja: aqui você compra as peças que as aulas já liberaram.',
    goal: 'Abra a Loja e veja as peças que você já pode comprar.',
  },
  reset: {
    log: 'Apagar progresso: se um dia quiser recomeçar do zero, é por aqui.',
    goal: 'Se um dia quiser recomeçar do zero, use Apagar progresso.',
  },
  workbench: {
    log: 'Bancada: aqui você monta o PC, encaixando as peças no gabinete.',
    goal: 'Abra a Bancada e instale a peça que você comprou.',
  },
  jobs: {
    log: 'Trabalhos extras: treine os assuntos que você já estudou e ganhe um dinheiro a mais.',
    goal: 'Abra Trabalhos extras e veja o que dá para treinar.',
  },
  'net-setup': {
    log: 'Configuração de Rede: aqui você escolhe o IP, a máscara, o gateway e o DNS do seu PC.',
    goal: 'Abra a Configuração de Rede e defina o seu endereço IP.',
  },
  'net-map': {
    log: 'Mapa da Rede: o laboratório de segurança aparece a partir do seu PC, máquina por máquina.',
    goal: 'Abra o Mapa da Rede e veja as máquinas que o seu PC alcança.',
  },
  'noc-tab': {
    log: 'NOC e swarm: na Bancada, ligue as máquinas invadidas ao seu PC para somar processamento e RAM.',
    goal: 'Abra a Bancada e veja a aba NOC e swarm.',
  },
  cities: {
    log: 'Cidades: redes novas, cada uma com o próprio plano de endereços, para você treinar.',
    goal: 'Abra Cidades e crie a sua primeira cidade.',
  },
  certificates: {
    log: 'Certificados: aqui ficam os certificados que você já recebeu.',
    goal: 'Abra Certificados para rever o seu certificado.',
  },
  'pos-tab': {
    log: 'Pós-graduação: Estudar ganhou uma aba nova, com as aulas da próxima etapa.',
    goal: 'Abra Estudar e veja a aba Pós-graduação.',
  },
} as const satisfies Record<string, ElementText>;
