import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

function getPrompt(filename: string) {
  return fs.readFileSync(path.join(process.cwd(), "prompts", filename), "utf8");
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/prompts/:name", (req, res) => {
    try {
      const prompt = getPrompt(req.params.name);
      res.send(prompt);
    } catch (e) {
      res.status(404).send("Prompt not found");
    }
  });

  const botCharsDir = path.join(process.cwd(), 'bot_characters');
  if (!fs.existsSync(botCharsDir)) {
    fs.mkdirSync(botCharsDir, { recursive: true });
  }

  app.get("/api/bot_characters", (req, res) => {
    try {
      const files = fs.readdirSync(botCharsDir).filter(f => f.endsWith('.md'));
      const chars = files.map(f => {
        const content = fs.readFileSync(path.join(botCharsDir, f), "utf-8");
        const nameMatch = content.match(/^#\s+(.+)$/m);
        const name = nameMatch ? nameMatch[1].trim() : f.replace('.md', '');
        return { id: f, name, content };
      });
      res.json(chars);
    } catch (e) {
      res.status(500).json({ error: "Failed to load bot characters" });
    }
  });

  app.post("/api/bot_characters", (req, res) => {
    try {
      const { name, content } = req.body;
      if (!name || !content) return res.status(400).json({ error: "Missing name or content" });
      const filename = name.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.md';
      fs.writeFileSync(path.join(botCharsDir, filename), content);
      res.json({ id: filename, name, content });
    } catch (e) {
      res.status(500).json({ error: "Failed to save bot character" });
    }
  });

  // Socket.io logic
  interface QueuePlayer {
    id: string;
    character: any;
    isReady: boolean;
  }
  let matchmakingQueue: Record<string, QueuePlayer> = {};
  const rooms: Record<string, any> = {};
  const players: Record<string, any> = {};

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("characterCreated", (state) => {
      players[socket.id] = { ...players[socket.id], character: state };
      socket.emit("characterSaved", state);
      socket.emit("characterSynced");
    });

    socket.on("startBotMatch", (data) => {
      const difficulty = data.difficulty || 'Medium';
      const botProfile = data.botProfile || `## Bot Profile\n\n**Class:** Automaton\n\n**Difficulty:** ${difficulty}\n\n**Abilities:**\n- Basic Attack\n- Defend\n\n**Inventory:**\n- Health Potion`;
      const botName = data.botName || `Bot (${difficulty})`;

      if (!players[socket.id]?.character) {
        socket.emit("error", "Create a character first.");
        return;
      }

      const roomId = `bot_room_${socket.id}`;
      const botId = `bot_${socket.id}`;

      const botCharacter = {
        name: botName,
        hp: 100,
        maxHp: 100,
        mana: 50,
        maxMana: 50,
        profileMarkdown: botProfile
      };

      rooms[roomId] = {
        id: roomId,
        host: socket.id,
        isBotMatch: true,
        botDifficulty: difficulty,
        players: {
          [socket.id]: { lockedIn: false, action: "", character: players[socket.id].character },
          [botId]: { lockedIn: false, action: "", character: botCharacter },
        },
        history: [],
      };

      socket.join(roomId);
      players[socket.id].room = roomId;

      io.to(roomId).emit("matchFound", {
        roomId,
        players: rooms[roomId].players,
        isBotMatch: true,
      });
    });

    socket.on("enterArena", () => {
      if (!players[socket.id]?.character) {
        socket.emit("error", "Create a character first.");
        return;
      }

      matchmakingQueue[socket.id] = { id: socket.id, character: players[socket.id].character, isReady: false };
      socket.join("matchmaking_lobby");
      io.to("matchmaking_lobby").emit("queueUpdated", Object.values(matchmakingQueue));
      socket.emit("waitingForOpponent");
    });

    socket.on("lockInQueue", () => {
      if (matchmakingQueue[socket.id]) {
        matchmakingQueue[socket.id].isReady = true;
        io.to("matchmaking_lobby").emit("queueUpdated", Object.values(matchmakingQueue));

        const queueList = Object.values(matchmakingQueue);
        const allReady = queueList.length >= 2 && queueList.every(p => p.isReady);

        if (allReady) {
          const roomId = "room_" + Math.random().toString(36).substring(2, 9);
          const roomPlayers: Record<string, any> = {};
          
          queueList.forEach(p => {
            roomPlayers[p.id] = { lockedIn: false, action: "", character: p.character };
            const pSocket = io.sockets.sockets.get(p.id);
            if (pSocket) {
              pSocket.leave("matchmaking_lobby");
              pSocket.join(roomId);
              players[p.id].room = roomId;
            }
          });

          rooms[roomId] = {
            id: roomId,
            host: queueList[0].id,
            players: roomPlayers,
            isBotMatch: false,
            history: []
          };

          io.to(roomId).emit("matchFound", {
            roomId,
            players: roomPlayers,
            isBotMatch: false
          });

          matchmakingQueue = {}; // Clear queue
        }
      }
    });

    socket.on("leaveQueue", () => {
      if (matchmakingQueue[socket.id]) {
        delete matchmakingQueue[socket.id];
        socket.leave("matchmaking_lobby");
        io.to("matchmaking_lobby").emit("queueUpdated", Object.values(matchmakingQueue));
      }
    });

    socket.on("typing", () => {
      const roomId = players[socket.id]?.room;
      if (roomId) {
        socket.to(roomId).emit("opponentTyping", socket.id);
      }
    });

    socket.on("botAction", (data) => {
      const roomId = players[socket.id]?.room;
      if (!roomId) return;
      const room = rooms[roomId];
      if (!room || !room.isBotMatch) return;

      const botId = `bot_${socket.id}`;
      room.players[botId].lockedIn = true;
      room.players[botId].action = data.action;
      io.to(roomId).emit("playerLockedIn", botId);

      const playerIds = Object.keys(room.players);
      const allLockedIn = playerIds.every((id) => room.players[id].lockedIn);
      if (allLockedIn) {
        io.to(room.host).emit("requestTurnResolution", room);
      }
    });

    socket.on("playerAction", (actionText) => {
      const roomId = players[socket.id]?.room;
      if (!roomId) return;

      const room = rooms[roomId];
      if (!room) return;

      room.players[socket.id].lockedIn = true;
      room.players[socket.id].action = actionText;
      io.to(roomId).emit("playerLockedIn", socket.id);

      const playerIds = Object.keys(room.players);
      const allLockedIn = playerIds.every((id) => room.players[id].lockedIn);

      if (allLockedIn) {
        // Delegate turn resolution to the host client
        io.to(room.host).emit("requestTurnResolution", room);
      }
    });

    socket.on("submitTurnResolution", (data) => {
      const roomId = players[socket.id]?.room;
      if (!roomId) return;

      const room = rooms[roomId];
      if (!room) return;

      const newState = data.state;

      if (newState) {
        for (const pid of Object.keys(room.players)) {
          const charName = room.players[pid].character.name;
          // Try to find the state by character name, or fallback to Player1/Player2 logic if the LLM used that
          const stateData = newState[charName] || Object.values(newState).find((s: any) => s && typeof s === 'object' && s.name === charName);
          
          if (stateData) {
            room.players[pid].character.hp = stateData.hp ?? room.players[pid].character.hp;
            room.players[pid].character.mana = stateData.mana ?? room.players[pid].character.mana;
            if (stateData.profileMarkdown) {
              room.players[pid].character.profileMarkdown = stateData.profileMarkdown;
            }
          } else {
            // Fallback for Player1/Player2 if the LLM followed the old format
            const pIndex = Object.keys(room.players).indexOf(pid) + 1;
            const fallbackData = newState[`Player${pIndex}`];
            if (fallbackData) {
              room.players[pid].character.hp = fallbackData.hp ?? room.players[pid].character.hp;
              room.players[pid].character.mana = fallbackData.mana ?? room.players[pid].character.mana;
              if (fallbackData.profileMarkdown) {
                room.players[pid].character.profileMarkdown = fallbackData.profileMarkdown;
              }
            }
          }
        }
      }

      // Reset locks
      for (const pid of Object.keys(room.players)) {
        room.players[pid].lockedIn = false;
        room.players[pid].action = "";
      }

      io.to(room.id).emit("turnResolved", {
        log: data.log,
        thoughts: data.thoughts,
        state: newState,
        players: room.players,
      });
    });

    socket.on("streamTurnResolutionStart", () => {
      const roomId = players[socket.id]?.room;
      if (roomId) {
        io.to(roomId).emit("streamTurnResolutionStart");
      }
    });

    socket.on("streamTurnResolutionChunk", (data) => {
      const roomId = players[socket.id]?.room;
      if (roomId) {
        io.to(roomId).emit("streamTurnResolutionChunk", data);
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      
      if (matchmakingQueue[socket.id]) {
        delete matchmakingQueue[socket.id];
        io.to("matchmaking_lobby").emit("queueUpdated", Object.values(matchmakingQueue));
      }

      const roomId = players[socket.id]?.room;
      if (roomId) {
        socket.to(roomId).emit("opponentDisconnected");
        delete rooms[roomId];
      }
      delete players[socket.id];
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
