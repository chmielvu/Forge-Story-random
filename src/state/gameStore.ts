
import { create } from 'zustand';
import { GameState, LogEntry, DirectorOutput, YandereLedger, CombinedGameStoreState } from '../types';
import { INITIAL_LEDGER, INITIAL_NODES, INITIAL_LINKS } from '../constants';
import { updateLedgerHelper, reconcileGraphHelper } from './stateHelpers';
import { createMultimodalSlice } from './multimodalSlice';

const INITIAL_GAME_STATE: GameState = {
  ledger: INITIAL_LEDGER,
  nodes: INITIAL_NODES,
  links: INITIAL_LINKS,
  turn: 0,
  location: 'The Arrival Dock',
};

export const useGameStore = create<CombinedGameStoreState>((set, get, api) => ({
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

  // Initialize multimodal slice
  ...createMultimodalSlice(set, get, api), 

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

  // NOTE: updateLogMedia is now deprecated, use multimodalSlice.markMediaReady etc.
  // Kept for Grimoire integration (tool_output logs)
  updateLogMedia: (logId, media) => set((state) => ({
    logs: state.logs.map(log => 
      log.id === logId 
        ? { ...log, ...media }
        : log
    )
  })),

  resetGame: () => {
    get().resetMultimodalState(); // Reset multimodal specific state first
    set({
      gameState: INITIAL_GAME_STATE,
      logs: [],
      choices: [],
      isThinking: false,
      executedCode: undefined,
      lastSimulationLog: undefined,
      lastDirectorDebug: undefined,
      isMenuOpen: false,
      isGrimoireOpen: false,
      isDevOverlayOpen: false,
    });
  },

  saveSnapshot: () => {
    const state = get();
    const snapshot = {
      gameState: state.gameState,
      logs: state.logs,
      choices: state.choices,
      multimodalTimeline: state.multimodalTimeline,
      currentTurnId: state.currentTurnId,
      // Do not save functions or non-serializable objects
    };
    try {
      localStorage.setItem('forge_loom_snapshot', JSON.stringify(snapshot));
      state.addLog({ id: `sys-save-${Date.now()}`, type: 'system', content: 'SYSTEM_SAVE::SNAPSHOT_CAPTURED.' });
    } catch (e) {
      console.error("Failed to save snapshot:", e);
      state.addLog({ id: `sys-save-fail-${Date.now()}`, type: 'system', content: 'SYSTEM_ERROR::SNAPSHOT_SAVE_FAILED.' });
    }
  },

  loadSnapshot: () => {
    try {
      const snapshotString = localStorage.getItem('forge_loom_snapshot');
      if (snapshotString) {
        const snapshot = JSON.parse(snapshotString);
        set((state) => {
          // Reset multimodal state first to clear any playing audio etc.
          state.resetMultimodalState(); 
          return {
            gameState: snapshot.gameState,
            logs: snapshot.logs,
            choices: snapshot.choices,
            multimodalTimeline: snapshot.multimodalTimeline,
            currentTurnId: snapshot.currentTurnId,
            isThinking: false,
            executedCode: undefined,
            lastSimulationLog: undefined,
            lastDirectorDebug: undefined,
            isMenuOpen: false,
            isGrimoireOpen: false,
            isDevOverlayOpen: false,
          };
        });
        get().addLog({ id: `sys-load-${Date.now()}`, type: 'system', content: 'SYSTEM_LOAD::SNAPSHOT_RESTORED.' });
      } else {
        get().addLog({ id: `sys-load-fail-${Date.now()}`, type: 'system', content: 'SYSTEM_ERROR::NO_SNAPSHOT_FOUND.' });
      }
    } catch (e) {
      console.error("Failed to load snapshot:", e);
      get().addLog({ id: `sys-load-fail-${Date.now()}`, type: 'system', content: 'SYSTEM_ERROR::SNAPSHOT_LOAD_FAILED.' });
    }
  },
}));
