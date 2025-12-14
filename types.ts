export enum SimulationPhase {
  CHAOS = 'CHAOS',
  EMERGENCE = 'EMERGENCE',
  CONVERGENCE = 'CONVERGENCE',
  COMPLETE = 'COMPLETE'
}

export enum InputMode {
  STATIC = 'STATIC',
  STREAM = 'STREAM',
  SPATIAL = 'SPATIAL', // Now functions as VR Environment
  INTERACTIVE = 'INTERACTIVE'
}

export interface SimulationMetrics {
  step: number;
  predictionError: number;
  bandwidth: number;
  coherence: number;
  tokenRate: number;
  phase: SimulationPhase;
  inputMode?: InputMode;
}

export interface TuningParams {
  diffusionRate: number; // Speed of convergence (0.0 - 1.0)
  hallucinationStrength: number; // Noise injection (0.0 - 1.0)
  predictionLookahead: number; // Latency compensation (ms)
  spatialDepth: number; // 3D Extrusion amount
}

export interface VideoGenerationState {
  isGenerating: boolean;
  progress: string;
  videoUri: string | null;
  error: string | null;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  content: string;
  source: 'SYSTEM' | 'CORTEX' | 'OLLAMA';
}

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}