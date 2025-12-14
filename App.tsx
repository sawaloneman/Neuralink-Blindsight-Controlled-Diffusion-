import React, { useState, useEffect, useRef } from 'react';
import BlindsightCanvas from './components/BlindsightCanvas';
import VeoGenerator from './components/VeoGenerator';
import UIOverlay from './components/UIOverlay';
import NeuralTerminal from './components/NeuralTerminal';
import NeuralPong from './components/NeuralPong';
import { SimulationMetrics, SimulationPhase, InputMode, TuningParams } from './types';

function App() {
  const [mode, setMode] = useState<'SIMULATION' | 'GENERATION'>('SIMULATION');
  const [inputMode, setInputMode] = useState<InputMode>(InputMode.STATIC);
  
  const [isSimRunning, setIsSimRunning] = useState(false);
  const [metrics, setMetrics] = useState<SimulationMetrics>({
    step: 0,
    predictionError: 1.0,
    bandwidth: 0,
    coherence: 0,
    tokenRate: 0,
    phase: SimulationPhase.CHAOS
  });
  
  // Tuning State (New Cortex Controls)
  const [tuning, setTuning] = useState<TuningParams>({
    diffusionRate: 0.15,
    hallucinationStrength: 0.05,
    predictionLookahead: 50,
    spatialDepth: 120
  });

  const [generatedVideoUri, setGeneratedVideoUri] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);

  // Media Sources
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pongCanvas, setPongCanvas] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = "https://picsum.photos/id/11/1280/720";
    img.onload = () => setSourceImage(img);

    setTimeout(() => setIsSimRunning(true), 1000);
  }, []);

  const handleMetricsUpdate = (newMetrics: SimulationMetrics) => {
    setMetrics(newMetrics);
  };

  const handleVideoReady = (uri: string) => {
    if (uri === 'local-mock-uri') {
        // "Offline" Mode: Simulate perfect convergence locally without video file
        setMode('SIMULATION');
        setTuning({
            diffusionRate: 0.8, // Maximum diffusion speed
            hallucinationStrength: 0.01, // Minimal noise
            predictionLookahead: 100,
            spatialDepth: 200
        });
        setMetrics(m => ({ ...m, phase: SimulationPhase.COMPLETE, coherence: 1.0 }));
        return;
    }
    setGeneratedVideoUri(uri);
    setMode('GENERATION');
    setIsSimRunning(false);
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && videoRef.current) {
          const url = URL.createObjectURL(file);
          videoRef.current.src = url;
          videoRef.current.play();
          setInputMode(InputMode.STREAM);
      }
  };

  let currentMediaSource: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | null = null;
  if (inputMode === InputMode.STATIC) currentMediaSource = sourceImage;
  else if (inputMode === InputMode.STREAM) currentMediaSource = videoRef.current;
  else if (inputMode === InputMode.INTERACTIVE) currentMediaSource = pongCanvas;

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden flex flex-col items-center justify-center">
      
      <video ref={videoRef} loop muted playsInline className="hidden" crossOrigin="anonymous" />
      <NeuralPong isActive={inputMode === InputMode.INTERACTIVE} onCanvasReady={setPongCanvas} />

      <div className="relative w-full h-full max-w-[1920px] max-h-[1080px] aspect-video bg-black shadow-2xl overflow-hidden border-y border-white/10 group">
        
        {mode === 'SIMULATION' && (
           <BlindsightCanvas 
             onMetricsUpdate={handleMetricsUpdate}
             isRunning={isSimRunning}
             inputMode={inputMode}
             mediaSource={currentMediaSource}
             tuning={tuning}
           />
        )}

        {mode === 'GENERATION' && generatedVideoUri && (
          <div className="w-full h-full flex items-center justify-center bg-black relative">
            <video 
              src={generatedVideoUri} 
              autoPlay loop muted controls
              className="w-full h-full object-contain"
            />
            <div className="absolute top-4 right-4 bg-red-600 text-white text-[10px] px-2 py-1 font-bold uppercase tracking-widest animate-pulse">
              Veo-3.1 Output
            </div>
          </div>
        )}

        {mode === 'SIMULATION' && <UIOverlay metrics={metrics} mode={mode} />}
        <NeuralTerminal phase={metrics.phase} isRunning={isSimRunning} />
        
        <div className="absolute bottom-32 right-8 z-40">
           <VeoGenerator onVideoReady={handleVideoReady} />
        </div>

        {/* Input Source Selector */}
        {mode === 'SIMULATION' && (
            <div className="absolute top-24 right-8 z-50 flex flex-col gap-2 bg-black/80 backdrop-blur border border-white/10 p-3 rounded text-xs font-mono">
                <div className="text-white/50 mb-1 uppercase tracking-widest">Cortex Input Source</div>
                <button 
                  onClick={() => setInputMode(InputMode.STATIC)}
                  className={`px-3 py-1 text-left border-l-2 transition-all ${inputMode === InputMode.STATIC ? 'border-green-400 text-white bg-white/10' : 'border-transparent text-white/40 hover:text-white'}`}
                >
                    STATIC_IMG_001
                </button>
                <label className={`px-3 py-1 text-left border-l-2 cursor-pointer transition-all ${inputMode === InputMode.STREAM ? 'border-green-400 text-white bg-white/10' : 'border-transparent text-white/40 hover:text-white'}`}>
                    <span>STREAM_VIDEO_IN</span>
                    <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
                </label>
                <button 
                  onClick={() => setInputMode(InputMode.INTERACTIVE)}
                  className={`px-3 py-1 text-left border-l-2 transition-all ${inputMode === InputMode.INTERACTIVE ? 'border-green-400 text-white bg-white/10' : 'border-transparent text-white/40 hover:text-white'}`}
                >
                    INTERACTIVE_GAME
                </button>
            </div>
        )}

        {/* Fine Tuning / Cortex Control Panel */}
        {mode === 'SIMULATION' && (
          <div className={`absolute left-8 top-32 z-50 transition-all duration-300 ${showControls ? 'translate-x-0' : '-translate-x-[120%]'}`}>
            <div className="w-64 bg-black/80 backdrop-blur border border-white/10 p-4 rounded text-xs font-mono">
               <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                 <span className="text-white/90 font-bold uppercase">Cortex Fine-Tuning</span>
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
               </div>

               {/* Controls */}
               <div className="space-y-4">
                 <div>
                   <div className="flex justify-between text-white/50 mb-1">
                     <span>Diffusion Rate</span>
                     <span className="text-white">{Math.round(tuning.diffusionRate * 100)}%</span>
                   </div>
                   <input 
                      type="range" min="0.01" max="0.5" step="0.01"
                      value={tuning.diffusionRate}
                      onChange={(e) => setTuning({...tuning, diffusionRate: parseFloat(e.target.value)})}
                      className="w-full accent-green-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                   />
                 </div>

                 <div>
                   <div className="flex justify-between text-white/50 mb-1">
                     <span>Hallucination Str</span>
                     <span className="text-white">{Math.round(tuning.hallucinationStrength * 100)}%</span>
                   </div>
                   <input 
                      type="range" min="0" max="0.5" step="0.01"
                      value={tuning.hallucinationStrength}
                      onChange={(e) => setTuning({...tuning, hallucinationStrength: parseFloat(e.target.value)})}
                      className="w-full accent-yellow-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                   />
                   <div className="text-[9px] text-white/30 mt-1">Controls stochastic noise injection (LLM Biased)</div>
                 </div>

                 <div>
                   <div className="flex justify-between text-white/50 mb-1">
                     <span>VR Depth Scale</span>
                     <span className="text-white">{tuning.spatialDepth}u</span>
                   </div>
                   <input 
                      type="range" min="0" max="300" step="10"
                      value={tuning.spatialDepth}
                      onChange={(e) => setTuning({...tuning, spatialDepth: parseFloat(e.target.value)})}
                      className="w-full accent-blue-500 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                   />
                 </div>

                 <div className="pt-2 border-t border-white/10 mt-2">
                    <div className="flex items-center gap-2 text-white/60">
                       <input type="checkbox" defaultChecked className="accent-green-500" />
                       <span>LLM Predictive Locking</span>
                    </div>
                    <div className="text-[9px] text-white/30 ml-5">Reduces latency by predicting object trajectory.</div>
                 </div>
               </div>
            </div>
          </div>
        )}
        
        {/* Toggle Button for Controls */}
        <button 
           onClick={() => setShowControls(!showControls)}
           className="absolute left-8 top-24 z-50 text-[10px] text-white/50 border border-white/20 px-2 py-1 rounded bg-black/50 hover:bg-white/10 uppercase"
        >
           {showControls ? 'Hide Controls' : 'Show Controls'}
        </button>

      </div>

      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-4 z-50">
        <button
          onClick={() => {
            setMode('SIMULATION');
            setIsSimRunning(false);
            setGeneratedVideoUri(null);
            setTimeout(() => setIsSimRunning(true), 100);
          }}
          className={`px-6 py-2 rounded-sm border ${
            mode === 'SIMULATION' 
              ? 'bg-white text-black border-white' 
              : 'bg-black text-white border-white/30 hover:border-white'
          } text-xs font-mono uppercase tracking-widest transition-all`}
        >
          Reset Simulation
        </button>
      </div>

    </div>
  );
}

export default App;