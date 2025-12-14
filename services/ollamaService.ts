import { OllamaModel } from '../types';

const OLLAMA_HOST = 'http://localhost:11434';

export const checkOllamaConnection = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`);
    return res.ok;
  } catch (error) {
    return false;
  }
};

export const getRunningModels = async (): Promise<OllamaModel[]> => {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`);
    if (!response.ok) throw new Error('Failed to fetch models');
    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.warn("Ollama connection failed:", error);
    return [];
  }
};

export const streamOllamaGeneration = async (
  model: string,
  system: string,
  prompt: string,
  onChunk: (chunk: string) => void
): Promise<void> => {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        system,
        prompt,
        stream: true,
        options: {
            temperature: 0.7,
            num_predict: 128
        }
      })
    });

    if (!response.body) throw new Error("No response body");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(Boolean);
      
      for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (json.response) {
                onChunk(json.response);
            }
          } catch (e) {
              // ignore partial json
          }
      }
    }
  } catch (error: any) {
    console.error("Ollama stream error:", error);
    onChunk(`\n[LOCAL CORE ERROR]: ${error.message || 'Connection lost'}`);
  }
};