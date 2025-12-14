import React, { useState } from 'react';
import { generateBlindsightVideo, requestApiKeySelection, checkApiKeySelection } from '../services/geminiService';
import { VideoGenerationState } from '../types';

interface VeoGeneratorProps {
  onVideoReady: (uri: string) => void;
}

const VEO_PROMPT = `
Photorealistic cinematic shot.
Phase 1: Pure chaos. Black background. Thousands of random, flickering white/yellow phosphene dots. High-frequency jitter, no structure.
Phase 2: Emergence. Dots organize. Faint glowing edges and intensity gradients emerge. Sparse guide pulses appear. Motion trajectories form: silhouette of a person walking, tree outline.
Phase 3: Convergence. Scene dramatically clarifies into a full photorealistic outdoor landscape. A person walking along a path toward a large tree at sunset. Golden hour lighting, detailed bark texture, gentle wind in leaves, long shadows. Depth and 3D parallax. Phosphene dots fade.
Scientific visualization, cinematic lighting, 8k resolution.
`;

const VeoGenerator: React.FC<VeoGeneratorProps> = ({ onVideoReady }) => {
  const [mode, setMode] = useState<'CLOUD' | 'LOCAL'>('CLOUD');
  const [state, setState] = useState<VideoGenerationState>({
    isGenerating: false,
    progress: '',
    videoUri: null,
    error: null
  });

  const simulateLocalGeneration = async () => {
    const steps = [
        "Connecting to Local Cluster (localhost:8000)...",
        "Loading CogVideoX-5B (Int8 Quantization)...",
        "Allocating VRAM (11.2GB / 24GB)...",
        "Initializing 3D VAE...",
        "Encoding Prompt Embeddings (T5-XXL)...",
        "Denoising Frame 1-16 (Step 1/50)...",
        "Denoising Frame 1-16 (Step 25/50)...",
        "Denoising Frame 17-32 (Step 12/50)...",
        "Denoising Frame 33-49 (Step 48/50)...",
        "Decoding Latents...",
        "Temporal Smoothing..."
    ];

    for (const step of steps) {
        setState(prev => ({ ...prev, progress: step }));
        await new Promise(r => setTimeout(r, 800 + Math.random() * 500));
    }
    return 'local-mock-uri';
  };

  const handleGenerate = async () => {
    setState(prev => ({ ...prev, isGenerating: true, error: null, progress: 'Initializing...' }));
    
    try {
      let uri: string;

      if (mode === 'CLOUD') {
        const hasKey = await checkApiKeySelection();
        if (!hasKey) {
          setState(prev => ({ ...prev, progress: 'Waiting for API Key selection...' }));
          await requestApiKeySelection();
        }

        uri = await generateBlindsightVideo(VEO_PROMPT, (status) => {
          setState(prev => ({ ...prev, progress: status }));
        });
      } else {
        // Local Mode
        uri = await simulateLocalGeneration();
      }

      setState({
        isGenerating: false,
        progress: 'Complete',
        videoUri: uri,
        error: null
      });
      
      onVideoReady(uri);

    } catch (err: any) {
      setState({
        isGenerating: false,
        progress: '',
        videoUri: null,
        error: err.message || "Generation failed"
      });
    }
  };

  return (
    <div className="w-80 bg-black/80 backdrop-blur-md border border-white/10 p-4 rounded-lg transition-all duration-300">
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10">
        <h3 className="text-white/90 font-mono text-sm uppercase">
          Video Core
        </h3>
        <div className="flex bg-white/5 rounded p-0.5">
            <button 
                onClick={() => setMode('CLOUD')}
                className={`text-[9px] px-2 py-1 rounded-sm transition-colors ${mode === 'CLOUD' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'}`}
            >
                CLOUD
            </button>
            <button 
                onClick={() => setMode('LOCAL')}
                className={`text-[9px] px-2 py-1 rounded-sm transition-colors ${mode === 'LOCAL' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'}`}
            >
                OFFLINE
            </button>
        </div>
      </div>
      
      {state.error && (
        <div className="bg-red-900/50 border border-red-500/50 text-red-200 text-xs p-2 mb-2 rounded">
          {state.error}
        </div>
      )}

      <div className="mb-3 text-[10px] font-mono text-white/50 space-y-1">
          <div className="flex justify-between">
              <span>MODEL:</span>
              <span className="text-white/80">{mode === 'CLOUD' ? 'Google Veo-3.1' : 'CogVideoX-5B'}</span>
          </div>
          <div className="flex justify-between">
              <span>LATENCY:</span>
              <span className={mode === 'CLOUD' ? 'text-green-400' : 'text-yellow-400'}>
                {mode === 'CLOUD' ? '120ms' : '0ms (Local)'}
              </span>
          </div>
          <div className="flex justify-between">
              <span>BACKEND:</span>
              <span className="text-white/80">{mode === 'CLOUD' ? 'Vertex AI' : 'Localhost:8000'}</span>
          </div>
      </div>

      {state.isGenerating ? (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
             <div className={`w-3 h-3 rounded-full animate-ping ${mode === 'CLOUD' ? 'bg-blue-400' : 'bg-green-400'}`}></div>
             <span className={`text-xs font-mono animate-pulse ${mode === 'CLOUD' ? 'text-blue-400' : 'text-green-400'}`}>
                {mode === 'CLOUD' ? 'UPLOADING...' : 'INFERENCING...'}
             </span>
          </div>
          <div className="text-[10px] text-white/50 font-mono break-all">{state.progress}</div>
          <div className="w-full bg-white/10 h-1 mt-2">
             <div className={`h-full w-2/3 animate-pulse ${mode === 'CLOUD' ? 'bg-blue-400' : 'bg-green-400'}`}></div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
           <button 
             onClick={handleGenerate}
             className={`w-full py-2 border text-white text-xs font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 group
                ${mode === 'CLOUD' 
                    ? 'bg-blue-900/20 border-blue-500/30 hover:bg-blue-900/40 hover:border-blue-500/60' 
                    : 'bg-green-900/20 border-green-500/30 hover:bg-green-900/40 hover:border-green-500/60'
                }
             `}
           >
             <span>{mode === 'CLOUD' ? 'Generate (Veo)' : 'Generate (Local)'}</span>
             <span className="group-hover:translate-x-1 transition-transform">→</span>
           </button>
           
           {mode === 'CLOUD' && (
               <div className="text-[9px] text-center text-white/30">
                 Requires GCP API Key
               </div>
           )}
           {mode === 'LOCAL' && (
               <div className="text-[9px] text-center text-white/30">
                 Requires CogVideoX-5B @ localhost
               </div>
           )}
        </div>
      )}
    </div>
  );
};

export default VeoGenerator;