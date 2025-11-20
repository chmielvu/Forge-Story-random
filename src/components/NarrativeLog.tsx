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
        // Randomize typing speed slightly for human feel
        const speed = Math.random() * 20 + 10; 
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
        <span className="inline-block w-2 h-5 bg-forge-crimson ml-1 align-middle animate-pulse" />
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
      className={`inline-flex items-center justify-center ml-2 p-1 hover:text-white transition-colors ${isPlaying ? 'text-forge-crimson animate-pulse' : 'text-stone-600'}`}
      title="Replay Voice"
    >
      <Volume2 size={16} />
    </button>
  );
};

const getCharacterDetails = (text: string) => {
  const lower = text.toLowerCase();
  if (lower.includes('selene') || lower.includes('provost')) return { name: 'Provost Selene', initials: 'PS', color: 'text-rose-600', border: 'border-rose-900' };
  if (lower.includes('lysandra') || lower.includes('logician')) return { name: 'Dr. Lysandra', initials: 'DL', color: 'text-emerald-600', border: 'border-emerald-900' };
  if (lower.includes('petra') || lower.includes('inquisitor')) return { name: 'Inquisitor Petra', initials: 'IP', color: 'text-orange-600', border: 'border-orange-900' };
  if (lower.includes('calista') || lower.includes('confessor')) return { name: 'Confessor Calista', initials: 'CC', color: 'text-purple-600', border: 'border-purple-900' };
  return { name: 'The Forge', initials: 'TF', color: 'text-stone-400', border: 'border-stone-700' };
};

// --- Main Component ---

const NarrativeLog: React.FC<Props> = ({ logs, thinking, choices, onChoice }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  
  const visibleLogs = useMemo(() => logs.filter(l => ['narrative', 'system', 'thought'].includes(l.type)), [logs]);
  const lastNarrative = [...logs].reverse().find(l => l.type === 'narrative');
  const speaker = useMemo(() => getCharacterDetails(lastNarrative?.content || ''), [lastNarrative]);

  // Function to scroll to bottom
  const scrollToBottom = () => {
    if (scrollRef.current) {
      const { scrollHeight, clientHeight } = scrollRef.current;
      scrollRef.current.scrollTop = scrollHeight - clientHeight;
    }
  };

  // Initial scroll when logs change (for non-animated parts)
  useEffect(() => {
    scrollToBottom();
  }, [logs.length, thinking]);

  return (
    <div className="flex h-full gap-8">
      
      {/* PORTRAIT - FIXED LEFT */}
      <div className="hidden md:flex flex-col justify-end pb-4 animate-fade-in">
        <div className={`w-32 h-32 border ${speaker.border} bg-black/80 backdrop-blur-sm flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.8)] relative overflow-hidden`}>
           <div className={`absolute inset-0 opacity-20 ${speaker.color} mix-blend-overlay bg-current`}></div>
           <span className={`font-display text-4xl ${speaker.color} drop-shadow-lg z-10`}>{speaker.initials}</span>
           
           {/* Scanning line effect */}
           <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/10 to-transparent h-[20%] w-full animate-[scan_4s_ease-in-out_infinite]"></div>
        </div>
        <div className={`mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-right ${speaker.color} opacity-80`}>
          {speaker.name}
        </div>
      </div>

      {/* SCROLLABLE TEXT AREA */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto custom-scrollbar pr-4 relative scroll-smooth"
      >
        <div className="space-y-8 pb-4 min-h-full flex flex-col justify-end">
            
            {visibleLogs.map((log, index) => {
                const isLast = index === visibleLogs.length - 1;
                const isNarrative = log.type === 'narrative';
                
                // Only animate the VERY last log if it is narrative
                const shouldAnimate = isLast && isNarrative;
                
                // Fade out older logs slightly
                const opacity = isLast ? 'opacity-100' : 'opacity-60 hover:opacity-100';

                if (log.type === 'system') {
                    return (
                        <div key={log.id} className={`font-mono text-[10px] text-forge-subtle tracking-widest uppercase border-l-2 border-stone-800 pl-3 py-1 ${opacity}`}>
                           <span className="text-forge-crimson mr-2">>></span> {log.content}
                        </div>
                    );
                }

                if (log.type === 'thought') {
                    return (
                         <div key={log.id} className={`flex gap-2 items-center text-[10px] font-mono text-stone-600 pl-1 ${opacity}`}>
                            <Brain size={10} />
                            <span>DIRECTOR_THOUGHT_PROCESS::ENCRYPTED</span>
                         </div>
                    );
                }

                return (
                    <div key={log.id} className={`prose prose-invert max-w-none ${opacity} transition-all duration-700`}>
                         <p className={`font-serif text-lg md:text-xl lg:text-2xl leading-relaxed text-stone-100 drop-shadow-md`}>
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
                 <div className="flex items-center gap-3 text-forge-crimson animate-pulse py-2 border-t border-forge-crimson/20 mt-4">
                    <Activity size={14} className="animate-spin" />
                    <span className="font-mono text-[10px] tracking-[0.3em]">WEAVING FATE...</span>
                 </div>
            )}

            {/* CHOICES - Only show when not thinking */}
            {!thinking && choices.length > 0 && (
                <div className="grid grid-cols-1 gap-3 mt-6 pt-6 border-t border-stone-800/50 animate-fade-in">
                    {choices.map((choice, idx) => (
                        <button
                            key={idx}
                            onClick={() => onChoice(choice)}
                            className="group text-left py-3 px-4 hover:bg-stone-900/80 border-l-2 border-transparent hover:border-forge-gold transition-all duration-300 flex items-center gap-3"
                        >
                            <Square size={8} className="text-stone-700 group-hover:text-forge-gold rotate-45 transition-colors duration-300" fill="currentColor" />
                            <span className="font-serif text-lg text-stone-400 group-hover:text-forge-gold italic transition-colors">
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