
import { useGameStore } from './gameStore';
import { generateNarrativeImage, generateSpeech, animateImageWithVeo } from '../services/mediaService';
import { MediaQueueItem, MediaStatus, MultimodalTurn } from '../types';
import { BEHAVIOR_CONFIG } from '../config/behaviorTuning';

let mediaProcessingTimeout: ReturnType<typeof setTimeout> | null = null;
const MEDIA_PROCESSING_DELAY_MS = 500; // Delay between processing queue items

/**
 * Processes the next item in the media generation queue.
 * @returns {Promise<void>}
 */
const processMediaQueue = async (): Promise<void> => {
  const store = useGameStore.getState();
  const { mediaQueue, multimodalTimeline, markMediaPending, markMediaReady, markMediaError, removeMediaFromQueue, retryFailedMedia } = store;

  // Stop if dev mode is set to skip media generation
  if (BEHAVIOR_CONFIG.DEV_MODE.skipMediaGeneration) {
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[MediaController] Skipping media generation due to DEV_CONFIG.skipMediaGeneration.");
    // Clear queue so it doesn't build up
    if (mediaQueue.pending.length > 0) {
      setTimeout(() => useGameStore.setState(s => ({
        mediaQueue: { ...s.mediaQueue, pending: [] }
      })), 0);
    }
    return;
  }

  if (mediaQueue.inProgress.length > 0) {
    // Already processing an item, reschedule check
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[MediaController] Media generation in progress, rescheduling queue check.");
    if (mediaProcessingTimeout) clearTimeout(mediaProcessingTimeout);
    mediaProcessingTimeout = setTimeout(processMediaQueue, MEDIA_PROCESSING_DELAY_MS);
    return;
  }

  const nextItem = mediaQueue.pending[0];
  if (!nextItem) {
    // Queue is empty
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[MediaController] Media queue is empty.");
    return;
  }

  // Mark as in progress
  markMediaPending(nextItem);
  const turn = multimodalTimeline.find(t => t.id === nextItem.turnId);

  if (!turn) {
    console.error(`[MediaController] Turn ${nextItem.turnId} not found for media item ${nextItem.type}. Removing from queue.`);
    removeMediaFromQueue(nextItem);
    // Continue processing next item
    if (mediaProcessingTimeout) clearTimeout(mediaProcessingTimeout);
    mediaProcessingTimeout = setTimeout(processMediaQueue, MEDIA_PROCESSING_DELAY_MS);
    return;
  }

  try {
    let dataUrl: string | undefined = undefined;
    let duration: number | undefined = undefined;

    switch (nextItem.type) {
      case 'image':
        dataUrl = await generateNarrativeImage(nextItem.prompt);
        break;
      case 'audio':
        if (BEHAVIOR_CONFIG.ANIMATION.ENABLE_TTS && BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableAudio) {
          dataUrl = await generateSpeech(nextItem.narrativeText || nextItem.prompt);
          // TODO: Real audio duration from actual audio buffer
          duration = nextItem.narrativeText ? Math.max(5, nextItem.narrativeText.split(' ').length * 0.4) : 10;
        } else {
          console.warn("[MediaController] Audio generation disabled by config.");
        }
        break;
      case 'video':
        if (BEHAVIOR_CONFIG.ANIMATION.ENABLE_VEO && BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideo) {
          // For video, we need the image data first.
          // This highlights a potential dependency. For now, assume image is ready or handled.
          // A more robust system would check imageStatus.
          const imageData = multimodalTimeline.find(t => t.id === nextItem.turnId)?.imageData;
          if (imageData) {
            dataUrl = await animateImageWithVeo(imageData, nextItem.prompt);
          } else {
            console.warn(`[MediaController] Cannot generate video for turn ${nextItem.turnId}: image data not available.`);
          }
        } else {
          console.warn("[MediaController] Video generation disabled by config.");
        }
        break;
      default:
        console.warn(`[MediaController] Unknown media type: ${nextItem.type}`);
    }

    if (dataUrl) {
      markMediaReady(nextItem.turnId, nextItem.type, dataUrl, duration);
      if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log(`[MediaController] Successfully generated ${nextItem.type} for turn ${nextItem.turnId}.`);
    } else {
      throw new Error(`Generated ${nextItem.type} data is empty.`);
    }
  } catch (error: any) {
    console.error(`[MediaController] Failed to generate ${nextItem.type} for turn ${nextItem.turnId}:`, error);
    markMediaError(nextItem.turnId, nextItem.type, error.message || 'Unknown media generation error');
    // After marking as error, attempt to retry if not maxed out
    const currentItem = store.mediaQueue.inProgress.find((q) => q.turnId === nextItem.turnId && q.type === nextItem.type);
    if (currentItem && (currentItem.retries || 0) < BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.MAX_MEDIA_QUEUE_RETRIES) {
      if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log(`[MediaController] Retrying ${nextItem.type} for turn ${nextItem.turnId}. Attempt ${currentItem.retries + 1}`);
      retryFailedMedia(nextItem.turnId, nextItem.type); // Enqueue for retry
    } else {
      if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.warn(`[MediaController] Max retries reached for ${nextItem.type} on turn ${nextItem.turnId}. Moving to failed queue.`);
      // It's already in the failed queue via markMediaError, no further action needed.
    }
  } finally {
    // Process next item after a short delay, regardless of success or failure
    if (mediaProcessingTimeout) clearTimeout(mediaProcessingTimeout);
    mediaProcessingTimeout = setTimeout(processMediaQueue, MEDIA_PROCESSING_DELAY_MS);
  }
};


/**
 * Enqueues a turn's required media for generation.
 * @param {MultimodalTurn} turn The turn to generate media for.
 * @param {boolean} forceEnqueue If true, forces re-enqueueing even if status is not 'idle'.
 */
export const enqueueTurnForMedia = (turn: MultimodalTurn, forceEnqueue: boolean = false) => {
  const store = useGameStore.getState();

  if (BEHAVIOR_CONFIG.DEV_MODE.skipMediaGeneration) {
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log(`[MediaController] Skipping enqueue for turn ${turn.id} due to DEV_CONFIG.skipMediaGeneration.`);
    return;
  }

  // Image
  if ((turn.imageStatus === 'idle' || forceEnqueue) && BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableImages) {
    store.enqueueMediaForTurn({
      turnId: turn.id,
      type: 'image',
      prompt: turn.visualPrompt || turn.text,
      narrativeText: turn.text,
    });
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log(`[MediaController] Enqueued image for turn ${turn.id}`);
  }

  // Audio
  if ((turn.audioStatus === 'idle' || forceEnqueue) && BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableAudio) {
    store.enqueueMediaForTurn({
      turnId: turn.id,
      type: 'audio',
      prompt: turn.text, // Audio prompt is usually the narrative text
      narrativeText: turn.text,
    });
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log(`[MediaController] Enqueued audio for turn ${turn.id}`);
  }

  // Video (conditional)
  const isHighIntensity = (turn.metadata?.ledgerSnapshot?.traumaLevel || 0) > BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideoAboveTrauma ||
                          (turn.metadata?.ledgerSnapshot?.shamePainAbyssLevel || 0) > BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideoAboveShame;
  
  if ((turn.videoStatus === 'idle' || forceEnqueue) && BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideo && isHighIntensity) {
    store.enqueueMediaForTurn({
      turnId: turn.id,
      type: 'video',
      prompt: turn.visualPrompt || turn.text, // Video prompt can be visual or text
      narrativeText: turn.text,
    });
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log(`[MediaController] Enqueued video for turn ${turn.id} (high intensity)`);
  }

  // Start processing if not already running
  if (!mediaProcessingTimeout) {
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[MediaController] Starting media queue processing.");
    mediaProcessingTimeout = setTimeout(processMediaQueue, MEDIA_PROCESSING_DELAY_MS);
  }
};

/**
 * Regenerates media for a specific turn.
 * @param {string} turnId
 * @param {'image' | 'audio' | 'video'} [type] Specific type to regenerate, or all if not specified.
 */
export const regenerateMediaForTurn = async (turnId: string, type?: 'image' | 'audio' | 'video') => {
  const store = useGameStore.getState();
  const turn = store.getTurnById(turnId);
  if (!turn) {
    console.warn(`[MediaController] Cannot regenerate media for non-existent turn ${turnId}`);
    return;
  }

  // Remove existing pending/in-progress/failed items for this turn/type
  const itemsToRemove: MediaQueueItem[] = [];
  if (!type || type === 'image') itemsToRemove.push({ turnId, type: 'image', prompt: '' });
  if (!type || type === 'audio') itemsToRemove.push({ turnId, type: 'audio', prompt: '' });
  if (!type || type === 'video') itemsToRemove.push({ turnId, type: 'video', prompt: '' });

  itemsToRemove.forEach(item => store.removeMediaFromQueue(item));

  // Reset status in timeline
  store.set((state) => ({
    multimodalTimeline: state.multimodalTimeline.map((t) => {
      if (t.id === turnId) {
        const updatedTurn = { ...t };
        if (!type || type === 'image') updatedTurn.imageStatus = 'idle';
        if (!type || type === 'audio') updatedTurn.audioStatus = 'idle';
        if (!type || type === 'video') updatedTurn.videoStatus = 'idle';
        return updatedTurn;
      }
      return t;
    }),
  }));

  // Re-enqueue
  enqueueTurnForMedia(turn, true);
};

/**
 * Preloads media for upcoming turns.
 * @param {string} currentTurnId The ID of the currently active turn.
 * @param {number} count The number of upcoming turns to preload.
 */
export const preloadUpcomingMedia = (currentTurnId: string, count: number) => {
  const store = useGameStore.getState();
  const { multimodalTimeline } = store;

  const currentIndex = multimodalTimeline.findIndex(t => t.id === currentTurnId);
  if (currentIndex === -1) return;

  for (let i = 1; i <= count; i++) {
    const nextTurn = multimodalTimeline[currentIndex + i];
    if (nextTurn) {
      enqueueTurnForMedia(nextTurn);
    }
  }
};

/**
 * Batch regenerates media for multiple turns.
 * @param {string[]} turnIds
 */
export const batchRegenerateMedia = async (turnIds: string[]) => {
  for (const turnId of turnIds) {
    await regenerateMediaForTurn(turnId);
  }
};
