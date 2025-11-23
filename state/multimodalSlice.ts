import { StateCreator } from 'zustand';
import {
  MultimodalTurn,
  MediaStatus,
  MediaQueueItem,
  AudioPlaybackState,
  CoherenceReport,
  GameState,
  YandereLedger,
  LogEntry
} from '../types';
import { BEHAVIOR_CONFIG } from '../config/behaviorTuning';
import { useGameStore } from './gameStore'; // Import the main store to interact with it

// Helper to generate a unique ID
const generateId = () => `mm_turn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Decode base64 audio (PCM)
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Global AudioContext for shared playback
let globalAudioContext: AudioContext | null = null;
const getAudioContext = () => {
  if (!globalAudioContext) {
    globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  return globalAudioContext;
};

// Main interface for the multimodal slice
export interface MultimodalSlice {
  multimodalTimeline: MultimodalTurn[];
  currentTurnId: string | null;
  mediaQueue: {
    pending: MediaQueueItem[];
    inProgress: MediaQueueItem[];
    failed: MediaQueueItem[];
  };
  audioPlayback: AudioPlaybackState;

  // Timeline Actions
  registerTurn: (
    text: string,
    visualPrompt: string,
    metadata?: Partial<MultimodalTurn['metadata']>
  ) => MultimodalTurn;
  setCurrentTurn: (turnId: string) => void;
  goToNextTurn: () => void;
  goToPreviousTurn: () => void;
  getTurnById: (turnId: string) => MultimodalTurn | undefined;
  getTimelineStats: () => {
    totalTurns: number;
    loadedTurns: number;
    pendingMedia: number;
    failedMedia: number;
    completionRate: number;
  };
  pruneOldTurns: (keepCount: number) => void;

  // Media Queue Actions
  enqueueMediaForTurn: (item: MediaQueueItem) => void;
  markMediaPending: (item: MediaQueueItem) => void;
  markMediaReady: (
    turnId: string,
    type: 'image' | 'audio' | 'video',
    dataUrl: string,
    duration?: number
  ) => void;
  markMediaError: (turnId: string, type: 'image' | 'audio' | 'video', errorMessage: string) => void;
  removeMediaFromQueue: (item: MediaQueueItem) => void;
  retryFailedMedia: (turnId: string, type?: 'image' | 'audio' | 'video') => void;

  // Audio Playback Actions
  playTurn: (turnId: string) => Promise<void>;
  pauseAudio: () => void;
  resumeAudio: () => void;
  seekAudio: (time: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  toggleAutoAdvance: () => void;
  setHasUserInteraction: () => void;

  // Utility Actions
  getCoherenceReport: (turnId: string) => CoherenceReport;
  resetMultimodalState: () => void;
}

export const createMultimodalSlice: StateCreator<
  MultimodalSlice & GameState // Combine with main GameState if needed
> = (set, get) => ({
  multimodalTimeline: [],
  currentTurnId: null,
  mediaQueue: {
    pending: [],
    inProgress: [],
    failed: [],
  },
  audioPlayback: {
    currentPlayingTurnId: null,
    isPlaying: false,
    currentTime: 0,
    volume: 0.7, // Default volume
    playbackRate: 1.0,
    autoAdvance: false,
    hasUserInteraction: false, // Must be true for browser autoplay
  },

  registerTurn: (text, visualPrompt, metadata) => {
    const newTurnIndex = get().multimodalTimeline.length;
    const newTurn: MultimodalTurn = {
      id: generateId(),
      turnIndex: newTurnIndex,
      text,
      visualPrompt,
      imageStatus: 'idle',
      audioStatus: 'idle',
      videoStatus: 'idle',
      metadata: {
        ledgerSnapshot: metadata?.ledgerSnapshot || { ...get().ledger }, // Snapshot current ledger
        activeCharacters: metadata?.activeCharacters || [],
        location: metadata?.location || get().location,
        tags: metadata?.tags || [],
        simulationLog: metadata?.simulationLog,
        directorDebug: metadata?.directorDebug,
      },
    };
    set((state) => ({
      multimodalTimeline: [...state.multimodalTimeline, newTurn],
      currentTurnId: newTurn.id, // Automatically set new turn as current
    }));
    return newTurn;
  },

  setCurrentTurn: (turnId) => {
    const turn = get().multimodalTimeline.find((t) => t.id === turnId);
    if (turn) {
      set({ currentTurnId: turnId });
      // If audio is playing and we switch turn, pause it
      if (get().audioPlayback.currentPlayingTurnId !== turnId && get().audioPlayback.isPlaying) {
        get().pauseAudio();
      }
    } else {
      console.warn(`Attempted to set current turn to non-existent ID: ${turnId}`);
    }
  },

  goToNextTurn: () => {
    const { currentTurnId, multimodalTimeline } = get();
    if (!currentTurnId) return;
    const currentIndex = multimodalTimeline.findIndex((t) => t.id === currentTurnId);
    if (currentIndex !== -1 && currentIndex < multimodalTimeline.length - 1) {
      get().setCurrentTurn(multimodalTimeline[currentIndex + 1].id);
    }
  },

  goToPreviousTurn: () => {
    const { currentTurnId, multimodalTimeline } = get();
    if (!currentTurnId) return;
    const currentIndex = multimodalTimeline.findIndex((t) => t.id === currentTurnId);
    if (currentIndex > 0) {
      get().setCurrentTurn(multimodalTimeline[currentIndex - 1].id);
    }
  },

  getTurnById: (turnId) => {
    return get().multimodalTimeline.find((t) => t.id === turnId);
  },

  getTimelineStats: () => {
    const { multimodalTimeline, mediaQueue } = get();
    const totalTurns = multimodalTimeline.length;
    const loadedTurns = multimodalTimeline.filter(
      (t) => t.imageStatus === 'ready' && t.audioStatus === 'ready' && t.videoStatus !== 'pending'
    ).length;
    const pendingMedia = mediaQueue.pending.length + mediaQueue.inProgress.length;
    const failedMedia = mediaQueue.failed.length;
    const completionRate = totalTurns > 0 ? (loadedTurns / totalTurns) * 100 : 0;
    return { totalTurns, loadedTurns, pendingMedia, failedMedia, completionRate };
  },

  pruneOldTurns: (keepCount) => {
    set((state) => ({
      multimodalTimeline: state.multimodalTimeline.slice(-keepCount),
    }));
  },

  enqueueMediaForTurn: (item) => {
    set((state) => {
      // Avoid duplicate enqueues for the same turnId and type
      const alreadyPending = state.mediaQueue.pending.some(
        (q) => q.turnId === item.turnId && q.type === item.type
      );
      const alreadyInProgress = state.mediaQueue.inProgress.some(
        (q) => q.turnId === item.turnId && q.type === item.type
      );
      if (alreadyPending || alreadyInProgress) {
        if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log(`[MultimodalSlice] Skipping duplicate enqueue for ${item.type} on turn ${item.turnId}`);
        return state;
      }
      return {
        mediaQueue: {
          ...state.mediaQueue,
          pending: [...state.mediaQueue.pending, { ...item, addedAt: Date.now(), retries: 0 }],
        },
      };
    });
  },

  markMediaPending: (item) => {
    set((state) => ({
      mediaQueue: {
        ...state.mediaQueue,
        pending: state.mediaQueue.pending.filter(
          (q) => !(q.turnId === item.turnId && q.type === item.type)
        ),
        inProgress: [...state.mediaQueue.inProgress, item],
      },
      multimodalTimeline: state.multimodalTimeline.map((turn) =>
        turn.id === item.turnId
          ? { ...turn, [`${item.type}Status`]: 'pending' as MediaStatus }
          : turn
      ),
    }));
  },

  markMediaReady: (turnId, type, dataUrl, duration) => {
    set((state) => ({
      mediaQueue: {
        ...state.mediaQueue,
        inProgress: state.mediaQueue.inProgress.filter(
          (q) => !(q.turnId === turnId && q.type === type)
        ),
      },
      multimodalTimeline: state.multimodalTimeline.map((turn) => {
        if (turn.id === turnId) {
          const update: Partial<MultimodalTurn> = { [`${type}Status`]: 'ready' };
          if (type === 'image') update.imageData = dataUrl;
          if (type === 'audio') {
            update.audioUrl = dataUrl;
            update.audioDuration = duration;
          }
          if (type === 'video') update.videoUrl = dataUrl;
          return { ...turn, ...update };
        }
        return turn;
      }),
    }));
  },

  markMediaError: (turnId, type, errorMessage) => {
    set((state) => {
      const item = state.mediaQueue.inProgress.find((q) => q.turnId === turnId && q.type === type);
      const newFailed = item ? [...state.mediaQueue.failed, { ...item, errorMessage }] : state.mediaQueue.failed;
      return {
        mediaQueue: {
          ...state.mediaQueue,
          inProgress: state.mediaQueue.inProgress.filter(
            (q) => !(q.turnId === turnId && q.type === type)
          ),
          failed: newFailed,
        },
        multimodalTimeline: state.multimodalTimeline.map((turn) =>
          turn.id === turnId
            ? { ...turn, [`${type}Status`]: 'error' as MediaStatus, [`${type}Error`]: errorMessage }
            : turn
        ),
      };
    });
  },

  removeMediaFromQueue: (item) => {
    set((state) => ({
      mediaQueue: {
        pending: state.mediaQueue.pending.filter((q) => q.turnId !== item.turnId || q.type !== item.type),
        inProgress: state.mediaQueue.inProgress.filter((q) => q.turnId !== item.turnId || q.type !== item.type),
        failed: state.mediaQueue.failed.filter((q) => q.turnId !== item.turnId || q.type !== item.type),
      },
    }));
  },

  retryFailedMedia: (turnId, type) => {
    set((state) => {
      const failedItems = state.mediaQueue.failed.filter((q) => q.turnId === turnId && (!type || q.type === type));
      if (failedItems.length === 0) return state;

      const newPending: MediaQueueItem[] = [];
      const newFailed = state.mediaQueue.failed.filter((q) => {
        if (q.turnId === turnId && (!type || q.type === type)) {
          if ((q.retries || 0) < BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.MAX_MEDIA_QUEUE_RETRIES) {
            newPending.push({ ...q, retries: (q.retries || 0) + 1, addedAt: Date.now() });
            return false; // Remove from failed, add to pending
          }
          return true; // Keep in failed if max retries reached
        }
        return true;
      });

      // Reset status in timeline for retried items
      const newTimeline = state.multimodalTimeline.map((turn) => {
        if (turn.id === turnId) {
          const updatedTurn = { ...turn };
          failedItems.forEach(item => {
            if (!type || item.type === type) {
              updatedTurn[`${item.type}Status`] = 'idle'; // Reset to idle for retry
              delete updatedTurn[`${item.type}Error`]; // Clear error message
            }
          });
          return updatedTurn;
        }
        return turn;
      });

      return {
        mediaQueue: {
          ...state.mediaQueue,
          pending: [...state.mediaQueue.pending, ...newPending],
          failed: newFailed,
        },
        multimodalTimeline: newTimeline,
      };
    });
  },

  playTurn: async (turnId) => {
    const audioContext = getAudioContext();
    const { audioPlayback, multimodalTimeline, setHasUserInteraction } = get();
    const turn = multimodalTimeline.find((t) => t.id === turnId);

    if (!turn || turn.audioStatus !== 'ready' || !turn.audioUrl) {
      if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.warn(`[MultimodalSlice] Cannot play turn ${turnId}: not ready or no audioUrl.`);
      return;
    }

    // Stop any currently playing audio first
    if (audioPlayback.isPlaying && audioPlayback.currentPlayingTurnId) {
      // Find the AudioBufferSourceNode associated with the current playing turn and stop it
      // This requires storing the source node reference, which is not directly in Zustand.
      // For simplicity, we'll stop all sources when a new one is played or paused.
      // A more robust solution would map turnId to its AudioBufferSourceNode.
      audioContext.suspend(); // Pause all playback
    }

    try {
      const decodedBytes = decode(turn.audioUrl);
      const audioBuffer = await audioContext.decodeAudioData(decodedBytes.buffer);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      source.onended = () => {
        set((state) => {
          if (state.audioPlayback.autoAdvance && state.audioPlayback.currentPlayingTurnId === turnId) {
            // Automatically advance to the next turn if autoAdvance is on
            const currentIndex = state.multimodalTimeline.findIndex(t => t.id === turnId);
            if (currentIndex !== -1 && currentIndex < state.multimodalTimeline.length - 1) {
              const nextTurn = state.multimodalTimeline[currentIndex + 1];
              // Use setTimeout to allow the current turn to fully stop before starting the next
              setTimeout(() => {
                get().setCurrentTurn(nextTurn.id); // Update current turn UI
                get().playTurn(nextTurn.id); // Play next turn audio
              }, 100); 
            }
          }
          return {
            audioPlayback: { ...state.audioPlayback, isPlaying: false, currentPlayingTurnId: null, currentTime: 0 },
          };
        });
      };

      source.start(0); // Play from the beginning
      audioContext.resume(); // Ensure context is running

      setHasUserInteraction(); // Mark that user interaction has occurred

      set((state) => ({
        audioPlayback: {
          ...state.audioPlayback,
          currentPlayingTurnId: turnId,
          isPlaying: true,
          currentTime: 0,
        },
      }));

      // Update current time every second (or more frequently if needed)
      let playbackInterval: NodeJS.Timeout | null = null;
      playbackInterval = setInterval(() => {
        set((state) => {
          // Check if the current audio is still playing the same turn
          if (state.audioPlayback.currentPlayingTurnId === turnId && state.audioPlayback.isPlaying) {
            const newTime = state.audioPlayback.currentTime + 1;
            if (newTime >= (turn.audioDuration || Infinity)) {
              // If audio has theoretically ended, clear interval (onended will handle state)
              if (playbackInterval) clearInterval(playbackInterval);
              return state;
            }
            return {
              audioPlayback: { ...state.audioPlayback, currentTime: newTime },
            };
          } else {
            // Audio stopped or switched, clear interval
            if (playbackInterval) clearInterval(playbackInterval);
            return state;
          }
        });
      }, 1000); // Update every 1 second

    } catch (error) {
      console.error(`[MultimodalSlice] Error playing audio for turn ${turnId}:`, error);
      set((state) => ({
        audioPlayback: { ...state.audioPlayback, isPlaying: false, currentPlayingTurnId: null, currentTime: 0 },
      }));
    }
  },

  pauseAudio: () => {
    const audioContext = getAudioContext();
    audioContext.suspend();
    set((state) => ({ audioPlayback: { ...state.audioPlayback, isPlaying: false } }));
  },

  resumeAudio: () => {
    const audioContext = getAudioContext();
    audioContext.resume();
    set((state) => ({ audioPlayback: { ...state.audioPlayback, isPlaying: true } }));
  },

  seekAudio: (time) => {
    // Current implementation of playTurn starts from 0,
    // robust seek requires re-creating source with offset.
    // For now, it will just update the visual currentTime
    set((state) => ({ audioPlayback: { ...state.audioPlayback, currentTime: time } }));
    console.warn("[MultimodalSlice] Audio seeking not fully implemented with current PCM playback logic. Only UI state updated.");
  },

  setVolume: (volume) => {
    // Requires a GainNode in the AudioContext pipeline. Not implemented in basic playback above.
    // This will only update the UI state.
    set((state) => ({ audioPlayback: { ...state.audioPlayback, volume } }));
    console.warn("[MultimodalSlice] Audio volume control not fully implemented. Only UI state updated.");
  },

  setPlaybackRate: (rate) => {
    // Requires setting playbackRate on AudioBufferSourceNode. Not implemented in basic playback above.
    // This will only update the UI state.
    set((state) => ({ audioPlayback: { ...state.audioPlayback, playbackRate: rate } }));
    console.warn("[MultimodalSlice] Audio playback rate control not fully implemented. Only UI state updated.");
  },

  toggleAutoAdvance: () => {
    set((state) => ({ audioPlayback: { ...state.audioPlayback, autoAdvance: !state.audioPlayback.autoAdvance } }));
  },

  setHasUserInteraction: () => {
    set((state) => ({ audioPlayback: { ...state.audioPlayback, hasUserInteraction: true } }));
  },

  getCoherenceReport: (turnId) => {
    const turn = get().multimodalTimeline.find((t) => t.id === turnId);
    if (!turn) {
      return {
        hasText: false,
        hasImage: false,
        hasAudio: false,
        hasVideo: false,
        isFullyLoaded: false,
        hasErrors: false,
        completionPercentage: 0,
      };
    }

    const hasText = !!turn.text;
    const hasImage = turn.imageStatus === 'ready' && !!turn.imageData;
    const hasAudio = turn.audioStatus === 'ready' && !!turn.audioUrl;
    const hasVideo = turn.videoStatus === 'ready' && !!turn.videoUrl;

    const totalModalities = 4; // text, image, audio, video
    let loadedModalities = 0;
    if (hasText) loadedModalities++;
    if (hasImage) loadedModalities++;
    if (hasAudio) loadedModalities++;
    if (hasVideo) loadedModalities++;

    const isFullyLoaded = hasText && hasImage && hasAudio && hasVideo;
    const hasErrors = turn.imageStatus === 'error' || turn.audioStatus === 'error' || turn.videoStatus === 'error';
    const completionPercentage = (loadedModalities / totalModalities) * 100;

    return {
      hasText,
      hasImage,
      hasAudio,
      hasVideo,
      isFullyLoaded,
      hasErrors,
      completionPercentage,
    };
  },

  resetMultimodalState: () => {
    set({
      multimodalTimeline: [],
      currentTurnId: null,
      mediaQueue: {
        pending: [],
        inProgress: [],
        failed: [],
      },
      audioPlayback: {
        currentPlayingTurnId: null,
        isPlaying: false,
        currentTime: 0,
        volume: 0.7,
        playbackRate: 1.0,
        autoAdvance: false,
        hasUserInteraction: false,
      },
    });
    // Ensure to stop any active audio playback
    getAudioContext().close().catch(e => console.error("Error closing AudioContext:", e));
    globalAudioContext = null; // Reset context
  },
});