
import { useGameStore } from './gameStore';
import { generateNarrativeImage, generateSpeech, animateImageWithVeo, buildVisualPrompt } from '../services/mediaService';
import { MediaQueueItem, MediaStatus, MultimodalTurn, CharacterId, YandereLedger, PrefectDNA } from '../types';
import { BEHAVIOR_CONFIG } from '../config/behaviorTuning';

// Use number for browser-compatible timer type
let mediaProcessingTimeout: number | null = null;
const MEDIA_PROCESSING_DELAY_MS = 500; // Delay between processing queue items
const MAX_CONCURRENT_MEDIA_GENERATION = 3; // Process up to N media items in parallel

/**
 * Processes a single media item from the queue.
 */
const processSingleMediaItem = async (item: MediaQueueItem): Promise<void> => {
  const store = useGameStore.getState();
  const { multimodalTimeline, markMediaReady, markMediaError, removeMediaFromQueue, retryFailedMedia } = store;

  const turn = multimodalTimeline.find(t => t.id === item.turnId);

  if (!turn) {
    console.error(`[MediaController] Turn ${item.turnId} not found for media item ${item.type}. Removing from queue.`);
    removeMediaFromQueue(item);
    return;
  }

  try {
    let dataUrl: string | undefined = undefined;
    let duration: number | undefined = undefined;

    switch (item.type) {
      case 'image':
        // The item.prompt for images is now expected to be the pre-built coherent JSON string
        dataUrl = await generateNarrativeImage(item.prompt);
        break;
      case 'audio':
        if (BEHAVIOR_CONFIG.ANIMATION.ENABLE_TTS && BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableAudio) {
          const result = await generateSpeech(item.narrativeText || item.prompt);
          // generateSpeech now returns object { audioData, duration }
          if (result && typeof result !== 'string') {
             // Handle structured return if implemented that way, else handle string
             // The services/mediaService.ts implementation returns object { audioData, duration } or undefined
             dataUrl = result.audioData;
             duration = result.duration;
          } else if (typeof result === 'string') {
             // Fallback if service still returns string
             dataUrl = result;
          }
        } else {
          if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.warn("[MediaController] Audio generation disabled by config.");
        }
        break;
      case 'video':
        if (BEHAVIOR_CONFIG.ANIMATION.ENABLE_VEO && BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideo) {
          // For video, we need the image data first.
          const imageData = multimodalTimeline.find(t => t.id === item.turnId)?.imageData;
          if (imageData) {
            // The prompt for video should also be the coherent one
            dataUrl = await animateImageWithVeo(imageData, item.prompt);
          } else {
            if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.warn(`[MediaController] Cannot generate video for turn ${item.turnId}: image data not available.`);
          }
        } else {
          if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.warn("[MediaController] Video generation disabled by config.");
        }
        break;
      default:
        console.warn(`[MediaController] Unknown media type: ${item.type}`);
    }

    if (dataUrl) {
      markMediaReady(item.turnId, item.type, dataUrl, duration);
      if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log(`[MediaController] Successfully generated ${item.type} for turn ${item.turnId}.`);
    } else {
      throw new Error(`Generated ${item.type} data is empty.`);
    }
  } catch (error: any) {
    console.error(`[MediaController] Failed to generate ${item.type} for turn ${item.turnId}:`, error);
    markMediaError(item.turnId, item.type, error.message || 'Unknown media generation error');
    
    // Check if max retries reached after marking as error
    const failedItem = store.mediaQueue.failed.find((q) => q.turnId === item.turnId && q.type === item.type);
    if (failedItem && (failedItem.retries || 0) < BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.MAX_MEDIA_QUEUE_RETRIES) {
      if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log(`[MediaController] Retrying ${item.type} for turn ${item.turnId}. Attempt ${(failedItem.retries || 0) + 1}`);
      retryFailedMedia(item.turnId, item.type); // Enqueue for retry
    } else {
      if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.warn(`[MediaController] Max retries reached for ${item.type} on turn ${item.turnId}. Item remains in failed queue.`);
    }
  }
};


/**
 * Processes the media generation queue, allowing for parallel generation.
 */
const processMediaQueue = async (): Promise<void> => {
  const store = useGameStore.getState();
  const { mediaQueue, markMediaPending } = store;

  // Stop if dev mode is set to skip media generation
  if (BEHAVIOR_CONFIG.DEV_MODE.skipMediaGeneration) {
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[MediaController] Skipping media generation due to DEV_CONFIG.skipMediaGeneration.");
    // Clear queue so it doesn't build up
    if (mediaQueue.pending.length > 0 || mediaQueue.inProgress.length > 0) {
      window.setTimeout(() => useGameStore.setState(s => ({
        mediaQueue: { ...s.mediaQueue, pending: [], inProgress: [] }
      })), 0);
    }
    return;
  }

  const { pending, inProgress } = mediaQueue;
  const availableSlots = MAX_CONCURRENT_MEDIA_GENERATION - inProgress.length;

  if (availableSlots <= 0 && pending.length > 0) {
    // Already processing max concurrent items, and more are pending. Reschedule check.
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log(`[MediaController] Max concurrent items (${MAX_CONCURRENT_MEDIA_GENERATION}) in progress, rescheduling queue check.`);
    if (mediaProcessingTimeout) window.clearTimeout(mediaProcessingTimeout);
    mediaProcessingTimeout = window.setTimeout(processMediaQueue, MEDIA_PROCESSING_DELAY_MS);
    return;
  }

  if (pending.length === 0 && inProgress.length === 0) {
    // Queue is entirely empty
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[MediaController] Media queue is empty.");
    mediaProcessingTimeout = null; // Clear timeout when queue is truly empty
    return;
  }

  // Take the next batch of items from pending
  const itemsToProcess = pending.slice(0, availableSlots);

  if (itemsToProcess.length > 0) {
    // Move items from pending to inProgress state
    itemsToProcess.forEach(item => markMediaPending(item));

    // Process items in parallel
    // We don't await Promise.allSettled here immediately,
    // as processSingleMediaItem will handle its own state updates (ready/error)
    // and subsequent calls to processMediaQueue will pick up the next batch.
    itemsToProcess.map(item => processSingleMediaItem(item));
  }

  // Always reschedule to keep checking the queue,
  // especially as inProgress items complete and open up new slots.
  if (mediaProcessingTimeout) window.clearTimeout(mediaProcessingTimeout);
  mediaProcessingTimeout = window.setTimeout(processMediaQueue, MEDIA_PROCESSING_DELAY_MS);
};


/**
 * Enqueues a turn's required media for generation.
 * @param {MultimodalTurn} turn The turn to generate media for.
 * @param {PrefectDNA | CharacterId} target The main character or subject of the visual.
 * @param {YandereLedger} ledger The current ledger state.
 * @param {MultimodalTurn} [previousTurn] The preceding multimodal turn for visual continuity.
 * @param {boolean} forceEnqueue If true, forces re-enqueueing even if status is not 'idle'.
 */
export const enqueueTurnForMedia = (
  turn: MultimodalTurn,
  target: PrefectDNA | CharacterId,
  ledger: YandereLedger,
  previousTurn?: MultimodalTurn,
  forceEnqueue: boolean = false
) => {
  const store = useGameStore.getState();

  if (BEHAVIOR_CONFIG.DEV_MODE.skipMediaGeneration) {
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log(`[MediaController] Skipping enqueue for turn ${turn.id} due to DEV_CONFIG.skipMediaGeneration.`);
    return;
  }

  // 1. Build the coherent visual prompt once for this turn's image/video
  const finalCoherentVisualPrompt = buildVisualPrompt(
    target, 
    turn.text, // Scene context from narrative text
    ledger, 
    turn.text, // Narrative text
    previousTurn
  );

  // Image
  if ((turn.imageStatus === MediaStatus.idle || forceEnqueue) && BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableImages) {
    store.enqueueMediaForTurn({
      turnId: turn.id,
      type: 'image',
      prompt: finalCoherentVisualPrompt, // Use the coherent prompt
      narrativeText: turn.text,
      target: target,
      previousTurn: previousTurn,
    });
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log(`[MediaController] Enqueued image for turn ${turn.id}`);
  }

  // Audio
  if ((turn.audioStatus === MediaStatus.idle || forceEnqueue) && BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableAudio) {
    store.enqueueMediaForTurn({
      turnId: turn.id,
      type: 'audio',
      prompt: turn.text, // Audio prompt is usually the narrative text
      narrativeText: turn.text,
      target: target,
      previousTurn: previousTurn,
    });
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log(`[MediaController] Enqueued audio for turn ${turn.id}`);
  }

  // Video (conditional)
  const isHighIntensity = (turn.metadata?.ledgerSnapshot?.traumaLevel || 0) > BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideoAboveTrauma ||
                          (turn.metadata?.ledgerSnapshot?.shamePainAbyssLevel || 0) > BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideoAboveShame;
  
  if ((turn.videoStatus === MediaStatus.idle || forceEnqueue) && BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideo && isHighIntensity) {
    store.enqueueMediaForTurn({
      turnId: turn.id,
      type: 'video',
      prompt: finalCoherentVisualPrompt, // Use the coherent prompt
      narrativeText: turn.text,
      target: target,
      previousTurn: previousTurn,
    });
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log(`[MediaController] Enqueued video for turn ${turn.id} (high intensity)`);
  }

  // Start processing if not already running
  if (!mediaProcessingTimeout) {
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[MediaController] Starting media queue processing.");
    mediaProcessingTimeout = window.setTimeout(processMediaQueue, MEDIA_PROCESSING_DELAY_MS);
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

  // Get previous turn and target for re-enqueueing
  const previousTurnIndex = turn.turnIndex - 1;
  const previousTurn = previousTurnIndex >= 0 ? store.multimodalTimeline[previousTurnIndex] : undefined;
  const target = turn.metadata?.activeCharacters?.[0] || CharacterId.PLAYER; // Default to player if no specific character

  // Remove existing pending/in-progress/failed items for this turn/type
  const itemsToRemove: MediaQueueItem[] = [];
  if (!type || type === 'image') itemsToRemove.push({ turnId, type: 'image', prompt: '' });
  if (!type || type === 'audio') itemsToRemove.push({ turnId, type: 'audio', prompt: '' });
  if (!type || type === 'video') itemsToRemove.push({ turnId, type: 'video', prompt: '' });

  itemsToRemove.forEach(item => store.removeMediaFromQueue(item));

  // Reset status in timeline
  useGameStore.setState((state) => ({
    multimodalTimeline: state.multimodalTimeline.map((t) => {
      if (t.id === turnId) {
        const updatedTurn = { ...t };
        if (!type || type === 'image') updatedTurn.imageStatus = MediaStatus.idle;
        if (!type || type === 'audio') updatedTurn.audioStatus = MediaStatus.idle;
        if (!type || type === 'video') updatedTurn.videoStatus = MediaStatus.idle;
        return updatedTurn;
      }
      return t;
    }),
  }));

  // Re-enqueue
  enqueueTurnForMedia(turn, target, store.gameState.ledger, previousTurn, true);
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
      // For preloading, we need to infer target and previous turn
      const previousTurn = multimodalTimeline[currentIndex + i - 1] || multimodalTimeline[currentIndex]; // Use current or previous for context
      const target = nextTurn.metadata?.activeCharacters?.[0] || CharacterId.PROVOST; // Default to Provost if not specified

      enqueueTurnForMedia(nextTurn, target, store.gameState.ledger, previousTurn);
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
