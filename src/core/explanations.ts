/**
 * Explanations shown after a mini-game round. Every concept is explained
 * through three lenses, each filled with the numbers of the round itself, so a
 * student who missed it sees the same idea from another angle (the reteach
 * rotation lives in reteach.ts).
 *
 * - steps:     the procedure, step by step (the text shown after a correct answer)
 * - analogy:   a comparison with something the student already knows
 * - realWorld: where the idea shows up on a real network or computer
 *
 * Every text is at most 220 characters, so it fits the result panel.
 */

import { listJoin, money } from './fmt';

export type Lens = 'steps' | 'analogy' | 'realWorld';

/** Default order, also used to break ties between lenses. */
export const LENSES: Lens[] = ['steps', 'analogy', 'realWorld'];

export const LENS_LABELS: Record<Lens, string> = {
  steps: 'Passo a passo',
  analogy: 'Analogia',
  realWorld: 'Na vida real',
};

export type Explanations = Record<Lens, string>;

/** "Not Found" stays as is; "A página carregou" becomes "a página carregou". */
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

// ─── Binary ───────────────────────────────────────────────────────────────

function placeValues(value: number, bits: number): number[] {
  const terms: number[] = [];
  for (let i = bits - 1; i >= 0; i--) if (value & (1 << i)) terms.push(1 << i);
  return terms;
}

export function explainToBinary(target: number, bits: number, binary: string): Explanations {
  const terms = placeValues(target, bits);
  return {
    steps: `${target} = ${binary} (${terms.join(' + ')})`,
    analogy: `É como pagar ${money(target)} com moedas de 1, 2, 4, 8…, no máximo uma de cada. Comece pela maior que cabe, ${terms[0]}, e vá completando. Cada moeda usada é um bit 1.`,
    realWorld: `Na memória do PC, ${target} fica guardado como ${binary}: cada bit é um transistor ligado (1) ou desligado (0).`,
  };
}

export function explainToDecimal(value: number, bits: number, binary: string): Explanations {
  const terms = placeValues(value, bits);
  return {
    steps: `${binary} = ${terms.join(' + ')} = ${value}`,
    analogy: `Leia ${binary} como uma fileira de lâmpadas. Da direita para a esquerda, cada uma vale o dobro da anterior: 1, 2, 4, 8… Some só as acesas, os 1, e dá ${value}.`,
    realWorld: `Tudo o que passa pelo cabo de rede são bits como ${binary}. O PC soma o valor de cada posição com 1 e entende o número ${value}.`,
  };
}

export function explainCombinations(n: number): Explanations {
  const total = 2 ** n;
  return {
    steps: `Cada bit a mais dobra as combinações: 2^${n} = ${total}.`,
    analogy: `Pense em ${n} interruptores, cada um ligado ou desligado. Um sozinho dá 2 jeitos, e cada interruptor a mais dobra a conta. Com ${n}, são ${total} jeitos.`,
    realWorld: `Um endereço IPv4 tem 32 bits, e por isso existem uns 4 bilhões deles. Com ${n} bits a conta é a mesma: 2 elevado a ${n} dá ${total}.`,
  };
}

// ─── Subnets ──────────────────────────────────────────────────────────────

export function explainSameNetwork(cidr: string, net: string, broadcast: string, prefix: number): Explanations {
  return {
    steps: `${cidr} fica na rede ${net}/${prefix}, que vai de ${net} a ${broadcast}.`,
    analogy: `A rede é uma rua: ${net} é o começo e ${broadcast} é o fim. Só quem tem número entre os dois mora na mesma rua que ${cidr}.`,
    realWorld: `O PC só fala direto com quem está na mesma rede; o resto vai pelo gateway. A rede de ${cidr} vai de ${net} a ${broadcast}.`,
  };
}

export function explainNetworkAddress(cidr: string, mask: string, net: string, prefix: number): Explanations {
  return {
    steps: `Aplique a máscara de sub-rede ${mask}: os bits de rede continuam iguais e os de host viram 0 → ${net}.`,
    analogy: `Em ${cidr}, os primeiros ${prefix} bits são o nome da rua e o resto é o número da casa. Zere o número da casa e sobra a rua: ${net}.`,
    realWorld: `O roteador faz essa conta o tempo todo: aplica a máscara ${mask} ao destino, acha a rede ${net} e decide por onde mandar o pacote.`,
  };
}

export function explainUsableHosts(prefix: number, hosts: number): Explanations {
  const hostBits = 32 - prefix;
  const total = 2 ** hostBits;
  return {
    steps: `Numa rede /${prefix} sobram ${hostBits} bits de host: 2^${hostBits} = ${total}. Tirando o endereço de rede e o de broadcast, ficam ${hosts}.`,
    analogy: `Um prédio com ${total} salas, mas duas já têm dono: a primeira identifica o prédio (rede) e a última é o alto-falante (broadcast). Sobram ${hosts}.`,
    realWorld: `Uma rede /${prefix} comporta no máximo ${hosts} computadores: dos ${total} endereços, o primeiro identifica a rede e o último é o broadcast.`,
  };
}

export function explainBroadcast(cidr: string, net: string, broadcast: string, prefix: number): Explanations {
  return {
    steps: `Com todos os bits de host em 1, dá ${broadcast}: o último endereço da rede ${net}/${prefix}.`,
    analogy: `O broadcast é o alto-falante da rede: o que vai para ele chega a todos. Ele fica no fim da faixa de ${cidr}, com os bits de host em 1: ${broadcast}.`,
    realWorld: `Um pacote para ${broadcast} chega a todos os hosts da rede ${net}/${prefix}. Por isso esse endereço nunca pode ser o IP de um PC.`,
  };
}

// ─── Ports ────────────────────────────────────────────────────────────────

export function explainServicePort(name: string, port: number, proto: string): Explanations {
  return {
    steps: `O serviço ${name} escuta na porta ${proto} ${port}.`,
    analogy: `O IP é o endereço do prédio e a porta é o número do apartamento. O serviço ${name} mora no ${port}: é lá que o servidor espera por ele.`,
    realWorld: `Quem usa ${name} se conecta à porta ${port} do servidor sem nem perceber. Bloquear a porta ${port} no firewall corta esse serviço.`,
  };
}

export function explainFirewall(allowed: number[], targetName: string, targetPort: number): Explanations {
  const ports = listJoin(allowed.map(String));
  return {
    steps: `O firewall só libera as portas ${ports}, e o serviço ${targetName} usa a porta ${targetPort}.`,
    analogy: `O firewall é a portaria com lista de convidados: só passam as portas ${ports}. A ${targetPort} está na lista; o resto é barrado no DENY ALL.`,
    realWorld: `O firewall lê as regras de cima para baixo e para na primeira que combina. A conexão para a porta ${targetPort} bate num ALLOW; as outras caem no DENY ALL.`,
  };
}

export function explainTransport(name: string, proto: 'TCP' | 'UDP'): Explanations {
  if (proto === 'TCP') {
    return {
      steps: `O serviço ${name} precisa que tudo chegue completo e na ordem certa: TCP.`,
      analogy: `O TCP é como carta registrada: cada pedaço tem aviso de recebimento e chega na ordem. O serviço ${name} não aceita perder nada.`,
      realWorld: `Se um pedaço se perde no caminho, o TCP pede de novo. Um arquivo ou uma página pela metade não serve para nada, por isso o serviço ${name} usa TCP.`,
    };
  }
  return {
    steps: `O serviço ${name} troca mensagens curtas e precisa de rapidez, não de garantia de entrega: UDP.`,
    analogy: `O UDP é como gritar um recado: chega rápido, mas ninguém confirma. Se o recado se perde, é só gritar de novo. Assim funciona o serviço ${name}.`,
    realWorld: `As mensagens do serviço ${name} cabem num pacote só. Se uma se perde, o programa pergunta de novo; o UDP economiza o tempo de abrir conexão.`,
  };
}

// ─── HTTP ─────────────────────────────────────────────────────────────────

export function explainStatusCode(code: number, meaning: string, scenario: string): Explanations {
  const klass = Math.floor(code / 100);
  return {
    steps: `${code} ${meaning}. Exemplo: ${scenario}.`,
    analogy: `Como no balcão de uma loja: 2xx é "aqui está", 3xx é "é em outro lugar", 4xx é "pedido errado" e 5xx é "deu problema aqui dentro". ${code} é um ${klass}xx.`,
    realWorld: `Aperte F12 no navegador e abra a aba Rede: cada arquivo carregado mostra o código da resposta. O ${code} aparece quando ${lowerFirst(scenario)}.`,
  };
}

const METHOD_EXAMPLES: Record<string, string> = {
  GET: 'Digitar um endereço no navegador faz um GET.',
  POST: 'Enviar um formulário de cadastro faz um POST.',
  PUT: 'Salvar de novo o perfil inteiro num app faz um PUT.',
  DELETE: 'Apagar uma postagem numa rede social faz um DELETE.',
};

export function explainMethod(method: string, use: string): Explanations {
  return {
    steps: `${method}: ${use}.`,
    analogy: `Numa biblioteca, GET é ler um livro, POST é doar um livro novo, PUT é trocar um livro inteiro por outro e DELETE é tirá-lo da estante. Aqui é ${method}.`,
    realWorld: `${METHOD_EXAMPLES[method]} Para ${lowerFirst(use)}, o método é ${method}.`,
  };
}

const CLASS_IN_PRACTICE: Record<number, string> = {
  2: 'não há nada a corrigir',
  3: 'o navegador segue sozinho para o outro endereço',
  4: 'quem precisa corrigir é quem fez o pedido',
  5: 'quem precisa corrigir é o servidor',
};

export function explainStatusClass(code: number, className: string): Explanations {
  const klass = Math.floor(code / 100);
  return {
    steps: `Os códigos ${klass}xx são de ${className.toLowerCase()}.`,
    analogy: `Só o primeiro dígito decide a classe, como o DDD de um telefone diz a região. ${code} começa com ${klass}: ${className.toLowerCase()}.`,
    realWorld: `Quando aparece um ${code} (${className.toLowerCase()}), ${CLASS_IN_PRACTICE[klass]}.`,
  };
}

// ─── DNS ──────────────────────────────────────────────────────────────────

const RECORD_EXAMPLES: Record<string, string> = {
  A: 'Quando você digita um site, o navegador pede o registro A para saber o IP.',
  AAAA: 'Em redes com IPv6, o navegador pede o AAAA para achar o endereço novo do site.',
  CNAME: 'Muitos sites usam CNAME para que o nome com www e o sem www levem ao mesmo lugar.',
  MX: 'Quando você manda e-mail para alguém de uma empresa, seu servidor consulta o MX dela.',
  NS: 'Quem registra um domínio informa os NS: são esses servidores que respondem por ele.',
  TXT: 'Serviços de e-mail pedem um registro TXT para provar que o domínio é seu.',
  PTR: 'Servidores de e-mail checam o PTR do IP de quem envia para barrar mensagens falsas.',
  SOA: 'Quando o número de série no SOA muda, os outros servidores sabem que a zona mudou.',
  SRV: 'Programas de chamada de voz usam SRV para descobrir em qual servidor e porta conectar.',
};

export function explainRecordType(type: string, purpose: string): Explanations {
  return {
    steps: `${type}: ${purpose}.`,
    analogy: `O DNS é a agenda de contatos da internet, e cada tipo de registro é um campo dessa agenda. O campo ${type} ${lowerFirst(purpose)}.`,
    realWorld: RECORD_EXAMPLES[type],
  };
}

export function explainResolve(domain: string, ask: 'mail' | 'chain' | 'direct', ip: string): Explanations {
  if (ask === 'mail') {
    return {
      steps: `O registro MX aponta para mail.${domain}, e o registro A desse nome é ${ip}.`,
      analogy: `É como mandar carta para uma empresa: primeiro você descobre quem recebe a correspondência (MX) e depois onde essa pessoa fica (A): ${ip}.`,
      realWorld: `Para entregar um e-mail a @${domain}, o servidor faz duas consultas, MX e depois A, e só então conecta em ${ip}.`,
    };
  }
  if (ask === 'chain') {
    return {
      steps: `www é um apelido (CNAME) de web.${domain}, que tem registro A ${ip}.`,
      analogy: `É como procurar alguém e ouvir "mudou, procure o web": você segue o apelido (CNAME) até achar o registro A com o endereço, ${ip}.`,
      realWorld: `O comando nslookup www.${domain} mostra isso: primeiro o CNAME para web.${domain}, depois o IP ${ip}.`,
    };
  }
  return {
    steps: `O registro A de www.${domain} aponta direto para ${ip}.`,
    analogy: `Achou o nome na agenda, achou o número: o registro A de www.${domain} já traz o endereço, ${ip}, sem apelido no meio.`,
    realWorld: `O navegador pede ao DNS o registro A de www.${domain}, recebe ${ip} e só então abre a conexão com o site.`,
  };
}

// ─── NAT ──────────────────────────────────────────────────────────────────

/** `range` is the private block the address is in, or null for a public one. */
export function explainPrivateRange(ip: string, range: string | null): Explanations {
  if (range) {
    return {
      steps: `${ip} fica na faixa privada ${range}: só vale dentro de uma rede local e nunca aparece na internet.`,
      analogy: `É como o ramal de uma empresa: ${ip} funciona dentro da rede, mas ninguém de fora liga direto para ele. A faixa ${range} se repete em milhares de redes.`,
      realWorld: `O IP do seu PC em casa quase sempre está numa faixa privada como ${range}. Para sair para a internet, o roteador troca esse endereço pelo público dele.`,
    };
  }
  return {
    steps: `${ip} não fica em 10.0.0.0/8, 172.16.0.0/12 nem 192.168.0.0/16. Fora dessas três faixas, o endereço é público e vale na internet.`,
    analogy: `É como um telefone com DDD: ${ip} é único no mundo, e qualquer um na internet consegue chegar até ele.`,
    realWorld: `Servidores de sites e o lado de fora do roteador de casa usam endereços públicos como ${ip}. Repare que 172.32 e 192.169 já ficam fora das faixas privadas.`,
  };
}

/** `out`: a connection leaving the network; `back`: its reply coming in. */
export function explainOutsideAddress(host: string, publicIp: string, direction: 'out' | 'back'): Explanations {
  if (direction === 'out') {
    return {
      steps: `Na saída, o NAT troca a origem ${host} pelo IP público do roteador, ${publicIp}. O site só enxerga ${publicIp}.`,
      analogy: `É como a portaria de um prédio que despacha as cartas de todo mundo com o endereço do prédio, ${publicIp}. Quem recebe nem sabe que o remetente mora no ${host}.`,
      realWorld: `Os sites que mostram "qual é o meu IP" exibem o endereço público do roteador, como ${publicIp}, e nunca o ${host} do PC.`,
    };
  }
  return {
    steps: `A resposta chega em ${publicIp}. O roteador procura essa porta na tabela do NAT e entrega a resposta a ${host}, que abriu a conexão.`,
    analogy: `É a portaria recebendo a resposta no endereço do prédio, ${publicIp}, e levando até o apartamento certo, ${host}, porque anotou quem mandou a carta.`,
    realWorld: `É assim que vários PCs da mesma casa navegam juntos por um IP público só: a tabela do NAT lembra que essa conexão é do ${host}.`,
  };
}

export function explainPortForward(rule: string, publicIp: string, host: string): Explanations {
  return {
    steps: `${rule}. O lado público é o IP do roteador, ${publicIp}; o lado privado é o host ${host}, na porta em que o serviço escuta.`,
    analogy: `O redirecionamento é a recepção que encaminha as visitas: quem chega em ${publicIp} pedindo aquela porta é levado até ${host}.`,
    realWorld: `Quem hospeda um servidor de jogo em casa faz isso no roteador: abre a porta no IP público e aponta para o IP privado do PC, como ${host}.`,
  };
}

// ─── VLAN ─────────────────────────────────────────────────────────────────

export function explainVlanMembership(port: number, other: number, vlan: string): Explanations {
  return {
    steps: `As portas ${port} e ${other} estão as duas na VLAN ${vlan}. As outras portas ficam em VLANs diferentes e só se falam passando por um roteador.`,
    analogy: `Cada VLAN é uma sala de porta fechada no mesmo prédio. As portas ${port} e ${other} estão na mesma sala, a VLAN ${vlan}; as outras estão em salas vizinhas.`,
    realWorld: `Na escola, o mesmo switch pode separar alunos e professores em VLANs. Quem está na VLAN ${vlan} só enxerga direto as máquinas dessa VLAN.`,
  };
}

/** `ids` are the VLANs the link has to carry; one VLAN means an access port. */
export function explainPortMode(ids: number[]): Explanations {
  const vlans = `as VLANs ${listJoin(ids.map(String))}`;
  if (ids.length > 1) {
    return {
      steps: `O link precisa levar ${vlans}: mais de uma VLAN, então é tronco, e cada quadro passa com a etiqueta da VLAN dele.`,
      analogy: `O tronco é uma avenida com uma faixa para cada VLAN; a porta de acesso é a rua de uma casa só. Para levar ${vlans} juntas, só a avenida serve.`,
      realWorld: `Entre os switches de andares diferentes de uma escola, o cabo quase sempre é tronco: por ele passam ${vlans} ao mesmo tempo.`,
    };
  }
  return {
    steps: `O aparelho fica só na VLAN ${ids[0]}, então a porta é de acesso nessa VLAN. Tronco é para links que levam várias VLANs.`,
    analogy: `A porta de acesso é a rua de uma casa só, a VLAN ${ids[0]}. O tronco é a avenida que junta várias VLANs, e o aparelho nem saberia ler as etiquetas dela.`,
    realWorld: `Impressoras, câmeras e PCs vão em portas de acesso: o switch põe o tráfego deles na VLAN ${ids[0]} sem que eles precisem saber disso.`,
  };
}

export type VlanIdVerdict = 'ok' | 'default' | 'reserved' | 'range';

export function explainVlanId(id: number, verdict: VlanIdVerdict): Explanations {
  const steps: Record<VlanIdVerdict, string> = {
    ok: `${id} fica entre 2 e 4094 e não é um dos reservados (1002 a 1005), então pode ser o ID de uma VLAN nova.`,
    default: 'A VLAN 1 é a padrão: toda porta do switch começa nela, então ela não serve para separar nada.',
    reserved: `${id} está entre os IDs reservados, de 1002 a 1005, que o switch não deixa usar.`,
    range: `${id} fica fora da faixa de 1 a 4094, a única que um ID de VLAN pode ter.`,
  };
  const room: Record<VlanIdVerdict, string> = {
    ok: 'é uma sala livre', default: 'é o saguão', reserved: 'é uma sala trancada', range: 'nem existe no prédio',
  };
  return {
    steps: steps[verdict],
    analogy: `Pense nos IDs como números de sala: a 1 é o saguão onde todos começam, de 1002 a 1005 as salas estão trancadas e nada passa de 4094. O ${id} ${room[verdict]}.`,
    realWorld: `No switch, o comando que cria a VLAN ${id} ${verdict === 'ok' ? 'funciona normalmente' : 'é recusado com erro'}. Por isso as redes costumam usar IDs simples, como 10, 20 e 30.`,
  };
}

// ─── IPv6 ─────────────────────────────────────────────────────────────────

export function explainCompress(full: string, short: string): Explanations {
  return {
    steps: `Tire os zeros à esquerda de cada grupo e troque a maior sequência de grupos zerados por "::": ${short}.`,
    analogy: `É como ditar 007 como 7: zero à esquerda não muda o valor. E o "::" quer dizer "aqui vão grupos de zero", por isso só pode aparecer uma vez: ${short}.`,
    realWorld: `Os comandos de rede mostram sempre a forma curta, ${short}. Ela é o mesmo endereço que ${full}.`,
  };
}

export function explainV6Prefix(host: string, prefix: string, length: number): Explanations {
  return {
    steps: `Num /${length}, os ${length / 16} primeiros grupos são a rede: fique com eles e zere o resto. ${host} está em ${prefix}.`,
    analogy: `O endereço é como CEP mais número da casa: os primeiros ${length} bits são o CEP da rede, ${prefix}, e o resto é a casa.`,
    realWorld: `O roteador olha só os primeiros ${length} bits para escolher o caminho: tudo o que começa como ${prefix} vai para a mesma rede.`,
  };
}

export type V6Kind = 'global' | 'linkLocal' | 'loopback' | 'multicast' | 'uniqueLocal';

export function explainAddressType(address: string, kind: V6Kind): Explanations {
  const all: Record<V6Kind, Explanations> = {
    global: {
      steps: `${address} começa com 2 ou 3: é um endereço global, que pode ser alcançado pela internet.`,
      analogy: `É como um telefone com código do país: ${address} é único no mundo, e qualquer um consegue chegar até ele.`,
      realWorld: `Quando você abre um site por IPv6, os dois lados da conexão usam endereços globais como ${address}.`,
    },
    linkLocal: {
      steps: `${address} começa com fe80: é link-local, só vale no próprio link e nunca passa por um roteador.`,
      analogy: `É como conversar com o vizinho por cima do muro: ${address} só alcança quem está no mesmo link.`,
      realWorld: 'Toda placa de rede com IPv6 cria sozinha um endereço fe80 quando liga, mesmo sem nenhum roteador na rede.',
    },
    loopback: {
      steps: '::1 é o loopback: o computador falando com ele mesmo, como o 127.0.0.1 do IPv4.',
      analogy: 'É como mandar um bilhete para você mesmo: o que vai para ::1 nunca sai do computador.',
      realWorld: 'Programas que conversam dentro do próprio PC, como um servidor de testes, usam o ::1 para não passar pela rede.',
    },
    multicast: {
      steps: `${address} começa com ff: é multicast, um endereço de grupo que entrega a mesma mensagem a vários destinos.`,
      analogy: `É como um grupo de mensagens: mandar para ${address} entrega a todo mundo que entrou no grupo.`,
      realWorld: 'O IPv6 não tem broadcast: para falar com todos os hosts de uma rede, ele usa o multicast ff02::1.',
    },
    uniqueLocal: {
      steps: `${address} começa com fd: é local única, o jeito IPv6 de fazer o que as faixas privadas como 192.168.0.0/16 fazem.`,
      analogy: `É como o ramal interno de uma empresa: ${address} funciona dentro da organização, mas não na internet.`,
      realWorld: 'Empresas usam endereços fd para serviços internos que não precisam aparecer na internet.',
    },
  };
  return all[kind];
}
