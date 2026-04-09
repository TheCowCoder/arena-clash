# What If — Complete Feature Guide

## Getting Started

### Prerequisites
- Node.js 18+
- A Google Gemini API key (get one at [aistudio.google.com](https://aistudio.google.com))
- (Optional) MongoDB URI for cloud account sync

### Running the App
```bash
npm install
npm run dev
```
The server starts on `http://localhost:3000`.

### Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| `API_KEY` or `GEMINI_API_KEY` | Yes | Your Google Gemini API key |
| `MONGODB_URI` | No | MongoDB connection string for cloud accounts |
| `JWT_SECRET` | No | Secret for JWT token signing (defaults to a fallback) |

You can also set your API key in-app via **Settings** (gear icon in top-right).

---

## Core Features

### 1. Character Creation
- From the **main menu**, tap **Create Character** (or the `+` button)
- Chat with the AI character creator — describe your character concept
- The AI will ask follow-up questions, then auto-save when ready (via native tool calling)
- After saving, you'll see a **Generate Portrait** button in the menu to create AI art of your character

### 2. Menu & Character Management
- **Switch characters**: Tap any character card on the menu
- **Delete characters**: Long-press or use the delete button
- **Generate Portrait**: The camera icon in the menu generates a portrait using `gemini-2.0-flash-preview-image-generation`
- **View full portrait**: Tap the circular avatar to see it fullscreen
- **Settings** (gear icon): Change API key, select models, manage account

### 3. PVP Matchmaking (Quick Match)
- Tap **Find Match** to enter the matchmaking queue
- You'll be matched with another online player (or a bot after timeout)
- Battles are turn-based: type your action each turn
- The AI judge (gemini-2.5-pro) narrates the outcome with thinking enabled
- **Eye button** in battle: generates a battle scene illustration

### 4. Level Select (Duolingo-style)
- Tap **Levels** from the menu
- Progress through increasingly difficult bot opponents
- Each level features a unique bot character with personality
- Defeating a level unlocks the next one

### 5. Open-World Exploration
- Tap **Explore World** from the menu
- You're placed in a procedurally-described fantasy archipelago (8 islands, 40+ locations)
- **Navigation**: Use the direction buttons at the top to move between connected locations
- **Chat**: Type actions in the text box (e.g., "search for herbs", "talk to the elder", "fish in the river")
- The AI guide manages everything through native function calling

#### Minimap
- The small map in the top-right shows your position (green dot), discovered locations (white dots), and other players (blue dots)
- **Tap the minimap** to expand it fullscreen
- In fullscreen, tap connected locations to travel directly
- Tap the backdrop or minimize button to close

#### Survival System
- **Hunger** and **Thirst** bars drain as you take actions
- If either hits 0, you lose **5 HP per action** (starvation/dehydration)
- Find food and water through exploration, crafting, or NPC trade
- **Stamina** affects movement and combat readiness

#### Inventory & Crafting
- Tap the **📦 Items** button to view your inventory
- The AI guide can craft items using recipes from the world data (13 recipes)
- Example: "craft a healing potion" (requires herbs + water)
- Equipment: weapons and armor can be equipped through exploration actions

#### NPCs
- NPCs appear at specific locations with full personalities, backstories, and trade goods
- Talk to them naturally: "ask the elder about the volcano", "trade wood for potions"
- Some NPCs can join you as **allies in combat** (the AI triggers this via tool calling)

#### Enemy Combat
- Enemies spawn at dangerous locations
- The AI guide triggers combat via tool calling when you engage enemies
- NPC allies can fight alongside you
- After winning, you return to exploration at the same location

#### Goals
- Tap the **⭐ Goals** button to see your current 5 goals
- Goals are dynamically updated by the AI as you progress
- Examples: "Find the Ancient Temple", "Craft a healing potion", "Defeat the Shadow Wolf"

#### Scene Visualization
- Tap the **👁 Visualize** button to generate an AI illustration of your current location

### 6. Multiplayer in Exploration
- Other online players appear on your minimap as blue dots
- When at the same location, you'll see **"Players here"** with challenge buttons
- **PVP Challenge**: Tap ⚔ to challenge a nearby player
- The challenged player gets a modal to Accept or Decline
- Accepting starts a PVP battle, then both return to exploration

### 7. Accounts & Cloud Sync
- Open **Settings** → **Account** section
- **Sign In** or **Create Account** with username/password
- Characters automatically sync to the cloud (debounced 1s)
- When you log in on another device, your characters are restored
- Requires `MONGODB_URI` environment variable on the server

---

## Model Configuration

| Purpose | Default Model | Configurable |
|---------|---------------|-------------|
| Character Creator | `gemini-2.5-flash` | Yes (Settings) |
| Battle Judge | `gemini-2.5-pro` | Yes (Settings) |
| Bot Actions | `gemini-2.5-flash` | Yes (Settings) |
| Exploration Guide | `gemini-2.5-flash` | Uses charModel setting |
| Image Generation | `gemini-2.0-flash-preview-image-generation` | No |

---

## Architecture Notes

- **Frontend**: Single-page React 19 app (`src/App.tsx`) with Tailwind CSS 4
- **Backend**: Express + Socket.io (`server.ts`) — handles matchmaking, battles, exploration rooms, auth
- **AI**: All LLM calls happen client-side via `@google/genai` SDK (API key stored in browser)
- **World Data**: Static `world.json` served by the server, loaded once by the client
- **Persistence**: localStorage for characters + optional MongoDB cloud sync
- **Auth**: bcryptjs password hashing, JWT tokens (30-day expiry)

---

## Solo Testing Checklist

All tests can be performed solo (no second player needed).

### 1. Character Creation & Portrait
- [ ] Click **Create Character** from menu
- [ ] Describe a character concept (e.g., "fire mage named Blaze")
- [ ] Verify AI asks follow-ups then auto-saves the character
- [ ] Verify portrait auto-generates after save (check console for `[Portrait Auto]` logs)
- [ ] If auto-gen fails, manually tap 🎨 **Generate Portrait** in the menu
- [ ] Verify circular avatar appears; tap it for fullscreen view

### 2. Exploration — Navigation & Minimap
- [ ] Tap **Explore World** — verify you enter exploration with minimap visible
- [ ] Verify the small minimap is centered on your position (green dot in center)
- [ ] Tap a direction button — verify instant movement (no "Thinking..." spinner)
- [ ] Tap the minimap to expand fullscreen — verify labels on discovered locations
- [ ] Scroll to zoom — verify zoom originates from cursor position
- [ ] Drag to pan — verify smooth movement
- [ ] Tap **Center** button — verify map recenters on your dot
- [ ] Verify islands are spread out (not overlapping)
- [ ] Close fullscreen map via X or backdrop click

### 3. Exploration — Chat & AI
- [ ] Type "look around" — verify narrative response (no stat dumps, no thought text)
- [ ] Verify no empty/stray bubbles appear
- [ ] Verify loading shows "Thinking..." not "Exploring..."
- [ ] Force an error (e.g., invalid API key) — verify your message reappears in the input box

### 4. Exploration — NPC Interaction
- [ ] Move to a location with NPCs (try Verdant Village — has Elder Kai)
- [ ] Type "talk to Elder Kai" — verify the AI roleplays the NPC with personality

### 5. Exploration — Crafting
- [ ] Gather resources: "gather herbs", "collect driftwood"
- [ ] Check inventory (📦 button) — verify items appear
- [ ] Type "craft a small raft from driftwood" — verify creative crafting works (no recipe restriction)
- [ ] Verify inventory updates (materials consumed, item added)

### 6. Exploration — Goals
- [ ] Tap ⭐ Goals — verify 5 goals display
- [ ] Complete a goal (e.g., if "find water" is listed and you're at water, say "I drink from the river")
- [ ] Verify only the completed goal is replaced, other 4 stay the same

### 7. Exploration — Scene Visualization  
- [ ] Tap 👁 **Visualize** — verify button shows "Generating..." and disables during load
- [ ] Verify AI image of location appears in chat
- [ ] Verify button re-enables after generation completes

### 8. Exploration — Enemy Combat
- [ ] Move to a dangerous location (try Mistwood Depths or Shadow Hollow)
- [ ] Type "attack the [enemy]" — verify combat triggers
- [ ] Verify battle header shows the location name (e.g., "⚔️ Mistwood Depths")
- [ ] Verify the bot enemy auto-generates an attack (if it stalls, check console for errors)
- [ ] Lock in your action — verify turn resolves
- [ ] After battle ends, verify "Return to World" button appears
- [ ] Tap it — verify you return to the same exploration location

### 9. Bot Match (from Menu)
- [ ] Tap **Play vs Bot** — select a persona and difficulty
- [ ] Start match — verify battle begins
- [ ] Type an action and lock in — verify bot responds and judge narrates
- [ ] Tap 👁 Eye icon — verify battle scene image generates
- [ ] Complete the battle — verify post-match screen with results

### 10. Level Select
- [ ] Tap **Levels** from menu
- [ ] Start Level 1 — verify battle with level-specific bot
- [ ] Complete it — verify Level 2 unlocks

### 11. Account & Cloud Sync
- [ ] Open Settings (⚙️) → tap **Sign In**
- [ ] Create account or log in — verify "Logged in as [name]" shows
- [ ] Generate a portrait — verify `[Sync]` logs in console
- [ ] Open new incognito tab, log in — verify characters + portraits restore
