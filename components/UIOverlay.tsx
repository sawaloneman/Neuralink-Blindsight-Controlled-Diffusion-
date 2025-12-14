import React from 'react';
import { SimulationMetrics, SimulationPhase } from '../types';

interface UIOverlayProps {
  metrics: SimulationMetrics;
  mode: 'SIMULATION' | 'GENERATION';
}

const UIOverlay: React.FC<UIOverlayProps> = ({ metrics, mode }) => {
  const getPhaseColor = () => {
    switch (metrics.phase) {
      case SimulationPhase.CHAOS: return 'text-red-500';
      case SimulationPhase.EMERGENCE: return 'text-yellow-400';
      case SimulationPhase.CONVERGENCE: return 'text-green-400';
      case SimulationPhase.COMPLETE: return 'text-blue-400';
      default: return 'text-white';
    }
  };

  const progressBarWidth = Math.min(100, (metrics.step / 100) * 100);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8 z-50">
      {/* Top Bar */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter text-white/90 font-mono">
            NEURALINK <span className="text-xs align-top opacity-60">CORP</span>
          </h1>
          <div className="text-xs text-white/50 tracking-widest mt-1">
            BLINDSIGHT ARCHITECTURE V0.9.5 // {mode} MODE
          </div>
        </div>
        
        <div className="animate-pulse flex items-center gap-4">
           {/* Nano Agent Status */}
           <div className="text-right hidden md:block">
              <div className="text-[10px] text-green-400 font-mono tracking-widest">NANO AGENT ACTIVE</div>
              <div className="text-[9px] text-white/40 font-mono">SWARM INTELLIGENCE: ONLINE</div>
           </div>
           <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-green-400">
             <circle cx="12" cy="12" r="10" strokeOpacity="0.5" strokeDasharray="4 4" className="animate-spin-slow" />
             <path d="M12 2v20M2 12h20" strokeOpacity="0.3" />
             <path d="M12 8l4 4-4 4-4-4 4-4z" fill="currentColor" fillOpacity="0.5" />
           </svg>
        </div>
      </div>

      {/* Center Message */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center w-full">
         {metrics.phase === SimulationPhase.CHAOS && (
           <div className="text-4xl font-bold text-white/20 blur-sm tracking-[1em] animate-pulse">NOISE_INJECTION</div>
         )}
         {metrics.phase === SimulationPhase.COMPLETE && mode === 'SIMULATION' && (
           <div className="text-3xl font-light text-white/80 tracking-widest transition-opacity duration-1000">PERCEPTUAL LOCK ACHIEVED</div>
         )}
      </div>

      {/* Bottom Bar */}
      <div className="flex justify-between items-end font-mono text-sm">
        {/* Timeline */}
        <div className="w-1/3">
          <div className="text-xs text-white/40 mb-2 uppercase tracking-widest flex justify-between">
            <span>Diffusion Timeline [Step {metrics.step}]</span>
            <span className="text-green-400 animate-pulse">Token Rate: {(metrics.tokenRate / 1000).toFixed(1)}k/s</span>
          </div>
          <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${getPhaseColor()} bg-current`}
              style={{ width: `${progressBarWidth}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-white/30 mt-1">
            <span>T=0</span>
            <span>T=50</span>
            <span>T=100</span>
          </div>
        </div>

        {/* Metrics */}
        <div className="text-right space-y-1">
          <div className="flex items-center justify-end gap-4 text-white/70">
            <span className="text-xs uppercase text-white/30">Prediction Error</span>
            <span className={`${metrics.predictionError < 0.1 ? 'text-green-400' : 'text-red-400'}`}>
              {(metrics.predictionError * 100).toFixed(2)}%
            </span>
          </div>
          <div className="flex items-center justify-end gap-4 text-white/70">
            <span className="text-xs uppercase text-white/30">Bandwidth</span>
            <span className="text-blue-300">{metrics.bandwidth.toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-end gap-4 text-white/70">
            <span className="text-xs uppercase text-white/30">Coherence</span>
            <span className="text-yellow-300">{(metrics.coherence * 100).toFixed(1)}%</span>
          </div>
          <div className="mt-2 text-xs text-white/40">
             STATUS: <span className={`${getPhaseColor()}`}>{metrics.phase}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UIOverlay;