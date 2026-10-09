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
A generated network the player can explore after winning the campaign and passing the routing lesson: a tree of subnets joined by routers that forms a correct IPv4 address plan, with one core machine at its deepest level.
*Avoid:* procedural map, random city

A city is never saved whole: its level and seed rebuild it identically, so the save keeps only the player's progress in it, apart from the campaign map. Only the player's own subnet is visible at first; each further subnet appears once the player breaches the router that leads to it and writes a correct Route entry. Breaching the core finishes the city, and each finished city raises the level of the next new one, up to a cap. A City code lets another player rebuild the same city.

### City code
The short code that names a City by its level and seed, so anyone who can open cities can rebuild exactly that city, while the mini-game questions stay random for each player.

### Route entry
What the player writes to open the subnet behind a breached router in a City: the destination network with its prefix, and the next hop, which is that router's address on the network the player's own machine already reaches.

A wrong Route entry names the specific mistake without revealing the right value and can be retried with no cost. Each field is judged on its own against the correct route, so a single wrong field produces a single error.


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

Each area has its own maximum, set by how far its content can get harder; only areas whose lesson the student has completed appear on the side-job board.
