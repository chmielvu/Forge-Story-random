import React, { useEffect, useRef, useMemo, useState } from 'react';
import { LogEntry, CharacterId } from '../types';
import { Brain, Terminal, Image as ImageIcon, Activity, Volume2 } from 'lucide-react';

interface Props {
  logs: LogEntry[];
  thinking: boolean;
}

// Helper to determine visual based on text content
const getCharacterVisual = (text: string) => {
  const lower = text.toLowerCase();
  if (lower.includes('selene') || lower.includes('provost')) return { id: CharacterId.PROVOST, color: 'bg-rose-950', label: 'PROVOST SELENE', border: 'border-rose-800' };
  if (lower.includes('lysandra') || lower.includes('logician')) return { id: CharacterId.LOGICIAN, color: 'bg-emerald-950', label: 'DR. LYSANDRA', border: 'border-emerald-800' };
  if (lower.includes('petra') || lower.includes('inquisitor')) return { id: CharacterId.INQUISITOR, color: 'bg-orange-950', label: 'INQUISITOR PETRA', border: 'border-orange-800' };
  if (lower.includes('calista') || lower.includes('confessor')) return { id: CharacterId.CONFESSOR, color: 'bg-purple-950', label: 'THE CONFESSOR', border: 'border-purple-800' };
  if (lower.includes('kaelen') || lower.includes('obsessive')) return { id: CharacterId.OBSESSIVE, color: 'bg-pink-950', label: 'KAELEN', border: 'border-pink-800' };
  return { id: 'ENVIRONMENT', color: 'bg-stone-900', label: 'THE FORGE', border: 'border-stone-700' };
};

const AudioPlayer: React.FC<{ audioData: string }> = ({ audioData }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Auto-play when data arrives
    if (audioData) {
      playAudio();
    }
    return () => {
      audioContextRef.current?.close();
    };
  }, [audioData]);

  const playAudio = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      // Decode Base64
      const binaryString = atob(audioData);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // PCM Decoding (16-bit little endian to float32)
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
      }

      const buffer = audioContextRef.current.createBuffer(1, float32.length, 24000);
      buffer.copyToChannel(float32, 0);

      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.start(0);
      setIsPlaying(true);
      source.onended = () => setIsPlaying(false);

    } catch (e) {
      console.error("Audio playback failed", e);
    }
  };

  return (
    <button 
      onClick={playAudio}
      className={`inline-flex items-center justify-center ml-2 align-middle p-1 rounded-full hover:bg-white/10 transition-all ${isPlaying ? 'text-forge-crimson animate-pulse' : 'text-stone-500'}`}
      title="Replay Narrative"
    >
      <Volume2 size={20} />
    </button>
  );
};

const SceneVisual: React.FC<{ text: string, imageData?: string, videoData?: string }> = ({ text, imageData, videoData }) => {
  const visual = useMemo(() => getCharacterVisual(text), [text]);

  const renderContent = () => {
    if (videoData) {
      return (
        <div className="absolute inset-0 animate-fade-in">
           <video 
             src={videoData} 
             autoPlay 
             loop 
             muted 
             playsInline 
             className="w-full h-full object-cover"
           />
           <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] pointer-events-none"></div>
           <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-1 text-[9px] font-mono text-white border border-white/20 rounded">VEO_REANIMATED</div>
        </div>
      );
    }
    if (imageData) {
      const imageSrc = imageData.startsWith('data:') ? imageData : `data:image/jpeg;base64,${imageData}`;
      return (
        <div className="absolute inset-0 animate-fade-in">
          <img src={imageSrc} alt="Scene" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[20s] ease-linear" />
          <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] pointer-events-none"></div>
          <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-black/50 pointer-events-none"></div>
        </div>
      );
    }
    // Fallback placeholder
    return (
      <>
        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.2)_50%)] bg-[length:100%_4px] pointer-events-none opacity-30"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/80 pointer-events-none"></div>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        <div className="text-center p-6 relative z-10 animate-pulse">
          <div className="mb-6 flex justify-center opacity-40">
            <ImageIcon size={64} strokeWidth={0.5} />
          </div>
          <h3 className="font-display text-3xl tracking-[0.2em] text-white/60 uppercase drop-shadow-lg">{visual.label}</h3>
          <div className="mt-4 flex justify-center">
            <div className="h-0.5 w-12 bg-white/20"></div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className={`w-full aspect-square md:aspect-[4/5] relative overflow-hidden rounded-sm border-2 ${visual.border} ${visual.color} flex items-center justify-center group shadow-2xl transition-all duration-1000`}>
        {renderContent()}
        <div className="absolute top-4 left-4 w-4 h-4 border-t border-l border-white/30"></div>
        <div className="absolute top-4 right-4 w-4 h-4 border-t border-r border-white/30"></div>
        <div className="absolute bottom-4 left-4 w-4 h-4 border-b border-l border-white/30"></div>
        <div className="absolute bottom-4 right-4 w-4 h-4 border-b border-r border-white/30"></div>
    </div>
  );
};

const NarrativeLog: React.FC<Props> = ({ logs, thinking }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, thinking]);

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col scroll-smooth">
      <div className="flex-1 p-4 md:p-8 space-y-16 max-w-[1600px] mx-auto w-full"> 
        {logs.map((log) => (
          <div key={log.id} className={`animate-fade-in w-full`}>
            
            {(log.type === 'system' || log.type === 'tool_output') && !log.imageData && !log.videoData && (
               <div className={`w-full border py-2 px-4 flex items-center gap-4 font-mono text-xs md:text-sm tracking-widest uppercase mb-8 
                  ${log.type === 'tool_output' ? 'border-cyan-800 bg-cyan-950/20 text-cyan-400 shadow-[0_0_15px_rgba(8,145,178,0.1)]' : 'border-forge-crimson/30 bg-forge-crimson/10 text-forge-crimson shadow-[0_0_15px_rgba(136,19,55,0.1)]'}
               `}>
                  <Terminal size={14} />
                  <span className="flex-1 truncate">{log.content}</span>
                  {log.type === 'system' && (
                    <div className="flex gap-1 hidden md:flex">
                      <div className="w-1.5 h-1.5 bg-forge-crimson rounded-full animate-pulse"></div>
                      <div className="w-1.5 h-1.5 bg-forge-crimson rounded-full animate-pulse delay-75"></div>
                      <div className="w-1.5 h-1.5 bg-forge-crimson rounded-full animate-pulse delay-150"></div>
                    </div>
                  )}
               </div>
            )}

            {log.type === 'thought' && (
              <div className="flex gap-3 text-[10px] font-mono text-cyan-700/60 items-center justify-center py-2 mb-4 opacity-40 hover:opacity-100 transition-opacity cursor-help">
                <Brain size={10} />
                <span>DIRECTOR_THOUGHT_PROCESS::ENCRYPTED</span>
              </div>
            )}

            {(log.type === 'narrative' || (log.type === 'tool_output' && (log.imageData || log.videoData))) && (
              <div className="flex flex-col lg:flex-row gap-8 items-start">
                <div className="w-full lg:w-[40%] xl:w-[35%] flex-shrink-0 sticky top-4">
                    <SceneVisual text={log.content} imageData={log.imageData} videoData={log.videoData} />
                </div>

                <div className="w-full lg:w-[60%] xl:w-[65%] flex flex-col justify-center pt-0 lg:pt-8">
                    <div className="prose prose-invert max-w-none">
                        <p className="font-serif text-xl md:text-2xl lg:text-3xl leading-[1.6] md:leading-[1.8] text-forge-text font-light drop-shadow-sm tracking-wide">
                            {log.type === 'narrative' && (
                                <span className="float-left text-5xl md:text-6xl lg:text-7xl text-forge-crimson font-display mr-3 md:mr-4 mt-[-4px] leading-none opacity-90">
                                    {log.content.charAt(0)}
                                </span>
                            )}
                            {log.content.slice(log.type === 'narrative' ? 1 : 0)}
                            {log.audioData && <AudioPlayer audioData={log.audioData} />}
                        </p>
                    </div>
                    
                    <div className="mt-8 md:mt-12 flex items-center gap-4 opacity-20">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white to-transparent"></div>
                        <div className="rotate-45 w-1.5 h-1.5 border border-white"></div>
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white to-transparent"></div>
                    </div>
                </div>
              </div>
            )}
          </div>
        ))}
        
        {thinking && (
          <div className="flex flex-col items-center justify-center gap-4 text-forge-subtle py-20">
             <Activity size={24} className="animate-spin text-forge-crimson" />
             <div className="font-mono text-xs tracking-[0.3em] animate-pulse text-forge-crimson/70">DIRECTOR IS WEAVING FATE</div>
          </div>
        )}
        <div ref={bottomRef} className="h-10" />
      </div>
    </div>
  );
};

export default NarrativeLog;
