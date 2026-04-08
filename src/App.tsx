import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import Markdown from 'react-markdown';
import { Home, User, Users, Shield, Droplet, Heart, Send, Check, Loader2, Sword, Settings, ChevronDown, ArrowLeft, AlertTriangle, Info } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

declare global {
  interface Window {
    aistudio?: {
      openSelectKey: () => Promise<void>;
      hasSelectedApiKey: () => Promise<boolean>;
    };
  }
}

const socket: Socket = io();
const defaultAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type Tab = 'home' | 'profile' | 'social';
type GameState = 'menu' | 'char_creation' | 'matchmaking' | 'battle' | 'post_match';

interface Character {
  name: string;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  profileMarkdown: string;
}

interface Message {
  role: 'user' | 'model' | 'system';
  text: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [gameState, setGameState] = useState<GameState>('menu');
  const [characters, setCharacters] = useState<Character[]>(() => {
    const saved = localStorage.getItem('duo_characters');
    return saved ? JSON.parse(saved) : [];
  });
  const [character, setCharacter] = useState<Character | null>(() => {
    const saved = localStorage.getItem('duo_character');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [settings, setSettings] = useState(() => {
    const defaultSettings = {
      apiKey: '',
      charModel: 'gemini-2.5-flash',
      battleModel: 'gemini-2.5-pro',
      botModel: 'gemini-2.5-flash'
    };
    const saved = localStorage.getItem('duo_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const validModels = ['gemini-3.1-pro-preview', 'gemini-3-flash-preview', 'gemini-2.5-pro', 'gemini-2.5-flash'];
        
        // Ensure any old/invalid models are reset to defaults so we don't silently request a maxed out model
        if (parsed.charModel && !validModels.includes(parsed.charModel)) parsed.charModel = defaultSettings.charModel;
        if (parsed.battleModel && !validModels.includes(parsed.battleModel)) parsed.battleModel = defaultSettings.battleModel;
        if (parsed.botModel && !validModels.includes(parsed.botModel)) parsed.botModel = defaultSettings.botModel;
        
        return { ...defaultSettings, ...parsed };
      } catch (e) {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
    localStorage.setItem('duo_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (character) {
      localStorage.setItem('duo_character', JSON.stringify(character));
      setCharacters(prev => {
        const index = prev.findIndex(c => c.name === character.name);
        let newChars;
        if (index >= 0) {
          newChars = [...prev];
          newChars[index] = character;
        } else {
          newChars = [...prev, character];
        }
        localStorage.setItem('duo_characters', JSON.stringify(newChars));
        return newChars;
      });
    }
  }, [character]);

  const getAIClient = () => {
    const customKey = settingsRef.current.apiKey?.trim();
    if (customKey) {
      console.log(`Using custom API key ending in ...${customKey.slice(-4)}`);
      return new GoogleGenAI({ apiKey: customKey });
    }
    
    // If the user selected a key via the platform dialog, it might be injected here
    // We create a new instance to ensure we pick up any dynamically injected keys
    console.log("Using platform-provided API key");
    return new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY });
  };
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isWaitingForChar, setIsWaitingForChar] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Battle state
  const [roomId, setRoomId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Record<string, any>>({});
  const [battleLogs, setBattleLogs] = useState<string[]>([]);
  const battleLogsRef = useRef<string[]>([]);
  const [battleInput, setBattleInput] = useState('');
  const [battleError, setBattleError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [expandedThoughts, setExpandedThoughts] = useState<Set<number>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isLockedIn, setIsLockedIn] = useState(false);
  const [opponentTyping, setOpponentTyping] = useState(false);
  const battleEndRef = useRef<HTMLDivElement>(null);
  const charInputRef = useRef<HTMLTextAreaElement>(null);
  const battleInputRef = useRef<HTMLTextAreaElement>(null);

  const [showBotModal, setShowBotModal] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState<number>(1);
  const [botCharacters, setBotCharacters] = useState<any[]>([]);
  const [selectedBotCharacter, setSelectedBotCharacter] = useState<string>('');
  const [isGeneratingBot, setIsGeneratingBot] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const lastSyncedCharRef = useRef<string>('');
  const [queuePlayers, setQueuePlayers] = useState<any[]>([]);
  const [isBotMatch, setIsBotMatch] = useState(false);
  const isBotMatchRef = useRef(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileToView, setProfileToView] = useState<string | null>(null);
  useEffect(() => { isBotMatchRef.current = isBotMatch; }, [isBotMatch]);
  const difficultyLabels = ['Easy', 'Medium', 'Hard', 'Superintelligent'];

  useEffect(() => {
    socket.on('characterSynced', () => setIsSynced(true));
    socket.on('disconnect', () => setIsSynced(false));
    return () => {
      socket.off('characterSynced');
      socket.off('disconnect');
    };
  }, []);

  useEffect(() => {
    const sync = () => {
      const charStr = JSON.stringify(character);
      if (character && charStr !== lastSyncedCharRef.current) {
        socket.emit('characterCreated', character);
        lastSyncedCharRef.current = charStr;
      }
    };

    socket.on('connect', sync);
    if (socket.connected) {
      sync();
    }

    return () => {
      socket.off('connect', sync);
    };
  }, [character]);

  useEffect(() => {
    fetch('/api/bot_characters')
      .then(res => res.json())
      .then(data => {
        setBotCharacters(data);
        if (data.length > 0) {
          setSelectedBotCharacter(data[0].id);
        }
      })
      .catch(err => console.error("Failed to load bot characters", err));
  }, []);

  useEffect(() => {
    battleLogsRef.current = battleLogs;
  }, [battleLogs]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    battleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [battleLogs]);

  const roomIdRef = useRef(roomId);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);
  const botDifficultyRef = useRef(botDifficulty);
  useEffect(() => { botDifficultyRef.current = botDifficulty; }, [botDifficulty]);

  const generateBotAction = async (currentRoom: any) => {
    if (!currentRoom || !currentRoom.isBotMatch) return;
    
    const playerIds = Object.keys(currentRoom.players);
    const botId = playerIds.find(id => id.startsWith('bot_'));
    const playerId = playerIds.find(id => !id.startsWith('bot_'));
    
    if (!botId || !playerId) return;

    const p1Data = currentRoom.players[playerId];
    const p2Data = currentRoom.players[botId];

    if (p2Data.lockedIn) return;

    setOpponentTyping(true);
    try {
      const aiClient = getAIClient();
      const botPromptRes = await fetch('/api/prompts/bot_player.txt');
      const botSysPrompt = await botPromptRes.text();
      
      const cleanLogs = battleLogsRef.current.filter(log => !log.startsWith("> **Judge's Thoughts:**"));
      const fullLogText = cleanLogs.join('\n\n');
      const logLines = fullLogText.split('\n');
      const totalLines = logLines.length;

      const botPrompt = `
DIFFICULTY: ${currentRoom.botDifficulty}
YOU ARE PLAYING AS: ${p2Data.character.name}
YOUR STATE: ${JSON.stringify(p2Data.character)}
OPPONENT STATE: ${JSON.stringify(p1Data.character)}
LATEST BATTLE EVENTS:
${totalLines > 0 ? logLines.slice(Math.max(0, totalLines - 15)).join('\n') : "The battle has just begun."}

What is your action? Keep it short and tactical. Remember, you are ${p2Data.character.name}.
`;
      const botRes = await aiClient.models.generateContent({
        model: settingsRef.current.botModel,
        contents: botPrompt,
        config: {
          systemInstruction: botSysPrompt,
          temperature: 0.8,
        },
      });
      
      const action = botRes.text || "I do nothing.";
      socket.emit('botAction', { action });
    } catch (error) {
      console.error("Error generating bot action:", error);
    } finally {
      setOpponentTyping(false);
    }
  };

  useEffect(() => {
    socket.on('characterSaved', (state: Character) => {
      const stateStr = JSON.stringify(state);
      if (stateStr !== lastSyncedCharRef.current) {
        setCharacter(state);
        setMessages(prev => [...prev, { role: 'system', text: `Character Created: ${state.name}!` }]);
        lastSyncedCharRef.current = stateStr;
      }
    });

    socket.on('queueUpdated', (queue) => {
      setQueuePlayers(queue);
    });

    socket.on('waitingForOpponent', () => {
      setGameState('matchmaking');
    });

    socket.on('matchFound', (data) => {
      setRoomId(data.roomId);
      setPlayers(data.players);
      setIsBotMatch(data.isBotMatch);
      setGameState('battle');
      setBattleLogs(['**Match Found!** The battle begins.']);
      setIsLockedIn(false);
      if (data.isBotMatch) {
        generateBotAction(data);
      }
    });

    socket.on('opponentTyping', (id) => {
      if (id !== socket.id) {
        setOpponentTyping(true);
        setTimeout(() => setOpponentTyping(false), 3000);
      }
    });

    socket.on('playerLockedIn', (id) => {
      setPlayers(prev => ({
        ...prev,
        [id]: { ...prev[id], lockedIn: true }
      }));
    });

    socket.on('requestTurnResolution', async (room) => {
      if (socket.id !== room.host) return;
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      const playerIds = Object.keys(room.players);
      // Add Player Actions bubble for visibility (only once)
      const actionsLog = 'PLAYER_ACTIONS_' + playerIds.map(pid => `**${room.players[pid].character.name}:** ${room.players[pid].action}`).join('\n\n');
      const baseLogs = [...battleLogsRef.current, actionsLog];
      setBattleLogs(baseLogs);

      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        if (signal.aborted) break;
        setBattleError(null);
        setRetryAttempt(attempts);

        try {
          const sysPromptRes = await fetch('/api/prompts/battle_judge.txt');
          const sysPrompt = await sysPromptRes.text();

          const aiClient = getAIClient();

          // 1. Recursive reasoning fix: Strip thoughts from history
          const cleanLogs = baseLogs.filter(log => !log.startsWith("> **Judge's Thoughts:**"));
          const fullLogText = cleanLogs.join('\n\n');
          const logLines = fullLogText.split('\n');
          const totalLines = logLines.length;

          // 2. Redundant state fix: Put character profiles in system instruction
          let profiles = "";
          for (const pid of playerIds) {
            const pData = room.players[pid];
            profiles += `Profile for ${pData.character.name}:\n${pData.character.profileMarkdown}\n\n`;
          }
          const fullSysPrompt = sysPrompt + "\n\n" + profiles;

          // 3. JSON leakage fix: Include battle state in memory, but keep prompt clean
          let prompt = `BATTLE STATE (TURN START):\n`;
          for (const pid of playerIds) {
            const pData = room.players[pid];
            prompt += `Player (${pData.character.name}):\nHP: ${pData.character.hp}, Mana: ${pData.character.mana}\nAction: ${pData.action}\n\n`;
          }
          
          prompt += `The battle log currently has ${totalLines} lines. You can use the read_battle_history tool to read it if you need context from previous turns. Otherwise, resolve the turn simultaneously.`;

          // 4. Linear history bloat fix: Tool calling for history
          const readBattleHistory = {
            name: "read_battle_history",
            description: "Read the battle history markdown log. Provide start and end lines to read a specific section. The log contains all previous turns.",
            parameters: {
              type: "OBJECT",
              properties: {
                startLine: { type: "INTEGER", description: "The line number to start reading from (1-indexed)." },
                endLine: { type: "INTEGER", description: "The line number to end reading at (inclusive)." }
              },
              required: ["startLine", "endLine"]
            }
          };

          let contents: any[] = [{ role: 'user', parts: [{ text: prompt }] }];
          let hasEmittedStart = false;
          let finalThoughts = "";
          let finalAnswer = "";

          while (true) {
            if (signal.aborted) break;
            const responseStream = await aiClient.models.generateContentStream({
              model: settingsRef.current.battleModel,
              contents: contents,
              config: {
                systemInstruction: fullSysPrompt,
                temperature: 1.5,
                thinkingConfig: {
                  includeThoughts: true,
                  thinkingBudget: 8192
                },
                tools: [{ functionDeclarations: [readBattleHistory as any] }]
              },
            });

            let hasToolCall = false;
            let toolCallPart = null;
            let modelParts = [];

            for await (const chunk of responseStream) {
              if (signal.aborted) break;
              const parts = chunk.candidates?.[0]?.content?.parts || [];
              for (const part of parts) {
                modelParts.push(part);
                if (part.functionCall) {
                  hasToolCall = true;
                  toolCallPart = part;
                } else if (!hasToolCall) {
                  const p = part as any;
                  const isThought = !!p.thought;
                  const text = typeof p.thought === 'string' ? p.thought : (p.text || "");

                  if (text) {
                    if (!hasEmittedStart) {
                      socket.emit('streamTurnResolutionStart');
                      hasEmittedStart = true;
                    }
                    
                    if (isThought) {
                      finalThoughts += text;
                    } else {
                      finalAnswer += text;
                    }
                    
                    const combinedStream = finalThoughts + "\n" + finalAnswer;
                    const logMatch = combinedStream.match(/<BATTLE_LOG>([\s\S]*?)(?:<\/BATTLE_LOG>|$)/);
                    const reasoningMatch = combinedStream.match(/<INTERNAL_REASONING>([\s\S]*?)(?:<\/INTERNAL_REASONING>|$)/);
                    
                    let displayThoughts = reasoningMatch ? reasoningMatch[1].trim() : finalThoughts;
                    let displayAnswer = logMatch ? logMatch[1].trim() : "";
                    
                    // Only use fallback if we haven't seen any tags yet and there is content
                    // This prevents the "preamble -> narrative" overwrite
                    if (!logMatch && !finalAnswer.includes('<INTERNAL_REASONING>') && !finalAnswer.includes('<BATTLE_LOG>') && finalAnswer.trim()) {
                      displayAnswer = finalAnswer.trim();
                    }
                    
                    if (logMatch) {
                       displayThoughts = displayThoughts.replace(/<BATTLE_LOG>[\s\S]*?(?:<\/BATTLE_LOG>|$)/, "").trim();
                    }
                    
                    socket.emit('streamTurnResolutionChunk', { type: 'thought', text: "REFRESH:" + displayThoughts });
                    socket.emit('streamTurnResolutionChunk', { type: 'answer', text: "REFRESH:" + displayAnswer });
                  }
                }
              }
            }
            if (signal.aborted) break;
            if (hasToolCall && toolCallPart) {
              const args = toolCallPart.functionCall.args as any;
              const start = Math.max(1, args.startLine || 1);
              const end = Math.min(totalLines, args.endLine || totalLines);
              const resultText = logLines.slice(start - 1, end).join('\n');
              
              contents.push({ role: 'model', parts: modelParts });
              contents.push({
                role: 'user',
                parts: [{
                  functionResponse: {
                    name: "read_battle_history",
                    response: { result: resultText }
                  }
                }]
              });
              // Loop again to let the model continue
            } else {
              // Done
              const combinedOutput = finalThoughts + "\n" + finalAnswer;
              
              const stateMatch = combinedOutput.match(/<BATTLE_STATE>([\s\S]*?)(?:<\/BATTLE_STATE>|$)/);
              let newState = null;
              if (stateMatch) {
                try {
                  newState = JSON.parse(stateMatch[1]);
                } catch (e) {
                  console.error("Failed to parse battle state", e);
                }
              }

              const reasoningMatch = combinedOutput.match(/<INTERNAL_REASONING>([\s\S]*?)(?:<\/INTERNAL_REASONING>|$)/);
              let thoughts = reasoningMatch ? reasoningMatch[1].trim() : finalThoughts.trim();

              const logMatch = combinedOutput.match(/<BATTLE_LOG>([\s\S]*?)(?:<\/BATTLE_LOG>|$)/);
              let markdownLog = logMatch ? logMatch[1].trim() : finalAnswer
                .replace(/<BATTLE_STATE>[\s\S]*?(?:<\/BATTLE_STATE>|$)/, "")
                .replace(/<INTERNAL_REASONING>[\s\S]*?(?:<\/INTERNAL_REASONING>|$)/, "")
                .trim();
                
              thoughts = thoughts
                .replace(/<BATTLE_LOG>[\s\S]*?(?:<\/BATTLE_LOG>|$)/, "")
                .replace(/<BATTLE_STATE>[\s\S]*?(?:<\/BATTLE_STATE>|$)/, "")
                .trim();
              
              socket.emit('submitTurnResolution', {
                log: markdownLog,
                thoughts: thoughts,
                state: newState
              });
              setRetryAttempt(0);
              setBattleError(null);
              return; // Exit the retry loop and the handler
            }
          }
        } catch (error: any) {
          if (error.name === 'AbortError') return;
          console.error("Error resolving turn:", error);
          
          const errorStr = typeof error.message === 'string' ? error.message : JSON.stringify(error);
          const is503 = errorStr.includes('503') || errorStr.includes('high demand') || errorStr.includes('UNAVAILABLE');
          
          if (is503 && attempts < maxAttempts - 1) {
            attempts++;
            setRetryAttempt(attempts);
            setBattleError(`Model high demand (503). Retrying in ${Math.pow(2, attempts)}s...`);
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
            continue;
          }

          socket.emit('error', `Turn resolution failed (Model: ${settingsRef.current.battleModel}). Error: ${error.message}`);
          setBattleError(`Error: ${error.message}`);
          setRetryAttempt(0);
          break;
        }
      }
    });

    socket.on('turnResolved', (data) => {
      setBattleLogs(prev => {
        // Remove the streaming logs if they exist
        const filtered = prev.filter(log => !log.startsWith('STREAMING_THOUGHTS_') && !log.startsWith('STREAMING_ANSWER_'));
        const thoughts = data.thoughts || "";
        return [...filtered, `> **Judge's Thoughts:**\n> ${thoughts.replace(/\n/g, '\n> ')}`, data.log];
      });
      if (data.state) {
        setPlayers(data.players);
        
        // Check win condition
        const alivePlayers = Object.values(data.players).filter((p: any) => p.character.hp > 0);
        if (alivePlayers.length <= 1) {
          const winner = alivePlayers[0] as any;
          const winnerName = winner ? winner.character.name : "No one";
          setBattleLogs(prev => [...prev, `**GAME OVER!** ${winnerName} is victorious!`]);
        } else {
          // If it's a bot match, trigger next bot action
          const room = { id: roomIdRef.current, players: data.players, isBotMatch: isBotMatchRef.current, botDifficulty: botDifficultyRef.current };
          if (room.isBotMatch) {
            generateBotAction(room);
          }
        }
      }
      setIsLockedIn(false);
      setOpponentTyping(false);
    });

    socket.on('streamTurnResolutionStart', () => {
      setBattleLogs(prev => [...prev, 'STREAMING_THOUGHTS_', 'STREAMING_ANSWER_']);
    });

    socket.on('streamTurnResolutionChunk', (data: { type: 'thought' | 'answer', text: string }) => {
      setBattleLogs(prev => {
        const newLogs = [...prev];
        const isRefresh = data.text.startsWith('REFRESH:');
        const textToAppend = isRefresh ? data.text.substring('REFRESH:'.length) : data.text;

        if (data.type === 'thought') {
          const idx = newLogs.findIndex(l => l.startsWith('STREAMING_THOUGHTS_'));
          if (idx !== -1) {
            if (isRefresh) {
              newLogs[idx] = 'STREAMING_THOUGHTS_' + textToAppend;
            } else {
              const current = newLogs[idx].substring('STREAMING_THOUGHTS_'.length);
              newLogs[idx] = 'STREAMING_THOUGHTS_' + current + textToAppend;
            }
          }
        } else {
          const idx = newLogs.findIndex(l => l.startsWith('STREAMING_ANSWER_'));
          if (idx !== -1) {
            if (isRefresh) {
              newLogs[idx] = 'STREAMING_ANSWER_' + textToAppend;
            } else {
              const current = newLogs[idx].substring('STREAMING_ANSWER_'.length);
              newLogs[idx] = 'STREAMING_ANSWER_' + current + textToAppend;
            }
          }
        }
        return newLogs;
      });
    });

    socket.on('opponentDisconnected', () => {
      setBattleLogs(prev => [...prev, '**Opponent disconnected.** You win by default!']);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    });

    socket.on('error', (msg) => {
      alert(msg);
      setIsWaitingForChar(false);
    });

    return () => {
      socket.off('characterSaved');
      socket.off('waitingForOpponent');
      socket.off('matchFound');
      socket.off('opponentTyping');
      socket.off('playerLockedIn');
      socket.off('requestTurnResolution');
      socket.off('turnResolved');
      socket.off('opponentDisconnected');
      socket.off('error');
    };
  }, []);

  const handleSendCharMessage = async () => {
    if (!inputText.trim() || isWaitingForChar) return;
    
    const sentText = inputText.trim();
    const newMessages = [...messages, { role: 'user' as const, text: sentText }];
    setMessages(newMessages);
    const originalInput = sentText;
    setInputText('');
    if (charInputRef.current) charInputRef.current.style.height = 'auto';
    setIsWaitingForChar(true);
    
    try {
      const sysPromptRes = await fetch('/api/prompts/char_creator.txt');
      const sysPrompt = await sysPromptRes.text();

      let fullSysPrompt = sysPrompt;
      if (character) {
        fullSysPrompt += `\n\nExisting Character Profile (The user is tweaking this):\n${JSON.stringify(character)}`;
      }

      // Format history for Gemini
      const contents = newMessages.map(m => `${m.role === 'user' ? 'User' : 'Model'}: ${m.text}`).join('\n');
      const aiClient = getAIClient();

      const responseStream = await aiClient.models.generateContentStream({
        model: settingsRef.current.charModel,
        contents: contents,
        config: {
          systemInstruction: fullSysPrompt,
          temperature: 0.7,
          thinkingConfig: { includeThoughts: true }
        },
      });
      
      let fullText = "";
      let currentModelMessage = "";
      
      // Add a placeholder for the model's response
      setMessages(prev => [...prev, { role: 'model', text: "" }]);
      
      for await (const chunk of responseStream) {
        // chunk.text only returns text parts, effectively hiding native thought parts
        fullText += chunk.text || "";
        
        const displayText = fullText.replace(/<CHAR_STATE>[\s\S]*?<\/CHAR_STATE>/g, '').trim();
        if (displayText !== currentModelMessage) {
          currentModelMessage = displayText;
          setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1] = { role: 'model', text: displayText };
            return newMsgs;
          });
        }
      }
      
      const stateMatch = fullText.match(/<CHAR_STATE>([\s\S]*?)<\/CHAR_STATE>/);
      if (stateMatch) {
        try {
          const state = JSON.parse(stateMatch[1]);
          socket.emit('characterCreated', state);
        } catch (e) {
          console.error("Failed to parse char state", e);
        }
      }
    } catch (error: any) {
      console.error("Error creating character:", error);
      const errorMsg = `[SYSTEM ERROR]: Failed to generate response using model ${settingsRef.current.charModel}. ${error.message}`;
      setMessages(prev => {
        const newMsgs = [...prev];
        if (newMsgs.length > 0 && newMsgs[newMsgs.length - 1].role === 'model' && !newMsgs[newMsgs.length - 1].text) {
          newMsgs.pop(); // Remove the empty placeholder
        }
        return [...newMsgs, { role: 'system', text: errorMsg }];
      });
      setInputText(originalInput); // Repopulate input for retry
    } finally {
      setIsWaitingForChar(false);
    }
  };

  const handleEnterArena = () => {
    if (!character) {
      setActiveTab('profile');
      setGameState('char_creation');
      if (messages.length === 0) {
        setMessages([{ role: 'model', text: "Welcome to the Arena! What kind of character do you want to create?" }]);
      }
      return;
    }
    socket.emit('enterArena');
  };

  const handleNewCharacter = () => {
    setCharacter(null);
    setMessages([{ role: 'model', text: "Let's build a new legend. What kind of character do you want to create?" }]);
    setGameState('char_creation');
    setActiveTab('profile');
  };

  const handleSelectCharacter = (name: string) => {
    const selected = characters.find(c => c.name === name);
    if (selected) {
      setCharacter(selected);
      setMessages([{ role: 'model', text: `Switched to ${selected.name}. Ready for action!` }]);
    }
  };

  const handleSendBattleAction = () => {
    if (!battleInput.trim() || isLockedIn) return;
    socket.emit('playerAction', battleInput);
    setIsLockedIn(true);
    setBattleInput('');
    if (battleInputRef.current) battleInputRef.current.style.height = 'auto';
  };

  const handleTyping = () => {
    socket.emit('typing');
  };

  const getThoughtTitle = (content: string) => {
    const lines = content.split('\n').filter(l => l.trim());
    // Look for the last header-like line
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('#') || (line.startsWith('**') && line.endsWith('**'))) {
        return line.replace(/[#*]/g, '').trim();
      }
    }
    // Fallback to first few words of last line
    const lastLine = lines[lines.length - 1] || "Thinking...";
    const words = lastLine.replace(/[#*]/g, '').trim().split(' ');
    if (words.length <= 4) return words.join(' ');
    return words.slice(0, 4).join(' ') + '...';
  };

  const renderTopBar = () => {
    // If in battle, show battle stats, else show own stats
    let hp = 100;
    let mana = 100;
    let charName = 'No Character';

    if (gameState === 'battle' && players[socket.id]) {
      hp = players[socket.id].character.hp;
      mana = players[socket.id].character.mana;
      charName = players[socket.id].character.name;
    } else if (character) {
      hp = character.hp;
      mana = character.mana;
      charName = character.name;
    }

    return (
      <div className="sticky top-0 z-20 bg-white border-b-2 border-duo-gray shadow-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-duo-gray-dark font-bold">
            {(gameState === 'battle' || gameState === 'post_match') && (
              <button onClick={() => {
                setGameState('menu');
                socket.emit('leaveQueue');
              }} className="mr-1 hover:text-duo-blue transition-colors">
                <ArrowLeft className="w-6 h-6" />
              </button>
            )}
            <Shield className="w-6 h-6" />
            <span className="uppercase text-sm truncate max-w-[120px]">{charName}</span>
          </div>
          <div className="flex items-center gap-4 font-bold text-lg">
            <div className="flex items-center gap-1 text-duo-blue">
              <Droplet className="w-6 h-6 fill-current" />
              <span>{mana}</span>
            </div>
            <div className="flex items-center gap-1 text-duo-red">
              <Heart className="w-6 h-6 fill-current" />
              <span>{hp}</span>
            </div>
            <button onClick={() => setShowSettings(true)} className="text-duo-gray-dark hover:text-duo-blue transition-colors ml-2">
              <Settings className="w-6 h-6" />
            </button>
          </div>
        </div>
        {gameState === 'battle' && (
          <>
            <div className="px-4 py-2 border-t border-duo-gray/30 flex flex-wrap gap-2">
              {Object.keys(players).map(id => {
                const p = players[id];
                const isMe = id === socket.id;
                return (
                  <div key={id} className="flex-1 min-w-[120px] space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-duo-gray-dark uppercase gap-2 items-center">
                      <button 
                        onClick={() => {
                          setProfileToView(p.character.profileMarkdown);
                          setShowProfileModal(true);
                        }}
                        className="truncate flex-1 hover:text-duo-blue transition-colors text-left"
                      >
                        {isMe ? 'You' : p.character.name}
                      </button>
                      <div className="flex gap-2 whitespace-nowrap">
                        <span className="text-duo-blue">{p.character.mana} MNA</span>
                        <span>{p.character.hp} HP</span>
                      </div>
                    </div>
                    <div className="h-2 bg-duo-gray rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${isMe ? 'bg-duo-green' : 'bg-duo-red'}`}
                        style={{ width: `${Math.max(0, p.character.hp)}%` }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-2 py-1 flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-duo-gray/50 bg-gray-50/50">
              {Object.keys(players).map(id => {
                const p = players[id];
                const isMe = id === socket.id;
                return (
                  <div key={id} className="text-[10px] font-bold text-duo-gray-dark flex items-center gap-1">
                    <span className="truncate max-w-[100px]">{isMe ? 'You' : p.character.name}:</span>
                    {p.lockedIn ? (
                      <><Check className="w-3 h-3 text-duo-green" /> Locked</>
                    ) : (id !== socket.id && opponentTyping) ? (
                      <span className="animate-pulse">Typing...</span>
                    ) : (
                      '...'
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderBottomBar = () => {
    if (gameState === 'battle' || gameState === 'matchmaking') return null;

    return (
      <div className="w-full max-w-md bg-white border-t-2 border-duo-gray flex justify-around py-3 pb-safe mt-auto">
        <button 
          onClick={() => { setActiveTab('home'); setGameState('menu'); }}
          className={`flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-duo-green' : 'text-duo-gray-dark'}`}
        >
          <Home className={`w-8 h-8 ${activeTab === 'home' ? 'fill-current' : ''}`} />
        </button>
        <button 
          onClick={() => { 
            setActiveTab('profile'); 
            setGameState('char_creation');
            if (messages.length === 0) {
              setMessages([{ role: 'model', text: "Welcome to the Arena! What kind of character do you want to create?" }]);
            }
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          }}
          className={`flex flex-col items-center gap-1 ${activeTab === 'profile' ? 'text-duo-green' : 'text-duo-gray-dark'}`}
        >
          <User className={`w-8 h-8 ${activeTab === 'profile' ? 'fill-current' : ''}`} />
        </button>
        <button 
          onClick={() => setActiveTab('social')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'social' ? 'text-duo-green' : 'text-duo-gray-dark'}`}
        >
          <Users className={`w-8 h-8 ${activeTab === 'social' ? 'fill-current' : ''}`} />
        </button>
      </div>
    );
  };

  const handleGenerateBot = async () => {
    setIsGeneratingBot(true);
    try {
      const aiClient = getAIClient();
      const prompt = `Generate a new, unique character for a text-based PvP game. 
Return ONLY the markdown profile.
It must start with "# [Character Name]".
Include Class, Description, Abilities (3), and Inventory (3 items).
Be creative and concise.`;

      const response = await aiClient.models.generateContent({
        model: settingsRef.current.charModel,
        contents: prompt,
        config: {
          temperature: 0.9,
        },
      });

      const content = response.text || "";
      const nameMatch = content.match(/^#\s+(.+)$/m);
      const name = nameMatch ? nameMatch[1].trim() : `Bot_${Date.now()}`;

      const res = await fetch('/api/bot_characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, content })
      });
      const newChar = await res.json();
      
      setBotCharacters(prev => [...prev, newChar]);
      setSelectedBotCharacter(newChar.id);
    } catch (err: any) {
      console.error("Failed to generate bot", err);
      alert(`Failed to generate bot using model ${settingsRef.current.botModel}. Error: ${err.message}`);
    } finally {
      setIsGeneratingBot(false);
    }
  };

  const renderMenu = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-black text-duo-text tracking-tight">Arena Clash</h1>
        <p className="text-duo-gray-dark font-bold">Learn to fight. Forever.</p>
      </div>

      <div className="flex flex-col gap-6 w-full max-w-xs">
        <div className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-full bg-duo-gray flex items-center justify-center border-4 border-white shadow-md">
            <User className="w-12 h-12 text-duo-gray-dark" />
          </div>
          
          {characters.length > 0 && (
            <div className="w-full space-y-2">
              <label className="block text-xs font-black text-duo-gray-dark uppercase tracking-wider text-center">Active Legend</label>
              <div className="flex gap-2">
                <select 
                  value={character?.name || ''}
                  onChange={(e) => handleSelectCharacter(e.target.value)}
                  className="flex-1 bg-duo-gray rounded-xl px-4 py-2 font-bold text-duo-text focus:outline-none border-b-4 border-gray-200"
                >
                  {characters.map(c => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
                {character && (
                  <button 
                    onClick={() => {
                      setProfileToView(character.profileMarkdown);
                      setShowProfileModal(true);
                    }}
                    className="p-2 bg-duo-gray rounded-xl border-b-4 border-gray-200 text-duo-blue hover:bg-gray-100"
                    title="View Profile"
                  >
                    <Info className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 w-full">
            <button 
              onClick={() => {
                setActiveTab('profile');
                setGameState('char_creation');
                if (messages.length === 0) {
                  setMessages([{ role: 'model', text: "Welcome back! How should we tweak your legend?" }]);
                }
              }}
              className="duo-btn duo-btn-blue flex-1 py-3 text-sm"
            >
              {character ? 'Tweak' : 'Create'}
            </button>
            <button 
              onClick={handleNewCharacter}
              className="duo-btn duo-btn-blue flex-1 py-3 text-sm"
            >
              New
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-full bg-duo-gray flex items-center justify-center border-4 border-white shadow-md">
            <Sword className="w-12 h-12 text-duo-gray-dark" />
          </div>
          <button 
            onClick={handleEnterArena}
            disabled={character && !isSynced}
            className="duo-btn duo-btn-green w-full py-3 text-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {character && !isSynced && <Loader2 className="w-5 h-5 animate-spin" />}
            {character && !isSynced ? 'Syncing...' : 'Enter Arena'}
          </button>
          <button 
            onClick={() => setShowBotModal(true)}
            disabled={character && !isSynced}
            className="duo-btn duo-btn-blue w-full py-3 text-lg mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {character && !isSynced && <Loader2 className="w-5 h-5 animate-spin" />}
            {character && !isSynced ? 'Syncing...' : 'Play vs Bot'}
          </button>
        </div>
      </div>

      {showBotModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl border-b-4 border-gray-200">
            <h3 className="text-2xl font-black text-duo-text mb-6 text-center">Bot Match</h3>
            
            <div className="mb-6">
              <label className="block text-sm font-bold text-duo-gray-dark mb-2">Select Persona</label>
              <div className="flex gap-2">
                <select 
                  value={selectedBotCharacter}
                  onChange={e => setSelectedBotCharacter(e.target.value)}
                  className="flex-1 bg-duo-gray rounded-xl px-3 py-2 font-bold text-duo-text focus:outline-none focus:ring-2 focus:ring-duo-blue"
                >
                  {botCharacters.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <button 
                  onClick={() => {
                    const selectedChar = botCharacters.find(c => c.id === selectedBotCharacter);
                    if (selectedChar) {
                      setProfileToView(selectedChar.content);
                      setShowProfileModal(true);
                    }
                  }}
                  disabled={!selectedBotCharacter}
                  className="duo-btn duo-btn-blue px-4 flex items-center justify-center disabled:opacity-50"
                  title="View Profile"
                >
                  <Info className="w-5 h-5" />
                </button>
                <button 
                  onClick={handleGenerateBot}
                  disabled={isGeneratingBot}
                  className="duo-btn duo-btn-blue px-4 flex items-center justify-center disabled:opacity-50"
                  title="Generate New Persona"
                >
                  {isGeneratingBot ? <Loader2 className="w-5 h-5 animate-spin" /> : <User className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="mb-8 px-2">
              <label className="block text-sm font-bold text-duo-gray-dark mb-4">Difficulty</label>
              <input 
                type="range" 
                min="0" 
                max="3" 
                step="1"
                value={botDifficulty}
                onChange={(e) => setBotDifficulty(parseInt(e.target.value))}
                className="w-full h-4 bg-duo-gray rounded-full appearance-none cursor-pointer accent-duo-blue"
              />
              <div className="flex justify-between mt-4 text-sm font-bold text-duo-gray-dark">
                <span className={botDifficulty === 0 ? 'text-duo-blue' : ''}>Easy</span>
                <span className={botDifficulty === 1 ? 'text-duo-blue' : ''}>Med</span>
                <span className={botDifficulty === 2 ? 'text-duo-blue' : ''}>Hard</span>
                <span className={botDifficulty === 3 ? 'text-duo-blue' : ''}>God</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowBotModal(false)}
                className="duo-btn duo-btn-gray flex-1 py-3"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setShowBotModal(false);
                  const selectedChar = botCharacters.find(c => c.id === selectedBotCharacter);
                  socket.emit('startBotMatch', {
                    difficulty: difficultyLabels[botDifficulty],
                    botProfile: selectedChar?.content,
                    botName: selectedChar?.name
                  });
                }}
                disabled={!selectedBotCharacter}
                className="duo-btn duo-btn-green flex-1 py-3 disabled:opacity-50"
              >
                Start Match
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderCharCreation = () => (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      <div className="p-4 bg-white border-b-2 border-duo-gray flex justify-between items-center">
        <button 
          onClick={() => setGameState('menu')}
          className="text-duo-gray-dark hover:text-duo-text flex items-center gap-1 font-bold"
        >
          <ArrowLeft className="w-5 h-5" /> Back
        </button>
        <h2 className="text-lg font-black text-duo-text">Character Architect</h2>
        {character ? (
          <button 
            onClick={() => {
              setProfileToView(character.profileMarkdown);
              setShowProfileModal(true);
            }}
            className="text-duo-blue hover:text-duo-blue-dark flex items-center gap-1 font-bold text-sm"
          >
            <Info className="w-4 h-4" /> Profile
          </button>
        ) : <div className="w-16" />}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => {
          if (!msg.text && msg.role === 'model') return null;
          return (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'system' ? (
                <div className="w-full text-center text-sm font-bold text-red-500 bg-red-50 border border-red-100 rounded-lg py-2 px-4 my-2">
                  {msg.text}
                </div>
              ) : (
                <div className={msg.role === 'user' ? 'chat-bubble-me' : 'chat-bubble-them'}>
                  <div className="markdown-body">
                    <Markdown>{msg.text}</Markdown>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {isWaitingForChar && (messages.length === 0 || messages[messages.length - 1].role === 'user' || !messages[messages.length - 1].text) && (
          <div className="flex justify-start">
            <div className="chat-bubble-them flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="font-bold text-sm">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>
      <div className="p-4 bg-white border-t-2 border-duo-gray flex gap-2">
        <textarea
          ref={charInputRef}
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, window.innerHeight / 2) + 'px';
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendCharMessage();
            }
          }}
          placeholder="Type your response..."
          className="flex-1 bg-duo-gray rounded-2xl px-4 py-3 font-bold text-duo-text focus:outline-none focus:ring-2 focus:ring-duo-blue resize-none overflow-y-auto"
          disabled={isWaitingForChar}
          rows={1}
          style={{ minHeight: '48px', maxHeight: '50vh' }}
        />
        <button 
          onClick={handleSendCharMessage}
          disabled={isWaitingForChar || !inputText.trim()}
          className="duo-btn duo-btn-blue px-6 flex items-center justify-center disabled:opacity-50"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  const renderMatchmaking = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50 relative">
      <h2 className="text-2xl font-black text-duo-gray-dark uppercase mb-8 tracking-wider">Arena Queue</h2>
      
      <div className="flex flex-wrap justify-center gap-6 mb-20">
        {queuePlayers.map(p => (
          <div key={p.id} className="relative flex flex-col items-center gap-2">
            {/* Blur background if ready */}
            {p.isReady && (
              <div className="absolute inset-0 bg-duo-green blur-xl opacity-50 rounded-full" />
            )}
            
            <div className={`relative w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold border-4 transition-colors ${p.isReady ? 'bg-duo-green/20 border-duo-green text-duo-green' : 'bg-white border-duo-gray text-duo-gray-dark'}`}>
              {p.character.name.charAt(0).toUpperCase()}
              {p.isReady && (
                <div className="absolute inset-0 bg-duo-green/20 rounded-full" />
              )}
            </div>
            <span className="text-xs font-bold text-duo-gray-dark truncate max-w-[80px] text-center">
              {p.character.name}
            </span>
          </div>
        ))}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t-2 border-duo-gray">
        <button 
          onClick={() => socket.emit('lockInQueue')}
          disabled={queuePlayers.find(p => p.id === socket.id)?.isReady}
          className="w-full duo-button-green py-4 text-lg"
        >
          {queuePlayers.find(p => p.id === socket.id)?.isReady ? 'READY' : 'START'}
        </button>
        <button 
          onClick={() => { socket.emit('leaveQueue'); setGameState('menu'); }}
          className="w-full mt-2 duo-button-gray py-2"
        >
          Leave Queue
        </button>
      </div>
    </div>
  );

  const renderBattle = () => {
    return (
      <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <h1 className="text-2xl font-black text-duo-text mb-2">The Battle</h1>
          {battleLogs.map((log, i) => {
            const isStreamingThoughts = log.startsWith('STREAMING_THOUGHTS_');
            const isStreamingAnswer = log.startsWith('STREAMING_ANSWER_');
            const isThoughts = log.startsWith("> **Judge's Thoughts:**") || isStreamingThoughts;
            
            // Check if it's a Player Actions bubble
            const isPlayerActions = log.startsWith('PLAYER_ACTIONS_');
            
            let content = log;
            if (isPlayerActions) content = log.substring('PLAYER_ACTIONS_'.length);
            if (isStreamingThoughts) content = log.substring('STREAMING_THOUGHTS_'.length);
            if (isStreamingAnswer) content = log.substring('STREAMING_ANSWER_'.length);

            if (isThoughts) {
              const cleanContent = content.replace(/^> \*\*Judge's Thoughts:\*\*\n> /, "").replace(/\n> /g, "\n");
              if (!cleanContent && isStreamingThoughts) return null;
              
              const isExpanded = expandedThoughts.has(i);
              const thoughtTitle = getThoughtTitle(cleanContent);

              return (
                <div key={i} className="duo-card p-3 bg-duo-gray/20 border-dashed text-xs text-duo-text">
                  <div 
                    className="flex items-center gap-2 cursor-pointer select-none" 
                    onClick={() => {
                      const next = new Set(expandedThoughts);
                      if (isExpanded) next.delete(i);
                      else next.add(i);
                      setExpandedThoughts(next);
                    }}
                  >
                    <Loader2 className={`w-3 h-3 flex-shrink-0 ${isStreamingThoughts ? 'animate-spin' : ''}`} />
                    <span className="font-bold text-duo-gray-dark flex-1">
                      {thoughtTitle}
                    </span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                  {isExpanded && (
                    <div className="markdown-body mt-2 pt-2 border-t border-duo-gray/30">
                      <Markdown>{cleanContent}</Markdown>
                    </div>
                  )}
                </div>
              );
            }

            if (!content.trim() && (isStreamingAnswer || isStreamingThoughts)) return null;

            return (
              <div key={i} className={`duo-card p-3 text-sm ${isPlayerActions ? 'bg-duo-blue/5 border-duo-blue/20' : ''}`}>
                <div className="markdown-body">
                  <Markdown>{content}</Markdown>
                  {isStreamingAnswer && <span className="inline-block w-2 h-4 ml-1 bg-duo-blue animate-pulse" />}
                </div>
              </div>
            );
          })}
          {battleError && (
            <div className="duo-card p-3 text-sm bg-red-50 border-red-200 text-red-600 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold">Battle Resolution Error</p>
                <p className="text-xs opacity-80">{battleError}</p>
                {retryAttempt > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-1 rounded border border-yellow-100 w-fit">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Retry Attempt #{retryAttempt}...
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={battleEndRef} />
        </div>

        <div className="p-3 bg-white border-t-2 border-duo-gray flex gap-2">
          <textarea
            ref={battleInputRef}
            value={battleInput}
            onChange={(e) => {
              setBattleInput(e.target.value);
              handleTyping();
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, window.innerHeight / 2) + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendBattleAction();
              }
            }}
            placeholder="Describe your action..."
            className="flex-1 bg-duo-gray rounded-2xl px-3 py-2 text-sm font-bold text-duo-text focus:outline-none focus:ring-2 focus:ring-duo-blue resize-none overflow-y-auto"
            disabled={isLockedIn}
            rows={1}
            style={{ minHeight: '40px', maxHeight: '50vh' }}
          />
          <button 
            onClick={handleSendBattleAction}
            disabled={isLockedIn || !battleInput.trim()}
            className={`duo-btn px-4 flex items-center justify-center disabled:opacity-50 ${isLockedIn ? 'duo-btn-gray' : 'duo-btn-blue'}`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const renderPostMatch = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-black text-duo-text tracking-tight">Match Over!</h1>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button 
          onClick={() => {
            // Reset character stats
            if (character) {
              setCharacter({ ...character, hp: 100, mana: 100 });
            }
            handleEnterArena();
          }}
          className="duo-btn duo-btn-green w-full py-4 text-lg"
        >
          New Opponent
        </button>
        
        <button 
          onClick={() => {
            setActiveTab('profile');
            setGameState('char_creation');
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          }}
          className="duo-btn duo-btn-blue w-full py-4 text-lg"
        >
          Tweak Character
        </button>

        <button 
          onClick={() => {
            setActiveTab('home');
            setGameState('menu');
          }}
          className="duo-btn duo-btn-gray w-full py-4 text-lg"
        >
          Home
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-duo-bg flex justify-center overflow-hidden">
      <div className="w-full max-w-md bg-white h-full flex flex-col relative shadow-2xl">
        {renderTopBar()}
        
        {gameState === 'menu' && renderMenu()}
        {gameState === 'char_creation' && renderCharCreation()}
        {gameState === 'matchmaking' && renderMatchmaking()}
        {gameState === 'battle' && renderBattle()}
        {gameState === 'post_match' && renderPostMatch()}

        {renderBottomBar()}

        {showSettings && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl border-b-4 border-gray-200">
              <h3 className="text-2xl font-black text-duo-text mb-6 text-center">Settings</h3>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-bold text-duo-gray-dark mb-1">
                    API Key (Optional)
                    {settings.apiKey?.trim() && <span className="ml-2 text-duo-green text-xs">✓ Custom Key Active</span>}
                  </label>
                  <input 
                    type="password" 
                    value={settings.apiKey}
                    onChange={e => setSettings({...settings, apiKey: e.target.value})}
                    className="w-full bg-duo-gray rounded-xl px-4 py-2 font-bold text-duo-text focus:outline-none focus:ring-2 focus:ring-duo-blue mb-2"
                    placeholder="Leave blank to use default"
                  />
                  <button
                    onClick={async () => {
                      if (window.aistudio && window.aistudio.openSelectKey) {
                        await window.aistudio.openSelectKey();
                      } else {
                        alert("Platform API key selection is not available in this environment.");
                      }
                    }}
                    className="w-full bg-duo-blue hover:bg-duo-blue-light text-white font-bold py-2 px-4 rounded-xl transition-colors"
                  >
                    Select AI Studio Platform Key
                  </button>
                  <p className="text-xs text-duo-gray-light mt-2">
                    If you are hitting rate limits, click the button above to link your paid Google Cloud project.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-duo-gray-dark mb-1">Char Creator Model</label>
                  <select 
                    value={settings.charModel}
                    onChange={e => setSettings({...settings, charModel: e.target.value})}
                    className="w-full bg-duo-gray rounded-xl px-4 py-2 font-bold text-duo-text focus:outline-none focus:ring-2 focus:ring-duo-blue"
                  >
                    <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview</option>
                    <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                    <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-duo-gray-dark mb-1">Battle Model</label>
                  <select 
                    value={settings.battleModel}
                    onChange={e => setSettings({...settings, battleModel: e.target.value})}
                    className="w-full bg-duo-gray rounded-xl px-4 py-2 font-bold text-duo-text focus:outline-none focus:ring-2 focus:ring-duo-blue"
                  >
                    <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview</option>
                    <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                    <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-duo-gray-dark mb-1">Bot Model</label>
                  <select 
                    value={settings.botModel}
                    onChange={e => setSettings({...settings, botModel: e.target.value})}
                    className="w-full bg-duo-gray rounded-xl px-4 py-2 font-bold text-duo-text focus:outline-none focus:ring-2 focus:ring-duo-blue"
                  >
                    <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview</option>
                    <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                    <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                  </select>
                </div>
              </div>
              <button 
                onClick={() => setShowSettings(false)}
                className="duo-btn duo-btn-blue w-full py-3"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
      {showProfileModal && profileToView && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl border-b-8 border-duo-gray overflow-hidden">
            <div className="p-4 border-b-2 border-duo-gray flex justify-between items-center bg-duo-blue text-white">
              <h3 className="text-xl font-black tracking-tight">Legend Profile</h3>
              <button 
                onClick={() => setShowProfileModal(false)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <ArrowLeft className="w-6 h-6 rotate-180" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 prose prose-slate max-w-none">
              <div className="markdown-body">
                <Markdown>{profileToView}</Markdown>
              </div>
            </div>
            <div className="p-4 border-t-2 border-duo-gray bg-gray-50 flex justify-end">
              <button 
                onClick={() => setShowProfileModal(false)}
                className="duo-btn duo-btn-blue px-8 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

