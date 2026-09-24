# Rootkit Academy

An educational browser game that teaches IT basics. You start with an empty
computer case, learn what goes inside it, build and upgrade the machine,
connect it to a network, and then explore that network by passing knowledge
mini-games. It plays like a hacking/upgrade game, and each step makes you
learn a real concept.

Built with [Phaser 4](https://phaser.io), TypeScript and Vite.

## Running

```bash
npm install
npm run dev        # dev server with hot reload
npm test           # unit tests for game logic and content
npm run build      # typecheck + production build in dist/
```

Progress is saved automatically in the browser (localStorage).

## How the game works

The game has three phases. Each one needs knowledge from the one before it.

### 1. Build: computer basics

- The case starts empty. The **Study** screen has lessons on the motherboard,
  power, CPU, RAM, storage and binary. Each lesson ends with a short quiz, and
  passing it for the first time pays cash.
- The **Shop** sells a part only after you pass the lesson for it. You cannot
  buy RAM until you know what RAM is.
- On the **Workbench** you install and swap parts. The build is checked the way
  a real one would be:
  - the CPU **socket** has to match the motherboard
  - the **RAM generation** (DDR4/DDR5) has to match the motherboard
  - the parts together must not draw more **watts** than the PSU delivers
- Every problem is explained in plain words. For example: "Parts draw 332 W but
  the PSU only delivers 250 W."

### 2. Connect: networking basics

- After the PC boots, the networking lessons open (NIC, router, LAN/WAN,
  bandwidth, IPv4, subnet masks, gateway, DNS).
- You buy and install a **network card** and a **router**. Link speed is set by
  the slower of the two.
- **Network Setup**: the router's DHCP is "broken", so you configure the IP
  address, mask, gateway and DNS by hand, using a sticky note on the router.
  Wrong settings get a specific explanation, such as an IP conflict with the
  Smart TV, a broadcast address, an address outside the subnet, or a gateway
  that is not the router.

### 3. Explore: the Net Map

- Nodes on the network each belong to a **knowledge area**. To connect to a
  node you win that area's mini-game:

  | Area              | Mini-game |
  |-------------------|-----------|
  | Data & Binary     | flip bits to reach a number, binary↔decimal, 2ⁿ values |
  | IP Addressing     | same-subnet hosts, network/broadcast addresses, usable hosts |
  | DNS               | record types, resolving names from a small zone file (CNAME chains, MX) |
  | Web / HTTP        | status codes, status classes, HTTP methods |
  | Ports & Firewalls | well-known ports, reading firewall rules, TCP vs UDP |

- Nodes also need **hardware**: a minimum CPU power, RAM, storage or link speed.
  Hardware also changes how the mini-games play:
  - **CPU power** (cores × GHz) gives you more seconds per step.
  - **RAM** lets you make more mistakes before the intrusion crashes.
- Breaching a node pays cash and reveals the nodes linked to it. You spend the
  cash on better parts, which let you reach harder nodes. The goal is the
  **Data Center Core**, which needs a top-tier build: 16 cores, 64 GB, NVMe
  storage and 10 Gbps on both the NIC and the router.
- To avoid soft-locks: parts sell back for 50%, breached nodes can be replayed
  for 20% of the reward, and the hub has a **Side job** (a binary mini-game)
  that pays a little cash at any time.

Every wrong answer shows an explanation, so a failed attempt still teaches
something.

## Project layout

```
src/
  data/          content, meant to be edited by educators
    lessons.ts   lessons: pages + quiz, prerequisites, rewards
    parts.ts     hardware catalog: stats, prices, lesson gates
    nodes.ts     network map: nodes, links, requirements, mini-game per node
  core/          pure game logic, no Phaser, unit tested
    state.ts     game state + all rules (buy/install/progress/breach)
    hardware.ts  build validation and specs → gameplay effects
    ip.ts        IPv4 math + network-config validation
    minigames.ts question generators for each knowledge area
    random.ts    seeded RNG
    store.ts     shared state + localStorage persistence
  scenes/        Phaser scenes (UI only)
  ui/widgets.ts  buttons, panels, header, toasts
tests/           Vitest tests for core logic and content integrity
```

## Adding content

- **A lesson:** add an entry to `LESSONS` in `src/data/lessons.ts`. Other
  content points to it by id.
- **A part:** add it to `PARTS` in `src/data/parts.ts`, with `requiresLesson`
  set to the lesson that teaches it.
- **A node:** add it to `NODES` in `src/data/nodes.ts`. Links must go both ways,
  and a test enforces this.
- **A knowledge area / mini-game:** add an id to `MinigameId` in `nodes.ts`, then
  write a generator in `src/core/minigames.ts` that returns `choice` or `bits`
  rounds. The scene renders it with no other changes needed.

`npm test` checks that every referenced lesson exists, that every quiz answer
is valid, and that every mini-game generates well-formed rounds at every
difficulty.

## Ideas for next steps

- Portuguese translation (all text is in the `data/` files and the scenes)
- More areas: Linux shell commands, SQL, cryptography/hashing, OSI layers
- A terminal-style mini-game where the player types commands
- Pixel-art sprites for parts and an animated case interior
- Teacher mode: export which concepts a student got wrong most often
