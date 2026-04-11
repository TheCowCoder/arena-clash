1. Reliability And Continuity

Character tweaker should always receive the full current character markdown plus a compact machine-readable stat sheet, so identity-specific resources like nanite are never invisible.
Disable autoscroll whenever the user has manually scrolled away from bottom, and only resume when they explicitly jump back.
Fix the random opponent-disconnected path, especially around app switching, reconnect, and transient socket stalls.
Fix the desync where one client skips battle log rendering and jumps straight from thinking to image generation.
Add clearer reconnect states: reconnecting, resyncing turn, opponent rejoined, instead of collapsing everything into a disconnect feel.
2. Extreme Text Compression

Simplify all LLM responses across character creation, exploration, battle, and system messages.
Reduce text amounts game-wide aggressively, with a hard style rule: shortest useful answer wins.
Replace long narrative paragraphs with 1-2 sentence outcome blocks.
Cap judge thoughts to one compact tactical sentence by default, with expand-to-read for more.
Convert many prose updates into chips or tags: HP -12, Moved, Follower Joined, Loot +2.
Remove repeated framing language, recap language, and atmospheric filler unless the user explicitly asks for detail.
Make battle logs action-first: who did what, what changed, where they ended.
Force models to prefer direct verbs over scene painting: slashes, shoves, casts, moves, blocks.
3. More Chat Space

Increase the vertical space of the main chat logs in exploration, battle, and character creation.
Shrink or collapse secondary panels, headers, and nonessential badges on mobile.
Reduce the permanent height of the bottom composer area.
Collapse inventory, stats, and mini status strips behind one-tap drawers instead of keeping them always expanded.
Use shorter titles and thinner section headers to reclaim vertical room.
Hide optional meta UI until needed: model retry text, debug-style tool badges, extended timer chrome.
4. Mobile And Input Cleanup

Fix the horizontal pill under the chat input on iPhone.
Normalize the input bar height so it never consumes extra vertical space from browser UI quirks.
Keep image-generation, typing, and lock-in indicators compact and inline with chat instead of taking a full row when possible.
Make the “currently generating image” state obvious without stealing too much screen space.
Keep battle input usable during async phases, but simplify disabled states so there is one clear reason the send button is blocked.
5. Simpler Game Structure

Reduce the number of simultaneous mechanics shown at once. Show only the next meaningful choice.
Collapse survival stats when they are stable, and only surface them when they become relevant.
Trim goal lists to 3 visible goals instead of 5, with the rest hidden behind a tap if needed.
Prefer one obvious primary action per state: move, act, inspect, or rewrite.
Reduce the number of unique system message styles so the game feels more legible and less noisy.
Shorten battle phases mentally for the player: actions, result, image, next turn.
6. Better Information Architecture

Split “must know now” from “nice to know later”.
Put irreversible or high-signal information at top: damage, movement, status, win/loss, follower presence.
Move lore, flavor, and secondary explanation below the fold or behind expanders.
Replace repeated markdown blocks with reusable compact cards for characters, followers, and enemies.
Show follower participation in one obvious place every turn: Follower: typing, Follower: locked, Follower: acted.
Add a compact end-of-turn summary block so players do not need to read the whole log to understand state.
7. AI-Specific Simplification Rules

Give every model a “brevity first” instruction with hard output ceilings by mode.
For exploration, default to 2 short sentences plus one actionable line.
For battle resolution, default to 3-5 short action lines, not a paragraph.
For character tweaking, always ground edits in the full character markdown plus current resources/stats.
Add a “do not restate known context” rule to every prompt so the AI stops re-explaining the same facts.
8. A Practical Rollout Order

First fix reliability bugs that break trust: disconnects, skipped logs, missing follower participation, autoscroll.
Then compress output and reclaim screen space.
Then simplify systems visibility and mobile layout.
Then tune prompts and UI defaults until the whole game feels lighter.
