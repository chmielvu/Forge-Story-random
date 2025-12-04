
import { StateCreator } from 'zustand';
import {
  MultimodalTurn,
  MediaStatus,
  MediaQueueItem,
  CombinedGameStoreState,
  MultimodalSliceExports,
} from '../types';
import { BEHAVIOR_CONFIG } from '../config/behaviorTuning';
import { INITIAL_LEDGER } from '../constants';

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

export const createMultimodalSlice: StateCreator<
  CombinedGameStoreState,
  [],
  [],
  MultimodalSliceExports 
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
    currentAudioSource: null, // Added for audio resource management
  },

  registerTurn: (text, visualPrompt, metadata) => {
    // Access root state and safely drill down to gameState
    const state = get(); 
    // Fallback to INITIAL_LEDGER if ledger is not yet ready to prevent undefined access
    const currentLedger = state.gameState.ledger || INITIAL_LEDGER; 
    const currentLocation = state.gameState.location || "Unknown";

    const newTurnIndex = state.multimodalTimeline.length;
    const newTurn: MultimodalTurn = {
      id: generateId(),
      turnIndex: newTurnIndex,
      text,
      visualPrompt,
      // Updated to use strict MediaStatus enum members
      imageStatus: MediaStatus.idle,
      audioStatus: MediaStatus.idle,
      videoStatus: MediaStatus.idle,
      metadata: {
        ledgerSnapshot: metadata?.ledgerSnapshot || { ...currentLedger },
        activeCharacters: metadata?.activeCharacters || [],
        location: metadata?.location || currentLocation,
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
      (t) => t.imageStatus === MediaStatus.ready && t.audioStatus === MediaStatus.ready && t.videoStatus !== MediaStatus.pending
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
          ? { ...turn, [`${item.type}Status`]: MediaStatus.inProgress } // Use strict Enum
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
          const update: Partial<MultimodalTurn> = { [`${type}Status`]: MediaStatus.ready }; // Use strict Enum
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
            ? { ...turn, [`${type}Status`]: MediaStatus.error, [`${type}Error`]: errorMessage } // Use strict Enum
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
              updatedTurn[`${item.type}Status`] = MediaStatus.idle; // Reset to IDLE for retry
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

    if (!turn || turn.audioStatus !== MediaStatus.ready || !turn.audioUrl) {
      if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.warn(`[MultimodalSlice] Cannot play turn ${turnId}: not ready or no audioUrl.`);
      return;
    }

    // Stop and disconnect any existing audio source
    if (audioPlayback.currentAudioSource) {
      audioPlayback.currentAudioSource.stop();
      audioPlayback.currentAudioSource.disconnect();
      set((state) => ({ audioPlayback: { ...state.audioPlayback, currentAudioSource: null } }));
    }

    // Suspend audio context if another turn was playing
    if (audioPlayback.isPlaying && audioPlayback.currentPlayingTurnId) {
      audioContext.suspend(); 
    }

    try {
      const decodedBytes = decode(turn.audioUrl);
      const dataInt16 = new Int16Array(decodedBytes.buffer);
      const frameCount = dataInt16.length; 
      const buffer = audioContext.createBuffer(1, frameCount, 24000); 
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0; 
      }

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);

      source.onended = () => {
        set((state) => {
          // Clear the current audio source
          if (state.audioPlayback.currentAudioSource === source) {
            source.disconnect();
          }

          if (state.audioPlayback.autoAdvance && state.audioPlayback.currentPlayingTurnId === turnId) {
            const currentIndex = state.multimodalTimeline.findIndex(t => t.id === turnId);
            if (currentIndex !== -1 && currentIndex < state.multimodalTimeline.length - 1) {
              const nextTurn = state.multimodalTimeline[currentIndex + 1];
              window.setTimeout(() => { // Use window.setTimeout for browser compatibility
                get().setCurrentTurn(nextTurn.id); 
                get().playTurn(nextTurn.id); 
              }, 100); 
            }
          }
          return {
            audioPlayback: { ...state.audioPlayback, isPlaying: false, currentPlayingTurnId: null, currentTime: 0, currentAudioSource: null },
          };
        });
      };

      source.start(0); 
      audioContext.resume(); 

      setHasUserInteraction(); 

      set((state) => ({
        audioPlayback: {
          ...state.audioPlayback,
          currentPlayingTurnId: turnId,
          isPlaying: true,
          currentTime: 0,
          currentAudioSource: source, // Store the new source
        },
      }));

      // Use window.setInterval to ensure return type is number (browser compatible)
      let playbackInterval: number | undefined;
      playbackInterval = window.setInterval(() => {
        set((state) => {
          if (state.audioPlayback.currentPlayingTurnId === turnId && state.audioPlayback.isPlaying) {
            const newTime = state.audioPlayback.currentTime + 1;
            if (newTime >= (turn.audioDuration || Infinity)) {
              if (playbackInterval) window.clearInterval(playbackInterval); 
              return state;
            }
            return {
              audioPlayback: { ...state.audioPlayback, currentTime: newTime },
            };
          } else {
            if (playbackInterval) window.clearInterval(playbackInterval); 
            return state;
          }
        });
      }, 1000); 

    } catch (error) {
      console.error(`[MultimodalSlice] Error playing audio for turn ${turnId}:`, error);
      set((state) => ({
        audioPlayback: { ...state.audioPlayback, isPlaying: false, currentPlayingTurnId: null, currentTime: 0, currentAudioSource: null },
      }));
    }
  },

  pauseAudio: () => {
    const audioContext = getAudioContext();
    const { currentAudioSource } = get().audioPlayback;
    if (currentAudioSource) {
      currentAudioSource.stop(); 
      currentAudioSource.disconnect(); 
    }
    audioContext.suspend();
    set((state) => ({ audioPlayback: { ...state.audioPlayback, isPlaying: false, currentAudioSource: null } }));
  },

  resumeAudio: () => {
    const audioContext = getAudioContext();
    audioContext.resume();
    set((state) => ({ audioPlayback: { ...state.audioPlayback, isPlaying: true } }));
  },

  seekAudio: (time) => {
    set((state) => ({ audioPlayback: { ...state.audioPlayback, currentTime: time } }));
    console.warn("[MultimodalSlice] Audio seeking not fully implemented with current PCM playback logic. Only UI state updated.");
  },

  setVolume: (volume) => {
    set((state) => ({ audioPlayback: { ...state.audioPlayback, volume } }));
    console.warn("[MultimodalSlice] Audio volume control not fully implemented. Only UI state updated.");
  },

  setPlaybackRate: (rate) => {
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
    const hasImage = turn.imageStatus === MediaStatus.ready && !!turn.imageData;
    const hasAudio = turn.audioStatus === MediaStatus.ready && !!turn.audioUrl;
    const hasVideo = turn.videoStatus === MediaStatus.ready && !!turn.videoUrl;

    const totalModalities = 4; // text, image, audio, video
    let loadedModalities = 0;
    if (hasText) loadedModalities++;
    if (hasImage) loadedModalities++;
    if (hasAudio) loadedModalities++;
    if (hasVideo) loadedModalities++;

    const isFullyLoaded = hasText && hasImage && hasAudio && hasVideo;
    const hasErrors = turn.imageStatus === MediaStatus.error || turn.audioStatus === MediaStatus.error || turn.videoStatus === MediaStatus.error;
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
    // Stop any playing audio before reset
    get().pauseAudio();

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
        currentAudioSource: null,
      },
    });
    // Ensure AudioContext is closed and reset
    if (globalAudioContext) {
      globalAudioContext.close().catch(e => console.error("Error closing AudioContext:", e));
      globalAudioContext = null; 
    }
  },
});
