
import React, { useState } from 'react';
import { useGameStore } from '../state/gameStore';
import { X, Activity, Terminal, Database, FileText } from 'lucide-react';

const DevOverlay: React.FC = () => {
  const isOpen = useGameStore(s => s.isDevOverlayOpen);
  const setOpen = useGameStore(s => s.setDevOverlayOpen);
  const gameState = useGameStore(s => s.gameState);
  const executedCode = useGameStore(s => s.executedCode);
  const simulationLog = useGameStore(s => s.lastSimulationLog);
  const debugTrace = useGameStore(s => s.lastDirectorDebug);

  const [activeTab, setActiveTab] = useState<'state' | 'sim' | 'logs'>('state');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md p-4 md:p-8 overflow-hidden font-mono text-xs text-green-500 animate-fade-in">
      <div className="w-full h-full border border-green-900 bg-black flex flex-col shadow-2xl rounded-sm">
        
        {/* Header */}
        <div className="h-10 border-b border-green-900 bg-green-900/10 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Terminal size={14} />
            <span className="font-bold tracking-widest">FORGE_OS::KERNEL_DEBUG</span>
          </div>
          <button onClick={() => setOpen(false)} className="hover:text-white transition-colors"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-green-900">
          <button 
            onClick={() => setActiveTab('state')}
            className={`px-4 py-2 border-r border-green-900 hover:bg-green-900/20 flex gap-2 transition-colors ${activeTab === 'state' ? 'bg-green-900/30 text-white' : ''}`}
          >
            <Database size={12} /> STATE MATRIX
          </button>
          <button 
            onClick={() => setActiveTab('sim')}
            className={`px-4 py-2 border-r border-green-900 hover:bg-green-900/20 flex gap-2 transition-colors ${activeTab === 'sim' ? 'bg-green-900/30 text-white' : ''}`}
          >
            <Activity size={12} /> SIMULATION LOG
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 border-r border-green-900 hover:bg-green-900/20 flex gap-2 transition-colors ${activeTab === 'logs' ? 'bg-green-900/30 text-white' : ''}`}
          >
            <FileText size={12} /> DIRECTOR TRACE
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-black/50">
          
          {activeTab === 'state' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-white mb-2 border-b border-green-800 pb-1 font-bold">LEDGER_DATA</h3>
                <pre className="text-[10px] leading-tight opacity-80 whitespace-pre-wrap">
                  {JSON.stringify(gameState.ledger, null, 2)}
                </pre>
              </div>
              <div>
                <h3 className="text-white mb-2 border-b border-green-800 pb-1 font-bold">GRAPH_NODES ({gameState.nodes.length})</h3>
                <pre className="text-[10px] leading-tight opacity-80 whitespace-pre-wrap">
                  {gameState.nodes.map(n => `[${n.group.toUpperCase()}] ${n.label} (ID: ${n.id})`).join('\n')}
                </pre>
              </div>
              {executedCode && (
                <div>
                   <h3 className="text-white mb-2 border-b border-green-800 pb-1 font-bold">LAST_EXECUTED_CODE</h3>
                   <pre className="text-[10px] text-yellow-500 whitespace-pre-wrap">{executedCode}</pre>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sim' && (
            <div className="h-full">
              <pre className="text-[11px] leading-relaxed whitespace-pre-wrap text-emerald-400">
                {simulationLog || "NO SIMULATION DATA AVAILABLE. \nRun a turn to generate agent simulation logs."}
              </pre>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="h-full">
              <pre className="text-[11px] leading-relaxed whitespace-pre-wrap text-blue-400">
                {debugTrace || "NO DIRECTOR TRACE AVAILABLE. \nRun a turn to see Gemini 3 Pro thought process."}
              </pre>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="h-8 border-t border-green-900 bg-green-900/10 flex items-center px-4 text-[10px] gap-4 opacity-70">
          <span>Turn: {gameState.turn}</span>
          <span>Loc: {gameState.location}</span>
          <span className="ml-auto">Press <code className="bg-green-900/40 px-1 rounded text-white">`</code> to toggle</span>
        </div>

      </div>
    </div>
  );
};

export default DevOverlay;
