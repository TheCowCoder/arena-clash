# What If — Implementation Plan

_Based on research findings and design decisions from MC questions._

---

## Phase 1: Zone-Based Combat System

### 1A. Battle Arena Zone Generation
**Decision:** AI dynamically decides zone count based on location context.

- Modify the battle judge prompt (`prompts/battle_judge.txt`) to include zone generation as a first-turn responsibility
- On battle start, the AI generates a **battlefield layout** as part of its first response:
  - Named zones (e.g., "Rocky Outcrop", "Open Courtyard", "Tower Balcony")
  - Zone count varies by location: jungle = 5-6 dense zones, beach = 3 open zones, ruins = 4-5 mixed
  - Each zone has terrain features described narratively (e.g., "a crumbling stone wall provides partial cover")
  - Zone adjacency (which zones connect to which)
- Server stores the zone layout in `room.battleMap.zones` as structured data
- The AI returns zone data as a tool call or structured JSON embedded in narrative

### 1B. Player Positioning in Zones
**Decision:** Free movement within a turn, limited by stamina.

- Each player has a `currentZone` field in `BattleMapPlayerState`
- Players can move between adjacent zones freely as part of their text action
- Existing stamina system governs how far players can move in one turn:
  - Each zone transition costs stamina
  - If stamina is depleted, the AI narrates the player as winded/unable to move further
  - Sprinting across multiple zones drains more stamina than a careful step
- Movement + attack in the same turn is allowed (the AI interprets intent)
- The AI judge tracks all player positions and zone states

### 1C. Cover & Terrain (LLM-Generated)
**Decision:** Cover is dynamic, AI-generated from terrain text. No fixed tiers.

- The AI describes terrain features per zone in its narrative
- Landmarks (houses, hills, boulders, trees) serve as natural cover
- Cover is created/destroyed dynamically through combat actions:
  - "I kick the table for cover" → AI creates cover narrative tag
  - "I fireball the pillar" → AI destroys cover, debris hazard
- The AI battle judge factors cover into damage resolution narratively
- No fixed cover tiers — the AI decides based on the described terrain what constitutes meaningful protection vs. minimal

### 1D. Distance & Attack Resolution
**Decision:** Fully AI-adjudicated, no fixed rules.

- The AI battle judge considers:
  - Zone distance between attacker and target
  - Type of attack (melee, ranged, magic, area)
  - Terrain/cover of the target's zone
  - Character abilities and equipment
  - Stamina state of the attacker
- Melee attacks naturally require same-zone or adjacent-zone proximity
- Ranged/magic attacks can cross zones but may be penalized by cover
- Area-of-effect abilities affect zones, not individual coordinates
- The battle judge prompt instructs the AI to adjudicate all spatial elements narratively

---

## Phase 2: Minimap Zone Expansion

### 2A. Zone Minimap During Combat
**Decision:** Hybrid interaction — tap on minimap OR type in chat.

- When a battle starts and zones are generated, the minimap expands to show:
  - Zone nodes as labeled circles/rectangles
  - Connections between zones as lines
  - Player dots within their current zone
  - Terrain features as small icons or labels
- Tapping a zone on the expanded minimap:
  - If it's an adjacent zone, the AI narrates the player moving there
  - Sends a chat message like "I move to [Zone Name]" automatically
- Players can also type movement in chat: "I sprint to the rocky outcrop"
- The minimap updates in real-time as players move between zones
- Exit the zone minimap by tapping outside or the close button

### 2B. Zone Minimap During Exploration
- When entering a exploration location, the minimap can expand to show sub-zones
- Sub-zones are generated based on location type and world.json data
- Players tap sub-zones to navigate or type movement in chat
- The minimap collapses back when leaving the location

---

## Phase 3: Exploration Sub-Zones

### 3A. All Locations Get Sub-Zones
**Decision:** Every exploration location has 2-5 sub-zones.

- Extend `world.json` locations with a `subZones` array (or generate them dynamically)
- Examples:
  - Village of Tides: "Market Square", "Docks", "Elder's Hut", "Fisherman's Wharf"
  - Driftwood Beach: "Tideline", "Rocky Pools", "Dune Crest"
  - Ancient Ruins: "Entrance Hall", "Inner Chamber", "Collapsed Wing", "Underground Passage"
- Player's `locationId` is supplemented by `subZoneId` in `explorationPlayers`
- The exploration guide AI narrates sub-zone transitions
- NPCs and enemies are placed in specific sub-zones rather than at the location level
- Resources are distributed across sub-zones

### 3B. Sub-Zone Navigation
- When entering a location, the AI describes available sub-zones
- Players move between sub-zones by typing directions or tapping minimap
- Some sub-zones may require items or abilities to access (item-gating from Wind Waker research)
- Moving between sub-zones costs less survival stats than moving between locations

---

## Phase 4: Token-Based Memory Compaction

### 4A. Automatic Conversation Compaction
**Decision:** Token-based auto-compaction (like GitHub Copilot) with loader badge.

- Track token count estimates for the exploration/battle conversation history
- When the conversation history exceeds a threshold (e.g., 80% of target context budget):
  - Show a small loader badge/indicator near the chat (e.g., a spinning gem icon)
  - Send the oldest portion of the conversation to a fast model (gemini-2.5-flash) for summarization
  - Replace the old messages with the compact summary
  - Remove the loader badge
- The compacted summary preserves:
  - Key events and decisions
  - Current state (inventory, HP, location, active quests)
  - NPC relationships and important dialog
  - Combat outcomes
- **No visible changes to the chat UI** — the user's messages stay intact, but the hidden context sent to the AI is compacted
- The loader badge is the only user-facing indicator

### 4B. Implementation Details
- Add a `compactConversation()` function in the client
- Monitor token estimate after each AI response
- Threshold configurable in admin settings
- Compact in background, don't block user input
- The summary becomes the new "system message" prefix, replacing verbose history

---

## Phase 5: Meta-Progression & Item Persistence

### 5A. Items Persist Across Matches
**Decision:** All player items persist from victories.

- After a PvP/bot victory, items collected during the match are saved to the character's persistent inventory
- After a loss, items from that match are NOT saved (risk/reward)
- Exploration items already persist (saved in character state)
- Battle items (looted from defeated opponents, crafted mid-battle) are new — need to add battle loot system
- Inventory syncs to MongoDB cloud sync same as characters

### 5B. Fight Counter in Character Markdown
**Decision:** Track total battles in the character sheet.

- Add a fight counter at the top of the character's `profileMarkdown`
- Format: `**Battles: 12** (8W-4L)` at the top of the character sheet
- Updated automatically by the server after each battle concludes
- Visible to opponents during arena prep (full profile is shown)
- The count includes PvP, bot matches, and exploration combat
- Wins/losses tracked separately

---

## Phase 6: PvP Refinements

### 6A. Full Profile Visibility
**Decision:** Show full profile to opponents during arena prep.

- This is already the current behavior — no changes needed
- The fight counter (Phase 5B) adds meaningful info to the visible profile

### 6B. No Intent Telegraphing
**Decision:** Don't show what players/bots will do next.

- No changes needed — current system already doesn't telegraph
- The battle judge continues to resolve actions simultaneously without previewing

---

## Implementation Priority Order

1. **Phase 1A-1D: Zone-Based Combat** — Biggest impact, transforms the core game loop
2. **Phase 2A: Zone Minimap (Combat)** — Visual representation of the new system
3. **Phase 3A-3B: Exploration Sub-Zones** — Enriches the exploration game loop
4. **Phase 2B: Zone Minimap (Exploration)** — Visual for exploration sub-zones
5. **Phase 4A-4B: Token Compaction** — Cost optimization, gameplay improvement
6. **Phase 5A-5B: Meta-Progression & Fight Counter** — Retention and progression
7. **Phase 6: PvP Refinements** — Minor changes

---

## Technical Notes

### Battle Judge Prompt Changes (Phase 1)
The `prompts/battle_judge.txt` will need significant updates:
- Instruct AI to generate zone layout on first turn
- Return zone data as structured tool call output
- Track player positions per zone across turns
- Factor zones, cover, distance, terrain into damage resolution
- Narrate movement between zones in combat descriptions

### Server State Changes (Phase 1-3)
- `BattleMapPlayerState`: add `currentZone: string`
- `rooms[roomId].battleMap`: add `zones: Zone[]` with `{ id, name, description, connections, terrain }`
- `explorationPlayers[socketId]`: add `subZoneId: string`
- `world.json` locations: add optional `subZones` array

### Frontend Changes (Phase 2)
- Minimap component: support zone-level rendering mode
- Zone nodes with player dots, connection lines, terrain labels
- Tap handler for zone navigation
- Toggle between location-level and zone-level minimap views

### Memory Compaction (Phase 4)
- Client-side function to estimate token count
- Summarization call to fast model
- Loader badge component
- Admin setting for compaction threshold
