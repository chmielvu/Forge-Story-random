
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, LogEntry } from './types';
import { INITIAL_LEDGER, INITIAL_NODES, INITIAL_LINKS } from './constants';
import { generateNextTurn, generateNarrativeMedia } from './services/geminiService';
import NarrativeLog from './components/NarrativeLog';
import Grimoire from './components/Grimoire';
import StatusLedger from './components/StatusLedger';
import NetworkGraph from './components/NetworkGraph';
import { Menu, Eye, X, Activity } from 'lucide-react';

const App: React.FC = () => {
  // Game State
  const [gameState, setGameState] = useState<GameState>({
    ledger: INITIAL_LEDGER,
    nodes: INITIAL_NODES,
    links: INITIAL_LINKS,
    turn: 0,
    location: 'The Arrival Dock',
  });

  const [logs, setLogs] = useState<LogEntry[]>([
    { 
      id: 'init-1', 
      type: 'system', 
      content: 'SYSTEM_BOOT::YANDERE_PROTOCOL_INITIATED...' 
    },
    { 
      id: 'init-2', 
      type: 'narrative', 
      content: 'The volcanic ash tastes like copper on your tongue. You stand on the Weeping Dock, the black stone slick with humidity. Ahead, the monolithic gates of The Forge loom, carved from ancient basalt. A woman in crimson velvet robes waits. Provost Selene. She holds a goblet of wine, her gaze dissecting you before you have taken a single step. The silence is heavy, broken only by the distant rhythmic pounding of the magma hammers deep beneath the earth. Your wrists chafe against the cold iron cuffs.' 
    }
  ]);

  const [choices, setChoices] = useState<string[]>([
    "Bow your head and approach silently.",
    "Meet her gaze with defiance.",
    "Scan the environment for escape routes."
  ]);

  const [isThinking, setIsThinking] = useState(false);
  const [isGrimoireOpen, setIsGrimoireOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const hasInitialized = useRef(false);

  // Derived state for background - find the last log with media
  const activeBackground = [...logs].reverse().find(l => l.imageData || l.videoData);
  const latestImage = activeBackground?.imageData;
  const latestVideo = activeBackground?.videoData;

  // Initial Art Generation
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initNarrative = logs[1].content;
    const initVisualPrompt = "Magistra Selene standing on the Weeping Dock, black volcanic rock, crimson velvet robes, holding wine goblet, stormy sky, cinematic lighting, detailed, oppressive atmosphere.";
    
    generateNarrativeMedia(initNarrative, initVisualPrompt).then(media => {
      setLogs(currentLogs => 
        currentLogs.map(log => 
          log.id === 'init-2' 
            ? { ...log, imageData: media.imageData, audioData: media.audioData }
            : log
        )
      );
    });
  }, []);

  const handleGrimoireResult = (type: 'image' | 'video' | 'text', data: string, context: string) => {
      const toolLog: LogEntry = {
          id: `tool-${Date.now()}`,
          type: 'tool_output',
          content: type === 'text' ? data : `> ARTIFACT GENERATED: ${context}`,
          imageData: type === 'image' ? data : undefined,
          videoData: type === 'video' ? data : undefined
      };
      setLogs(prev => [...prev, toolLog]);
  };

  // Action Handler
  const handleAction = useCallback(async (action: string) => {
    setChoices([]);
    setIsThinking(true);
    
    const actionLog: LogEntry = {
      id: Date.now().toString(),
      type: 'system',
      content: `> SELECTION: ${action.toUpperCase()}`
    };
    setLogs(prev => [...prev, actionLog]);

    const historyText = logs.filter(l => l.type === 'narrative').map(l => l.content);
    const response = await generateNextTurn(historyText, gameState, action);

    setIsThinking(false);

    if (response.state_updates) {
      setGameState(prev => ({
        ...prev,
        ledger: { ...prev.ledger, ...response.state_updates },
        turn: prev.turn + 1
      }));
    }

    if (response.new_edges) {
       setGameState(prev => ({
           ...prev,
           // Simplified edge update logic
           links: [...prev.links, ...response.new_edges!]
       }));
    }

    const narrativeId = `narrative-${Date.now()}`;
    const newLogs: LogEntry[] = [
      { id: `think-${Date.now()}`, type: 'thought', content: response.thought_process },
      { id: narrativeId, type: 'narrative', content: response.narrative }
    ];

    setLogs(prev => [...prev, ...newLogs]);
    setChoices(response.choices);

    generateNarrativeMedia(response.narrative, response.visual_prompt).then(media => {
      setLogs(currentLogs => 
        currentLogs.map(log => 
          log.id === narrativeId 
            ? { ...log, imageData: media.imageData, audioData: media.audioData }
            : log
        )
      );
    });

  }, [logs, gameState]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-forge-text font-sans">
      
      {/* LAYER 0: CINEMATIC BACKGROUND */}
      <div className="absolute inset-0 z-0 transition-opacity duration-1000 ease-in-out">
        {latestVideo ? (
           <video src={latestVideo} autoPlay loop muted playsInline className="w-full h-full object-cover opacity-60" />
        ) : latestImage ? (
           <img src={latestImage.startsWith('data:') ? latestImage : `data:image/jpeg;base64,${latestImage}`} className="w-full h-full object-cover opacity-60 animate-pulse-slow" alt="Scene" />
        ) : (
           <div className="w-full h-full bg-stone-950 opacity-100 flex items-center justify-center">
              <div className="text-stone-800 font-display text-6xl opacity-20">THE FORGE</div>
           </div>
        )}
        {/* Heavy gradient at bottom for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black"></div>
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black via-black/90 to-transparent"></div>
      </div>

      {/* LAYER 1: VIGNETTE & NOISE */}
      <div className="absolute inset-0 z-10 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,1)]"></div>

      {/* LAYER 2: TOP CONTROLS */}
      <div className="absolute top-0 left-0 right-0 z-40 p-6 flex justify-between items-start">
        <div className="flex gap-4">
          <button 
            onClick={() => setIsMenuOpen(true)}
            className="group border border-forge-gold/30 bg-black/50 hover:bg-forge-gold/10 hover:text-forge-gold hover:border-forge-gold p-2 rounded-sm transition-all backdrop-blur-md text-stone-400"
          >
            <Menu size={20} />
          </button>
        </div>
        
        <div className="flex flex-col items-end gap-2">
           <button 
               onClick={() => setIsGrimoireOpen(true)}
               className="border border-stone-700 bg-black/50 text-stone-400 hover:text-white hover:border-white px-4 py-2 rounded-sm backdrop-blur-md font-mono text-xs tracking-widest uppercase flex items-center gap-2 transition-all"
           >
              <Eye size={14} />
              Terminal
           </button>
           <div className="flex items-center gap-2 text-[10px] font-mono text-stone-500">
              <Activity size={10} className={isThinking ? "text-forge-crimson animate-pulse" : "text-stone-700"} />
              <span>{isThinking ? "NEURAL_LINK_ACTIVE" : "AWAITING_INPUT"}</span>
           </div>
        </div>
      </div>

      {/* LAYER 3: BOTTOM NARRATIVE CONSOLE */}
      <div className="absolute bottom-0 left-0 right-0 z-30 h-[35vh] flex flex-col justify-end pb-6 md:pb-12">
        <div className="w-full h-full max-w-7xl mx-auto px-4 md:px-12 flex gap-8 items-end">
           
           {/* NARRATIVE COMPONENT */}
           <div className="flex-1 h-full relative">
              <NarrativeLog 
                logs={logs} 
                thinking={isThinking} 
                choices={choices}
                onChoice={handleAction}
              />
           </div>

        </div>
      </div>

      {/* OVERLAYS: MENU / STATS */}
      {isMenuOpen && (
        <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-xl p-8 animate-fade-in flex flex-col md:flex-row gap-12 overflow-y-auto">
          <button onClick={() => setIsMenuOpen(false)} className="absolute top-6 right-6 text-white hover:text-forge-crimson"><X /></button>
          
          <div className="flex-1 max-w-md space-y-8 pt-10">
             <h2 className="font-display text-3xl text-forge-gold border-b border-stone-800 pb-4">Subject Metrics</h2>
             <StatusLedger ledger={gameState.ledger} />
             <div className="font-mono text-xs text-stone-500 space-y-2 p-4 border border-stone-900 bg-stone-900/20">
                <p>TURN_CYCLE: {gameState.turn}</p>
                <p>CURRENT_SECTOR: {gameState.location}</p>
                <p>SYSTEM_STATUS: NOMINAL</p>
             </div>
          </div>

          <div className="flex-1 max-w-2xl space-y-8 pt-10">
             <h2 className="font-display text-3xl text-forge-crimson border-b border-stone-800 pb-4">Social Web</h2>
             <NetworkGraph nodes={gameState.nodes} links={gameState.links} />
          </div>
        </div>
      )}

      <Grimoire 
        isOpen={isGrimoireOpen} 
        onClose={() => setIsGrimoireOpen(false)} 
        onResult={handleGrimoireResult}
        gameState={gameState}
      />

    </div>
  );
};

export default App;
