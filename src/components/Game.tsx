import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { generateStoryStep, generateImage, generateChatResponse, GameState } from '../services/gemini';
import { Scroll, Backpack, Image as ImageIcon, MessageSquare, Send, Loader2, Zap, Brain, Save, ToggleLeft, ToggleRight, BookOpen, Search, Users, Swords, Shield, Heart, Sparkles, Info } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function Game() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [storyHistory, setStoryHistory] = useState<{ role: string, parts: { text: string }[] }[]>([]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageSize, setImageSize] = useState<"1K" | "2K" | "4K">("1K");
  
  const [chatHistory, setChatHistory] = useState<{ role: string, parts: { text: string }[] }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [chatModel, setChatModel] = useState<'gemini-3.1-flash-lite-preview' | 'gemini-3.1-pro-preview'>('gemini-3.1-flash-lite-preview');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loreSearchQuery, setLoreSearchQuery] = useState("");

  const [activeTab, setActiveTab] = useState<'quest' | 'companions' | 'lore' | 'settings'>('quest');
  const [companionSubTab, setCompanionSubTab] = useState<'party' | 'npcs' | 'codex'>('party');

  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(() => {
    const stored = localStorage.getItem('autoSaveEnabled');
    return stored ? JSON.parse(stored) : true;
  });
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadGame = () => {
      const stored = localStorage.getItem('infiniteAdventureSave');
      if (stored) {
        try {
          const data = JSON.parse(stored);
          const loadedGameState = { 
            ...data.gameState, 
            difficultyLevel: data.gameState.difficultyLevel ?? 0,
            lore: data.gameState.lore ?? [],
            characters: data.gameState.characters ?? [],
            companions: data.gameState.companions ?? []
          };
          setGameState(loadedGameState);
          setStoryHistory(data.storyHistory);
          setImageUrl(data.imageUrl);
          setChatHistory(data.chatHistory || []);
          return true;
        } catch (e) {
          console.error("Failed to load save data", e);
        }
      }
      return false;
    };

    if (!loadGame()) {
      startGame();
    }
  }, []);

  // Auto-save on state change (after generation completes)
  useEffect(() => {
    if (isAutoSaveEnabled && gameState && !isGeneratingStory && !isGeneratingImage) {
      const saveData = { gameState, storyHistory, imageUrl, chatHistory };
      localStorage.setItem('infiniteAdventureSave', JSON.stringify(saveData));
      setLastSaved(new Date());
    }
  }, [gameState, storyHistory, imageUrl, chatHistory, isAutoSaveEnabled, isGeneratingStory, isGeneratingImage]);

  // Periodic auto-save every 5 minutes
  useEffect(() => {
    if (!isAutoSaveEnabled || !gameState) return;
    const interval = setInterval(() => {
      const saveData = { gameState, storyHistory, imageUrl, chatHistory };
      localStorage.setItem('infiniteAdventureSave', JSON.stringify(saveData));
      setLastSaved(new Date());
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAutoSaveEnabled, gameState, storyHistory, imageUrl, chatHistory]);

  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, isChatOpen]);

  const startGame = async () => {
    setIsGeneratingStory(true);
    setError(null);
    try {
      const { state, newHistory } = await generateStoryStep([], "Start a new adventure.");
      // Ensure difficultyLevel and arrays are set
      const stateWithDifficulty = { 
        ...state, 
        difficultyLevel: state.difficultyLevel ?? 0,
        lore: state.lore ?? [],
        characters: state.characters ?? [],
        companions: state.companions ?? []
      };
      setGameState(stateWithDifficulty);
      setStoryHistory(newHistory);
      generateSceneImage(state.imagePrompt, imageSize);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "An error occurred starting the game.");
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleChoice = async (choice: string) => {
    if (!gameState || isGeneratingStory) return;
    setIsGeneratingStory(true);
    setError(null);
    try {
      const { state, newHistory } = await generateStoryStep(storyHistory, choice, gameState);
      const stateWithDifficulty = { 
        ...state, 
        difficultyLevel: state.difficultyLevel ?? 0,
        lore: state.lore ?? [],
        characters: state.characters ?? [],
        companions: state.companions ?? []
      };
      setGameState(stateWithDifficulty);
      setStoryHistory(newHistory);
      generateSceneImage(state.imagePrompt, imageSize);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "An error occurred making a choice.");
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const generateSceneImage = async (prompt: string, size: "1K" | "2K" | "4K") => {
    setIsGeneratingImage(true);
    try {
      const url = await generateImage(prompt, size);
      setImageUrl(url);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatting) return;
    
    const message = chatInput.trim();
    setChatInput("");
    setIsChatting(true);
    
    try {
      const { text, newHistory } = await generateChatResponse(chatHistory, message, chatModel, gameState);
      setChatHistory(newHistory);
    } catch (e) {
      console.error(e);
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans flex overflow-hidden">
      {/* Left Sidebar - Game State */}
      <div className="w-80 bg-zinc-900 border-r border-zinc-805 flex flex-col h-screen shrink-0">
        <div className="p-5 border-b border-zinc-800 bg-zinc-950/20">
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Scroll className="text-indigo-400" size={20} />
            Infinite Adventure
          </h1>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/40 p-1 shrink-0">
          {[
            { id: 'quest', label: 'Quest', icon: Scroll },
            { id: 'companions', label: 'Companions', icon: Users },
            { id: 'lore', label: 'Lore', icon: BookOpen },
            { id: 'settings', label: 'Setup', icon: Save }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-1.5 px-0.5 rounded-md flex flex-col items-center justify-center gap-0.5 transition-all outline-none ${
                  isActive
                    ? 'bg-zinc-800 text-white font-medium border border-zinc-700/30'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-indigo-400' : ''} />
                <span className="text-[10px] tracking-wide font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {activeTab === 'quest' && (
            <div className="space-y-6">
              {/* Quest Tracker */}
              <div>
                <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                  <Scroll size={13} className="text-zinc-500" /> Current Quest
                </h2>
                <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-300 leading-relaxed shadow-inner">
                  {gameState?.quest || "Awaiting your destiny..."}
                </div>
              </div>

              {/* World Threat Level */}
              <div>
                <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                  <Shield size={13} className="text-zinc-500" /> World Danger Level
                </h2>
                <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-3.5 flex flex-col gap-2.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400">Current Threat:</span>
                    <span className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider ${
                      (gameState?.difficultyLevel ?? 0) === -2 ? 'bg-green-500/10 text-green-400' :
                      (gameState?.difficultyLevel ?? 0) === -1 ? 'bg-emerald-500/10 text-emerald-400' :
                      (gameState?.difficultyLevel ?? 0) === 0 ? 'bg-blue-500/10 text-blue-400' :
                      (gameState?.difficultyLevel ?? 0) === 1 ? 'bg-amber-500/10 text-amber-500' :
                      'bg-red-500/10 text-red-450'
                    }`}>
                      {(gameState?.difficultyLevel ?? 0) === -2 ? 'Safe Refuge' :
                       (gameState?.difficultyLevel ?? 0) === -1 ? 'Looming Shadows' :
                       (gameState?.difficultyLevel ?? 0) === 0 ? 'Dark Realms' :
                       (gameState?.difficultyLevel ?? 0) === 1 ? 'Vicious Night' :
                       'Grim Apocalypse'}
                    </span>
                  </div>
                  <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        (gameState?.difficultyLevel ?? 0) <= -1 ? 'bg-green-500' :
                        (gameState?.difficultyLevel ?? 0) === 0 ? 'bg-blue-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${((gameState?.difficultyLevel ?? 0) + 2) * 25}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Inventory */}
              <div>
                <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                  <Backpack size={13} className="text-zinc-500" /> Inventory / Belongings
                </h2>
                {gameState?.inventory && gameState.inventory.length > 0 ? (
                  <ul className="space-y-1.5">
                    {gameState.inventory.map((item, i) => (
                      <li key={i} className="bg-zinc-950/50 border border-zinc-805 rounded-lg px-3 py-2 text-xs text-zinc-300 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-zinc-650 italic pl-1">Your pockets are empty. Find key items as you search.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'companions' && (
            <div className="space-y-4">
              {/* Class Subtab Selection */}
              <div className="flex bg-zinc-950/50 border border-zinc-800 rounded-lg p-0.5 text-[10px] shrink-0 mb-1">
                <button
                  type="button"
                  onClick={() => setCompanionSubTab('party')}
                  className={`flex-1 py-1 rounded-md font-medium text-center transition-all ${
                    companionSubTab === 'party' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Party ({gameState?.companions?.length ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setCompanionSubTab('npcs')}
                  className={`flex-1 py-1 rounded-md font-medium text-center transition-all ${
                    companionSubTab === 'npcs' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  NPCs ({gameState?.characters?.length ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setCompanionSubTab('codex')}
                  className={`flex-1 py-1 rounded-md font-medium text-center transition-all ${
                    companionSubTab === 'codex' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Codex
                </button>
              </div>

              {companionSubTab === 'party' && (
                <div className="space-y-3">
                  {gameState?.companions && gameState.companions.length > 0 ? (
                    <ul className="space-y-3.5">
                      {gameState.companions.map((comp, i) => {
                        const lowerArch = comp.archetype.toLowerCase();
                        let badgeColor = "bg-zinc-950/50 text-zinc-300 border-zinc-800";
                        if (lowerArch.includes("gloom") || lowerArch.includes("shadow")) {
                          badgeColor = "bg-purple-500/10 text-purple-400 border-purple-500/20";
                        } else if (lowerArch.includes("aegis") || lowerArch.includes("armor") || lowerArch.includes("knight") || lowerArch.includes("sentinel")) {
                          badgeColor = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                        } else if (lowerArch.includes("doctor") || lowerArch.includes("plague") || lowerArch.includes("healer") || lowerArch.includes("chemist")) {
                          badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                        } else if (lowerArch.includes("blood") || lowerArch.includes("ranger") || lowerArch.includes("beast")) {
                          badgeColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                        } else if (lowerArch.includes("spell") || lowerArch.includes("blade") || lowerArch.includes("demon")) {
                          badgeColor = "bg-rose-500/10 text-rose-400 border-rose-500/20";
                        }

                        let loyaltyColor = "bg-indigo-500";
                        if (comp.loyalty <= 25) loyaltyColor = "bg-red-550";
                        else if (comp.loyalty <= 50) loyaltyColor = "bg-amber-500";
                        else if (comp.loyalty <= 75) loyaltyColor = "bg-indigo-500";
                        else loyaltyColor = "bg-green-500";

                        return (
                          <li key={i} className="bg-zinc-950/45 border border-zinc-850 rounded-xl p-3.5 space-y-3 shadow hover:border-zinc-800 transition-all">
                            {/* Companion Header */}
                            <div className="flex items-start justify-between gap-1.5">
                              <div>
                                <h3 className="text-xs font-bold text-white leading-tight">
                                  {comp.name}
                                </h3>
                                <span className={`inline-block text-[8px] uppercase px-1 py-0.5 mt-1 rounded border font-mono tracking-wider ${badgeColor}`}>
                                  {comp.archetype}
                                </span>
                              </div>
                              <span className={`text-[8px] tracking-wider font-mono uppercase px-1.5 py-0.5 rounded leading-none ${
                                comp.status.toLowerCase() === 'active' ? 'bg-green-500/10 text-green-400' :
                                comp.status.toLowerCase() === 'injured' ? 'bg-yellow-500/10 text-yellow-400' :
                                'bg-zinc-850 text-zinc-550 border border-zinc-800'
                              }`}>
                                {comp.status}
                              </span>
                            </div>

                            {/* Companion Background */}
                            <p className="text-[11px] text-zinc-400 leading-snug font-normal">{comp.background}</p>

                            {/* Loyalty System */}
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-[9px]">
                                <span className="text-zinc-500 flex items-center gap-1">
                                  <Heart size={9} className="text-rose-500/70" /> Loyalty / Bonding
                                </span>
                                <span className={`font-mono font-bold ${comp.loyalty > 75 ? 'text-green-400' : comp.loyalty < 30 ? 'text-red-400' : 'text-zinc-300'}`}>
                                  {comp.relationshipStatus} ({comp.loyalty}%)
                                </span>
                              </div>
                              <div className="w-full bg-zinc-900 rounded-full h-1 overflow-hidden">
                                <span 
                                  className={`block h-full transition-all duration-500 ${loyaltyColor}`} 
                                  style={{ width: `${comp.loyalty}%` }} 
                                />
                              </div>
                            </div>

                            {/* Abilities System */}
                            {comp.abilities && comp.abilities.length > 0 && (
                              <div className="space-y-1.5 pt-2 border-t border-zinc-850">
                                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                                  <Sparkles size={10} className="text-amber-500/80" /> Talents / Moves
                                </span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {comp.abilities.map((ability, abIndex) => (
                                    <span key={abIndex} className="bg-zinc-900 border border-zinc-800 text-zinc-350 text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold">
                                      {ability}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="text-xs text-zinc-600 bg-zinc-950/20 p-5 rounded-xl border border-dashed border-zinc-800 text-center py-8 space-y-1.5">
                       <p className="font-semibold text-zinc-500">Alone in the wilderness.</p>
                       <p className="text-[10px] text-zinc-650 leading-relaxed">No companions have sworn compacts with you. Your choices and dialogues will dynamicly influence key archetypes to join your retinue.</p>
                    </div>
                  )}
                </div>
              )}

              {companionSubTab === 'npcs' && (
                <div className="space-y-3">
                  {gameState?.characters && gameState.characters.length > 0 ? (
                    <ul className="space-y-3">
                      {gameState.characters.map((char, i) => (
                        <li key={i} className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-3 shadow-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-white leading-none">{char.name}</span>
                            <span className={`text-[8px] uppercase px-1 py-0.5 rounded font-mono font-medium ${
                              char.status.toLowerCase() === 'alive' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                              char.status.toLowerCase() === 'hostile' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                              'bg-zinc-800 text-zinc-450'
                            }`}>
                              {char.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 leading-snug font-normal mt-1.5 mb-2">{char.description}</p>
                          <div className="text-[9px] text-indigo-400 font-mono">Disposition: {char.relationship}</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-xs text-zinc-600 bg-zinc-950/20 p-5 rounded-xl border border-dashed border-zinc-800 text-center py-8">
                      No key inhabitants are cataloged yet in your travel diary.
                    </div>
                  )}
                </div>
              )}

              {companionSubTab === 'codex' && (
                <div className="space-y-3 text-xs leading-relaxed">
                  <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-850 flex items-start gap-2 mb-1.5">
                    <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                    <p className="text-zinc-450 text-[10px] leading-tight font-normal">Persuade these five legend-bound archetypes to swear allegiance throughout your travels by matching your choices with their values.</p>
                  </div>
                  
                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {[
                      {
                        name: "Gloomweaver",
                        nature: "🔮 Shadow Weaver",
                        likes: "Pragmatism, forbidden lore, secrecy, survival instinct",
                        skills: "Shadowstep, Veil of Whispers",
                        desc: "Cunning shadowcasters who manipulate twilight of the soul to warp minds and strike from dense voids."
                      },
                      {
                        name: "Aegis Sentinel",
                        nature: "🛡️ Chivalric warden",
                        likes: "Justice, shielding innocence, sacred vows, valor",
                        skills: "Bastion Shield, Vanguard Charge",
                        desc: "Bulwarks of absolute armor sworn to guard the weak. They wield grand towers-shields."
                      },
                      {
                        name: "Plague Doctor",
                        nature: "🧪 Alchemist-Healer",
                        likes: "Curiosity, logical rationalism, alchemy testing",
                        skills: "Acid Bomb, Rejuvenating Brew",
                        desc: "Enigmatic scholars wearing bird masks. They carry reactive chemistry vials to poison or restore targets."
                      },
                      {
                        name: "Bloodhound Ranger",
                        nature: "🐾 Wild beast tracker",
                        likes: "Survival tactics, wilderness trust, simple honesty",
                        skills: "Pack Hunting, Viper Shot",
                        desc: "Beastmasters synced with ancestral wilds. They hunt with bows and spectral pack wolves."
                      },
                      {
                        name: "Cursed Spellblade",
                        nature: "⚔️ Demonic dualist",
                        likes: "High risk high reward, defiance of rulers, power gain",
                        skills: "Hellfire Strike, Demon Lash",
                        desc: "Volatile swordsmen striking demon contracts. They spark blaze-sigils from their own vitality."
                      }
                    ].map((codex, i) => (
                      <div key={i} className="bg-zinc-950/30 border border-zinc-850 rounded-xl p-3 space-y-1.5">
                        <div className="flex justify-between items-center border-b border-zinc-800 pb-1">
                          <span className="font-bold text-white text-[11px]">{codex.name}</span>
                          <span className="text-[9px] text-indigo-400 font-mono font-bold">{codex.nature}</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-snug font-normal">{codex.desc}</p>
                        <div className="text-[9px] space-y-0.5 pt-1 border-t border-zinc-850/50 text-zinc-500 font-mono">
                          <div><span className="text-zinc-450 font-semibold font-sans">Favors:</span> {codex.likes}</div>
                          <div><span className="text-zinc-450 font-semibold font-sans">Talents:</span> {codex.skills}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'lore' && (
            <div className="space-y-4">
              <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2 mb-1">
                <BookOpen size={13} className="text-zinc-500" /> Persistent World Lore
              </h2>
              
              {gameState?.lore && gameState.lore.length > 0 ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Search chronicles..."
                      value={loreSearchQuery}
                      onChange={(e) => setLoreSearchQuery(e.target.value)}
                      className="w-full bg-zinc-950/50 border border-zinc-850 rounded-lg pl-8.5 pr-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 transition-all font-mono"
                    />
                  </div>

                  <ul className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
                    {gameState.lore
                      .filter(entry => entry.toLowerCase().includes(loreSearchQuery.toLowerCase()))
                      .map((entry, i) => (
                        <li key={i} className="text-[11px] leading-relaxed border-l-2 border-indigo-500/25 pl-2.5 py-1.5 bg-zinc-950/20 rounded-r-lg">
                          <div className="text-zinc-350">{entry}</div>
                        </li>
                      ))}
                    {gameState.lore.filter(entry => entry.toLowerCase().includes(loreSearchQuery.toLowerCase())).length === 0 && (
                      <div className="text-[11px] text-zinc-600 italic text-center py-4">No matching chronologies found.</div>
                    )}
                  </ul>
                </div>
              ) : (
                <div className="text-xs text-zinc-600 text-center italic py-8 bg-zinc-950/15 border border-dashed border-zinc-800 rounded-xl">
                  The annals of history are blank. Discover ancient runes and stories to populate the lore chronicles.
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-5">
              {/* Image Quality setting */}
              <div>
                <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <ImageIcon size={13} className="text-zinc-500" /> Render Depth
                </h2>
                <div className="flex bg-zinc-950/50 border border-zinc-805 rounded-lg p-0.5">
                  {(["1K", "2K", "4K"] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => setImageSize(size)}
                      className={`flex-1 py-1 text-[11px] font-bold rounded-md transition-all ${
                        imageSize === size ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Autosaver */}
              <div>
                <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Save size={13} className="text-zinc-500" /> Persistent Saving
                </h2>
                <div className="flex items-center justify-between bg-zinc-950/50 border border-zinc-850 rounded-lg p-2.5">
                  <span className="text-xs text-zinc-350">Save game state</span>
                  <button 
                    type="button"
                    onClick={() => {
                      const newVal = !isAutoSaveEnabled;
                      setIsAutoSaveEnabled(newVal);
                      localStorage.setItem('autoSaveEnabled', JSON.stringify(newVal));
                    }}
                    className={`transition-colors outline-none ${isAutoSaveEnabled ? 'text-indigo-400' : 'text-zinc-650'}`}
                  >
                    {isAutoSaveEnabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>
                </div>
                {lastSaved && isAutoSaveEnabled && (
                  <div className="text-[9px] text-zinc-500 mt-1 text-right font-mono">
                    Last backup: {lastSaved.toLocaleTimeString()}
                  </div>
                )}
              </div>

              {/* Wipe Control */}
              <div className="pt-2.5 border-t border-zinc-850">
                {!showResetConfirm ? (
                  <button 
                    type="button"
                    onClick={() => setShowResetConfirm(true)}
                    className="w-full py-2 text-[10px] font-bold rounded-lg bg-zinc-950/30 text-red-400 hover:bg-red-955/20 border border-zinc-850 hover:border-red-900/40 transition-all font-mono tracking-wider text-center"
                  >
                    WIPE ADVENTURE HISTORY
                  </button>
                ) : (
                  <div className="bg-red-950/15 border border-red-900/20 rounded-xl p-3 text-center space-y-3">
                    <p className="text-[10px] text-red-400 leading-snug">Confirmation required. Erases all companions, inventory state, memory variables and current choices.</p>
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => setShowResetConfirm(false)}
                        className="flex-1 py-1 text-[10px] font-semibold rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                      >
                        Keep Save
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          setShowResetConfirm(false);
                          localStorage.removeItem('infiniteAdventureSave');
                          setGameState(null);
                          setStoryHistory([]);
                          setImageUrl(null);
                          setChatHistory([]);
                          startGame();
                        }}
                        className="flex-1 py-1 text-[10px] font-bold rounded bg-red-650 text-white hover:bg-red-600 transition-colors"
                      >
                        Confirm Wipe
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen relative">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto w-full p-8 pb-32">
            
            {/* Scene Image */}
            <div className="w-full aspect-video bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden relative mb-8 shadow-2xl">
              <AnimatePresence mode="wait">
                {imageUrl ? (
                  <motion.img
                    key={imageUrl}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    src={imageUrl}
                    alt="Scene"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-600">
                    <ImageIcon size={48} className="opacity-20" />
                  </div>
                )}
              </AnimatePresence>
              
              {isGeneratingImage && (
                <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center">
                  <div className="flex items-center gap-3 text-indigo-400 bg-zinc-900/90 px-4 py-2 rounded-full border border-zinc-800">
                    <Loader2 className="animate-spin" size={18} />
                    <span className="text-sm font-medium">Visualizing scene...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Story Text */}
            <div className="prose prose-invert prose-zinc max-w-none mb-12">
              {error && (
                <div className="bg-red-950/50 border border-red-900 text-red-400 p-4 rounded-xl mb-6">
                  <p className="font-bold mb-1">Error</p>
                  <p className="text-sm">{error}</p>
                  <button onClick={startGame} className="mt-3 text-sm underline hover:text-red-300">Restart Adventure</button>
                </div>
              )}
              
              {isGeneratingStory && !gameState ? (
                <div className="flex items-center gap-3 text-zinc-400">
                  <Loader2 className="animate-spin" size={20} />
                  Weaving the tale...
                </div>
              ) : (
                <motion.div
                  key={gameState?.storyText}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-lg leading-relaxed text-zinc-300"
                >
                  <ReactMarkdown 
                    components={{
                      p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} />,
                      strong: ({node, ...props}) => <strong className="text-white font-bold" {...props} />,
                      em: ({node, ...props}) => <em className="text-zinc-400 italic" {...props} />,
                    }}
                  >
                    {gameState?.storyText || ""}
                  </ReactMarkdown>
                </motion.div>
              )}
            </div>

            {/* Choices */}
            {gameState && !isGeneratingStory && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {gameState.choices.map((choice, i) => (
                  <button
                    key={i}
                    onClick={() => handleChoice(choice)}
                    className="text-left p-4 bg-zinc-900 border border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-800/50 rounded-xl transition-all group"
                  >
                    <div className="text-indigo-400 text-xs font-bold mb-1 uppercase tracking-wider group-hover:text-indigo-300">Option {i + 1}</div>
                    <div className="text-zinc-200">{choice}</div>
                  </button>
                ))}
                
                {/* Custom Action Input */}
                <div className="md:col-span-2 mt-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Or do something else..."
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                          handleChoice(e.currentTarget.value.trim());
                          e.currentTarget.value = '';
                        }
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            )}
            
            {isGeneratingStory && gameState && (
              <div className="flex items-center justify-center gap-3 text-indigo-400 py-8">
                <Loader2 className="animate-spin" size={24} />
                <span className="font-medium">The story continues...</span>
              </div>
            )}
          </div>
        </div>

        {/* Chatbot Toggle Button */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="absolute bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg shadow-indigo-900/20 flex items-center justify-center transition-transform hover:scale-105 z-50"
        >
          <MessageSquare size={24} />
        </button>

        {/* Chatbot Panel */}
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="absolute bottom-24 right-6 w-96 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-40"
              style={{ height: '500px', maxHeight: 'calc(100vh - 120px)' }}
            >
              {/* Chat Header */}
              <div className="p-4 border-b border-zinc-800 bg-zinc-950/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white font-medium">
                  <Brain size={18} className="text-indigo-400" />
                  Oracle
                </div>
                <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setChatModel('gemini-3.1-flash-lite-preview')}
                    className={`px-2 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-colors ${
                      chatModel === 'gemini-3.1-flash-lite-preview' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                    title="Fast responses"
                  >
                    <Zap size={12} /> Fast
                  </button>
                  <button
                    onClick={() => setChatModel('gemini-3.1-pro-preview')}
                    className={`px-2 py-1 text-xs font-medium rounded-md flex items-center gap-1 transition-colors ${
                      chatModel === 'gemini-3.1-pro-preview' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                    title="Smart responses"
                  >
                    <Brain size={12} /> Smart
                  </button>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatHistory.length === 0 && (
                  <div className="text-center text-zinc-500 text-sm mt-8">
                    Ask the Oracle about the world, your quest, or what to do next.
                  </div>
                )}
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-br-sm' 
                        : 'bg-zinc-800 text-zinc-200 rounded-bl-sm'
                    }`}>
                      <ReactMarkdown 
                        components={{
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />
                        }}
                      >
                        {msg.parts[0].text}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))}
                {isChatting && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-800 text-zinc-400 rounded-2xl rounded-bl-sm px-4 py-3 text-sm flex items-center gap-2">
                      <Loader2 className="animate-spin" size={14} /> Thinking...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleChatSubmit} className="p-3 border-t border-zinc-800 bg-zinc-950/50">
                <div className="relative">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask the Oracle..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-4 pr-10 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isChatting}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-indigo-400 disabled:opacity-50 disabled:hover:text-zinc-400 transition-colors"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
