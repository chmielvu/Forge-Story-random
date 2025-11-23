import { LogEntry } from '../types';
import { generateNextTurn } from '../services/geminiService';
import { generateEnhancedMedia } from '../services/mediaService';
import { useGameStore } from './gameStore';

export const turnService = {
  
  /**
   * Initializes the game with the intro sequence
   */
  initGame: async () => {
    const store = useGameStore.getState();
    if (store.logs.length > 2) return; // Already initialized

    const initialLogs: LogEntry[] = [
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
    ];

    const initialChoices = [
      "Bow your head and approach silently.",
      "Meet her gaze with defiance.",
      "Scan the environment for escape routes."
    ];

    store.setLogs(initialLogs);
    store.setChoices(initialChoices);

    // Initial Art
    const initVisualPrompt = "Magistra Selene standing on the Weeping Dock, black volcanic rock, crimson velvet robes, holding wine goblet, stormy sky, cinematic lighting, highly detailed, baroque brutalism.";
    
    // Generate media in background
    try {
      const media = await generateEnhancedMedia(initialLogs[1].content, initVisualPrompt, store.gameState.ledger);
      store.updateLogMedia('init-2', media);
    } catch (e) {
      console.error("Initial media generation failed", e);
    }
  },

  /**
   * Handles a player action choice
   */
  handleAction: async (action: string) => {
    const store = useGameStore.getState();
    
    // 1. UI Updates
    store.setChoices([]);
    store.setThinking(true);
    
    // 2. Add System Log
    const actionLog: LogEntry = {
      id: Date.now().toString(),
      type: 'system',
      content: `> SELECTION: ${action.toUpperCase()}`
    };
    store.addLog(actionLog);

    // 3. Call AI Service
    const historyText = store.logs
      .filter(l => l.type === 'narrative')
      .map(l => l.content);
      
    const response = await generateNextTurn(historyText, store.gameState, action);

    // 4. Update Store with Response
    store.setThinking(false);
    store.applyDirectorUpdates(response);
    
    // 5. Add Narrative Logs
    const narrativeId = `narrative-${Date.now()}`;
    const newLogs: LogEntry[] = [
      { id: `think-${Date.now()}`, type: 'thought', content: response.thought_process },
      { id: narrativeId, type: 'narrative', content: response.narrative }
    ];
    newLogs.forEach(log => store.addLog(log));
    
    store.setChoices(response.choices);

    // 6. Generate Media (Async)
    generateEnhancedMedia(response.narrative, response.visual_prompt, store.gameState.ledger)
      .then(media => {
        store.updateLogMedia(narrativeId, media);
      });
  }
};