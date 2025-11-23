
import { GoogleGenAI, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { YandereLedger } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- AUDIO ENGINE: EMOTIONAL VOICE SELECTION ---

const selectVoiceForNarrative = (narrative: string): string => {
  const lower = narrative.toLowerCase();
  
  // 1. Emotional Overrides (Tone modulation via preset selection)
  // Anger/Aggression -> Fenrir (Rough, deep)
  if (lower.includes('shout') || lower.includes('scream') || lower.includes('fury') || lower.includes('rage') || lower.includes('snarl')) return 'Fenrir';
  
  // Seduction/Intimacy -> Kore (Soft, breathy)
  if (lower.includes('whisper') || lower.includes('moan') || lower.includes('caress') || lower.includes('purr') || lower.includes('breath against')) return 'Kore';
  
  // Clinical/Detached -> Puck (Clear, somewhat lighter)
  if (lower.includes('analyze') || lower.includes('data') || lower.includes('calmly') || lower.includes('note that')) return 'Puck';

  // 2. Character Identity Defaults
  if (lower.includes('selene') || lower.includes('provost')) return 'Zephyr'; // Commanding
  if (lower.includes('petra') || lower.includes('inquisitor')) return 'Fenrir'; // Aggressive
  if (lower.includes('calista') || lower.includes('confessor')) return 'Kore'; // Seductive
  if (lower.includes('lysandra') || lower.includes('logician')) return 'Puck'; // Analytical
  if (lower.includes('anya') || lower.includes('nurse')) return 'Lyria'; // Deceptive warmth
  
  return 'Zephyr'; // Fallback Narrator
};

export const generateSpeech = async (narrative: string): Promise<string | undefined> => {
  try {
    const voiceName = selectVoiceForNarrative(narrative);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: { parts: [{ text: narrative }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName }
          }
        },
      }
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("⚠️ Audio generation failed:", error);
    return undefined;
  }
};

// --- VEO 3.1 VIDEO GENERATION ---

/**
 * Generates a short video loop using Veo 3.1 based on an initial image and a prompt.
 * Uses dynamic prompt injection for atmospheric motion.
 */
export const animateImageWithVeo = async (
  imageB64: string, 
  visualPrompt: string, 
  aspectRatio: '16:9' | '9:16' = '16:9'
): Promise<string | undefined> => {
  try {
    console.log("🎬 Starting Veo 3.1 Generation...");
    
    // Construct a motion-specific prompt based on the structured visual prompt
    const motionPrompt = `
      Cinematic slow motion, extreme high fidelity, 8k resolution.
      Bring this specific scene to life with subtle, atmospheric movement.
      
      SCENE CONTEXT:
      ${visualPrompt}

      MOTION DIRECTIVES:
      - Focus on micro-movements: fabric breathing, hair shifting, dust motes floating.
      - Lighting dynamics: flickering candlelight, shifting shadows, god rays.
      - Atmosphere: Oppressive, psychological horror, "Park Chan-wook" style.
      - Camera: Slow, creeping pan or subtle zoom in.
      - NO sudden movements or morphing. Keep it grounded and realistic.
    `.trim();

    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: motionPrompt,
      image: {
        imageBytes: imageB64,
        mimeType: 'image/jpeg',
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio
      }
    });

    // Poll for completion (timeout after 60s)
    let attempts = 0;
    while (!operation.done && attempts < 12) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
      operation = await ai.operations.getVideosOperation({ operation: operation });
      attempts++;
      console.log(`...Veo processing: ${attempts * 5}s`);
    }

    if (!operation.done) {
      console.warn("Veo generation timed out.");
      return undefined;
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (videoUri) {
      // Fetch the actual video bytes using the URI + API Key
      const response = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    return undefined;
  } catch (e) {
    console.error("Veo Animation Failed:", e);
    return undefined;
  }
};

// --- IMAGEN 3 GENERATION ---

export const generateNarrativeImage = async (visualPrompt: string): Promise<string | undefined> => {
  // Enhance the prompt with specific aesthetic mandates if they aren't already present
  // The Director provides the core scene; we provide the "Camera & Film Stock"
  const styleSuffix = `
    . Art Direction: Baroque Brutalism meets Vampire Noir. 
    Lighting: High contrast Chiaroscuro (Caravaggio style), volumetric lighting, deep blacks, rich golds and crimsons.
    Texture: Photorealistic, highly detailed surfaces (velvet, wet stone, cold iron, skin pores).
    Quality: 8k resolution, cinematic composition, masterpiece, oil painting aesthetic.
  `.trim();
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview', 
      contents: { parts: [{ text: `${visualPrompt} ${styleSuffix}` }] },
      config: {
        imageConfig: {
          aspectRatio: '16:9',
          imageSize: '1K'
        },
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) {
        return part.inlineData.data;
      }
    }
    return undefined;
  } catch (error) {
    console.error("⚠️ Image generation failed:", error);
    return undefined;
  }
};

// --- UTILITY: DISTORTION ---

export const distortImage = async (imageB64: string, instruction: string): Promise<string | undefined> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: imageB64,
              mimeType: 'image/jpeg',
            },
          },
          { text: instruction },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part?.inlineData) {
      return part.inlineData.data;
    }
    return undefined;
  } catch (e) {
    console.error("Image Distortion Failed:", e);
    return undefined;
  }
};

// --- ORCHESTRATOR ---

export const generateEnhancedMedia = async (
  narrative: string,
  visualPrompt: string,
  ledger: YandereLedger
): Promise<{ audioData?: string, imageData?: string, videoData?: string }> => {
  
  // 1. Start Image Generation
  const imagePromise = generateNarrativeImage(visualPrompt);

  // 2. Start Audio Generation
  const audioPromise = generateSpeech(narrative);

  // 3. Conditional Video Generation (Veo 3.1)
  // Only trigger if trauma or shame is high to save resources and create impact
  let videoPromise: Promise<string | undefined> = Promise.resolve(undefined);
  
  if (ledger.traumaLevel > 70 || ledger.shamePainAbyssLevel > 80) {
    videoPromise = (async () => {
      try {
        // We need the image first to animate it
        const imageBase64 = await imagePromise;
        if (!imageBase64) return undefined;

        // Trigger Veo using the same visual prompt context
        return await animateImageWithVeo(imageBase64, visualPrompt, '16:9');
      } catch (e) {
        console.warn("Video generation skipped or failed:", e);
        return undefined;
      }
    })();
  }

  const [imageBytes, audioBytes, videoBytes] = await Promise.all([imagePromise, audioPromise, videoPromise]);
  
  return {
    imageData: imageBytes,
    audioData: audioBytes,
    videoData: videoBytes
  };
};
