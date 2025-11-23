
import React, { useEffect, useRef } from 'react';
import { useGameStore } from './state/gameStore';
import { turnService } from './state/turnService';
import { BEHAVIOR_CONFIG } from './config/behaviorTuning';
import NarrativeLog from './components/NarrativeLog';
import Grimoire from './components/Grimoire';
import StatusLedger from './components/StatusLedger';
import NetworkGraph from './components/NetworkGraph';
import ReactiveCanvas from './components/ReactiveCanvas';
import DistortionLayer from './components/DistortionLayer';
import DevOverlay from './components/DevOverlay';
import { Menu, Terminal, Activity, Zap, X } from 'lucide-react';

const App: React.FC = () => {
  // Store Hooks
  const gameState = useGameStore(state => state.gameState);
  const logs = useGameStore(state => state.logs);
  const choices = useGameStore(state => state.choices);
  const isThinking = useGameStore(state => state.isThinking);
  const isMenuOpen = useGameStore(state => state.isMenuOpen);
  const isGrimoireOpen = useGameStore(state => state.isGrimoireOpen);
  const executedCode = useGameStore(state => state.executedCode);
  const setMenuOpen = useGameStore(state => state.setMenuOpen);
  const setGrimoireOpen = useGameStore(state => state.setGrimoireOpen);
  const setDevOverlayOpen = useGameStore(state => state.setDevOverlayOpen);
  const addLog = useGameStore(state => state.addLog);

  // Local UI State (for purely visual toggles not needed in global store)
  const [canvasActive, setCanvasActive] = React.useState(true);
  const hasInitialized = useRef(false);

  // Background Media Logic
  const activeBackground = [...logs].reverse().find(l => l.imageData || l.videoData);
  const latestImage = activeBackground?.imageData;
  const latestVideo = activeBackground?.videoData;

  // Initialize Game
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    turnService.initGame();
  }, []);

  // Haptic Feedback
  useEffect(() => {
    if (BEHAVIOR_CONFIG.ANIMATION.ENABLE_HAPTICS) {
      if (gameState.ledger.shamePainAbyssLevel > 85 || gameState.ledger.traumaLevel > 90) {
        if ('vibrate' in navigator) {
          navigator.vibrate([100, 50, 100]);
        }
      }
    }
  }, [gameState.ledger.shamePainAbyssLevel, gameState.ledger.traumaLevel]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Dev Overlay with `
      if (e.key === BEHAVIOR_CONFIG.DEV_MODE.TRIGGER_KEY) {
        e.preventDefault();
        const current = useGameStore.getState().isDevOverlayOpen;
        setDevOverlayOpen(!current);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setDevOverlayOpen]);

  // Grimoire Handler
  const handleGrimoireResult = (type: 'image' | 'video' | 'text', data: string, context: string) => {
      const toolLog = {
          id: `tool-${Date.now()}`,
          type: 'tool_output' as const,
          content: type === 'text' ? data : `> ARTIFACT GENERATED: ${context}`,
          imageData: type === 'image' ? data : undefined,
          videoData: type === 'video' ? data : undefined
      };
      addLog(toolLog);
  };

  return (
    <DistortionLayer ledger={gameState.ledger}>
      <div className="relative w-full h-screen overflow-hidden bg-forge-black text-forge-text font-sans selection:bg-forge-gold selection:text-black">
        
        {/* DEV OVERLAY */}
        <DevOverlay />

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
              onClick={() => setMenuOpen(true)}
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
              <span className={gameState.ledger.traumaLevel > BEHAVIOR_CONFIG.TRAUMA_THRESHOLDS.GLITCH_START ? 'text-forge-crimson animate-pulse' : 'text-stone-500'}>
                TRM:{gameState.ledger.traumaLevel}%
              </span>
              <span className="text-stone-700">|</span>
              <span className={gameState.ledger.shamePainAbyssLevel > BEHAVIOR_CONFIG.TRAUMA_THRESHOLDS.GLITCH_START ? 'text-forge-crimson' : 'text-stone-500'}>
                SHM:{gameState.ledger.shamePainAbyssLevel}%
              </span>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
             <button 
                 onClick={() => setGrimoireOpen(true)}
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
               onChoice={turnService.handleAction}
               ledger={gameState.ledger}
             />
          </div>
        </div>

        {/* OVERLAYS: MENU / STATS */}
        {isMenuOpen && (
          <div className="absolute inset-0 z-50 bg-black/98 backdrop-blur-xl p-8 animate-fade-in flex flex-col md:flex-row gap-12 overflow-y-auto">
            <button onClick={() => setMenuOpen(false)} className="absolute top-6 right-6 text-stone-500 hover:text-forge-gold transition-colors"><X /></button>
            
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
          onClose={() => setGrimoireOpen(false)} 
          onResult={handleGrimoireResult}
          gameState={gameState}
        />

      </div>
    </DistortionLayer>
  );
};

export default App;
