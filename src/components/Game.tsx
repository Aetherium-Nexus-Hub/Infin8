import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { generateStoryStep, generateImage, generateChatResponse, GameState } from '../services/gemini';
import { Scroll, Backpack, Image as ImageIcon, MessageSquare, Send, Loader2, Zap, Brain, Save, ToggleLeft, ToggleRight, BookOpen, Search } from 'lucide-react';
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
            lore: data.gameState.lore ?? []
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
      // Ensure difficultyLevel is set
      const stateWithDifficulty = { 
        ...state, 
        difficultyLevel: state.difficultyLevel ?? 0,
        lore: state.lore ?? []
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
      setGameState(state);
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
      <div className="w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col h-screen shrink-0">
        <div className="p-6 border-b border-zinc-800">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Scroll className="text-indigo-400" />
            Infinite Adventure
          </h1>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Quest Tracker */}
          <div>
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Scroll size={14} /> Current Quest
            </h2>
            <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-300 leading-relaxed">
              {gameState?.quest || "Awaiting your destiny..."}
            </div>
          </div>

          {/* Inventory */}
          <div>
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Backpack size={14} /> Inventory
            </h2>
            {gameState?.inventory && gameState.inventory.length > 0 ? (
              <ul className="space-y-2">
                {gameState.inventory.map((item, i) => (
                  <li key={i} className="bg-zinc-950/50 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-zinc-600 italic">Your pockets are empty.</div>
            )}
          </div>

          {/* Lore Database */}
          <div>
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <BookOpen size={14} /> World Lore
            </h2>
            
            {gameState?.lore && gameState.lore.length > 0 && (
              <div className="relative mb-4">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search lore..."
                  value={loreSearchQuery}
                  onChange={(e) => setLoreSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 transition-all"
                />
              </div>
            )}

            {gameState?.lore && gameState.lore.length > 0 ? (
              <ul className="space-y-3">
                {gameState.lore
                  .filter(entry => entry.toLowerCase().includes(loreSearchQuery.toLowerCase()))
                  .map((entry, i) => (
                    <li key={i} className="text-sm border-l-2 border-indigo-500/30 pl-3 py-1">
                      <div className="text-zinc-300 leading-snug">{entry}</div>
                    </li>
                  ))}
                {gameState.lore.filter(entry => entry.toLowerCase().includes(loreSearchQuery.toLowerCase())).length === 0 && (
                  <div className="text-xs text-zinc-600 italic text-center py-4"> No matches found.</div>
                )}
              </ul>
            ) : (
              <div className="text-sm text-zinc-600 italic">The world's history remains a mystery.</div>
            )}
          </div>

          {/* Settings */}
          <div>
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <ImageIcon size={14} /> Image Quality
            </h2>
            <div className="flex bg-zinc-950/50 border border-zinc-800 rounded-lg p-1">
              {(["1K", "2K", "4K"] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setImageSize(size)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    imageSize === size ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Auto-Save */}
          <div>
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Save size={14} /> Auto-Save
            </h2>
            <div className="flex items-center justify-between bg-zinc-950/50 border border-zinc-800 rounded-lg p-3">
              <span className="text-sm text-zinc-300">Enable Auto-Save</span>
              <button 
                onClick={() => {
                  const newVal = !isAutoSaveEnabled;
                  setIsAutoSaveEnabled(newVal);
                  localStorage.setItem('autoSaveEnabled', JSON.stringify(newVal));
                }}
                className={`transition-colors ${isAutoSaveEnabled ? 'text-indigo-400' : 'text-zinc-600'}`}
              >
                {isAutoSaveEnabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
              </button>
            </div>
            {lastSaved && isAutoSaveEnabled && (
              <div className="text-xs text-zinc-500 mt-2 text-right">
                Last saved: {lastSaved.toLocaleTimeString()}
              </div>
            )}
            <div className="mt-4">
              {!showResetConfirm ? (
                <button 
                  onClick={() => setShowResetConfirm(true)}
                  className="w-full py-2 text-xs font-medium rounded-lg bg-zinc-900 text-red-400 hover:bg-red-950/30 border border-zinc-800 hover:border-red-900/50 transition-colors"
                >
                  Reset Game
                </button>
              ) : (
                <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-red-400 mb-3">Are you sure? All progress will be lost.</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setShowResetConfirm(false)}
                      className="flex-1 py-1.5 text-xs font-medium rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => {
                        setShowResetConfirm(false);
                        localStorage.removeItem('infiniteAdventureSave');
                        setGameState(null);
                        setStoryHistory([]);
                        setImageUrl(null);
                        setChatHistory([]);
                        startGame();
                      }}
                      className="flex-1 py-1.5 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-500 transition-colors"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
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
