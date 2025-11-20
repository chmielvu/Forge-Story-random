import React, { useState, useRef } from 'react';
import { Camera, Film, Wand2, Upload, Loader2, Eye, X } from 'lucide-react';
import { animateImageWithVeo, distortImage, analyzeArcaneRelic } from '../services/geminiService';
import { ToolMode, GameState } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onResult: (type: 'image' | 'video' | 'text', data: string, context: string) => void;
  gameState: GameState; // Pass full game state for context
}

const Grimoire: React.FC<Props> = ({ isOpen, onClose, onResult, gameState }) => {
  const [mode, setMode] = useState<ToolMode>('ANALYZE');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Full data URL for preview
        setSelectedFile(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const execute = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);

    // Strip data URL prefix for API calls
    const base64Raw = selectedFile.split(',')[1];

    try {
      if (mode === 'ANALYZE') {
        const result = await analyzeArcaneRelic(base64Raw, gameState);
        onResult('text', result, `RELIC_ANALYSIS`);
      } 
      else if (mode === 'REANIMATE') {
        const videoData = await animateImageWithVeo(base64Raw, prompt || "Make it breathe, subtle movement");
        if (videoData) onResult('video', videoData, `REANIMATED_MEMORY`);
      } 
      else if (mode === 'DISTORT') {
        const imageData = await distortImage(base64Raw, prompt || "Make it darker, corrupted");
        if (imageData) onResult('image', imageData, `DISTORTED_REALITY`);
      }
      onClose(); // Close modal on success
    } catch (e) {
      console.error("Grimoire Error", e);
      // Optionally show an error message to the user
    } finally {
      setIsProcessing(false);
      setSelectedFile(null);
      setPrompt('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-forge-stone border border-forge-crimson/50 shadow-[0_0_50px_rgba(136,19,55,0.2)] rounded-sm flex flex-col overflow-hidden relative animate-fade-in">
        
        {/* Header */}
        <div className="h-12 bg-stone-950 border-b border-stone-800 flex items-center justify-between px-4">
          <div className="font-display tracking-widest text-forge-text uppercase flex items-center gap-2">
            <Eye size={16} className="text-forge-crimson" />
            Faculty Terminal
          </div>
          <button onClick={onClose} className="text-stone-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-800">
          <button 
            onClick={() => setMode('ANALYZE')}
            className={`flex-1 py-3 text-xs font-mono uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-stone-900 transition-colors ${mode === 'ANALYZE' ? 'bg-stone-800 text-white border-b-2 border-forge-crimson' : 'text-stone-500'}`}
          >
            <Camera size={14} /> Analyze
          </button>
          <button 
            onClick={() => setMode('REANIMATE')}
            className={`flex-1 py-3 text-xs font-mono uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-stone-900 transition-colors ${mode === 'REANIMATE' ? 'bg-stone-800 text-white border-b-2 border-forge-crimson' : 'text-stone-500'}`}
          >
            <Film size={14} /> Reanimate (Veo)
          </button>
          <button 
            onClick={() => setMode('DISTORT')}
            className={`flex-1 py-3 text-xs font-mono uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-stone-900 transition-colors ${mode === 'DISTORT' ? 'bg-stone-800 text-white border-b-2 border-forge-crimson' : 'text-stone-500'}`}
          >
            <Wand2 size={14} /> Distort
          </button>
        </div>

        {/* Content */}
        <div className="p-6 bg-stone-950/50 flex-1 flex flex-col gap-6">
          
          {/* Upload Area */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-stone-800 hover:border-forge-crimson/50 rounded-lg h-48 flex flex-col items-center justify-center cursor-pointer transition-colors relative group overflow-hidden"
          >
            {selectedFile ? (
              <img src={selectedFile} alt="Preview" className="w-full h-full object-contain p-2" />
            ) : (
              <>
                <Upload className="text-stone-600 group-hover:text-forge-crimson mb-2 transition-colors" size={32} />
                <span className="text-xs font-mono text-stone-500 uppercase">Upload Evidence</span>
              </>
            )}
            <input 
              ref={fileInputRef} 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileSelect} 
            />
          </div>

          {/* Prompt Input (Only for Generative modes) */}
          {mode !== 'ANALYZE' && (
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-forge-subtle uppercase tracking-widest">Director Command</label>
              <textarea 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={mode === 'REANIMATE' ? "e.g., Make the shadows breathe, subtle cinematic pan..." : "e.g., Add a glitch effect, make it blood red..."}
                className="w-full bg-stone-900 border border-stone-800 rounded p-3 text-sm text-forge-text focus:border-forge-crimson outline-none font-serif resize-none h-20"
              />
            </div>
          )}

          {/* Action Button */}
          <button 
            onClick={execute}
            disabled={!selectedFile || isProcessing}
            className={`w-full py-3 rounded font-mono text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all
              ${!selectedFile || isProcessing ? 'bg-stone-800 text-stone-600 cursor-not-allowed' : 'bg-forge-crimson hover:bg-red-900 text-white shadow-lg hover:shadow-forge-crimson/30'}
            `}
          >
            {isProcessing ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Processing...
              </>
            ) : (
              <span>Execute Protocol</span>
            )}
          </button>

        </div>
      </div>
    </div>
  );
};

export default Grimoire;
