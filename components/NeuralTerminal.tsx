import React, { useState, useEffect, useRef } from 'react';
import { SimulationPhase, LogEntry, OllamaModel } from '../types';
import { getRunningModels, streamOllamaGeneration, checkOllamaConnection } from '../services/ollamaService';

interface NeuralTerminalProps {
  phase: SimulationPhase;
  isRunning: boolean;
}

const SYSTEM_PROMPT = `You are the kernel of the Neuralink Blindsight visual cortex interface. 
Your job is to output short, cryptic, highly technical system logs describing the current process of reconstructing vision from neural spikes.
Use terms like: V1 cortex, spike train, gaussian noise, denoising, latent space, phosphene grid, dopamine reinforcement, edge detection, semantic lock.
Output format: Just the log message. Keep it brief (1-2 sentences). Do not use markdown.`;

const NeuralTerminal: React.FC<NeuralTerminalProps> = ({ phase, isRunning }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isExpanding, setIsExpanding] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastPhaseRef = useRef<SimulationPhase>(SimulationPhase.CHAOS);

  // Initial connection check
  useEffect(() => {
    const init = async () => {
      const connected = await checkOllamaConnection();
      setIsConnected(connected);
      if (connected) {
        const available = await getRunningModels();
        setModels(available);
        if (available.length > 0) {
          // Prefer smaller/faster models if available
          const preferred = available.find(m => m.name.includes('llama3') || m.name.includes('mistral')) || available[0];
          setSelectedModel(preferred.name);
          addLog("LOCAL_CORE: CONNECTED TO OLLAMA HOST", "SYSTEM");
        }
      } else {
        addLog("LOCAL_CORE: NOT DETECTED (Run 'ollama serve' with CORS enabled)", "SYSTEM");
      }
    };
    init();
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Phase change reaction
  useEffect(() => {
    if (!isConnected || !isRunning || !selectedModel) return;
    
    // Trigger generation when phase changes or occasionally during running
    if (phase !== lastPhaseRef.current) {
      triggerLogGeneration(phase);
      lastPhaseRef.current = phase;
    }
  }, [phase, isConnected, isRunning, selectedModel]);

  const addLog = (content: string, source: 'SYSTEM' | 'CORTEX' | 'OLLAMA') => {
    setLogs(prev => [...prev.slice(-20), { // Keep last 20 logs
      id: Math.random().toString(36),
      timestamp: new Date().toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 2 } as any),
      content,
      source
    }]);
  };

  const triggerLogGeneration = async (currentPhase: SimulationPhase) => {
    let prompt = "";
    switch (currentPhase) {
      case SimulationPhase.CHAOS:
        prompt = "Generate 3 log lines about initializing random noise injection and electrode calibration failure/success.";
        break;
      case SimulationPhase.EMERGENCE:
        prompt = "Generate 3 log lines about detecting faint edges, coherence gradients rising, and phosphene alignment.";
        break;
      case SimulationPhase.CONVERGENCE:
        prompt = "Generate 3 log lines about image synthesis, locking onto semantic targets, and temporal stability.";
        break;
      case SimulationPhase.COMPLETE:
        prompt = "Generate a success message about full visual cortex override and high-fidelity output.";
        break;
    }

    let buffer = "";
    await streamOllamaGeneration(selectedModel, SYSTEM_PROMPT, prompt, (chunk) => {
       buffer += chunk;
       // Simple split by newline to simulate separate log entries
       if (buffer.includes('\n')) {
         const parts = buffer.split('\n');
         // Process all complete parts
         for (let i = 0; i < parts.length - 1; i++) {
            if (parts[i].trim()) addLog(parts[i].trim(), 'OLLAMA');
         }
         // Keep the remainder
         buffer = parts[parts.length - 1];
       }
    });
    if (buffer.trim()) addLog(buffer.trim(), 'OLLAMA');
  };

  return (
    <div className={`absolute left-8 bottom-32 z-40 transition-all duration-500 ease-out font-mono text-[10px] ${isExpanding ? 'w-96 h-64' : 'w-80 h-48'}`}>
      {/* Header */}
      <div className="bg-black/90 border border-white/20 border-b-0 p-2 flex justify-between items-center rounded-t-sm backdrop-blur-md">
        <div className="flex items-center gap-2">
           <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
           <span className="text-white/80 font-bold tracking-wider">NEURAL_KERNEL // {isConnected ? 'ONLINE' : 'OFFLINE'}</span>
        </div>
        <button onClick={() => setIsExpanding(!isExpanding)} className="text-white/40 hover:text-white">
          {isExpanding ? '[-]' : '[+]'}
        </button>
      </div>

      {/* Connection Config (only if online) */}
      {isConnected && models.length > 0 && (
         <div className="bg-black/90 border-x border-white/20 px-2 pb-2 text-white/50">
            <select 
              value={selectedModel} 
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-black border border-white/10 text-xs w-full p-1 focus:outline-none focus:border-green-500 text-green-500/80"
            >
               {models.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
            </select>
         </div>
      )}

      {/* Terminal Body */}
      <div 
        ref={scrollRef}
        className="bg-black/80 border border-white/20 h-full overflow-y-auto p-2 font-mono space-y-1 backdrop-blur-md custom-scrollbar"
      >
        {!isConnected && (
            <div className="p-2 border border-red-900/50 bg-red-900/10 text-red-400 mb-2">
                <p className="font-bold">LOCAL CORE DISCONNECTED</p>
                <p className="opacity-70 mt-1">To enable Neural Narrative:</p>
                <ol className="list-decimal list-inside mt-1 opacity-60">
                    <li>Install Ollama</li>
                    <li>Set OLLAMA_ORIGINS="*"</li>
                    <li>Run `ollama serve`</li>
                </ol>
            </div>
        )}
        
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2 leading-tight">
            <span className="text-white/30 shrink-0">[{log.timestamp}]</span>
            <span className={`${
              log.source === 'SYSTEM' ? 'text-yellow-500' : 
              log.source === 'OLLAMA' ? 'text-green-400' : 'text-blue-400'
            }`}>
              {log.source === 'OLLAMA' && '> '}
              {log.content}
            </span>
          </div>
        ))}
        <div className="animate-pulse text-green-500">_</div>
      </div>
    </div>
  );
};

export default NeuralTerminal;