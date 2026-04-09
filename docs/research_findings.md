# Game Design Research Findings

_Research conducted for "What If" — an LLM-powered text RPG with real-time multiplayer_

---

## Table of Contents

1. [Spatial Systems & Positioning in Text RPGs](#1-spatial-systems--positioning-in-text-rpgs)
2. [Cover, Terrain & Distance Mechanics](#2-cover-terrain--distance-mechanics)
3. [Multi-Island Map Design](#3-multi-island-map-design)
4. [LLM Game Design Patterns](#4-llm-game-design-patterns)
5. [Multiplayer PvP in Narrative Games](#5-multiplayer-pvp-in-narrative-games)
6. [Singleplayer Progression & Bot Design](#6-singleplayer-progression--bot-design)
7. [Synthesis: Recommendations for "What If"](#7-synthesis-recommendations-for-what-if)

---

## 1. Spatial Systems & Positioning in Text RPGs

### MUD Room-Based Navigation
_Source: [Wikipedia — Multi-user dungeon](https://en.wikipedia.org/wiki/Multi-user_dungeon)_

Traditional MUDs use **room-based navigation** — the world is a graph of discrete rooms connected by exits. Players type directional commands (`north`, `south`, `enter cave`) to move between rooms.

**Key design facts:**
- Each room has a text description listing objects, players, NPCs, and available exits
- Rooms describe a "scene" rather than precise coordinates — spatial relationships are narrative
- "Due to the room-based nature \[of MUDs\], ranged combat is typically difficult to implement" — rooms collapse all occupants into the same logical space
- The MUD "mudlib" defines physics including "mass/weight, timers, movement and communication... magic and combat mechanisms"
- Movement between rooms is the primary spatial mechanic; within a room, all entities are co-located

**Implications for "What If":**
The current 60x60 grid system is over-engineered for a text game. MUDs demonstrate that text games work best with **discrete locations** (rooms/zones) rather than coordinate grids. Players should move _between_ zones, not _within_ them.

### Fate RPG: Abstract Positioning with Aspects
_Source: [Wikipedia — Fate (role-playing game system)](https://en.wikipedia.org/wiki/Fate_(role-playing_game_system))_

Fate uses **free-form descriptors called "aspects"** rather than grid-based positioning. Key mechanics:

- **Aspects** are narrative tags on characters or scenes (e.g., "Behind Heavy Cover", "High Ground", "Cornered in an Alley")
- A relevant aspect can be **invoked** for a +2 bonus or re-roll (costs a fate point)
- Aspects can be **compelled** against a character (e.g., "Flanked" forces disadvantage)
- The **"create advantage" action** lets players establish new situational aspects using relevant skills
- Skills perform one of four actions: **attacking, defending, overcoming obstacles, or creating an advantage**
- Fate Accelerated replaces skills with six "approaches": Careful, Clever, Flashy, Forceful, Quick, Sneaky

**Implications for "What If":**
The Fate aspect system maps directly to how an LLM battle judge could handle positioning. Instead of tracking x/y coordinates, the AI could track **narrative tags** like "behind cover", "at range", "flanking" — applying bonuses/penalties based on these descriptors. Players create advantages via creative text actions.

---

## 2. Cover, Terrain & Distance Mechanics

### Sly Flourish: Narrative "Theater of the Mind" Combat
_Source: [Sly Flourish — Guide to Narrative Combat in D&D](https://slyflourish.com/guide_to_narrative_combat.html)_

This is the single most relevant source for "What If" combat design. Sly Flourish describes how to run D&D combat without a grid — using only narrative description and DM adjudication.

**Core principle: Intent-based resolution**
> "The DM describes the situation, the player describes what they want to do, the DM adjudicates the result."

**Movement abstraction:**
- Characters can reach most targets in **1-2 moves** — no precise counting
- Fast characters (monks, rogues) get a bonus move, letting them reach farther targets
- **Melee** = within 5 feet, risking opportunity attacks
- **Ranged** = most attacks hit unless targets are "really far away"
- The DM decides what's "nearby" vs "far" based on narrative context

**Area-of-Effect creature counts:**
| Area Size | Creatures Hit |
|-----------|--------------|
| Tiny (5ft) | 1 |
| Small (10-15ft) | 2 |
| Large (20ft) | 4 |
| Huge (20ft+) | Everyone |

**Cover and line of sight:**
- Cover is a **DM-described feature** of the environment, not a geometric calculation
- "If a creature is behind a pillar, they have cover" — no ray-casting needed
- The DM can use **random target selection** for fairness when multiple valid targets exist

**Key takeaway for "What If":**
The AI battle judge should work like a narrative DM: describe the environment, let players state intent, then adjudicate outcomes based on contextual logic rather than coordinate math.

### XCOM: Enemy Unknown — Tactical Cover System
_Source: [Wikipedia — XCOM: Enemy Unknown](https://en.wikipedia.org/wiki/XCOM:_Enemy_Unknown)_

XCOM's cover system provides a reference model for how cover could be abstracted in text:

**Cover mechanics:**
- **Two cover levels:** Full cover (block icon) vs. Half cover (shield icon)
- **Flanking:** Attacking from a position where the target's cover doesn't apply — the game warns players with a flanking indicator
- **Cover destruction:** Explosives and missed shots can destroy cover objects, dynamically changing the battlefield
- **Height advantage:** Being elevated affects both offense and defense
- **Overwatch:** Units can delay their turn to fire at enemies that move — creates a "hold position" tactical option

**Class-based range roles (4 classes):**
- **Assault** — close range, run-and-gun
- **Support** — mid-range healing/buffing
- **Heavy** — area damage, cover destruction
- **Sniper** — extreme range, high damage, position-dependent

**Design principles:**
- Squad size of 6 creates "meaningful decisions" — each move matters
- Permanent death makes positioning decisions consequential
- Missions target ~20 minutes — keeps engagement high
- "Fog of war" creates information asymmetry — you don't know what's beyond your sight

### The Fundamental Pillars of a Combat System
_Source: [gamedeveloper.com — Sébastien Lambottin, 2012](https://www.gamedeveloper.com/design/the-fundamental-pillars-of-a-combat-system)_

This article identifies **distance evaluation** as one of three core combat challenges:

**Three core challenges of combat:**
1. **Evaluate distance** — Understanding spatial relationships to enemies
2. **Evaluate time** — Reading enemy animations/tells for timing
3. **Cleverness/anticipation** — Predicting enemy behavior and adapting

**Enemy archetypes defined by range:**
- **Shield enemies** — Must be flanked or broken through (close range challenge)
- **Heavy enemies** — Slow but powerful, punish staying close too long
- **Sniper enemies** — Punish standing still at range, force movement
- **Bomber enemies** — Area denial, force repositioning

**Key insight:**
> "The fundamental purpose of a combat system is to present the player with a series of challenges that test their ability to evaluate distance, time, and anticipate enemy behavior."

**Implications for "What If":**
Distance doesn't need to be measured in grid squares — it needs to be a meaningful _decision_. The question is "am I close enough to strike?" or "can I get to cover before the sniper fires?" not "am I at coordinate (34, 22)."

---

## 3. Multi-Island Map Design

### The Legend of Zelda: The Wind Waker
_Source: [Wikipedia — The Wind Waker](https://en.wikipedia.org/wiki/The_Legend_of_Zelda:_The_Wind_Waker)_

Wind Waker's Great Sea is the canonical example of island-archipelago world design:

**World structure:**
- The Great Sea is divided into **49 gridded sections**, each containing an island or island chain
- Players **sail between islands** using wind direction mechanics (8 compass directions)
- A **sea chart** is progressively updated with information on each square and island
- Additional charts point to treasure and significant locations
- Exploration is **item-gated** — certain islands require specific items (e.g., grappling hook) to fully explore

**Progression design:**
- Each major island has a **dungeon** with maps, puzzles, and boss battles
- Sidequests (like the Picto Box camera quests) reward exploration between main story beats
- A second player could assist via the **Tingle Tuner** (GBA connection) — an early form of asymmetric co-op

**Critical design lesson — sailing tedium:**
> "The heavy emphasis on sailing was the game's most common criticism."

Players found sailing between distant islands **tedious**, especially when wind direction changes were required. The HD remake mitigated this with a "Swift Sail" item for faster, wind-independent sailing.

**Implications for "What If":**
The Shattered Isles' 8 islands already follow this pattern. Key lessons:
- **Fast travel is essential** — don't make players "sail" through empty transitions
- Each island should have **distinct identity and gameplay purpose**
- A map/chart system that reveals information progressively keeps exploration rewarding
- Item-gating creates natural progression without artificial level locks

---

## 4. LLM Game Design Patterns

### AI Dungeon: Memory System Architecture
_Source: [Latitude.io — How the New Memory System Works (May 2024)](https://latitude.io/news/how-the-new-memory-system-works)_

This is the most directly relevant source for "What If." AI Dungeon uses a **dual memory architecture** inspired by how human brains work:

**The core problem:**
> "The core promise of AI Dungeon is that you can have ultimate freedom... if the AI forgets those choices after a few thousand tokens, those choices become meaningless."

**Dual approach: Compression + Retrieval**

#### 1. Auto Summarization (Memory Compression)
- Maintains a running **"Story Summary"** plot component
- Every 4 player actions, the AI generates a **new memory summary** of what happened
- New memories are appended to the Story Summary
- When the summary gets long enough, it's **re-summarized** (compressed) into a shorter version
- This creates a progressively compressed narrative history

#### 2. Memory Bank (Embedding-based Retrieval)
- Individual memories are stored with **embedding vectors**
- When generating a response, the system computes **cosine similarity** between the current story context and all stored memories
- The most relevant memories are **inserted into the AI context window**
- An allocated portion of the context window is reserved for retrieved memories
- **Least-used memories are forgotten over time** — mimics natural memory decay
- Duplicate-text checks prevent the same content from appearing multiple times in context

**Context tiers:**
| Tier | Context Window |
|------|---------------|
| Free | 2,000 tokens |
| Premium | Varies |
| Mythic | 32,000 tokens |

**Origin:**
The memory system was originally built for **Voyage** — a more traditional RPG with stats, quests, inventory, levels, and structured game state. It was later adapted for AI Dungeon's open-ended collaborative storytelling.

### AI Dungeon: Provider/Model Agnostic Architecture
_Source: [Latitude.io — How We Gave Players 2x Context (April 2024)](https://latitude.io/news/how-we-gave-players-2x-context-on-ai-dungeon)_

Latitude's architecture philosophy offers key lessons for any LLM-powered game:

**Provider agnostic:**
- Can switch AI providers at any time with minimal effort
- Hosted Mixtral on 3 different providers as a hedge
- "If one provider has issues, we can quickly move to another"

**Model agnostic:**
- Database-driven model management — quickly add/evaluate new models without code changes
- Deliberately **not building custom models** — leverage commercial and open-source models
- This avoids vendor lock-in and allows riding the capability curve of frontier models

**Evaluation process:**
- **Qualitative playtesting** — staff and alpha testers play extensively
- **Quantitative benchmarks** — automated quality metrics
- Check for: storytelling ability, instruction following, creativity, coherence, moralizing
- Google models failed evaluation due to "heavy moralizing and below-average storytelling abilities"
- Mixtral was found to be better quality at lower cost than their previous "Dragon" model

**Key insights:**
- Volume-based pricing negotiation is critical at scale
- Pass cost savings to users (Costco-inspired model)
- Free tier with unlimited AI builds a sustainable user base

### Generative Agents: Simulating Believable Human Behavior
_Source: [Park et al., 2023 — arXiv:2304.03442](https://arxiv.org/abs/2304.03442)_

Stanford/Google research paper on LLM-powered agents in a sandbox simulation:

- 25 generative agents populated a sandbox environment
- Each agent has an **observation → planning → reflection** architecture
- Agents **observe** their environment, **plan** daily activities, and **reflect** on experiences to form higher-level insights
- Emergent behaviors: agents spread information, formed relationships, coordinated activities (e.g., organizing a Valentine's Day party without being told to)
- Key finding: the **reflection** step (periodically synthesizing observations into insights) is critical for coherent long-term behavior

**Implications for "What If":**
Bot characters could use a simplified version of this architecture — observe battle state, plan actions based on personality, reflect on what's working/failing.

---

## 5. Multiplayer PvP in Narrative Games

### MUD PvP Systems
_Source: [Wikipedia — Multi-user dungeon](https://en.wikipedia.org/wiki/Multi-user_dungeon)_

MUDs were the original text-based multiplayer games, and several developed sophisticated PvP:

- **Avalon: The Legend Lives** introduced skill-based PvP with cooldowns — considered a pioneer
- Many MUDs allow PvP in designated areas or with consent flags
- The MUD mudlib controls combat resolution, determining hit/miss/damage
- Room-based PvP means all combatants share the same space — no kiting or positioning in the traditional sense
- Some MUDs implemented flee/chase mechanics — if you leave a room during combat, the opponent can follow

**Challenge for text PvP:**
Since rooms are discrete, the "distance" problem collapses. Everyone in the same room can hit each other. This is why MUDs struggled with ranged combat — there's no meaningful "between" space.

**XCOM-inspired PvP principles** (adapted from singleplayer):
- **Information asymmetry** (fog of war) creates tension in PvP
- **Permanent consequences** make positioning decisions matter
- **Class diversity** ensures asymmetric but balanced matchups
- **Turn-based structure** allows thoughtful decision-making over twitch reflexes

---

## 6. Singleplayer Progression & Bot Design

### Hades: The Gold Standard for Roguelike Meta-Progression
_Source: [Wikipedia — Hades (video game)](https://en.wikipedia.org/wiki/Hades_(video_game))_

Hades demonstrates how to make repeated runs feel meaningful through layered progression:

**Within-run progression (resets on death):**
- Olympian **Boons** — persistent power-ups themed by god (Zeus = lightning, Poseidon = knockback)
- Choice of 3 boons per offering — strategic deck-building within a run
- Room rewards: health recovery, currency, new boons
- Weapon choice before each run (6 weapons, each with aspects)

**Between-run meta-progression (permanent):**
- **Permanent ability upgrades** using special currency
- **Weapon unlocks and upgrades** that persist across deaths
- **Construction of new Underworld features** that appear in future runs
- **NPC relationship progression** — dialogs advance with each run, providing narrative rewards
- **Quests** from NPCs that span multiple runs

**Difficulty scaling:**
- The **Pact of Punishment** (unlocked after first clear) lets players manually add challenges:
  - Increase enemy attack power/health/numbers
  - Change boss fights (e.g., Theseus gets a machine-gun chariot)
  - Add extra boss phases
- Increasing difficulty yields rare rewards, decorative items, and NPC subplot progression
- **20 "Heat" levels** of escalating difficulty

**Accessibility:**
- **God Mode** — player gets stronger after each failed run (incremental damage resistance)
- Allows struggling players to experience the full story
- Not a binary toggle — gradual assist that preserves challenge

**Narrative integration with roguelike loop:**
- Death is canonical — Zagreus returns to the House of Hades via the River Styx
- Each return unlocks new dialog with ~10 hours of written dialog
- NPCs react to what happened during the run (e.g., meeting Eurydice triggers Orpheus asking about her)
- Branching narrative works because roguelike structure ensures multiple playthroughs

### Slay the Spire: Roguelike Deck-Building Progression
_Source: [Wikipedia — Slay the Spire](https://en.wikipedia.org/wiki/Slay_the_Spire)_

Slay the Spire is relevant for its meta-progression and difficulty scaling patterns:

**Progression systems:**
- **In-run:** Build a deck from ~75 available cards per character; collect relics (permanent buffs) and potions (consumables)
- **Between runs:** Completed/failed runs contribute points toward unlocking new characters, cards, and relics
- **Ascension:** 20 difficulty levels unlocked with each successful completion — each adds a cumulative negative effect (lower health, stronger enemies)
- **Daily challenge mode:** Fixed random seed so all players face the same run — competitive leaderboard

**Enemy intent telegraphing:**
- Enemies show their **next intended action** via icons (attack, block, buff, debuff)
- Attack intents show **exact damage numbers** — allows perfect-information strategic play
- Originally hidden but playtesters found visible intents more engaging
- This reduces randomness frustration — you lose because of your decisions, not because of hidden information

**Key design principle:**
> "Too many weak cards dilute the player's deck, and the player must strategically decide which cards to turn down." — Deck-thinning is as important as deck-building.

**Balancing approach:**
- Used gameplay metrics from thousands of players to identify overpowered/underpowered cards
- Cards never picked = too weak, cards in every winning deck = too strong
- Streamer feedback as indirect playtesting: "A streamer isn't going to be afraid to speak their minds"

### Implications for "What If" Bot Design

Drawing from Hades' NPC design and Generative Agents research:

- **Bot personality via prompt templates** — each bot character should have a distinct behavioral profile (aggressive, defensive, tactical, chaotic) defined in their character markdown files
- **Difficulty scaling via bot behavior** — easy bots act predictably with telegraphed moves; hard bots use strategic combos
- **Narrative bots** — bots should have personality that comes through in their action descriptions (already started with `bot_the_murderer.md` and `seraphina_the_lightbringer.md`)
- **Meta-progression gates** — unlock harder bot opponents as player skill increases (Pact of Punishment model)

---

## 7. Synthesis: Recommendations for "What If"

### Replace Grid Positioning with Zone-Based Narrative System

**Current problem:** 60x60 grid with x/y coordinates is meaningless in a text game. No movement within locations, only teleporting between connected locations.

**Proposed solution based on research:**
1. **Zones** (from MUD rooms + Fate zones): Each combat encounter has 3-5 narrative zones (e.g., "Behind the Stone Wall", "The Open Courtyard", "The Tower Balcony")
2. **Zone properties** (from XCOM): Each zone has properties like cover level, height, and environmental hazards
3. **Movement as action** (from Sly Flourish): Moving between zones costs an action or part of a turn — 1-2 moves to reach adjacent zones
4. **AI adjudication** (from Sly Flourish): The AI battle judge describes zones, interprets player intent, and adjudicates distance/cover based on narrative context

### Implement AI Memory for Persistent Worlds

**Based on AI Dungeon's Memory System:**
1. **Auto-summarize exploration events** every N actions
2. **Store memory embeddings** for retrieval during future encounters  
3. **Allocate context budget** wisely — use compression for old events, full detail for recent
4. **Progressive forgetting** — old, unused memories decay naturally

### Design Progression Around the Death/Retry Loop

**Inspired by Hades + Slay the Spire:**
1. **Within-match progression**: Boons/power-ups collected during battle that reset after
2. **Between-match meta-progression**: Permanent unlocks (new characters, abilities, bot opponents)
3. **Difficulty scaling**: Ascension-style system — each win unlocks harder modifiers
4. **Narrative progression through loss**: NPCs react to player history; losing unlocks new dialog/lore

### Keep Architecture Provider-Agnostic

**From Latitude.io's lessons:**
1. Don't hardcode to one LLM provider — abstract the AI interface
2. Database-driven model configuration — swap models without code changes
3. Evaluate qualitatively (play the game!) and quantitatively (metrics)
4. Watch for moralizing/censorship issues with different providers

---

## Source Index

| # | Source | URL | Domains Covered |
|---|--------|-----|----------------|
| 1 | Wikipedia: Multi-user dungeon | https://en.wikipedia.org/wiki/Multi-user_dungeon | Spatial, PvP |
| 2 | Sly Flourish: Narrative Combat | https://slyflourish.com/guide_to_narrative_combat.html | Cover, Distance |
| 3 | Wikipedia: XCOM Enemy Unknown | https://en.wikipedia.org/wiki/XCOM:_Enemy_Unknown | Cover, Terrain, Classes |
| 4 | Fundamental Pillars of Combat | https://www.gamedeveloper.com/design/the-fundamental-pillars-of-a-combat-system | Distance, Enemy Design |
| 5 | Wikipedia: Wind Waker | https://en.wikipedia.org/wiki/The_Legend_of_Zelda:_The_Wind_Waker | Island Map Design |
| 6 | Latitude.io: Memory System | https://latitude.io/news/how-the-new-memory-system-works | LLM Patterns |
| 7 | Latitude.io: 2x Context | https://latitude.io/news/how-we-gave-players-2x-context-on-ai-dungeon | LLM Architecture |
| 8 | Generative Agents Paper | https://arxiv.org/abs/2304.03442 | LLM Agent Design |
| 9 | Wikipedia: Fate RPG | https://en.wikipedia.org/wiki/Fate_(role-playing_game_system) | Abstract Positioning |
| 10 | Wikipedia: Hades | https://en.wikipedia.org/wiki/Hades_(video_game) | Roguelike Progression |
| 11 | Wikipedia: Slay the Spire | https://en.wikipedia.org/wiki/Slay_the_Spire | Meta-progression, Difficulty |
