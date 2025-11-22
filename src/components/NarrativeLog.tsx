
import React, { useEffect, useRef, useMemo, useState } from 'react';
import { LogEntry } from '../types';
import { Brain, Volume2, Activity, Square } from 'lucide-react';

interface Props {
  logs: LogEntry[];
  thinking: boolean;
  choices: string[];
  onChoice: (c: string) => void;
}

// --- Sub-components ---

const Typewriter: React.FC<{ text: string; onTyping: () => void; onComplete?: () => void }> = ({ text, onTyping, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const index = useRef(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    index.current = 0;
    setDisplayedText('');
    
    const type = () => {
      if (index.current < text.length) {
        setDisplayedText(prev => prev + text.charAt(index.current));
        index.current++;
        onTyping(); // Trigger scroll in parent
        // Variable typing speed for natural feel
        const speed = Math.random() * 15 + 5; 
        setTimeout(() => {
          frameRef.current = requestAnimationFrame(type);
        }, speed);
      } else {
        onComplete?.();
      }
    };

    frameRef.current = requestAnimationFrame(type);

    return () => cancelAnimationFrame(frameRef.current);
  }, [text]);

  return (
    <span>
      {displayedText}
      {index.current < text.length && (
        <span className="inline-block w-2 h-5 bg-forge-gold ml-1 align-middle animate-pulse" />
      )}
    </span>
  );
};

const AudioPlayer: React.FC<{ audioData: string }> = ({ audioData }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const playAudio = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const binaryString = atob(audioData);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
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
      className={`inline-flex items-center justify-center ml-2 p-1 hover:text-white transition-colors ${isPlaying ? 'text-forge-gold animate-pulse' : 'text-stone-600'}`}
      title="Replay Voice"
    >
      <Volume2 size={16} />
    </button>
  );
};

const getCharacterDetails = (text: string) => {
  // Colors updated to use Gold themes or specific variations, moving away from red
  const lower = text.toLowerCase();
  if (lower.includes('selene') || lower.includes('provost')) return { name: 'Provost Selene', initials: 'PS', color: 'text-rose-400', border: 'border-rose-800', bg: 'bg-rose-950/30' };
  if (lower.includes('lysandra') || lower.includes('logician')) return { name: 'Dr. Lysandra', initials: 'DL', color: 'text-emerald-400', border: 'border-emerald-800', bg: 'bg-emerald-950/30' };
  if (lower.includes('petra') || lower.includes('inquisitor')) return { name: 'Inquisitor Petra', initials: 'IP', color: 'text-orange-400', border: 'border-orange-800', bg: 'bg-orange-950/30' };
  if (lower.includes('calista') || lower.includes('confessor')) return { name: 'Confessor Calista', initials: 'CC', color: 'text-purple-400', border: 'border-purple-800', bg: 'bg-purple-950/30' };
  return { name: 'The Forge', initials: 'TF', color: 'text-stone-400', border: 'border-stone-700', bg: 'bg-stone-900/30' };
};

// --- Main Component ---

const NarrativeLog: React.FC<Props> = ({ logs, thinking, choices, onChoice }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  
  // Filter to show last few logs to keep DOM light, but enough for context
  const visibleLogs = useMemo(() => {
      const filtered = logs.filter(l => ['narrative', 'system', 'thought'].includes(l.type));
      return filtered.slice(-10); // Keep last 10 entries
  }, [logs]);

  const lastNarrative = [...logs].reverse().find(l => l.type === 'narrative');
  const speaker = useMemo(() => getCharacterDetails(lastNarrative?.content || ''), [lastNarrative]);

  // Function to scroll to bottom
  const scrollToBottom = () => {
    if (bottomRef.current) {
       bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  };

  // Initial scroll when logs change (for non-animated parts)
  useEffect(() => {
    scrollToBottom();
  }, [logs.length, thinking]);

  return (
    <div className="flex h-full gap-6 md:gap-10">
      
      {/* PORTRAIT - FIXED BOTTOM LEFT */}
      <div className="hidden md:flex flex-col justify-end pb-2 animate-fade-in flex-shrink-0">
        <div className={`w-24 h-32 md:w-32 md:h-40 border-2 ${speaker.border} ${speaker.bg} backdrop-blur-md flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.5)] relative overflow-hidden transition-all duration-1000`}>
           <div className={`absolute inset-0 opacity-10 ${speaker.color} mix-blend-overlay bg-current`}></div>
           <span className={`font-display text-4xl ${speaker.color} drop-shadow-lg z-10`}>{speaker.initials}</span>
           
           {/* Scanning line effect */}
           <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent h-[20%] w-full animate-[scan_4s_ease-in-out_infinite]"></div>
        </div>
        <div className={`mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-right ${speaker.color} opacity-80`}>
          {speaker.name}
        </div>
      </div>

      {/* SCROLLABLE TEXT AREA */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 relative scroll-smooth mask-image-gradient">
        <div className="space-y-6 pb-2 min-h-full flex flex-col justify-end">
            
            {visibleLogs.map((log, index) => {
                const isLast = index === visibleLogs.length - 1;
                const isNarrative = log.type === 'narrative';
                
                // Only animate the VERY last log if it is narrative
                const shouldAnimate = isLast && isNarrative;
                
                // Heavy fade on older logs
                const opacity = isLast ? 'opacity-100' : 'opacity-40 blur-[0.5px] hover:opacity-100 hover:blur-0 transition-all duration-500';

                if (log.type === 'system') {
                    return (
                        <div key={log.id} className={`font-mono text-[9px] md:text-[10px] text-forge-subtle tracking-widest uppercase border-l-2 border-stone-800 pl-3 py-1 ${opacity}`}>
                           <span className="text-forge-gold mr-2">>></span> {log.content}
                        </div>
                    );
                }

                if (log.type === 'thought') {
                    return (
                         <div key={log.id} className={`flex gap-2 items-center text-[9px] font-mono text-stone-700 pl-1 ${opacity}`}>
                            <Brain size={10} />
                            <span>DIRECTOR_THOUGHT_PROCESS::ENCRYPTED</span>
                         </div>
                    );
                }

                return (
                    <div key={log.id} className={`prose prose-invert max-w-none ${opacity}`}>
                         <p className={`font-serif text-lg md:text-xl lg:text-2xl leading-relaxed text-forge-text drop-shadow-lg`}>
                            {shouldAnimate ? (
                                <Typewriter 
                                  text={log.content} 
                                  onTyping={scrollToBottom} 
                                />
                            ) : (
                                <span>{log.content}</span>
                            )}
                            {log.audioData && <AudioPlayer audioData={log.audioData} />}
                         </p>
                    </div>
                );
            })}

            {thinking && (
                 <div className="flex items-center gap-3 text-forge-gold animate-pulse py-2 mt-4">
                    <Activity size={14} className="animate-spin" />
                    <span className="font-mono text-[10px] tracking-[0.3em]">WEAVING FATE...</span>
                 </div>
            )}

            {/* CHOICES - Only show when not thinking */}
            {!thinking && choices.length > 0 && (
                <div className="grid grid-cols-1 gap-2 mt-4 pt-4 border-t border-stone-800/30 animate-fade-in">
                    {choices.map((choice, idx) => (
                        <button
                            key={idx}
                            onClick={() => onChoice(choice)}
                            className="group text-left py-2 px-4 hover:bg-white/5 border-l-2 border-transparent hover:border-forge-gold transition-all duration-300 flex items-center gap-3"
                        >
                            <Square size={6} className="text-stone-600 group-hover:text-forge-gold rotate-45 transition-colors duration-300" fill="currentColor" />
                            <span className="font-serif text-base md:text-lg text-stone-400 group-hover:text-forge-gold italic transition-colors">
                                "{choice}"
                            </span>
                        </button>
                    ))}
                </div>
            )}
            
            <div ref={bottomRef} className="h-1" />
        </div>
      </div>
    </div>
  );
};

export default NarrativeLog;
