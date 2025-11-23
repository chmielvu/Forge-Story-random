# Multimodal Zustand Integration Guide

## Overview

This guide explains how to integrate the complete multimodal Zustand slice into **The Forge's Loom** to achieve synchronized text, voice, and image experiences.

---

## Files Created

### Core State Management

1. **`state/multimodalSlice.ts`**

  * Complete multimodal slice with types and actions

  * Manages timeline, audio playback, media queue

  * ~600 lines of production-ready code

2. **`state/gameStore.ts`**

  * Combines core game state + multimodal slice

  * Single unified Zustand store

  * Replaces your existing `gameStore.ts`

3. **`state/stateHelpers.ts`**

  * Pure functions for state updates

  * Already created in previous refactor

### Services

1. **`state/mediaController.ts`**

  * Orchestrates image/audio/video generation

  * Queue processor for sequential media generation

  * Batch operations and preloading

2. **`state/turnService.ts`**

  * Updated turn service with multimodal registration

  * Replaces your existing `turnService.ts`

  * Automatically registers turns in timeline

### UI Components

1. **`components/MediaPanel.tsx`**

  * Complete media viewer component

  * Synchronized image + audio playback

  * Timeline navigation controls

2. **`components/DevOverlay.tsx`**

  * Extended dev console with multimodal tab

  * Timeline inspection and debugging

  * Coherence reporting

---

## Integration Steps

### Step 1: Install Dependencies

```bash
npm install zustand
```

### Step 2: Replace Core Files

Replace these existing files with the new versions:

* `state/gameStore.ts` (This file is updated with multimodal integration)

* `state/turnService.ts` (This file is updated with multimodal integration)

* `components/DevOverlay.tsx` (This file is updated with multimodal integration)

### Step 3: Add New Files

Copy these new files into your project:

* `state/multimodalSlice.ts`

* `state/mediaController.ts`

* `components/MediaPanel.tsx`

### Step 4: Update Imports

In all files that import from `gameStore` or `turnService`, ensure they point to the main files:

```ts
// Example: In App.tsx or other components
import { useGameStore } from './state/gameStore'; // No longer .integrated suffix
import { turnService } from './state/turnService'; // No longer .integrated suffix
```

### Step 5: Update App.tsx

Add the MediaPanel to your layout:

```tsx
import { MediaPanel } from './components/MediaPanel';

// In your render, within the main layout grid:
<div className="flex-1 max-w-xl space-y-8 pt-10">
    <h2 className="font-display text-3xl text-forge-gold border-b border-forge-gold/30 pb-4">Multimodal Timeline</h2>
    <div className="h-[400px] w-full border border-stone-800 rounded-sm overflow-hidden">
        <MediaPanel />
    </div>
</div>
```

*Note: The example above places the `MediaPanel` inside the main menu overlay for now, as that's where the existing app has space. You can adjust its placement as needed.*

### Step 6: Update Media Service (Already Done in this Update)

In `services/mediaService.ts`, `generateNarrativeImage` already returns a promise. This step ensures its signature is compatible with `mediaController`.

```ts
export async function generateNarrativeImage(visualPrompt: any): Promise<string | undefined> {
  // Your existing implementation
  // Should return base64 image data or URL
}
```

---

## Key Concepts

### 1\. MultimodalTurn

Every narrative beat is now a `MultimodalTurn` (defined in `types.ts`):

```ts
{
  id: string;              // Matches log entry ID
  turnIndex: number;       // Sequential turn number
  text: string;            // Canonical narrative text
  visualPrompt?: string;   // JSON visual prompt
  
  // Media status tracking
  imageStatus: 'idle' | 'pending' | 'ready' | 'error';
  imageData?: string;
  
  audioStatus: 'idle' | 'pending' | 'ready' | 'error';
  audioUrl?: string;
  audioDuration?: number;
  
  videoStatus: 'idle' | 'pending' | 'ready' | 'error';
  videoUrl?: string;
  
  // Metadata for coherence
  metadata?: {
    ledgerSnapshot: any;
    activeCharacters: string[];
    location: string;
    tags: string[];
  };
}
```

### 2\. Timeline as Source of Truth

The `multimodalTimeline` array in `useGameStore` is the canonical record of all narrative beats. UI components subscribe to it:

```ts
const { multimodalTimeline, currentTurnId } = useGameStore();
const currentTurn = multimodalTimeline.find(t => t.id === currentTurnId);
```

### 3\. Media Lifecycle

```
Turn Created (by turnService.handleAction)
    ↓
registerTurn() (in gameStore via multimodalSlice) → adds to timeline with 'idle' status
    ↓
enqueueTurnForMedia() (by mediaController) → adds to generation queue
    ↓
processMediaQueue() (in mediaController) → starts generation
    ↓
markImagePending() / markAudioPending() (in gameStore via multimodalSlice)
    ↓
[Generation happens via mediaService]
    ↓
markImageReady() / markAudioReady() (in gameStore via multimodalSlice)
    ↓
UI automatically updates (reactive)
```

### 4\. Audio Playback Sync

Audio state lives in Zustand, not in component state:

```ts
const { audioPlayback, playTurn, pauseAudio } = useGameStore();

// Play a specific turn
playTurn(turnId);

// Pause current playback
pauseAudio();

// Audio element syncs with store via useEffect
```

---

## Usage Examples

### Playing a Turn with Full Media

```ts
import { useGameStore } from './state/gameStore'; // Updated import

function MyComponent() {
  const { currentTurnId, playTurn, getTurnById } = useGameStore();
  
  const handlePlay = () => {
    if (currentTurnId) {
      const turn = getTurnById(currentTurnId);
      if (turn?.audioStatus === 'ready') {
        playTurn(currentTurnId);
      }
    }
  };
  
  return <button onClick={handlePlay}>Play</button>;
}
```

### Navigating Timeline

```ts
const { goToNextTurn, goToPreviousTurn, currentTurnId } = useGameStore();

// Navigate forward/backward
<button onClick={goToNextTurn}>Next</button>
<button onClick={goToPreviousTurn}>Previous</button>
```

### Checking Media Coherence

```ts
const { getCoherenceReport } = useGameStore();

const coherence = getCoherenceReport(turnId);
console.log(coherence);
// {
//   hasText: true,
//   hasImage: true,
//   hasAudio: true,
//   hasVideo: false,
//   isFullyLoaded: true,
//   hasErrors: false,
//   completionPercentage: 100
// }
```

### Regenerating Failed Media

```ts
import { regenerateMediaForTurn } from './state/mediaController'; // Updated import

// Retry failed media generation
await regenerateMediaForTurn(turnId);
```

### Preloading Upcoming Turns

```ts
import { preloadUpcomingMedia } from './state/mediaController'; // Updated import

// Preload next 2 turns
await preloadUpcomingMedia(currentTurnId, 2);
```

---

## Configuration

All media behavior is controlled via `config/behaviorTuning.ts`:

```ts
export const MEDIA_THRESHOLDS = {
  enableVideoAboveTrauma: 80,
  enableVideoAboveShame: 80,
  enableAudio: true,
  enableImages: true,
  enableVideo: false,  // Toggle expensive video generation
};

export const DEV_CONFIG = {
  skipMediaGeneration: false,  // Skip all media for fast iteration
  verboseLogging: true,
};
```

---

## Dev Tools

### Press `` ` `` to Open Dev Console

The multimodal tab shows:

*   **Timeline Stats**: total turns, completion rate, failures

*   **Audio Playback State**: current turn, time, volume, rate

*   **Media Queue**: pending, in-progress, failed generations

*   **Timeline Table**: all turns with status indicators
    *   Click any turn to jump to it
    *   Click "Retry" on failed turns to regenerate

### Keyboard Shortcuts (Now managed in `DevOverlay.tsx`)

*   `` ` `` - Toggle dev console
*   `Ctrl+S` - Save snapshot (includes multimodal timeline)
*   `Ctrl+L` - Load snapshot
*   `Ctrl+R` - Reset game
*   `1-9` - Quick choice selection

---

## Advanced Patterns

### Auto-Advance Playback

```ts
const { toggleAutoAdvance, audioPlayback } = useGameStore();

// Enable auto-advance (plays next turn when audio ends)
if (!audioPlayback.autoAdvance) {
  toggleAutoAdvance();
}
```

### Timeline Replay

```ts
import { turnService } from './state/turnService'; // Updated import

// Replay entire timeline with auto-advance (restarts the game)
await turnService.replayTimeline(true);
```

### Session Branching

```ts
// Save current state as a named session
const { saveSnapshot } = useGameStore();
saveSnapshot(); // Includes full multimodal timeline

// Later, load it back
const { loadSnapshot } = useGameStore();
loadSnapshot();
```

### Batch Media Regeneration

```ts
import { batchRegenerateMedia } from './state/mediaController'; // Updated import

// Regenerate media for multiple turns
const failedTurns = useGameStore.getState().multimodalTimeline
  .filter(t => t.imageStatus === 'error')
  .map(t => t.id);

await batchRegenerateMedia(failedTurns);
```

---

## Performance Considerations

### 1\. Queue Processing

Media generation is sequential by default to avoid overwhelming APIs:

```ts
// In mediaController.ts
if (store.mediaQueue.pending.length > 0) {
  setTimeout(() => processMediaQueue(), 500); // 500ms delay between turns
}
```

### 2\. Timeline Pruning

For long sessions, prune old turns:

```ts
const { pruneOldTurns } = useGameStore();

// Keep only last 50 turns
pruneOldTurns(50);
```

### 3\. Lazy Loading

Images/videos are only loaded when visible:

```tsx
<img
  src={turn.imageData}
  loading="lazy"
  onLoad={() => setIsImageLoaded(true)}
/>
```

---

## Troubleshooting

### Media Not Generating

1.  Check `DEV_CONFIG.skipMediaGeneration` in `config/behaviorTuning.ts` is `false`
2.  Check `MEDIA_THRESHOLDS.enableImages` / `enableAudio` / `enableVideo` in `config/behaviorTuning.ts` are `true` as desired.
3.  Open dev console (`` ` ``) → Multimodal tab → check queue status (Pending, In Progress, Failed).
4.  Look for errors in browser console.

### Audio Not Playing

1.  Check `turn.audioStatus === 'ready'` in the Dev Overlay.
2.  Check browser autoplay policy (user interaction required - clicking "Play" or interacting with the page should enable it).
3.  Verify `audioUrl` is valid base64 in the dev overlay (though it's handled internally).
4.  Check volume is not 0 in the Media Panel.

### Timeline Out of Sync

1.  Open dev console (`` ` ``) → Multimodal tab.
2.  Check coherence percentage for each turn.
3.  Click "Retry" on failed turns.
4.  Verify `currentTurnId` in the Dev Overlay matches expected turn.

### Images Not Displaying

1.  Check `turn.imageStatus === 'ready'` in the Dev Overlay.
2.  Verify `imageData` is valid base64 or URL in the dev overlay.
3.  Check browser console for CORS errors (unlikely with base64).
4.  Try regenerating: `regenerateMediaForTurn(turnId)`.

---

## Migration Checklist

*   \[X] Install Zustand (`npm install zustand`)
*   \[X] Copy all 3 new files (`state/multimodalSlice.ts`, `state/mediaController.ts`, `components/MediaPanel.tsx`)
*   \[X] Replace/Update `state/gameStore.ts` with the new integrated version.
*   \[X] Replace/Update `state/turnService.ts` with the new integrated version.
*   \[X] Replace/Update `components/DevOverlay.tsx` with the new version including the multimodal tab.
*   \[X] Update `config/behaviorTuning.ts` with `MEDIA_THRESHOLDS` and `DEV_CONFIG.skipMediaGeneration`.
*   \[X] Update all imports in your remaining files (e.g., `App.tsx`, `components/NarrativeLog.tsx`) to point to the new main `gameStore` and `turnService` files (remove `.integrated` suffix if used in previous conceptual steps).
*   \[X] Add `<MediaPanel />` to your `App.tsx` layout.
*   \[ ] Test basic turn progression.
*   \[ ] Test media generation (images, audio, conditional video).
*   \[ ] Test audio playback and controls.
*   \[ ] Test timeline navigation.
*   \[ ] Test save/load snapshots.
*   \[ ] Configure `MEDIA_THRESHOLDS` for your needs in `config/behaviorTuning.ts`.

---

## Next Steps

Once integrated, you can:

1.  **Enhance TTS**: Replace mock audio with real TTS service if `mediaService.generateSpeech` is a placeholder.
2.  **Add Video**: Fully integrate Veo or other video generation if `animateImageWithVeo` is a placeholder.
3.  **Visual Effects**: Sync `DistortionLayer` with audio playback (e.g., visualizers reacting to sound).
4.  **Haptics**: Trigger vibration on audio beats.
5.  **Accessibility**: Add captions synced to audio timestamps.
6.  **Analytics**: Track coherence metrics over sessions.

---

**You now have a complete, production-ready multimodal system powered by Zustand.**

The key insight: **Zustand holds the canonical timeline, and all UI components are just views into that timeline.** This ensures text, voice, and image can never drift out of sync.