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
      'Um computador faz quatro coisas: recebe ENTRADA (teclado, rede), faz o PROCESSAMENTO (processador), faz o ARMAZENAMENTO (RAM, discos) e gera SAÍDA (tela, rede).',
      'A PLACA-MÃE é a placa de circuito principal. Todas as outras peças se conectam a ela, e as trilhas dela levam dados e energia entre as peças.',
      'A placa-mãe define o que pode ser instalado: o SOCKET precisa combinar com o processador e os SLOTS de memória precisam combinar com a geração da RAM.',
      'Seu gabinete está vazio. Sua missão: aprender o que cada peça faz, comprar, instalar e fazer esta máquina dar boot.',
    ],
    quiz: [
      {
        question: 'Qual peça conecta todos os outros componentes?',
        options: ['Processador', 'Placa-mãe', 'Fonte de alimentação', 'HD'],
        answer: 1,
        explain: 'A placa-mãe é a base: todas as peças se conectam a ela.',
      },
      {
        question: 'Uma placa de rede recebendo uma página da web é um exemplo de...',
        options: ['Entrada', 'Processamento', 'Saída', 'Armazenamento'],
        answer: 0,
        explain: 'Dados chegando ao computador são entrada.',
      },
      {
        question: 'O que precisa combinar entre o processador e a placa-mãe?',
        options: ['A cor', 'O socket', 'O tamanho do armazenamento', 'A marca do gabinete'],
        answer: 1,
        explain: 'O processador só encaixa fisicamente em um socket compatível.',
      },
    ],
  },
  {
    id: 'power',
    title: 'Fontes de alimentação',
    track: 'hardware',
    requires: ['computer-basics'],
    reward: 40,
    pages: [
      'A tomada fornece corrente alternada (CA). As peças do computador precisam de corrente contínua (CC) de baixa tensão. A FONTE DE ALIMENTAÇÃO converte uma na outra.',
      'Toda peça consome energia, medida em WATTS (W). O processador costuma ser a peça mais gulosa.',
      'A fonte tem uma capacidade máxima. Se as peças juntas consomem mais que isso, o sistema fica instável ou nem liga. Sempre some o consumo e deixe uma margem de folga.',
    ],
    quiz: [
      {
        question: 'O que a fonte faz?',
        options: ['Guarda arquivos', 'Converte a CA da tomada em CC para as peças', 'Resfria o processador', 'Conecta à internet'],
        answer: 1,
        explain: 'A fonte converte CA nas tensões CC de que os componentes precisam.',
      },
      {
        question: 'Suas peças consomem 320 W. Qual fonte é suficiente?',
        options: ['250 W', '300 W', '450 W', 'Qualquer uma, watts não importam'],
        answer: 2,
        explain: 'A capacidade da fonte precisa ser maior que o consumo total: 450 W > 320 W.',
      },
      {
        question: 'Potência é medida em...',
        options: ['Hertz', 'Bytes', 'Watts', 'Bits por segundo'],
        answer: 2,
        explain: 'Watts medem potência. Hertz é frequência; bytes são dados.',
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
      'O processador (CPU, Unidade Central de Processamento) executa as instruções dos programas: contas, comparações, movimentação de dados.',
      'A FREQUÊNCIA, em gigahertz (GHz), é quantos ciclos por segundo um núcleo executa. 3 GHz = 3 bilhões de ciclos por segundo.',
      'Um processador tem um ou mais NÚCLEOS. Cada núcleo executa sua própria sequência de instruções, então mais núcleos deixam o computador fazer mais coisas em paralelo.',
      'Neste jogo, seu poder de processamento é núcleos × GHz. Mais poder = mais tempo para pensar durante as invasões.',
    ],
    quiz: [
      {
        question: 'O que o processador faz?',
        options: ['Guarda dados com o computador desligado', 'Executa instruções dos programas', 'Fornece energia', 'Mostra imagens'],
        answer: 1,
        explain: 'O processador executa instruções. O armazenamento guarda dados; a fonte fornece energia.',
      },
      {
        question: 'O que significa "4 núcleos"?',
        options: ['Ele funciona a 4 GHz', 'Ele executa 4 sequências de instruções em paralelo', 'Ele tem 4 GB de memória', 'Ele precisa de 4 cabos de energia'],
        answer: 1,
        explain: 'Cada núcleo é uma unidade de execução independente.',
      },
      {
        question: 'Uma frequência de 3,2 GHz significa...',
        options: ['3,2 bilhões de ciclos por segundo', '3,2 milhões de arquivos', '3,2 gigabytes', '3,2 watts'],
        answer: 0,
        explain: 'Giga = bilhão; hertz = ciclos por segundo.',
      },
    ],
  },
  {
    id: 'memory',
    title: 'Memória (RAM)',
    track: 'hardware',
    requires: ['computer-basics'],
    reward: 50,
    pages: [
      'A memória RAM (memória de acesso aleatório) é a área de trabalho do processador. Os programas e os dados em uso são carregados na RAM porque ela é muito mais rápida que os discos.',
      'A RAM é VOLÁTIL: quando a energia acaba, o conteúdo se perde. Por isso você salva os arquivos no armazenamento.',
      'A RAM vem em gerações, como DDR4 e DDR5. Elas não são intercambiáveis: um pente DDR5 não encaixa em um slot DDR4.',
      'Mais RAM permite manter mais coisas rodando ao mesmo tempo. Neste jogo, mais RAM significa mais espaço para erros antes que sua invasão caia.',
    ],
    quiz: [
      {
        question: 'O que acontece com o conteúdo da RAM quando o computador desliga?',
        options: ['Fica guardado para sempre', 'Ele se perde', 'Vai para o processador', 'É enviado ao roteador'],
        answer: 1,
        explain: 'A RAM é volátil: sem energia, sem dados.',
      },
      {
        question: 'Por que os programas são carregados na RAM?',
        options: ['A RAM é muito mais rápida que os discos', 'A RAM é mais barata que os discos', 'Discos não guardam programas', 'A fonte exige isso'],
        answer: 0,
        explain: 'O processador ficaria parado esperando os discos; a RAM é muito mais rápida.',
      },
      {
        question: 'Dá para instalar RAM DDR5 em uma placa-mãe DDR4?',
        options: ['Sim', 'Não', 'Só com uma fonte maior', 'Só aos domingos'],
        answer: 1,
        explain: 'As gerações de memória são física e eletricamente diferentes.',
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
      'O ARMAZENAMENTO guarda dados com o computador desligado: o sistema operacional, os programas e os seus arquivos ficam aqui.',
      'O HD (disco rígido) grava dados magneticamente em pratos que giram. É barato e grande, mas lento e mecânico.',
      'O SSD usa memória flash, sem partes móveis. Um SSD SATA é cerca de 4× mais rápido que um HD; um SSD NVMe se comunica direto pelo barramento PCIe e é mais rápido ainda.',
      'A capacidade é medida em gigabytes (GB) e terabytes (TB). 1 TB = 1000 GB.',
    ],
    quiz: [
      {
        question: 'Qual deles guarda dados sem energia?',
        options: ['RAM', 'Cache do processador', 'SSD', 'Nenhum deles'],
        answer: 2,
        explain: 'SSDs e HDs são armazenamento não volátil.',
      },
      {
        question: 'Qual é o mais rápido?',
        options: ['HD', 'SSD SATA', 'SSD NVMe', 'São todos iguais'],
        answer: 2,
        explain: 'O NVMe usa o barramento PCIe direto e é o mais rápido dos três.',
      },
      {
        question: 'Por que um HD é mais lento que um SSD?',
        options: ['Ele tem partes mecânicas móveis', 'Ele usa mais RAM', 'Ele é sempre menor', 'Ele precisa de internet'],
        answer: 0,
        explain: 'Uma cabeça de leitura precisa se mover sobre pratos girando para achar os dados.',
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
      'Computadores guardam tudo como BITS: 0 ou 1, desligado ou ligado. Um grupo de 8 bits é um BYTE.',
      'Binário é base 2. Cada posição vale o dobro da posição à direita: 128 64 32 16 8 4 2 1.',
      'Para ler 00001011: 8 + 2 + 1 = 11. Para escrever 6: 4 + 2 → 00000110.',
      'Com n bits você representa 2ⁿ valores diferentes. Um byte: 2⁸ = 256 valores (0–255). Guarde esse número: ele aparece nos endereços IP!',
    ],
    quiz: [
      {
        question: 'Quantos bits tem um byte?',
        options: ['2', '4', '8', '10'],
        answer: 2,
        explain: '1 byte = 8 bits.',
      },
      {
        question: 'Quanto é 101 (binário) em decimal?',
        options: ['3', '5', '6', '101'],
        answer: 1,
        explain: '4 + 0 + 1 = 5.',
      },
      {
        question: 'Qual é o maior valor que cabe em um byte?',
        options: ['128', '255', '256', '1024'],
        answer: 1,
        explain: '8 bits dão 256 valores, de 0 a 255.',
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
      'Uma REDE é um conjunto de dispositivos que trocam dados. Uma LAN (rede local) é a da sua casa ou escritório; uma WAN (rede de longa distância) cobre cidades. A internet é a maior de todas.',
      'A PLACA DE REDE conecta um computador a uma rede. Cada placa de rede tem um endereço físico único, o endereço MAC.',
      'O ROTEADOR encaminha o tráfego entre redes. O roteador da sua casa liga a sua LAN ao seu PROVEDOR de internet, que leva ao resto da internet.',
      'A largura de banda é medida em bits por segundo (Mbps, Gbps). Um caminho só é tão rápido quanto o seu link mais lento.',
    ],
    quiz: [
      {
        question: 'Qual dispositivo permite que um computador se conecte a uma rede?',
        options: ['Fonte', 'Placa de rede', 'Placa de vídeo', 'SSD'],
        answer: 1,
        explain: 'A placa de rede.',
      },
      {
        question: 'O que um roteador faz?',
        options: ['Guarda páginas da web', 'Encaminha o tráfego entre redes', 'Fornece energia ao computador', 'Traduz binário em texto'],
        answer: 1,
        explain: 'Roteadores ligam redes entre si, como a sua LAN e o seu provedor.',
      },
      {
        question: 'Sua placa de rede é de 1 Gbps e seu roteador, de 100 Mbps. Qual a velocidade do link?',
        options: ['1 Gbps', '1,1 Gbps', '100 Mbps', '550 Mbps'],
        answer: 2,
        explain: 'Um link funciona na velocidade da sua ponta mais lenta.',
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
      'Todo dispositivo em uma rede IP precisa de um ENDEREÇO IP. Um endereço IPv4 tem 4 bytes escritos em decimal: 192.168.0.42. Cada parte (octeto) vai de 0 a 255.',
      'A MÁSCARA DE SUB-REDE diz qual parte do endereço é a REDE e qual parte é o HOST. 255.255.255.0 (/24) significa que os 3 primeiros octetos são a rede.',
      'Dois dispositivos só conversam diretamente se estiverem na mesma rede: com /24, 192.168.0.42 e 192.168.0.7 são vizinhos, mas 192.168.1.7 não é.',
      'Em cada sub-rede, o primeiro endereço é o ENDEREÇO DE REDE (192.168.0.0) e o último é o de BROADCAST (192.168.0.255). Nenhum dos dois vai para um host, e dois hosts nunca podem ter o mesmo IP.',
      'Para alcançar outras redes, o host envia o tráfego ao seu GATEWAY PADRÃO: o endereço do roteador na rede local.',
    ],
    quiz: [
      {
        question: 'Qual é um endereço IPv4 válido?',
        options: ['192.168.0.300', '10.0.0.5', '192.168.0', 'a.b.c.d'],
        answer: 1,
        explain: 'Quatro octetos, cada um de 0 a 255.',
      },
      {
        question: 'Com a máscara 255.255.255.0, qual está na mesma rede que 192.168.0.42?',
        options: ['192.168.1.42', '192.168.0.200', '10.0.0.42', '192.169.0.42'],
        answer: 1,
        explain: 'Os três primeiros octetos (192.168.0) precisam ser iguais.',
      },
      {
        question: 'O que é o gateway padrão?',
        options: ['O servidor DNS', 'O endereço do roteador usado para alcançar outras redes', 'O endereço de broadcast', 'O seu próprio IP'],
        answer: 1,
        explain: 'O tráfego para outras redes vai para o gateway (roteador).',
      },
      {
        question: 'Um host pode usar 192.168.0.255 em uma rede /24?',
        options: ['Sim', 'Não, é o endereço de broadcast'],
        answer: 1,
        explain: 'O último endereço de uma sub-rede é reservado para broadcast.',
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
      'Pessoas lembram nomes como example.com; redes encaminham por endereço IP. O DNS (Sistema de Nomes de Domínio) traduz nomes em endereços.',
      'Seu computador pergunta a um RESOLVEDOR DNS, definido nas configurações de rede. Muitas vezes é o seu roteador (que repassa a pergunta) ou um servidor do seu provedor.',
      'O DNS guarda REGISTROS. A → endereço IPv4. AAAA → endereço IPv6. CNAME → apelido para outro nome. MX → servidor de e-mail do domínio. NS → servidores de nomes responsáveis pelo domínio. TXT → texto livre (muito usado para verificação).',
      'Sem um servidor DNS você ainda alcança as máquinas pelo IP, mas boa sorte para decorar todos.',
    ],
    quiz: [
      {
        question: 'O que o DNS faz?',
        options: ['Criptografa o tráfego', 'Traduz nomes de domínio em endereços IP', 'Distribui endereços MAC', 'Acelera o processador'],
        answer: 1,
        explain: 'O DNS resolve nomes em endereços.',
      },
      {
        question: 'Qual registro guarda o endereço IPv4 de um nome?',
        options: ['MX', 'A', 'CNAME', 'TXT'],
        answer: 1,
        explain: 'Registros A ligam um nome a um endereço IPv4.',
      },
      {
        question: 'Qual registro diz para onde entregar os e-mails de um domínio?',
        options: ['AAAA', 'NS', 'MX', 'A'],
        answer: 2,
        explain: 'O registro MX aponta o servidor de e-mail do domínio.',
      },
    ],
  },

  // ─── Field knowledge (needed for specific targets on the network) ─────
  {
    id: 'ports',
    title: 'Portas e firewalls',
    track: 'field',
    requires: ['dns'],
    reward: 100,
    pages: [
      'O endereço IP encontra a máquina; a PORTA (0–65535) encontra o programa nessa máquina. Um servidor web escuta na porta 80 (HTTP) ou 443 (HTTPS).',
      'Portas comuns: 22 SSH, 25 SMTP (e-mail), 53 DNS, 80 HTTP, 443 HTTPS, 3306 MySQL, 3389 RDP (área de trabalho remota).',
      'O TCP é orientado a conexão e confiável: garante a ordem e a entrega (web, SSH, e-mail). O UDP não usa conexão, é rápido, mas pode perder pacotes (consultas DNS, jogos, chamadas de vídeo).',
      'Um FIREWALL filtra o tráfego com regras como "permitir TCP 443 de qualquer origem, bloquear todo o resto". Conhecer as portas é como você lê essas regras e passa por elas.',
    ],
    quiz: [
      {
        question: 'Qual porta o SSH usa por padrão?',
        options: ['21', '22', '80', '443'],
        answer: 1,
        explain: 'O SSH escuta na porta 22.',
      },
      {
        question: 'Qual protocolo garante a entrega em ordem?',
        options: ['UDP', 'TCP', 'Os dois', 'Nenhum'],
        answer: 1,
        explain: 'O TCP reenvia pacotes perdidos e mantém a ordem; o UDP não.',
      },
      {
        question: 'Qual é a função de um firewall?',
        options: ['Acelerar a rede', 'Filtrar o tráfego usando regras', 'Resolver nomes de domínio', 'Distribuir IPs'],
        answer: 1,
        explain: 'Firewalls permitem ou bloqueiam o tráfego com base em regras.',
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
      'A web funciona com HTTP: um cliente (o navegador) envia uma REQUISIÇÃO e o servidor devolve uma RESPOSTA.',
      'Toda requisição tem um MÉTODO: GET lê um recurso, POST envia dados, PUT substitui, DELETE remove.',
      'Toda resposta traz um CÓDIGO DE STATUS. 2xx sucesso (200 OK, 201 Created). 3xx redirecionamento (301 Moved Permanently). 4xx erro do cliente (400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found). 5xx erro do servidor (500 Internal Server Error, 503 Service Unavailable).',
      'HTTPS é HTTP dentro de um túnel criptografado TLS, na porta 443.',
    ],
    quiz: [
      {
        question: 'Qual método é usado para ler uma página?',
        options: ['GET', 'POST', 'DELETE', 'PUT'],
        answer: 0,
        explain: 'O GET busca um recurso sem alterá-lo.',
      },
      {
        question: 'O que significa 404?',
        options: ['O servidor travou', 'Not Found (não encontrado)', 'Sucesso', 'Redirecionamento'],
        answer: 1,
        explain: '404 Not Found: o recurso não existe.',
      },
      {
        question: 'Um código 5xx significa que o problema está...',
        options: ['No cliente', 'No servidor', 'No DNS', 'No cabo'],
        answer: 1,
        explain: '5xx são erros do servidor; 4xx são erros do cliente.',
      },
    ],
  },
];


const LESSON_INDEX = new Map(LESSONS.map((l) => [l.id, l]));

export function getLesson(id: string): Lesson {
  const lesson = LESSON_INDEX.get(id);
  if (!lesson) throw new Error(`Unknown lesson: ${id}`);
  return lesson;
}

/** Fraction of quiz answers that must be right to pass. */
export const QUIZ_PASS_RATIO = 0.66;
