import { create } from 'zustand';
import { GameState, LogEntry, DirectorOutput } from '../types';
import { INITIAL_LEDGER, INITIAL_NODES, INITIAL_LINKS } from '../constants';
import { updateLedgerHelper, reconcileGraphHelper } from './stateHelpers';

interface GameStoreState {
  // Data
  gameState: GameState;
  logs: LogEntry[];
  choices: string[];
  
  // UI Flags
  isThinking: boolean;
  isMenuOpen: boolean;
  isGrimoireOpen: boolean;
  isDevOverlayOpen: boolean;
  
  // Dev / Debug Data
  executedCode?: string;
  lastSimulationLog?: string;
  lastDirectorDebug?: string;

  // Actions
  addLog: (log: LogEntry) => void;
  setLogs: (logs: LogEntry[]) => void;
  setChoices: (choices: string[]) => void;
  setThinking: (isThinking: boolean) => void;
  setMenuOpen: (isOpen: boolean) => void;
  setGrimoireOpen: (isOpen: boolean) => void;
  setDevOverlayOpen: (isOpen: boolean) => void;
  
  // Complex Updates
  updateGameState: (updates: Partial<GameState>) => void;
  applyDirectorUpdates: (response: DirectorOutput) => void;
  
  // Media Update (Specific for turn service)
  updateLogMedia: (logId: string, media: { imageData?: string, audioData?: string, videoData?: string }) => void;

  // System
  resetGame: () => void;
}

const INITIAL_GAME_STATE: GameState = {
  ledger: INITIAL_LEDGER,
  nodes: INITIAL_NODES,
  links: INITIAL_LINKS,
  turn: 0,
  location: 'The Arrival Dock',
};

export const useGameStore = create<GameStoreState>((set, get) => ({
  gameState: INITIAL_GAME_STATE,
  logs: [],
  choices: [],
  
  isThinking: false,
  isMenuOpen: false,
  isGrimoireOpen: false,
  isDevOverlayOpen: false,
  
  executedCode: undefined,
  lastSimulationLog: undefined,
  lastDirectorDebug: undefined,

  addLog: (log) => set((state) => ({ logs: [...state.logs, log] })),
  
  setLogs: (logs) => set({ logs }),
  
  setChoices: (choices) => set({ choices }),
  
  setThinking: (isThinking) => set({ isThinking }),
  
  setMenuOpen: (isMenuOpen) => set({ isMenuOpen }),
  
  setGrimoireOpen: (isGrimoireOpen) => set({ isGrimoireOpen }),
  
  setDevOverlayOpen: (isDevOverlayOpen) => set({ isDevOverlayOpen }),

  updateGameState: (updates) => set((state) => ({
    gameState: { ...state.gameState, ...updates }
  })),

  applyDirectorUpdates: (response) => set((state) => {
    const { gameState } = state;
    
    // 1. Update Ledger
    const nextLedger = response.state_updates 
      ? updateLedgerHelper(gameState.ledger, response.state_updates) 
      : gameState.ledger;

    // 2. Update Graph
    const { nodes, links } = reconcileGraphHelper(
      gameState.nodes, 
      gameState.links, 
      response.graph_updates
    );

    // 3. Debug Data
    const executedCode = response.executed_code;
    const lastSimulationLog = response.simulationLog;
    const lastDirectorDebug = response.debugTrace || response.thought_process;

    return {
      gameState: {
        ...gameState,
        ledger: nextLedger,
        nodes,
        links,
        turn: gameState.turn + 1
      },
      executedCode,
      lastSimulationLog,
      lastDirectorDebug
    };
  }),

  updateLogMedia: (logId, media) => set((state) => ({
    logs: state.logs.map(log => 
      log.id === logId 
        ? { ...log, ...media }
        : log
    )
  })),

  resetGame: () => set({
    gameState: INITIAL_GAME_STATE,
    logs: [],
    choices: [],
    isThinking: false,
    executedCode: undefined
  })
}));