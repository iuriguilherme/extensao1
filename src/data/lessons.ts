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

export type LessonTrack = 'Hardware' | 'Networking' | 'Field Knowledge';

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
    title: 'What is a computer?',
    track: 'Hardware',
    requires: [],
    reward: 40,
    pages: [
      'A computer does four things: it takes INPUT (keyboard, network), PROCESSES it (CPU), STORES it (RAM, disks) and produces OUTPUT (screen, network).',
      'The MOTHERBOARD is the main circuit board. Every other part plugs into it, and its traces carry data and power between them.',
      'A motherboard decides what can be installed: the CPU SOCKET must match the processor and the memory SLOTS must match the RAM generation.',
      'Your case is empty. Your job: learn what each part does, buy it, install it, and get this machine to boot.',
    ],
    quiz: [
      {
        question: 'Which part connects all other components together?',
        options: ['CPU', 'Motherboard', 'Power supply', 'Hard drive'],
        answer: 1,
        explain: 'The motherboard is the backbone: every part plugs into it.',
      },
      {
        question: 'A network card receiving a web page is an example of...',
        options: ['Input', 'Processing', 'Output', 'Storage'],
        answer: 0,
        explain: 'Data arriving into the computer is input.',
      },
      {
        question: 'What must match between a CPU and a motherboard?',
        options: ['The color', 'The socket', 'The storage size', 'The brand of the case'],
        answer: 1,
        explain: 'A CPU physically fits only in a matching socket.',
      },
    ],
  },
  {
    id: 'power',
    title: 'Power supplies',
    track: 'Hardware',
    requires: ['computer-basics'],
    reward: 40,
    pages: [
      'The wall outlet provides AC (alternating current). Computer parts need low-voltage DC (direct current). The POWER SUPPLY UNIT (PSU) converts one into the other.',
      'Every part draws power, measured in WATTS (W). The CPU is usually the hungriest part.',
      'A PSU has a maximum capacity. If your parts together draw more than that, the system becomes unstable or will not turn on. Always add up the draw and keep some headroom.',
    ],
    quiz: [
      {
        question: 'What does the PSU do?',
        options: ['Stores files', 'Converts AC from the wall to DC for the parts', 'Cools the CPU', 'Connects to the internet'],
        answer: 1,
        explain: 'The PSU converts AC to the DC voltages components need.',
      },
      {
        question: 'Your parts draw 320 W. Which PSU is enough?',
        options: ['250 W', '300 W', '450 W', 'Any, watts do not matter'],
        answer: 2,
        explain: 'The PSU capacity must be above the total draw: 450 W > 320 W.',
      },
      {
        question: 'Power is measured in...',
        options: ['Hertz', 'Bytes', 'Watts', 'Bits per second'],
        answer: 2,
        explain: 'Watts measure power. Hertz is frequency, bytes are data.',
      },
    ],
  },
  {
    id: 'cpu',
    title: 'The CPU',
    track: 'Hardware',
    requires: ['computer-basics'],
    reward: 50,
    pages: [
      'The CPU (Central Processing Unit) executes program instructions: arithmetic, comparisons, moving data around.',
      'CLOCK SPEED, in gigahertz (GHz), is how many cycles per second a core runs. 3 GHz = 3 billion cycles per second.',
      'A CPU has one or more CORES. Each core can run its own stream of instructions, so more cores let the computer do more things in parallel.',
      'In this game your processing power is cores × GHz. More power = more time to think during intrusions.',
    ],
    quiz: [
      {
        question: 'What does the CPU do?',
        options: ['Keeps data when power is off', 'Executes program instructions', 'Supplies power', 'Displays images'],
        answer: 1,
        explain: 'The CPU executes instructions. Storage keeps data; the PSU supplies power.',
      },
      {
        question: 'What does "4 cores" mean?',
        options: ['It runs at 4 GHz', 'It can run 4 instruction streams in parallel', 'It has 4 GB of memory', 'It needs 4 power cables'],
        answer: 1,
        explain: 'Each core is an independent execution unit.',
      },
      {
        question: 'A 3.2 GHz clock means...',
        options: ['3.2 billion cycles per second', '3.2 million files', '3.2 gigabytes', '3.2 watts'],
        answer: 0,
        explain: 'Giga = billion, Hertz = cycles per second.',
      },
    ],
  },
  {
    id: 'memory',
    title: 'Memory (RAM)',
    track: 'Hardware',
    requires: ['computer-basics'],
    reward: 50,
    pages: [
      'RAM (Random Access Memory) is the CPU\'s workspace. Programs and the data they are using are loaded into RAM because it is far faster than disks.',
      'RAM is VOLATILE: when power is cut, its contents are lost. That is why you save files to storage.',
      'RAM comes in generations like DDR4 and DDR5. They are not interchangeable: a DDR5 stick will not fit a DDR4 slot.',
      'More RAM lets you keep more running at once. In this game, more RAM means more room for mistakes before your intrusion crashes.',
    ],
    quiz: [
      {
        question: 'What happens to RAM contents when the computer turns off?',
        options: ['They are kept forever', 'They are lost', 'They move to the CPU', 'They are sent to the router'],
        answer: 1,
        explain: 'RAM is volatile: no power, no data.',
      },
      {
        question: 'Why are programs loaded into RAM?',
        options: ['RAM is much faster than disks', 'RAM is cheaper than disks', 'Disks cannot store programs', 'The PSU requires it'],
        answer: 0,
        explain: 'The CPU would starve waiting on disks; RAM is much faster.',
      },
      {
        question: 'Can you install DDR5 RAM on a DDR4 motherboard?',
        options: ['Yes', 'No', 'Only with a bigger PSU', 'Only on Sundays'],
        answer: 1,
        explain: 'Memory generations are physically and electrically different.',
      },
    ],
  },
  {
    id: 'storage',
    title: 'Storage',
    track: 'Hardware',
    requires: ['computer-basics'],
    reward: 50,
    pages: [
      'STORAGE keeps data when the power is off: the operating system, programs and your files live here.',
      'HDDs (hard disk drives) store data magnetically on spinning platters. Cheap and large, but slow and mechanical.',
      'SSDs (solid-state drives) use flash memory with no moving parts. SATA SSDs are ~4× faster than HDDs; NVMe SSDs talk directly over PCIe and are much faster still.',
      'Capacity is measured in gigabytes (GB) and terabytes (TB). 1 TB = 1000 GB.',
    ],
    quiz: [
      {
        question: 'Which one keeps data without power?',
        options: ['RAM', 'CPU cache', 'SSD', 'None of them'],
        answer: 2,
        explain: 'SSDs and HDDs are non-volatile storage.',
      },
      {
        question: 'Which is the fastest?',
        options: ['HDD', 'SATA SSD', 'NVMe SSD', 'They are all equal'],
        answer: 2,
        explain: 'NVMe uses the PCIe bus directly and is the fastest of the three.',
      },
      {
        question: 'Why is an HDD slower than an SSD?',
        options: ['It has moving mechanical parts', 'It uses more RAM', 'It is always smaller', 'It needs the internet'],
        answer: 0,
        explain: 'A physical head must move over spinning platters to find data.',
      },
    ],
  },
  {
    id: 'binary',
    title: 'Bits and bytes',
    track: 'Hardware',
    requires: ['computer-basics'],
    reward: 60,
    pages: [
      'Computers store everything as BITS: 0 or 1, off or on. A group of 8 bits is a BYTE.',
      'Binary is base 2. Each position is worth double the one to its right: 128 64 32 16 8 4 2 1.',
      'To read 00001011: 8 + 2 + 1 = 11. To write 6: 4 + 2 → 00000110.',
      'With n bits you can represent 2ⁿ different values. One byte: 2⁸ = 256 values (0–255). Remember that number — it shows up in IP addresses!',
    ],
    quiz: [
      {
        question: 'How many bits are in a byte?',
        options: ['2', '4', '8', '10'],
        answer: 2,
        explain: '1 byte = 8 bits.',
      },
      {
        question: 'What is 101 (binary) in decimal?',
        options: ['3', '5', '6', '101'],
        answer: 1,
        explain: '4 + 0 + 1 = 5.',
      },
      {
        question: 'What is the largest value one byte can hold?',
        options: ['128', '255', '256', '1024'],
        answer: 1,
        explain: '8 bits give 256 values, from 0 to 255.',
      },
    ],
  },

  // ─── Networking ─────────────────────────────────────────────────────────
  {
    id: 'network-basics',
    title: 'Networks 101',
    track: 'Networking',
    requires: ['cpu', 'memory', 'storage', 'power'],
    reward: 60,
    pages: [
      'A NETWORK is a set of devices that can exchange data. A LAN (Local Area Network) is your home or office; a WAN (Wide Area Network) spans cities — the Internet is the biggest one.',
      'A NIC (Network Interface Card) connects a computer to a network. Each NIC has a unique hardware address, the MAC address.',
      'A ROUTER forwards traffic between networks. Your home router joins your LAN to your ISP (Internet Service Provider), which leads to the rest of the Internet.',
      'Bandwidth is measured in bits per second (Mbps, Gbps). A path is only as fast as its slowest link.',
    ],
    quiz: [
      {
        question: 'Which device lets a computer connect to a network?',
        options: ['PSU', 'NIC', 'GPU', 'SSD'],
        answer: 1,
        explain: 'The Network Interface Card.',
      },
      {
        question: 'What does a router do?',
        options: ['Stores web pages', 'Forwards traffic between networks', 'Powers the computer', 'Translates binary into text'],
        answer: 1,
        explain: 'Routers connect networks together, such as your LAN and your ISP.',
      },
      {
        question: 'Your NIC is 1 Gbps and your router is 100 Mbps. Link speed?',
        options: ['1 Gbps', '1.1 Gbps', '100 Mbps', '550 Mbps'],
        answer: 2,
        explain: 'A link runs at the speed of its slowest end.',
      },
    ],
  },
  {
    id: 'ip-addressing',
    title: 'IP addresses & subnets',
    track: 'Networking',
    requires: ['network-basics', 'binary'],
    reward: 80,
    pages: [
      'Every device on an IP network needs an IP ADDRESS. IPv4 addresses are 4 bytes written in decimal: 192.168.0.42. Each part (octet) is 0–255.',
      'The SUBNET MASK says which part of the address is the NETWORK and which part is the HOST. 255.255.255.0 (/24) means the first 3 octets are the network.',
      'Two devices can talk directly only if they are in the same network: with /24, 192.168.0.42 and 192.168.0.7 are neighbors, but 192.168.1.7 is not.',
      'In each subnet, the first address is the NETWORK address (192.168.0.0) and the last is BROADCAST (192.168.0.255). Neither can be given to a host, and no two hosts may share an IP.',
      'To reach other networks, a host sends traffic to its DEFAULT GATEWAY: the router\'s address on the local network.',
    ],
    quiz: [
      {
        question: 'Which is a valid IPv4 address?',
        options: ['192.168.0.300', '10.0.0.5', '192.168.0', 'a.b.c.d'],
        answer: 1,
        explain: 'Four octets, each 0–255.',
      },
      {
        question: 'With mask 255.255.255.0, which is on the same network as 192.168.0.42?',
        options: ['192.168.1.42', '192.168.0.200', '10.0.0.42', '192.169.0.42'],
        answer: 1,
        explain: 'The first three octets (192.168.0) must match.',
      },
      {
        question: 'What is the default gateway?',
        options: ['The DNS server', 'The router address used to reach other networks', 'The broadcast address', 'Your own IP'],
        answer: 1,
        explain: 'Traffic for other networks goes to the gateway (router).',
      },
      {
        question: 'Can a host use 192.168.0.255 on a /24 network?',
        options: ['Yes', 'No, it is the broadcast address'],
        answer: 1,
        explain: 'The last address of a subnet is reserved for broadcast.',
      },
    ],
  },
  {
    id: 'dns',
    title: 'DNS',
    track: 'Networking',
    requires: ['ip-addressing'],
    reward: 80,
    pages: [
      'Humans remember names like example.com; networks route by IP address. DNS (Domain Name System) translates names into addresses.',
      'Your computer asks a DNS RESOLVER, configured in its network settings. Often this is your router (which forwards the question) or a server from your ISP.',
      'DNS stores RECORDS. A → IPv4 address. AAAA → IPv6 address. CNAME → alias to another name. MX → mail server for the domain. NS → the name servers responsible for the domain. TXT → free text (often used for verification).',
      'Without a DNS server you can still reach machines by IP — but good luck remembering them all.',
    ],
    quiz: [
      {
        question: 'What does DNS do?',
        options: ['Encrypts traffic', 'Translates domain names to IP addresses', 'Assigns MAC addresses', 'Speeds up the CPU'],
        answer: 1,
        explain: 'DNS resolves names to addresses.',
      },
      {
        question: 'Which record holds the IPv4 address of a name?',
        options: ['MX', 'A', 'CNAME', 'TXT'],
        answer: 1,
        explain: 'A records map a name to an IPv4 address.',
      },
      {
        question: 'Which record says where to deliver email for a domain?',
        options: ['AAAA', 'NS', 'MX', 'A'],
        answer: 2,
        explain: 'MX = Mail eXchanger.',
      },
    ],
  },

  // ─── Field knowledge (needed for specific targets on the network) ─────
  {
    id: 'ports',
    title: 'Ports & firewalls',
    track: 'Field Knowledge',
    requires: ['dns'],
    reward: 100,
    pages: [
      'An IP address finds the machine; a PORT (0–65535) finds the program on that machine. A web server listens on port 80 (HTTP) or 443 (HTTPS).',
      'Common ports: 22 SSH, 25 SMTP (mail), 53 DNS, 80 HTTP, 443 HTTPS, 3306 MySQL, 3389 Remote Desktop.',
      'TCP is connection-oriented and reliable: it guarantees order and delivery (web, SSH, email). UDP is connectionless and fast but may lose packets (DNS queries, games, video calls).',
      'A FIREWALL filters traffic by rules like "allow TCP 443 from anywhere, deny everything else". Knowing ports is how you read — and slip past — those rules.',
    ],
    quiz: [
      {
        question: 'Which port does SSH use by default?',
        options: ['21', '22', '80', '443'],
        answer: 1,
        explain: 'SSH listens on 22.',
      },
      {
        question: 'Which protocol guarantees ordered delivery?',
        options: ['UDP', 'TCP', 'Both', 'Neither'],
        answer: 1,
        explain: 'TCP retransmits lost packets and keeps order; UDP does not.',
      },
      {
        question: 'What is the job of a firewall?',
        options: ['Speed up the network', 'Filter traffic using rules', 'Resolve domain names', 'Assign IPs'],
        answer: 1,
        explain: 'Firewalls allow or block traffic based on rules.',
      },
    ],
  },
  {
    id: 'http',
    title: 'The Web (HTTP)',
    track: 'Field Knowledge',
    requires: ['dns'],
    reward: 100,
    pages: [
      'The Web runs on HTTP: a client (browser) sends a REQUEST, the server sends back a RESPONSE.',
      'Requests have a METHOD: GET reads a resource, POST submits data, PUT replaces, DELETE removes.',
      'Responses carry a STATUS CODE. 2xx success (200 OK, 201 Created). 3xx redirection (301 Moved Permanently). 4xx client error (400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found). 5xx server error (500 Internal Server Error, 503 Service Unavailable).',
      'HTTPS is HTTP inside an encrypted TLS tunnel, on port 443.',
    ],
    quiz: [
      {
        question: 'Which method is used to read a page?',
        options: ['GET', 'POST', 'DELETE', 'PUT'],
        answer: 0,
        explain: 'GET retrieves a resource without changing it.',
      },
      {
        question: 'What does 404 mean?',
        options: ['Server crashed', 'Not Found', 'Success', 'Redirect'],
        answer: 1,
        explain: '404 Not Found: the resource does not exist.',
      },
      {
        question: 'A 5xx code means the problem is...',
        options: ['On the client', 'On the server', 'In the DNS', 'In the cable'],
        answer: 1,
        explain: '5xx are server errors; 4xx are client errors.',
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
