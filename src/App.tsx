
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, LogEntry, YandereLedger, GraphNode, GraphLink, DirectorOutput } from './types';
import { INITIAL_LEDGER, INITIAL_NODES, INITIAL_LINKS } from './constants';
import { generateNextTurn } from './services/geminiService';
import { generateEnhancedMedia } from './services/mediaService';
import NarrativeLog from './components/NarrativeLog';
import Grimoire from './components/Grimoire';
import StatusLedger from './components/StatusLedger';
import NetworkGraph from './components/NetworkGraph';
import ReactiveCanvas from './components/ReactiveCanvas';
import DistortionLayer from './components/DistortionLayer';
import { Menu, Eye, X, Activity, Zap, Terminal } from 'lucide-react';

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
  const [canvasActive, setCanvasActive] = useState(true);
  const [executedCode, setExecutedCode] = useState<string | undefined>(undefined);
  
  const hasInitialized = useRef(false);

  // Derived state for background - find the last log with media
  const activeBackground = [...logs].reverse().find(l => l.imageData || l.videoData);
  const latestImage = activeBackground?.imageData;
  const latestVideo = activeBackground?.videoData;

  // Haptic Feedback System
  useEffect(() => {
    if (gameState.ledger.shamePainAbyssLevel > 85 || gameState.ledger.traumaLevel > 90) {
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    }
  }, [gameState.ledger.shamePainAbyssLevel, gameState.ledger.traumaLevel]);

  // Initial Art Generation
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initNarrative = logs[1].content;
    const initVisualPrompt = "Magistra Selene standing on the Weeping Dock, black volcanic rock, crimson velvet robes, holding wine goblet, stormy sky, cinematic lighting, highly detailed, baroque brutalism.";
    
    generateEnhancedMedia(initNarrative, initVisualPrompt, gameState.ledger).then(media => {
      setLogs(currentLogs => 
        currentLogs.map(log => 
          log.id === 'init-2' 
            ? { ...log, imageData: media.imageData, audioData: media.audioData, videoData: media.videoData }
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

  // --- STATE HELPERS ---

  const updateLedger = (current: YandereLedger, updates: Partial<YandereLedger>): YandereLedger => {
    const next = { ...current, ...updates };
    // Deep merge traumaBonds to prevent overwriting
    if (updates.traumaBonds) {
      next.traumaBonds = {
        ...current.traumaBonds,
        ...updates.traumaBonds
      };
    }
    return next;
  };

  const reconcileGraph = (
    currentNodes: GraphNode[], 
    currentLinks: GraphLink[], 
    updates?: DirectorOutput['graph_updates']
  ) => {
    if (!updates) return { nodes: currentNodes, links: currentLinks };

    let nextNodes = [...currentNodes];
    let nextLinks = [...currentLinks];

    // 1. Node Additions/Updates
    if (updates.nodes_added) {
      updates.nodes_added.forEach(newNode => {
        const index = nextNodes.findIndex(n => n.id === newNode.id);
        if (index > -1) {
          nextNodes[index] = { ...nextNodes[index], ...newNode };
        } else {
          nextNodes.push(newNode);
        }
      });
    }

    // 2. Node Removals
    if (updates.nodes_removed) {
      const removedIds = new Set(updates.nodes_removed);
      nextNodes = nextNodes.filter(n => !removedIds.has(n.id));
      nextLinks = nextLinks.filter(l => {
        const s = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
        const t = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
        return !removedIds.has(s) && !removedIds.has(t);
      });
    }

    // 3. Edge Additions/Updates
    if (updates.edges_added) {
      updates.edges_added.forEach(newEdge => {
        const index = nextLinks.findIndex(l => {
            const s = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
            const t = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
            return s === newEdge.source && t === newEdge.target;
        });

        if (index > -1) {
            nextLinks[index] = { ...nextLinks[index], ...newEdge };
        } else {
            nextLinks.push(newEdge);
        }
      });
    }

    // 4. Edge Removals
    if (updates.edges_removed) {
       updates.edges_removed.forEach(rem => {
          nextLinks = nextLinks.filter(l => {
            const s = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id;
            const t = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id;
            return !(s === rem.source && t === rem.target);
          });
       });
    }

    return { nodes: nextNodes, links: nextLinks };
  };

  // Action Handler
  const handleAction = useCallback(async (action: string) => {
    setChoices([]);
    setIsThinking(true);
    setExecutedCode(undefined);
    
    const actionLog: LogEntry = {
      id: Date.now().toString(),
      type: 'system',
      content: `> SELECTION: ${action.toUpperCase()}`
    };
    setLogs(prev => [...prev, actionLog]);

    const historyText = logs.filter(l => l.type === 'narrative').map(l => l.content);
    
    // CALL ENHANCED AGENT SYSTEM
    const response = await generateNextTurn(historyText, gameState, action);

    setIsThinking(false);
    
    if (response.executed_code) {
      setExecutedCode(response.executed_code);
    }

    // ROBUST STATE UPDATES
    setGameState(prev => {
        const nextLedger = response.state_updates 
            ? updateLedger(prev.ledger, response.state_updates) 
            : prev.ledger;
            
        const { nodes, links } = reconcileGraph(prev.nodes, prev.links, response.graph_updates);
        
        return {
            ...prev,
            ledger: nextLedger,
            nodes,
            links,
            turn: prev.turn + 1
        };
    });

    const narrativeId = `narrative-${Date.now()}`;
    const newLogs: LogEntry[] = [
      { id: `think-${Date.now()}`, type: 'thought', content: response.thought_process },
      { id: narrativeId, type: 'narrative', content: response.narrative }
    ];

    setLogs(prev => [...prev, ...newLogs]);
    setChoices(response.choices);

    // Media Pipeline
    generateEnhancedMedia(response.narrative, response.visual_prompt, gameState.ledger).then(media => {
      setLogs(currentLogs => 
        currentLogs.map(log => 
          log.id === narrativeId 
            ? { ...log, imageData: media.imageData, audioData: media.audioData, videoData: media.videoData } 
            : log
        )
      );
    });

  }, [logs, gameState]);

  return (
    <DistortionLayer ledger={gameState.ledger}>
      <div className="relative w-full h-screen overflow-hidden bg-forge-black text-forge-text font-sans selection:bg-forge-gold selection:text-black">
        
        {/* LAYER 0: CINEMATIC BACKGROUND */}
        <div className="absolute inset-0 z-0 transition-opacity duration-1000 ease-in-out">
          {latestVideo ? (
             <video src={latestVideo} autoPlay loop muted playsInline className="w-full h-full object-cover opacity-70" />
          ) : latestImage ? (
             <img src={latestImage.startsWith('data:') ? latestImage : `data:image/jpeg;base64,${latestImage}`} className="w-full h-full object-cover opacity-70 animate-pulse-slow" alt="Scene" />
          ) : (
             <div className="w-full h-full bg-stone-950 opacity-100 flex items-center justify-center">
                <div className="text-forge-gold font-display text-6xl opacity-20">THE FORGE</div>
             </div>
          )}
          
          <ReactiveCanvas ledger={gameState.ledger} isActive={canvasActive} />

          {/* Cinematic Letterbox / Gradients */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/90"></div>
          <div className="absolute bottom-0 left-0 right-0 h-[40vh] bg-gradient-to-t from-black via-black/95 to-transparent"></div>
        </div>

        {/* LAYER 1: ATMOSPHERE */}
        <div className="absolute inset-0 z-10 pointer-events-none shadow-[inset_0_0_200px_rgba(0,0,0,0.8)]"></div>

        {/* LAYER 2: TOP CONTROLS */}
        <div className="absolute top-0 left-0 right-0 z-40 p-6 flex justify-between items-start">
          <div className="flex gap-4">
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="group border border-forge-gold/30 bg-black/50 hover:bg-forge-gold/10 hover:text-forge-gold hover:border-forge-gold p-3 rounded-sm transition-all backdrop-blur-md text-stone-400"
            >
              <Menu size={20} />
            </button>

            <button 
              onClick={() => setCanvasActive(!canvasActive)}
              className={`border border-forge-gold/30 bg-black/50 p-3 rounded-sm transition-all backdrop-blur-md ${canvasActive ? 'text-forge-gold shadow-[0_0_10px_rgba(250,204,21,0.2)]' : 'text-stone-500'}`}
              title="Toggle Particle Effects"
            >
              <Zap size={20} />
            </button>
            
            {/* Quick Stats */}
            <div className="hidden md:flex items-center gap-4 px-4 bg-black/50 border border-stone-800 rounded-sm backdrop-blur-md font-mono text-[10px] tracking-widest">
              <span className={gameState.ledger.traumaLevel > 70 ? 'text-forge-crimson animate-pulse' : 'text-stone-500'}>
                TRM:{gameState.ledger.traumaLevel}%
              </span>
              <span className="text-stone-700">|</span>
              <span className={gameState.ledger.shamePainAbyssLevel > 70 ? 'text-forge-crimson' : 'text-stone-500'}>
                SHM:{gameState.ledger.shamePainAbyssLevel}%
              </span>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
             <button 
                 onClick={() => setIsGrimoireOpen(true)}
                 className="border border-stone-800 bg-black/50 text-stone-400 hover:text-forge-gold hover:border-forge-gold px-4 py-2 rounded-sm backdrop-blur-md font-mono text-xs tracking-widest uppercase flex items-center gap-2 transition-all"
             >
                <Terminal size={14} />
                <span className="hidden md:inline">Director Terminal</span>
             </button>
             <div className="flex items-center gap-2 text-[10px] font-mono text-stone-500">
                <Activity size={10} className={isThinking ? "text-forge-gold animate-pulse" : "text-stone-700"} />
                <span>{isThinking ? "WEAVING_FATE" : "AWAITING_INPUT"}</span>
             </div>
          </div>
        </div>

        {/* LAYER 3: BOTTOM NARRATIVE CONSOLE */}
        <div className="absolute bottom-0 left-0 right-0 z-30 h-[30vh] md:h-[35vh] flex flex-col justify-end pb-4 md:pb-8">
          <div className="w-full h-full max-w-7xl mx-auto px-4 md:px-12 flex gap-8 items-end">
             <NarrativeLog 
               logs={logs} 
               thinking={isThinking} 
               choices={choices}
               onChoice={handleAction}
               ledger={gameState.ledger}
             />
          </div>
        </div>

        {/* OVERLAYS: MENU / STATS */}
        {isMenuOpen && (
          <div className="absolute inset-0 z-50 bg-black/98 backdrop-blur-xl p-8 animate-fade-in flex flex-col md:flex-row gap-12 overflow-y-auto">
            <button onClick={() => setIsMenuOpen(false)} className="absolute top-6 right-6 text-stone-500 hover:text-forge-gold transition-colors"><X /></button>
            
            <div className="flex-1 max-w-md space-y-8 pt-10">
               <h2 className="font-display text-3xl text-forge-gold border-b border-forge-gold/30 pb-4">Subject Metrics</h2>
               <StatusLedger ledger={gameState.ledger} />
               <div className="font-mono text-xs text-stone-500 space-y-2 p-4 border border-stone-900 bg-stone-900/20">
                  <p>TURN_CYCLE: {gameState.turn}</p>
                  <p>CURRENT_SECTOR: {gameState.location}</p>
                  <p>SYSTEM_STATUS: NOMINAL</p>
               </div>
            </div>

            <div className="flex-1 max-w-2xl space-y-8 pt-10">
               <h2 className="font-display text-3xl text-forge-gold border-b border-forge-gold/30 pb-4">Social Graph (NetworkX)</h2>
               <NetworkGraph 
                  nodes={gameState.nodes} 
                  links={gameState.links} 
                  ledger={gameState.ledger} 
                  executedCode={executedCode}
                />
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
    </DistortionLayer>
  );
};

export default App;
