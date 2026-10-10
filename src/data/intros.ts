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
  /** Goal line while a control is being introduced; passive elements have none. */
  goal?: string;
}

export const ELEMENT_TEXT = {
  study: {
    log: 'Estudar: cada aula ensina uma parte do computador ou da rede e libera peças e alvos novos.',
    goal: 'Abra Estudar e faça a primeira aula.',
  },
  money: {
    log: 'O seu dinheiro agora aparece no alto da tela, à direita. Aulas e invasões pagam; peças custam.',
  },
  shop: {
    log: 'Loja: aqui você compra as peças que as aulas já liberaram.',
    goal: 'Abra a Loja e veja as peças que você já pode comprar.',
  },
  reset: {
    log: 'Apagar progresso: se um dia quiser recomeçar do zero, é por aqui.',
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

export interface CardText {
  title: string;
  /** One line per control, in the order the player meets them. */
  lines: string[];
}

/** The card each screen shows the first time it opens; "?" shows it again. */
export const CARD_TEXT = {
  study: {
    title: 'Estudar',
    lines: [
      'Cada cartão é uma aula. Clique em uma aula aberta (●) para começar; o cartão mostra quanto ela paga.',
      'Uma aula concluída (✓) pode ser revista quando você quiser, mas só paga uma vez.',
      'Aulas novas aparecem aqui assim que você conclui as que vêm antes delas.',
    ],
  },
  lesson: {
    title: 'Aula',
    lines: [
      'Leia cada página com calma. Próxima avança e Anterior volta.',
      'Na última página vem o quiz. Acertando o bastante, a aula fica concluída e paga a recompensa.',
      'Se não passar, releia a aula e tente de novo: errar não custa nada.',
    ],
  },
  shop: {
    title: 'Loja',
    lines: [
      'As abas do alto separam as peças por tipo.',
      'Cada peça mostra o que faz, quanto custa e quantas você já tem.',
      'Comprar guarda a peça no seu estoque. Para usá-la, instale na Bancada.',
      'Quando o dinheiro não dá, o botão avisa no lugar de Comprar.',
    ],
  },
  workbench: {
    title: 'Bancada',
    lines: [
      'À esquerda fica o gabinete: cada encaixe mostra a peça instalada, e Remover devolve a peça ao estoque.',
      'À direita fica o estoque: Instalar encaixa a peça no PC, e Vender devolve metade do preço.',
      'O monitor da estação mostra se o PC dá boot e o que ainda falta.',
    ],
  },
  noc: {
    title: 'NOC e swarm',
    lines: [
      'Cada switch instalado aqui soma portas para ligar máquinas invadidas.',
      'Conectar liga uma máquina invadida ao seu PC; Desconectar libera a porta.',
      'O processamento e a RAM das máquinas ligadas se somam aos do seu PC, até onde a largura de banda deixar.',
    ],
  },
  'net-setup': {
    title: 'Configuração de Rede',
    lines: [
      'O bilhete colado no roteador traz os dados da rede da sua casa.',
      'Preencha o IP, a máscara, o gateway e o DNS. Cada campo explica o que pede.',
      'Aplicar confere tudo. Se algo estiver errado, a tela diz qual campo e por quê.',
    ],
  },
  'net-map': {
    title: 'Mapa da Rede',
    lines: [
      'O mapa começa no seu PC e cresce a cada máquina invadida.',
      'Clique em uma máquina para ver o que ela exige: ✓ já cumprido, ✗ ainda falta.',
      'Invadir começa a invasão. Uma máquina já invadida pode ser invadida de novo, mas paga menos.',
      'Pulsando: dá para alcançar. Com ✓: invadida. Ponto azul: ligada ao swarm.',
    ],
  },
  minigame: {
    title: 'Invasão',
    lines: [
      'Cada etapa é uma pergunta: responda antes que o tempo acabe.',
      'O processador define o tempo de cada etapa, e a RAM, quantos erros a invasão aguenta.',
      'Nas perguntas de bits, clique em cada bit para trocar entre 0 e 1.',
      'Depois de cada etapa, leia a explicação e siga com Próxima etapa. Se o acesso cair, tente de novo.',
    ],
  },
  jobs: {
    title: 'Trabalhos extras',
    lines: [
      'Os trabalhos de revisão treinam o que você mais errou.',
      'Os trabalhos novos sobem o nível de um assunto quando você termina com no máximo um erro.',
      'Cada trabalho paga quando você termina.',
    ],
  },
  cities: {
    title: 'Cidades',
    lines: [
      'Nova cidade cria uma rede inédita no seu nível atual.',
      'Entrar código abre a cidade que outra pessoa compartilhou com você.',
      'As cidades que você já começou ficam na lista: clique em uma para continuar.',
    ],
  },
  'city-map': {
    title: 'Mapa da cidade',
    lines: [
      'No começo só aparece a sub-rede do seu PC.',
      'Clique em uma máquina para invadi-la. Invadido um roteador, escreva a entrada dele para abrir a sub-rede que fica atrás.',
      'Use < e > para andar pelo mapa. Invadir o núcleo, na sub-rede mais funda, conclui a cidade.',
    ],
  },
  route: {
    title: 'Entrada do roteador',
    lines: [
      'O quadro mostra o que a invasão revelou sobre o roteador e as redes dos dois lados.',
      'Escolha o valor de cada campo. Cada um explica o que pede.',
      'Aplicar confere a entrada: um campo errado aponta o erro sem dar a resposta, e dá para tentar de novo à vontade.',
    ],
  },
  formatura: {
    title: 'Formatura',
    lines: [
      'Você concluiu o laboratório de segurança: chegou a hora de receber o certificado.',
      'Digite o seu nome do jeito que ele deve sair em todos os certificados e confirme.',
    ],
  },
  certificate: {
    title: 'Certificado',
    lines: [
      'O certificado guarda os números do dia em que você o recebeu; ao lado aparecem os de hoje.',
      'Use ▲ e ▼ para rolar a lista de aulas.',
    ],
  },
  pos: {
    title: 'Pós-graduação',
    lines: [
      'Esta aba reúne as aulas da pós-graduação, uma coluna para cada etapa aberta.',
      'Concluídas as aulas de uma etapa, um tipo novo de cidade abre em Cidades. O núcleo da primeira cidade desse tipo dá o certificado da etapa.',
    ],
  },
} as const satisfies Record<string, CardText>;
