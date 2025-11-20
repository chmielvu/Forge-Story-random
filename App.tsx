import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameState, LogEntry, GraphNode, GraphLink } from './types';
import { INITIAL_LEDGER, INITIAL_NODES, INITIAL_LINKS } from './constants';
import { generateNextTurn, generateNarrativeMedia } from './services/geminiService';
import StatusLedger from './components/StatusLedger'; // Changed to default import
import NetworkGraph from './components/NetworkGraph';
import NarrativeLog from './components/NarrativeLog';
import Grimoire from './components/Grimoire';
import { AlertTriangle, Activity, Hexagon, Eye } from 'lucide-react';

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
      content: 'INITIALIZING YANDERE_LEDGER... VITAL SIGNS NOMINAL.' 
    },
    { 
      id: 'init-2', 
      type: 'narrative', 
      content: 'The volcanic ash tastes like copper on your tongue. You stand on the Weeping Dock, the black stone slick with humidity. Ahead, the monolithic gates of The Forge loom, carved from ancient basalt. A woman in crimson velvet robes waits. Provost Selene. She holds a goblet of wine, her gaze dissecting you before you have taken a single step.' 
    }
  ]);

  const [choices, setChoices] = useState<string[]>([
    "Bow your head and approach silently.",
    "Meet her gaze with defiance.",
    "Scan the environment for escape routes."
  ]);

  const [isThinking, setIsThinking] = useState(false);
  const [isGrimoireOpen, setIsGrimoireOpen] = useState(false);
  const hasInitialized = useRef(false);

  // Initial Art Generation
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initNarrative = logs[1].content;
    const initVisualPrompt = "PROVOST SELENE (Late 40s, regal, raven-black hair in severe braids, cold steel-gray eyes) standing on the Weeping Dock. She wears a floor-length CRIMSON VELVET ROBE with a plunging neckline to the navel (cleavage visible, framed by gold embroidery) and a high hip slit revealing a full thigh, sheer black stocking, and garter. She holds a goblet of red wine. Background: Wet black Roman concrete, monolithic basalt gates, condensation, 'Baroque Brutalism'. Lighting: Vampire Noir, single flickering gaslight, chiaroscuro, cinematic 50mm lens.";
    
    generateNarrativeMedia(initNarrative, initVisualPrompt).then(media => {
      setLogs(currentLogs => 
        currentLogs.map(log => 
          log.id === 'init-2' 
            ? { ...log, imageData: media.imageData, audioData: media.audioData }
            : log
        )
      );
    });
  }, []); // Corrected dependency array to run only once on mount

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
      content: `> SUBJECT_ACTION: ${action.toUpperCase()}`
    };
    setLogs(prev => [...prev, actionLog]);

    const historyText = logs.filter(l => l.type === 'narrative').map(l => l.content);
    const response = await generateNextTurn(historyText, gameState, action);

    setIsThinking(false);

    const validNodeIds = new Set(gameState.nodes.map(n => n.id));
    const validNewEdges = response.new_edges?.filter(e => {
        if (!e.source || !e.target) return false;
        const sourceId = typeof e.source === 'object' ? e.source.id : e.source;
        const targetId = typeof e.target === 'object' ? e.target.id : e.target;
        if (!validNodeIds.has(sourceId) || !validNodeIds.has(targetId)) {
            console.warn(`[Graph Validation] Ignoring edge with invalid node ID: ${sourceId} -> ${targetId}`);
            return false;
        }
        return true;
    }) || [];

    if (response.state_updates) {
      setGameState(prev => ({
        ...prev,
        ledger: { ...prev.ledger, ...response.state_updates },
        turn: prev.turn + 1
      }));
    }

    if (validNewEdges.length > 0) {
      setGameState(prev => {
        const newLinks = [...prev.links];
        validNewEdges.forEach(edge => {
          const sId = typeof edge.source === 'object' ? edge.source.id : edge.source;
          const tId = typeof edge.target === 'object' ? edge.target.id : edge.target;

          const existingIndex = newLinks.findIndex(l => {
            const currentS = typeof l.source === 'object' ? l.source.id : l.source;
            const currentT = typeof l.target === 'object' ? l.target.id : l.target;
            return currentS === sId && currentT === tId;
          });
          
          if (existingIndex >= 0) {
            newLinks[existingIndex] = { ...edge, source: sId, target: tId };
          } else {
            newLinks.push({ ...edge, source: sId, target: tId });
          }
        });
        return { ...prev, links: newLinks };
      });
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
    <div className="min-h-screen bg-forge-black text-forge-text font-sans flex flex-col md:flex-row overflow-hidden selection:bg-forge-crimson selection:text-white">
      
      <div className="w-full md:w-80 flex-shrink-0 border-r border-stone-800 bg-stone-950/80 backdrop-blur-sm flex flex-col gap-4 overflow-y-auto custom-scrollbar z-20">
        <div className="p-6 pb-0">
          <header className="mb-8 border-b border-stone-800 pb-6">
            <h1 className="font-display text-3xl text-white tracking-widest uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] text-center">The Forge's Loom</h1>
            <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-forge-crimson mt-3 opacity-80">
              <Activity size={12} className="animate-pulse" />
              <span>LIVE_SESSION // TURN_{gameState.turn.toString().padStart(3, '0')}</span>
            </div>
          </header>

          <section className="mb-10">
            <div className="flex items-center gap-2 mb-4 text-forge-gold font-mono text-xs uppercase tracking-widest border-l-2 border-forge-gold pl-2">
              <Hexagon size={12} />
              <span>Subject Metrics</span>
            </div>
            <StatusLedger ledger={gameState.ledger} />
          </section>

          <section className="flex-1 min-h-[300px]">
            <div className="flex items-center gap-2 mb-4 text-forge-crimson font-mono text-xs uppercase tracking-widest border-l-2 border-forge-crimson pl-2">
              <AlertTriangle size={12} />
              <span>Knowledge Graph</span>
            </div>
            <NetworkGraph nodes={gameState.nodes} links={gameState.links} />
            <p className="text-[9px] text-stone-600 mt-4 font-mono leading-tight border-t border-stone-900 pt-3 opacity-70">
              *Real-time tracking of social dominance vectors. Nodes represent faculty/prefects. Links represent localized trauma bonds.
            </p>
          </section>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative bg-black">
        <div className="h-16 border-b border-stone-900 flex items-center justify-between px-10 bg-stone-950/95 backdrop-blur-md z-20 sticky top-0 shadow-2xl">
          <div className="flex items-center">
             <span className="font-mono text-xs text-stone-600 mr-6 tracking-[0.2em]">LOC_ID:</span>
             <span className="font-display text-xl text-white tracking-[0.15em] uppercase drop-shadow-md">{gameState.location}</span>
          </div>
          <button 
            onClick={() => setIsGrimoireOpen(true)}
            className="flex items-center gap-2 text-xs font-mono text-stone-400 hover:text-forge-crimson uppercase tracking-widest transition-colors border border-stone-800 px-3 py-1 rounded hover:border-forge-crimson"
          >
            <Eye size={14} /> Faculty Terminal
          </button>
        </div>

        <NarrativeLog logs={logs} thinking={isThinking} />

        <div className="p-10 border-t border-stone-900 bg-stone-950/95 backdrop-blur-xl z-30">
          {choices.length > 0 ? (
            <div className="flex flex-col gap-4 max-w-4xl mx-auto">
              {choices.map((choice, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAction(choice)}
                  disabled={isThinking}
                  className="group relative p-6 border border-stone-800 bg-stone-900/40 hover:bg-stone-900 hover:border-stone-600 transition-all duration-300 text-left flex items-center gap-8 overflow-hidden shadow-lg hover:shadow-forge-crimson/10"
                >
                  <div className="w-10 h-10 flex-shrink-0 rounded-full border border-stone-700 flex items-center justify-center text-lg font-display text-stone-500 group-hover:border-white group-hover:text-white transition-colors z-10 bg-stone-950 shadow-inner">
                    {idx + 1}
                  </div>
                  
                  <span className="font-serif text-2xl italic text-stone-300 group-hover:text-white transition-colors z-10 tracking-wide">
                    "{choice}"
                  </span>

                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-forge-crimson/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                </button>
              ))}
            </div>
          ) : (
             <div className="h-32 flex items-center justify-center gap-4 text-stone-600 font-mono text-xs tracking-[0.2em] animate-pulse">
               <div className="w-2 h-2 bg-forge-crimson rounded-full"></div>
               AWAITING DIRECTOR INPUT...
             </div>
          )}
        </div>
      </div>
      
      <div className="pointer-events-none fixed inset-0 shadow-[inset_0_0_200px_rgba(0,0,0,0.9)] z-40 mix-blend-multiply"></div>

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