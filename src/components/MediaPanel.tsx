
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '../state/gameStore';
import { Play, Pause, FastForward, Rewind, Volume2, VolumeX, Maximize, Loader2, RefreshCw, ChevronLeft, ChevronRight, Speaker } from 'lucide-react';
import { BEHAVIOR_CONFIG } from '../config/behaviorTuning';
import { regenerateMediaForTurn } from '../state/mediaController';

// Placeholder for formatTime if utils/helpers.ts is not created.
const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};


interface MediaPanelProps {}

const MediaPanel: React.FC<MediaPanelProps> = () => {
  const {
    multimodalTimeline,
    currentTurnId,
    audioPlayback,
    getTurnById,
    setCurrentTurn,
    goToNextTurn,
    goToPreviousTurn,
    playTurn,
    pauseAudio,
    resumeAudio,
    setVolume,
    setPlaybackRate,
    setHasUserInteraction,
  } = useGameStore();

  const audioRef = useRef<HTMLAudioElement>(null);
  const currentTurn = currentTurnId ? getTurnById(currentTurnId) : undefined;

  const [localVolume, setLocalVolume] = useState(audioPlayback.volume);
  const [isMuted, setIsMuted] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Sync internal audio element with Zustand state
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;

    audioEl.volume = audioPlayback.volume;
    audioEl.playbackRate = audioPlayback.playbackRate;
    audioEl.muted = isMuted;

    // This useEffect now primarily syncs visual playback state.
    // The actual audio playback logic is handled by playTurn/pauseAudio
    // which directly interact with the Web Audio API.
    // If the turn changes and is playing, play it via the store.
    if (audioPlayback.isPlaying && audioPlayback.currentPlayingTurnId === currentTurn?.id) {
        // No direct `play()` call here; `playTurn` handles Web Audio API.
        // This effect mainly keeps UI consistent.
    } else if (!audioPlayback.isPlaying) {
        // If Zustand says paused, ensure element reflects it
        // (though Web Audio API is primary)
    }

  }, [audioPlayback.volume, audioPlayback.playbackRate, isMuted, audioPlayback.isPlaying, audioPlayback.currentPlayingTurnId, currentTurn?.id]);

  // Handle playing audio when a turn becomes current and audio is ready
  useEffect(() => {
    if (currentTurn && currentTurn.id === audioPlayback.currentPlayingTurnId && audioPlayback.isPlaying) {
      // If audio is already playing and this is the active turn, ensure UI reflects it
      // No explicit play here, as playTurn() handles Web Audio context.
    } else if (currentTurn && currentTurn.id === audioPlayback.currentPlayingTurnId && !audioPlayback.isPlaying) {
      // If the current turn is the one expected to be playing, but the state says paused
      // (e.g., after an explicit pause), then the Web Audio Context is likely suspended.
    }
  }, [currentTurn, audioPlayback.isPlaying, audioPlayback.currentPlayingTurnId]);

  // Auto-play the currently selected turn if auto-advance is on and audio is ready
  useEffect(() => {
    if (currentTurn && currentTurn.audioStatus === 'ready' && audioPlayback.autoAdvance && audioPlayback.hasUserInteraction) {
      if (audioPlayback.currentPlayingTurnId !== currentTurn.id) {
        // Only play if a different turn's audio is not already active
        playTurn(currentTurn.id);
      }
    }
  }, [currentTurn, audioPlayback.autoAdvance, audioPlayback.hasUserInteraction, audioPlayback.currentPlayingTurnId, playTurn]);


  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setLocalVolume(vol);
    setVolume(vol);
    if (vol > 0 && isMuted) setIsMuted(false);
  }, [setVolume, isMuted]);

  const toggleMute = useCallback(() => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (newMutedState) {
      setLocalVolume(0);
      setVolume(0);
    } else {
      setLocalVolume(audioPlayback.volume > 0 ? audioPlayback.volume : 0.7); // Restore to previous or default
      setVolume(audioPlayback.volume > 0 ? audioPlayback.volume : 0.7);
    }
  }, [isMuted, audioPlayback.volume, setVolume]);

  const handlePlayPause = useCallback(() => {
    setHasUserInteraction(); // Crucial for browser autoplay policies
    if (audioPlayback.isPlaying && audioPlayback.currentPlayingTurnId === currentTurn?.id) {
      pauseAudio();
    } else if (currentTurn?.audioStatus === 'ready' && currentTurn.id) {
      playTurn(currentTurn.id);
    } else if (!currentTurn) {
        console.warn("No current turn selected to play.");
    } else {
        console.warn(`Audio for turn ${currentTurn.id} is not ready (${currentTurn.audioStatus}).`);
    }
  }, [audioPlayback.isPlaying, audioPlayback.currentPlayingTurnId, currentTurn, playTurn, pauseAudio, setHasUserInteraction]);

  const handleRegenerateMedia = useCallback(async (type?: 'image' | 'audio' | 'video') => {
    if (currentTurn?.id) {
        if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log(`[MediaPanel] Regenerating ${type || 'all'} media for turn ${currentTurn.id}`);
        await regenerateMediaForTurn(currentTurn.id, type);
    }
  }, [currentTurn]);


  if (!currentTurn) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-forge-black text-forge-subtle font-mono text-xs uppercase">
        NO_NARRATIVE_TIMELINE_ACTIVE
      </div>
    );
  }

  const {
    text,
    imageData,
    imageStatus,
    audioDuration,
    audioStatus,
    videoUrl,
    videoStatus,
  } = currentTurn;

  return (
    <div className="relative w-full h-full bg-black flex flex-col items-center justify-center text-forge-text font-serif">
      {/* Media Display Area */}
      <div className="relative flex-1 w-full flex items-center justify-center bg-stone-950 overflow-hidden">
        {(videoStatus === 'pending' || imageStatus === 'pending' || audioStatus === 'pending') && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 text-forge-gold animate-pulse">
            <Loader2 size={32} className="animate-spin mb-4" />
            <span className="font-mono text-xs uppercase tracking-widest">GENERATING_MEDIA...</span>
            <span className="font-mono text-[10px] text-stone-500 mt-2">({imageStatus} | {audioStatus} | {videoStatus})</span>
          </div>
        )}

        {videoUrl && videoStatus === 'ready' ? (
          <video
            src={videoUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-contain"
            onLoadedData={() => setImageLoaded(true)}
            onError={(e) => {
                console.error("Video element error:", e);
                // regenerateMediaForTurn(currentTurn.id, 'video'); // Auto-retry video
            }}
          />
        ) : imageData && imageStatus === 'ready' ? (
          <img
            src={imageData.startsWith('data:') ? imageData : `data:image/jpeg;base64,${imageData}`}
            alt={`Scene for Turn ${currentTurn.turnIndex}`}
            className={`w-full h-full object-contain transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
            onError={(e) => {
                console.error("Image element error:", e);
                // regenerateMediaForTurn(currentTurn.id, 'image'); // Auto-retry image
            }}
          />
        ) : (
          <div className="w-full h-full bg-stone-900 flex items-center justify-center">
            <span className="font-display text-4xl text-forge-subtle opacity-30">NO_VISUAL_FEED</span>
          </div>
        )}

        {(imageStatus === 'error' || audioStatus === 'error' || videoStatus === 'error') && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-red-950/80 text-white font-mono text-xs uppercase p-4">
                <span className="text-red-400 mb-2">MEDIA_GENERATION_FAILED</span>
                {imageStatus === 'error' && <p>Image: {currentTurn.imageError || 'Error'}</p>}
                {audioStatus === 'error' && <p>Audio: {currentTurn.audioError || 'Error'}</p>}
                {videoStatus === 'error' && <p>Video: {currentTurn.videoError || 'Error'}</p>}
                <button 
                    onClick={() => handleRegenerateMedia()}
                    className="mt-4 px-3 py-1 bg-red-700 hover:bg-red-600 text-white rounded-sm text-xs flex items-center gap-2"
                >
                    <RefreshCw size={12} /> RETRY
                </button>
            </div>
        )}
      </div>

      {/* Controls */}
      <div className="w-full bg-forge-black p-4 border-t border-stone-800 flex flex-col gap-3">
        {/* Playback Controls */}
        <div className="flex items-center justify-between">
          <button
            onClick={goToPreviousTurn}
            className="p-2 text-stone-500 hover:text-forge-gold transition-colors"
          >
            <Rewind size={20} />
          </button>

          <button
            onClick={handlePlayPause}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-forge-gold text-black shadow-lg hover:bg-yellow-400 transition-colors"
            disabled={audioStatus !== 'ready' && !audioPlayback.isPlaying}
          >
            {audioPlayback.isPlaying && audioPlayback.currentPlayingTurnId === currentTurn.id ? <Pause size={20} /> : <Play size={20} />}
          </button>

          <button
            onClick={goToNextTurn}
            className="p-2 text-stone-500 hover:text-forge-gold transition-colors"
          >
            <FastForward size={20} />
          </button>
        </div>

        {/* Progress Bar & Time */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-stone-500">
            {formatTime(audioPlayback.currentPlayingTurnId === currentTurn.id ? audioPlayback.currentTime : 0)}
          </span>
          <div className="flex-1 h-1 bg-stone-800 rounded-full relative">
            <div
              className="absolute inset-y-0 left-0 bg-forge-gold rounded-full transition-all duration-100 ease-linear"
              style={{ width: `${(audioPlayback.currentPlayingTurnId === currentTurn.id && audioDuration) ? (audioPlayback.currentTime / audioDuration) * 100 : 0}%` }}
            ></div>
          </div>
          <span className="font-mono text-[10px] text-stone-500">
            {formatTime(audioDuration || 0)}
          </span>
        </div>

        {/* Volume & Rate Controls */}
        <div className="flex items-center gap-4 text-stone-500">
          <button onClick={toggleMute} className="hover:text-forge-gold transition-colors">
            {isMuted || localVolume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={localVolume}
            onChange={handleVolumeChange}
            className="w-24 h-1 bg-stone-700 rounded-lg appearance-none cursor-pointer accent-forge-gold"
          />

          <span className="ml-auto font-mono text-[10px] uppercase flex items-center gap-1">
            <Speaker size={14} /> RATE: {audioPlayback.playbackRate.toFixed(1)}x
          </span>
          {/* Add rate change buttons if needed */}
        </div>
      </div>
    </div>
  );
};

export default MediaPanel;