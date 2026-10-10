# Concepts

> Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Game text

### Glossary
The single agreed list of the words the game uses for each IT concept, with each word's grammatical gender, which every piece of player-facing Portuguese text must follow.
*Avoid:* term list, dicionário

The glossary decides wording, not phrasing: a sentence that uses only glossary terms can still be a Calque. A concept the game has not named yet gets an entry here before it appears in text.

### Kept term
An IT word the game deliberately leaves in English because Brazilian technicians say it in English (for example switch, firewall, boot, AC and DC); protocol acronyms such as DNS and TCP stay as-is too.
*Avoid:* untranslated word

A Kept term is a choice recorded in the Glossary, not an omission; any other English word in player text is a defect. The reverse is a defect too: replacing a word the field says in English with a Portuguese coinage or dictionary translation that Brazilian technicians do not use. When in doubt, the word technicians actually say wins. Uppercase protocol notation (HTTP methods, firewall rule keywords, status phrases such as "404 Not Found") is accepted only in that exact notation form.

### Calque
Portuguese text that copies the structure, idioms or word choices of an English source instead of saying the idea the way a native speaker would, so it is grammatical yet unnatural or meaningless.

Calques are not detectable by automated checks, because every word is Portuguese; only a native reader catches them.

## Network

### Security lab
The framing of the whole network map as an isolated training network the school runs, where every machine except the player's own computer is simulated, so breaching them is a lab exercise and not a crime.
*Avoid:* cyber range (in player text)

The game requires the law-and-ethics lesson before the first breach of any node, and that lesson draws the line between the lab and real systems. Player text calls it "laboratório de segurança", and node details mark every target as simulated.

### Swarm
The set of breached network nodes currently connected to the player's network, whose processing, memory and storage add to the player's own computer.
*Avoid:* enxame

A node joins the Swarm only by occupying a free port on the player's router, on a switch in the NOC, or on another connected node that has ports, and it counts only while the player's own computer is online. How much processing and memory the Swarm adds is limited by the Swarm's bandwidth, the traffic its nodes' links can carry through the uplinks they connect to; storage is not. Breaching a node and connecting it are separate: a breached node with no free port waits disconnected. The word is a Kept term.

### City
A generated network the player can explore after winning the campaign and passing the routing lesson: a tree of subnets joined by routers that forms a correct address plan, with one core machine at its deepest level.
*Avoid:* procedural map, random city

A city is never saved whole: its level and seed rebuild it identically, so the save keeps only the player's progress in it, apart from the campaign map. Only the player's own subnet is visible at first; each further subnet appears once the player breaches the router that leads to it and writes the correct entry for that router: a Route entry, or the entry its City type asks for. Breaching the core finishes the city, and each finished city raises the level of the next new one, up to a cap. A machine's difficulty rises with the city level and its depth, up to its area's maximum, and the machine opens only once the student's Area level in that area reaches it; a city is where a student repeats levels they already reached. A City code lets another player rebuild the same city.

### City code
The short code that names a City by its level and seed, so anyone who can open cities can rebuild exactly that city, while the mini-game questions stay random for each player.

### City type
The kind of a City, fixed when it is created: a plain City practises IPv4 routes, and each Pós-graduação tier unlocks one more type whose routers ask for that tier's topic, a port forward for NAT, a VLAN and port mode for VLAN, or a route for IPv6.

A typed City has the same tree a plain City of its level and seed would have and changes only its addresses or labels. Its City code names the type, and a code for a type the player has not unlocked opens nothing. A typed City's mini-game rounds draw on its own networks, with addresses that vary from round to round inside them.

### Route entry
What the player writes to open the subnet behind a breached router in a City: the destination network with its prefix, and the next hop, which is that router's address on the network the player's own machine already reaches.

A wrong Route entry names the specific mistake without revealing the right value and can be retried with no cost. Each field is judged on its own against the correct route, so a single wrong field produces a single error.


## Graduation

### Formatura
The one-time ceremony that follows the first breach of the campaign's final machine: the player types the name for their certificates and receives the conclusão Certificate, which presents finishing the campaign as finishing the course.

### Certificate
A record of what the player had achieved when they earned it: their name, the lessons completed, and per area their accuracy, learned and weak Concepts, and Area level.

A Certificate keeps the numbers it was earned with; reopened later, it shows the current numbers beside them. It is created at the qualifying breach and shown later by its ceremony, so closing the game mid-ceremony resumes it.

### Pós-graduação tier
One of three optional steps after the Formatura, in fixed order, each pairing two lessons with a City type and a mini-game area; finishing the first City of that type earns the tier's Certificate, and the next tier opens once that Certificate is presented.
*Avoid:* level (for a tier), pós-graduação level

Only the next step is ever shown: a tier's lessons appear once the tier opens, and its City type once those lessons are passed.

### Conquista
A Steam-style achievement: an optional badge for a story milestone, skill challenge, long-term counter or secret oddity, which the player collects alongside the campaign but never needs for it.

A Conquista gives no gameplay reward, and the game's goal stays the Certificates. Conquistas live apart from the game save, so a reset can keep them, and their counters keep growing across resets. Once unlocked, a Conquista stays unlocked until the player chooses to erase the Conquistas. The player sees a locked Conquista only while it is reachable with what the game has already opened to them, never a locked secret one, and of a tiered counter only the next tier.
*Avoid:* troféu, medalha, achievement (in player text)

## Interface

### Introduction
The moment a newly available part of the interface first appears to the player: it arrives alone, pulses until first used, gets a line in the message log, and the first time its screen opens, a short card explains its controls.

Nothing is drawn before it is available, and never drawn disabled. When several things become available together, they are introduced one at a time. Something the player cannot or should not press, such as the money counter or the reset button, counts as introduced once it has been seen for a moment. Using a newly introduced part from anywhere completes its introduction, not only from the desk. A save from before introductions existed counts its reached interface as already introduced.

## Mini-games

### Concept
One idea a mini-game round can test, such as converting binary to decimal or finding a broadcast address; every round belongs to exactly one, and the game remembers misses per Concept rather than per area or per fact.

A missed Concept becomes weak. It counts as learned again only after the student answers it correctly in two separate later mini-games, and a new miss before then starts the count over. Weak Concepts are what the side-job board offers as review jobs.

### Lens
One of the three angles every Concept is explained from after a round: step by step, an analogy, or a real-world case, each filled in with the numbers of the round the student just played.
*Avoid:* explanation style, learning style

On a repeat miss the game shows a Lens the student has not yet seen for that Concept, starting with the Lens that has most often been showing when this student learned a Concept again. Favoring only changes the order; every Lens still comes up for every Concept, so no student is labeled as one kind of learner.

### Area level
The difficulty a student has reached in one knowledge area of the mini-games, which sets the level of that area's fresh side jobs and goes up when a fresh job at that level is finished with at most one mistake.
*Avoid:* side-job level, difficulty (for a student's progress)

Each area has its own maximum, set by how far its content can get harder; only areas whose lesson the student has completed appear on the side-job board. A City machine of a higher difficulty than the student's Area level stays locked.
