/**
 * Lessons are the knowledge gates of the game. Finishing a lesson's quiz
 * unlocks parts in the shop, network setup, and nodes on the network map.
 *
 * To add content: append a lesson here and reference its id from a part
 * (`requiresLesson`), a node (`requiresLesson`) or another lesson (`requires`).
 */

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: number;
  explain: string;
}

export type LessonTrack = 'hardware' | 'networking' | 'field';

export const TRACKS: LessonTrack[] = ['hardware', 'networking', 'field'];

export const TRACK_LABELS: Record<LessonTrack, string> = {
  hardware: 'Hardware',
  networking: 'Redes',
  field: 'Na prática',
};

export interface Lesson {
  id: string;
  title: string;
  track: LessonTrack;
  /** Lessons that must be completed before this one opens. */
  requires: string[];
  /** Cash for passing the quiz the first time. */
  reward: number;
  pages: string[];
  quiz: QuizQuestion[];
}

export const LESSONS: Lesson[] = [
  // ─── Hardware ───────────────────────────────────────────────────────────
  {
    id: 'computer-basics',
    title: 'O que é um computador?',
    track: 'hardware',
    requires: [],
    reward: 40,
    pages: [
      'Todo computador faz quatro coisas: recebe dados pela ENTRADA (teclado, rede), faz o PROCESSAMENTO (processador), guarda no ARMAZENAMENTO (RAM, discos) e mostra o resultado na SAÍDA (tela, rede).',
      'A PLACA-MÃE é a placa principal do computador: todas as outras peças são encaixadas nela, e as trilhas dela carregam dados e energia de uma peça para outra.',
      'É a placa-mãe que decide o que dá para instalar: o SOCKET tem que ser compatível com o processador, e os SLOTS de memória, com a geração da RAM.',
      'Seu gabinete está vazio. Sua missão: aprender para que serve cada peça, comprar, montar e fazer essa máquina dar boot.',
    ],
    quiz: [
      {
        question: 'Qual peça liga todos os outros componentes entre si?',
        options: ['Processador', 'Placa-mãe', 'Fonte de alimentação', 'HD'],
        answer: 1,
        explain: 'A placa-mãe é a base do computador: todas as peças se encaixam nela.',
      },
      {
        question: 'Quando a placa de rede recebe uma página da web, isso é um exemplo de...',
        options: ['Entrada', 'Processamento', 'Saída', 'Armazenamento'],
        answer: 0,
        explain: 'Tudo o que chega ao computador é entrada.',
      },
      {
        question: 'O que precisa ser compatível entre o processador e a placa-mãe?',
        options: ['A cor', 'O socket', 'O tamanho do armazenamento', 'A marca do gabinete'],
        answer: 1,
        explain: 'O processador só encaixa num socket compatível com ele.',
      },
    ],
  },
  {
    id: 'power',
    title: 'Fonte de alimentação',
    track: 'hardware',
    requires: ['computer-basics'],
    reward: 40,
    pages: [
      'A tomada fornece corrente alternada (AC), mas as peças do computador funcionam com corrente contínua (DC) de baixa tensão. A FONTE DE ALIMENTAÇÃO faz essa conversão.',
      'Toda peça consome energia, e esse consumo é medido em WATTS (W). Normalmente, o processador é a peça que mais gasta.',
      'Toda fonte tem uma potência máxima. Se as peças juntas passam disso, o PC fica instável ou nem liga. Sempre some o consumo de tudo e deixe uma folga.',
    ],
    quiz: [
      {
        question: 'Para que serve a fonte?',
        options: ['Guardar arquivos', 'Converter a corrente AC da tomada em DC para as peças', 'Resfriar o processador', 'Conectar à internet'],
        answer: 1,
        explain: 'A fonte transforma a corrente AC da tomada na corrente DC que os componentes usam.',
      },
      {
        question: 'Suas peças consomem 320 W. Qual fonte dá conta?',
        options: ['250 W', '300 W', '450 W', 'Qualquer uma, a potência não faz diferença'],
        answer: 2,
        explain: 'A fonte precisa aguentar mais do que o consumo total: 450 W > 320 W.',
      },
      {
        question: 'Potência é medida em...',
        options: ['Hertz', 'Bytes', 'Watts', 'Bits por segundo'],
        answer: 2,
        explain: 'Watt é a unidade de potência. Hertz mede frequência; bytes medem dados.',
      },
    ],
  },
  {
    id: 'cpu',
    title: 'O processador',
    track: 'hardware',
    requires: ['computer-basics'],
    reward: 50,
    pages: [
      'O processador (a CPU) é quem roda os programas, executando instrução por instrução: faz contas, compara valores e move dados de um lugar para outro.',
      'A FREQUÊNCIA, em gigahertz (GHz), diz quantos ciclos um núcleo completa por segundo. 3 GHz = 3 bilhões de ciclos por segundo.',
      'Um processador tem um ou mais NÚCLEOS. Cada núcleo cuida da sua própria fila de instruções, então, quanto mais núcleos, mais tarefas o computador faz ao mesmo tempo.',
      'Neste jogo, seu poder de processamento é núcleos × GHz. Quanto mais poder, mais tempo você tem para pensar durante as invasões.',
    ],
    quiz: [
      {
        question: 'Para que serve o processador?',
        options: ['Guardar dados com o computador desligado', 'Executar as instruções dos programas', 'Fornecer energia', 'Mostrar imagens'],
        answer: 1,
        explain: 'O processador executa as instruções. Quem guarda os dados é o armazenamento; quem fornece energia é a fonte.',
      },
      {
        question: 'O que quer dizer "4 núcleos"?',
        options: ['Que ele funciona a 4 GHz', 'Que ele roda 4 filas de instruções ao mesmo tempo', 'Que ele tem 4 GB de memória', 'Que ele precisa de 4 cabos de energia'],
        answer: 1,
        explain: 'Cada núcleo trabalha sozinho, sem depender dos outros.',
      },
      {
        question: 'Uma frequência de 3,2 GHz quer dizer...',
        options: ['3,2 bilhões de ciclos por segundo', '3,2 milhões de arquivos', '3,2 gigabytes', '3,2 watts'],
        answer: 0,
        explain: 'Giga = bilhão; hertz = ciclos por segundo.',
      },
    ],
  },
  {
    id: 'memory',
    title: 'Memória RAM',
    track: 'hardware',
    requires: ['computer-basics'],
    reward: 50,
    pages: [
      'A memória RAM (memória de acesso aleatório) guarda o que o processador está usando no momento: os programas abertos e os dados deles ficam nela, porque ela é muito mais rápida que os discos.',
      'A RAM é VOLÁTIL: se a energia cai, tudo o que estava nela se perde. É por isso que você salva os arquivos no armazenamento.',
      'A RAM tem gerações, como DDR4 e DDR5, e uma não substitui a outra: um pente DDR5 não encaixa num slot DDR4.',
      'Com mais RAM, dá para deixar mais coisas abertas ao mesmo tempo. Neste jogo, mais RAM quer dizer que você pode errar mais vezes antes de perder o acesso.',
    ],
    quiz: [
      {
        question: 'O que acontece com o que está na RAM quando o computador desliga?',
        options: ['Fica guardado para sempre', 'Tudo se perde', 'Vai para o processador', 'É enviado ao roteador'],
        answer: 1,
        explain: 'A RAM é volátil: acabou a energia, acabaram os dados.',
      },
      {
        question: 'Por que os programas são carregados na RAM?',
        options: ['Porque a RAM é muito mais rápida que os discos', 'Porque a RAM é mais barata que os discos', 'Porque os discos não guardam programas', 'Porque a fonte exige'],
        answer: 0,
        explain: 'Se dependesse só dos discos, o processador passaria o tempo todo esperando; a RAM é muito mais rápida.',
      },
      {
        question: 'Dá para instalar RAM DDR5 numa placa-mãe DDR4?',
        options: ['Sim', 'Não', 'Só com uma fonte mais potente', 'Só aos domingos'],
        answer: 1,
        explain: 'Cada geração de memória tem encaixe e parte elétrica diferentes.',
      },
    ],
  },
  {
    id: 'storage',
    title: 'Armazenamento',
    track: 'hardware',
    requires: ['computer-basics'],
    reward: 50,
    pages: [
      'O ARMAZENAMENTO guarda os dados mesmo com o computador desligado: é ali que ficam o sistema operacional, os programas e os seus arquivos.',
      'O HD (disco rígido) grava os dados magneticamente em pratos que giram. É barato e cabe muita coisa, mas é lento e mecânico.',
      'O SSD usa memória flash e não tem nenhuma parte móvel. Um SSD SATA é cerca de 4× mais rápido que um HD; um SSD NVMe se liga direto ao barramento PCIe e é mais rápido ainda.',
      'A capacidade é medida em gigabytes (GB) e terabytes (TB). 1 TB = 1000 GB.',
    ],
    quiz: [
      {
        question: 'Qual deles mantém os dados sem energia?',
        options: ['RAM', 'Cache do processador', 'SSD', 'Nenhum deles'],
        answer: 2,
        explain: 'SSDs e HDs são armazenamento não volátil: não perdem nada quando o PC desliga.',
      },
      {
        question: 'Qual é o mais rápido?',
        options: ['HD', 'SSD SATA', 'SSD NVMe', 'São todos iguais'],
        answer: 2,
        explain: 'O NVMe se liga direto ao barramento PCIe e é o mais rápido dos três.',
      },
      {
        question: 'Por que o HD é mais lento que o SSD?',
        options: ['Porque tem partes mecânicas que se movem', 'Porque usa mais RAM', 'Porque é sempre menor', 'Porque precisa de internet'],
        answer: 0,
        explain: 'Para achar os dados, a cabeça de leitura precisa se deslocar até o ponto certo do prato, que está girando.',
      },
    ],
  },
  {
    id: 'binary',
    title: 'Bits e bytes',
    track: 'hardware',
    requires: ['computer-basics'],
    reward: 60,
    pages: [
      'O computador guarda tudo em BITS: 0 ou 1, desligado ou ligado. Oito bits juntos formam um BYTE.',
      'O binário é a base 2. Cada posição vale o dobro da que está à direita dela: 128 64 32 16 8 4 2 1.',
      'Para ler 00001011: 8 + 2 + 1 = 11. Para escrever 6: 4 + 2 → 00000110.',
      'Com n bits dá para representar 2ⁿ valores diferentes. Em um byte: 2⁸ = 256 valores (de 0 a 255). Guarde esse número: ele vai aparecer de novo nos endereços IP!',
    ],
    quiz: [
      {
        question: 'Quantos bits tem um byte?',
        options: ['2', '4', '8', '10'],
        answer: 2,
        explain: '1 byte = 8 bits.',
      },
      {
        question: 'Quanto é o binário 101 em decimal?',
        options: ['3', '5', '6', '101'],
        answer: 1,
        explain: '4 + 0 + 1 = 5.',
      },
      {
        question: 'Qual é o maior valor que cabe em um byte?',
        options: ['128', '255', '256', '1024'],
        answer: 1,
        explain: 'Com 8 bits dá para formar 256 valores, de 0 a 255.',
      },
    ],
  },

  // ─── Networking ─────────────────────────────────────────────────────────
  {
    id: 'network-basics',
    title: 'Redes: o básico',
    track: 'networking',
    requires: ['cpu', 'memory', 'storage', 'power'],
    reward: 60,
    pages: [
      'Uma REDE é um conjunto de aparelhos que trocam dados entre si. A LAN (rede local) é a da sua casa ou da empresa; a WAN (rede de longa distância) liga cidades inteiras. A internet é a maior de todas.',
      'A PLACA DE REDE é o que liga o computador à rede. Cada placa de rede vem de fábrica com um endereço físico único: o endereço MAC.',
      'O ROTEADOR encaminha o tráfego de uma rede para outra. O roteador da sua casa liga a sua LAN ao PROVEDOR de internet, e o provedor dá acesso ao resto da internet.',
      'A largura de banda é medida em bits por segundo (Mbps, Gbps). A conexão nunca passa da velocidade do equipamento mais lento do caminho.',
      'O SWITCH serve para ligar vários aparelhos na mesma rede local: cada um ocupa uma porta. O roteador de casa já vem com algumas portas LAN, mas quando elas acabam, você coloca um switch. Tudo o que os aparelhos ligados no switch mandam para o resto da rede sai por um único link, o UPLINK. Com um uplink lento, todo mundo ligado no switch fica preso a essa velocidade.',
    ],
    quiz: [
      {
        question: 'Qual peça permite que o computador se conecte a uma rede?',
        options: ['Fonte', 'Placa de rede', 'Placa de vídeo', 'SSD'],
        answer: 1,
        explain: 'A placa de rede é a peça que liga o computador à rede.',
      },
      {
        question: 'O que o roteador faz?',
        options: ['Guarda páginas da web', 'Encaminha o tráfego entre redes', 'Fornece energia ao computador', 'Traduz binário em texto'],
        answer: 1,
        explain: 'O roteador liga uma rede à outra, como a sua LAN ao provedor.',
      },
      {
        question: 'Sua placa de rede é de 1 Gbps e o seu roteador é de 100 Mbps. Qual é a velocidade do link?',
        options: ['1 Gbps', '1,1 Gbps', '100 Mbps', '550 Mbps'],
        answer: 2,
        explain: 'A conexão nunca passa da velocidade do equipamento mais lento: aqui, o roteador.',
      },
      {
        question: 'As 8 portas do seu switch estão ocupadas. Como você liga mais um aparelho?',
        options: ['É só ligar, o switch dá um jeito', 'Colocando outro switch, ou trocando por um com mais portas', 'Desligando o roteador', 'Trocando a placa de rede do PC'],
        answer: 1,
        explain: 'Cada aparelho ocupa uma porta. Sem porta livre, só mais portas resolvem: outro switch ou um switch maior.',
      },
    ],
  },
  {
    id: 'ip-addressing',
    title: 'Endereços IP e sub-redes',
    track: 'networking',
    requires: ['network-basics', 'binary'],
    reward: 80,
    pages: [
      'Todo aparelho numa rede IP precisa de um ENDEREÇO IP. Um endereço IPv4 tem 4 bytes, escritos em decimal: 192.168.0.42. Cada parte (octeto) vai de 0 a 255.',
      'A MÁSCARA DE SUB-REDE divide o endereço em duas partes: a da REDE e a do HOST. Com 255.255.255.0 (/24), os 3 primeiros octetos são a rede.',
      'Dois aparelhos só se comunicam direto se estiverem na mesma rede: com /24, 192.168.0.42 e 192.168.0.7 são vizinhos, mas 192.168.1.7 já está em outra rede.',
      'Em toda sub-rede, o primeiro endereço é o ENDEREÇO DE REDE (192.168.0.0) e o último é o de BROADCAST (192.168.0.255). Nenhum dos dois pode ser dado a um host, e dois hosts nunca podem ter o mesmo IP.',
      'Para falar com outras redes, o host manda o tráfego para o GATEWAY PADRÃO, que é o endereço do roteador na rede local.',
    ],
    quiz: [
      {
        question: 'Qual destes é um endereço IPv4 válido?',
        options: ['192.168.0.300', '10.0.0.5', '192.168.0', 'a.b.c.d'],
        answer: 1,
        explain: 'Ele precisa ter quatro octetos, cada um de 0 a 255.',
      },
      {
        question: 'Com a máscara 255.255.255.0, qual destes está na mesma rede que 192.168.0.42?',
        options: ['192.168.1.42', '192.168.0.200', '10.0.0.42', '192.169.0.42'],
        answer: 1,
        explain: 'Os três primeiros octetos (192.168.0) têm que ser iguais.',
      },
      {
        question: 'O que é o gateway padrão?',
        options: ['O servidor DNS', 'O endereço do roteador, usado para chegar a outras redes', 'O endereço de broadcast', 'O seu próprio IP'],
        answer: 1,
        explain: 'Tudo o que vai para outra rede passa pelo gateway (o roteador).',
      },
      {
        question: 'Um host pode usar o 192.168.0.255 numa rede /24?',
        options: ['Sim', 'Não, esse é o endereço de broadcast'],
        answer: 1,
        explain: 'O último endereço de toda sub-rede fica reservado para o broadcast.',
      },
    ],
  },
  {
    id: 'dns',
    title: 'DNS',
    track: 'networking',
    requires: ['ip-addressing'],
    reward: 80,
    pages: [
      'As pessoas lembram de nomes como example.com, mas a rede entrega os dados pelo endereço IP. O DNS (Sistema de Nomes de Domínio) traduz os nomes em endereços.',
      'Seu computador pergunta a um RESOLVEDOR DNS, que fica definido nas configurações de rede. Muitas vezes é o próprio roteador (que repassa a pergunta) ou um servidor do provedor.',
      'O DNS guarda REGISTROS. A → endereço IPv4. AAAA → endereço IPv6. CNAME → apelido que aponta para outro nome. MX → servidor de e-mail do domínio. NS → servidores de nomes responsáveis pelo domínio. TXT → texto livre (muito usado para verificação).',
      'Sem servidor DNS ainda dá para acessar as máquinas pelo IP, mas boa sorte para decorar todos eles.',
    ],
    quiz: [
      {
        question: 'Para que serve o DNS?',
        options: ['Criptografar o tráfego', 'Traduzir nomes de domínio em endereços IP', 'Distribuir endereços MAC', 'Acelerar o processador'],
        answer: 1,
        explain: 'O DNS converte nomes em endereços.',
      },
      {
        question: 'Qual registro guarda o endereço IPv4 de um nome?',
        options: ['MX', 'A', 'CNAME', 'TXT'],
        answer: 1,
        explain: 'O registro A liga um nome a um endereço IPv4.',
      },
      {
        question: 'Qual registro diz para onde vão os e-mails de um domínio?',
        options: ['AAAA', 'NS', 'MX', 'A'],
        answer: 2,
        explain: 'O registro MX indica qual é o servidor de e-mail do domínio.',
      },
    ],
  },

  // ─── Field knowledge (needed for specific targets on the network) ─────
  {
    // Required before any breach (see checkRequirements in core/state.ts).
    id: 'ethics',
    title: 'Invasão, ética e a lei',
    track: 'field',
    requires: ['network-basics'],
    reward: 100,
    pages: [
      'Tudo o que você invade neste jogo fica no LABORATÓRIO DE SEGURANÇA da escola: uma rede isolada, montada só para treinar, em que todas as máquinas são simuladas. Aqui pode. Fora daqui, a história muda.',
      'No Brasil, entrar sem autorização no computador, no celular ou no servidor de outra pessoa para pegar, alterar ou apagar dados é CRIME. Está no artigo 154-A do Código Penal, criado pela Lei 12.737/2012, a "Lei Carolina Dieckmann". Desde a Lei 14.155/2021, a pena é de 1 a 4 anos de reclusão, mais multa. E não adianta dizer que o aparelho estava sem senha: a lei vale do mesmo jeito.',
      'O que separa um profissional de segurança de um criminoso é a AUTORIZAÇÃO. Num teste de invasão de verdade, o pentest, o dono do sistema dá permissão por escrito e combina o ESCOPO: quais máquinas podem ser testadas, de que forma e até quando. Saiu do escopo, deixou de ser teste.',
      'Achou uma falha num site ou sistema de verdade, mesmo sem querer? Não use a falha e não saia espalhando. Avise quem cuida do sistema e dê tempo para corrigirem: isso é a DIVULGAÇÃO RESPONSÁVEL. Muitas empresas têm programas de bug bounty, que pagam quem reporta falhas desse jeito.',
      'Dá para fazer carreira com isso: o pentester testa sistemas com autorização, e o analista de SOC acompanha os ataques num centro de operações de segurança. Para treinar, existem as competições de CTF, com desafios montados para serem invadidos. E se você seguir para o curso de ADS (Análise e Desenvolvimento de Sistemas), segurança da informação tem disciplina própria no último semestre.',
    ],
    quiz: [
      {
        question: 'Entrar no celular de um colega sem permissão para ler as mensagens dele é:',
        options: ['Permitido, se o celular estava sem senha', 'Crime previsto no Código Penal', 'Tudo bem, desde que seja brincadeira', 'Problema só se ele descobrir'],
        answer: 1,
        explain: 'É crime pelo artigo 154-A do Código Penal (Lei 12.737/2012), com ou sem senha no aparelho.',
      },
      {
        question: 'O que torna um teste de invasão legal?',
        options: ['Usar ferramentas profissionais', 'Não apagar nenhum arquivo', 'Permissão por escrito do dono, dentro do escopo combinado', 'Avisar o dono depois de terminar'],
        answer: 2,
        explain: 'Sem autorização prévia do dono, não é teste: é invasão. E a autorização só vale dentro do escopo combinado.',
      },
      {
        question: 'Você achou uma falha no site da sua escola. O que fazer?',
        options: ['Explorar a falha para ver até onde ela vai', 'Postar nas redes sociais para alertar todo mundo', 'Avisar quem cuida do site e não usar a falha', 'Guardar a falha para usar depois'],
        answer: 2,
        explain: 'Isso é divulgação responsável: quem cuida do site fica sabendo e corrige antes que alguém use a falha para o mal.',
      },
      {
        question: 'Por que, neste jogo, você pode invadir as máquinas da rede?',
        options: ['Porque elas têm senhas fracas', 'Porque são máquinas simuladas num laboratório de treino', 'Porque ninguém está olhando', 'Porque é tudo de mentira, então vale tudo'],
        answer: 1,
        explain: 'A rede do jogo é um laboratório de segurança: as máquinas existem para serem invadidas. Numa rede de verdade, sem autorização, seria crime.',
      },
    ],
  },
  {
    id: 'ports',
    title: 'Portas e firewalls',
    track: 'field',
    requires: ['dns'],
    reward: 100,
    pages: [
      'O endereço IP encontra a máquina; a PORTA (0–65535) encontra o programa dentro dela. Um servidor web fica escutando na porta 80 (HTTP) ou 443 (HTTPS).',
      'Portas mais comuns: 22 SSH, 25 SMTP (e-mail), 53 DNS, 80 HTTP, 443 HTTPS, 3306 MySQL, 3389 RDP (acesso remoto).',
      'O TCP abre uma conexão e é confiável: garante que tudo chegue, e na ordem certa (web, SSH, e-mail). O UDP não abre conexão: é rápido, mas pode perder pacotes no caminho (consultas DNS, jogos, chamadas de vídeo).',
      'O FIREWALL filtra o tráfego seguindo regras como "liberar TCP 443 de qualquer origem e bloquear todo o resto". Quem conhece as portas consegue ler essas regras e achar uma brecha.',
    ],
    quiz: [
      {
        question: 'Qual porta o SSH usa por padrão?',
        options: ['21', '22', '80', '443'],
        answer: 1,
        explain: 'O SSH escuta na porta 22.',
      },
      {
        question: 'Qual protocolo garante que os dados cheguem na ordem certa?',
        options: ['UDP', 'TCP', 'Os dois', 'Nenhum'],
        answer: 1,
        explain: 'O TCP reenvia os pacotes perdidos e mantém a ordem; o UDP não faz isso.',
      },
      {
        question: 'Para que serve um firewall?',
        options: ['Acelerar a rede', 'Filtrar o tráfego com base em regras', 'Resolver nomes de domínio', 'Distribuir IPs'],
        answer: 1,
        explain: 'O firewall libera ou bloqueia o tráfego de acordo com as regras.',
      },
    ],
  },
  {
    id: 'http',
    title: 'A web (HTTP)',
    track: 'field',
    requires: ['dns'],
    reward: 100,
    pages: [
      'A web funciona com HTTP: o cliente (o navegador) manda uma REQUISIÇÃO e o servidor devolve uma RESPOSTA.',
      'Toda requisição usa um MÉTODO: GET busca um recurso, POST envia dados, PUT substitui, DELETE apaga.',
      'Toda resposta vem com um CÓDIGO DE STATUS. 2xx: deu certo (200 OK, 201 Created). 3xx: redirecionamento (301 Moved Permanently). 4xx: erro do cliente (400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found). 5xx: erro do servidor (500 Internal Server Error, 503 Service Unavailable).',
      'O HTTPS é o HTTP passando por dentro de um túnel criptografado com TLS, na porta 443.',
    ],
    quiz: [
      {
        question: 'Qual método serve para ler uma página?',
        options: ['GET', 'POST', 'DELETE', 'PUT'],
        answer: 0,
        explain: 'O GET busca um recurso sem alterar nada nele.',
      },
      {
        question: 'O que quer dizer o código 404?',
        options: ['O servidor travou', 'Not Found (não encontrado)', 'Sucesso', 'Redirecionamento'],
        answer: 1,
        explain: '404 Not Found: o recurso não existe.',
      },
      {
        question: 'Um código 5xx indica que o problema está...',
        options: ['No cliente', 'No servidor', 'No DNS', 'No cabo'],
        answer: 1,
        explain: '5xx são erros do servidor; 4xx, erros do cliente.',
      },
    ],
  },
];


const LESSON_INDEX = new Map(LESSONS.map((l) => [l.id, l]));

/** The law-and-ethics lesson every node except home requires before a breach. */
export const ETHICS_LESSON_ID = 'ethics';

export function getLesson(id: string): Lesson {
  const lesson = LESSON_INDEX.get(id);
  if (!lesson) throw new Error(`Unknown lesson: ${id}`);
  return lesson;
}

/** Fraction of quiz answers that must be right to pass. */
export const QUIZ_PASS_RATIO = 0.66;
