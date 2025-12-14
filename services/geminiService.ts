import { GoogleGenAI } from "@google/genai";

export const checkApiKeySelection = async (): Promise<boolean> => {
  if ((window as any).aistudio) {
    return await (window as any).aistudio.hasSelectedApiKey();
  }
  return !!process.env.API_KEY;
};

export const requestApiKeySelection = async (): Promise<void> => {
  if ((window as any).aistudio) {
    await (window as any).aistudio.openSelectKey();
  } else {
    console.warn("AI Studio key selection not available in this environment.");
  }
};

export const generateBlindsightVideo = async (
  prompt: string, 
  onProgress: (status: string) => void
): Promise<string> => {
  // Always create a new instance to capture the latest key if selected via UI
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  onProgress("Initializing Veo-3.1 session...");

  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '1080p',
        aspectRatio: '16:9'
      }
    });

    onProgress("Diffusion agents active. Processing video frames...");

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({operation: operation});
      onProgress("Refining temporal coherence...");
    }

    if (operation.error) {
       throw new Error(operation.error.message || "Unknown error during video generation");
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) {
      throw new Error("No video URI returned from generation.");
    }
    
    // Append API key for download if needed (standard pattern for some Google APIs, though Veo usually provides signed or accessible URLs)
    // The instructions say: "You must append an API key when fetching from the download link."
    return `${videoUri}&key=${process.env.API_KEY}`;

  } catch (error: any) {
    console.error("Video generation failed:", error);
    // Handle the specific "Requested entity was not found" error which implies key issues
    if (error.message && error.message.includes("Requested entity was not found")) {
        if ((window as any).aistudio) {
            await (window as any).aistudio.openSelectKey();
        }
        throw new Error("API Key invalid or expired. Please re-select your key.");
    }
    throw error;
  }
};