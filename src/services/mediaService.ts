
import { GoogleGenAI, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { YandereLedger, PrefectDNA, CharacterId, MultimodalTurn } from "../types";
import { BEHAVIOR_CONFIG } from "../config/behaviorTuning"; 
import { visualCoherenceEngine, ZERO_DRIFT_HEADER, AESTHETIC_TOKENS, VISUAL_MANDATE, ARCHETYPE_VISUAL_MAP } from './visualCoherenceEngine';


const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- VISUAL PROMPT BUILDERS ---

/**
 * Builds a coherent visual prompt by integrating character DNA, scene context, ledger state,
 * and historical visual memory from the VisualCoherenceEngine.
 * This function is now the primary entry point for constructing image generation prompts.
 */
export function buildVisualPrompt(
  target: PrefectDNA | CharacterId, 
  sceneContext: string,
  ledger: YandereLedger,
  narrativeText: string,
  previousTurn?: MultimodalTurn // Pass previous turn for continuity
): string {
  // Delegate to the VisualCoherenceEngine for detailed prompt construction
  return visualCoherenceEngine.buildCoherentPrompt(
    target, 
    sceneContext, 
    ledger, 
    narrativeText,
    previousTurn
  );
}

// --- IMAGEN 3 GENERATION ---

const MAX_IMAGE_RETRIES = 2; // Max retries for image generation

/**
 * Generates a narrative image using the provided coherent prompt.
 * Includes retry logic and explicit quality/negative prompt directives.
 */
export const generateNarrativeImage = async (
  finalCoherentPrompt: string, // Expects a fully constructed JSON prompt string
  retryCount: number = 0
): Promise<string | undefined> => {
  
  if (!BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableImages) {
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[mediaService] Image generation is disabled by config.");
    return undefined; // Return undefined if disabled
  }

  // Add quality enforcement directives
  const qualityEnforcedPrompt = `
    ${ZERO_DRIFT_HEADER}
    
    QUALITY MANDATE (CRITICAL):
    - Minimum 8K resolution equivalent detail
    - Perfect anatomical correctness (hands, faces, proportions)
    - Photorealistic skin texture with pore detail
    - Fabric rendering with individual thread visibility, folds, and clinging effects
    - Dramatic Rembrandt Caravaggio lighting with accurate shadow falloff, deep chiaroscuro, cool rim-lighting
    - Zero artifacting, zero blurriness, zero distortion
    - Complex compositions, cinematic framing (85mm close-up)
    
    ${finalCoherentPrompt}
    
    NEGATIVE PROMPT (STRICTLY FORBIDDEN):
    blurry, low quality, bad anatomy, extra limbs, deformed hands, 
    poorly drawn face, mutation, ugly, bad proportions, text, watermark,
    signature, out of frame, duplicate, cut off, worst quality, low res,
    jpeg artifacts, cropped, poorly drawn, low detail, too dark, underexposed,
    flat lighting, muddy textures, cartoon, anime, 3d render, bright colors,
    cheerful, modern architecture, soft focus, natural daylight, graphic violence,
    explicit nudity (focus on implied sensuality/tension), fantasy armor, capes, lightning,
    gore, blood, screaming, supernatural elements, monsters, ghosts.
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', 
      contents: { parts: [{ text: qualityEnforcedPrompt }] },
      config: {
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
        temperature: 0.7, // Lower = more consistent style and adherence
      }
    });

    const imageData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!imageData) {
      if (retryCount < MAX_IMAGE_RETRIES) {
        console.warn(`[mediaService] Image generation attempt ${retryCount + 1} failed (no data), retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 + (retryCount * 1000))); // Exponential backoff
        return generateNarrativeImage(finalCoherentPrompt, retryCount + 1);
      } else {
        console.error(`[mediaService] Image generation failed after ${MAX_IMAGE_RETRIES + 1} attempts (no data).`);
        return undefined;
      }
    }
    
    return imageData;
  } catch (error) {
    if (retryCount < MAX_IMAGE_RETRIES) {
      console.warn(`[mediaService] Image generation error on attempt ${retryCount + 1}, retrying...`, error);
      await new Promise(resolve => setTimeout(resolve, 2000 + (retryCount * 2000))); // Exponential backoff
      return generateNarrativeImage(finalCoherentPrompt, retryCount + 1);
    }
    console.error(`[mediaService] Image generation failed after ${MAX_IMAGE_RETRIES + 1} attempts.`, error);
    throw error; // Re-throw final error
  }
};

// --- AUDIO ENGINE ---

const selectVoiceForNarrative = (narrative: string): string => {
  const lower = narrative.toLowerCase();
  if (lower.includes('shout') || lower.includes('fury') || lower.includes('petra')) return 'Fenrir';
  if (lower.includes('whisper') || lower.includes('calista') || lower.includes('kaelen')) return 'Kore';
  if (lower.includes('analyze') || lower.includes('lysandra') || lower.includes('elara')) return 'Puck';
  return 'Zephyr'; // Selene/Default
};

export const generateSpeech = async (narrative: string): Promise<{ audioData: string; duration: number } | undefined> => {
  if (!BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableAudio) {
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[mediaService] Audio generation is disabled by config.");
    return Promise.resolve(undefined);
  }

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
    
    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!audioData) return undefined;

    // Calculate accurate duration from PCM data
    // PCM16 at 24000 Hz: 2 bytes per sample
    const base64Length = audioData.length;
    const byteLength = (base64Length * 3) / 4; // Base64 to bytes approx
    // More accurate byte length from base64 string without padding
    // const byteLength = atob(audioData).length; 
    
    // Assuming 1 channel, 16-bit PCM, 24kHz
    const sampleCount = byteLength / 2; // 16-bit = 2 bytes per sample
    const duration = sampleCount / 24000; // 24000 Hz sample rate

    return { audioData, duration };

  } catch (error) {
    console.error("⚠️ Audio generation failed:", error);
    return undefined;
  }
};

// --- VEO 3.1 VIDEO GENERATION ---

export const animateImageWithVeo = async (
  imageB64: string, 
  visualPrompt: string, 
  aspectRatio: '16:9' | '9:16' = '16:9'
): Promise<string | undefined> => {
  if (!BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideo) {
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[mediaService] Video generation is disabled by config.");
    return Promise.resolve(undefined);
  }

  try {
    const motionPrompt = `
      ${ZERO_DRIFT_HEADER}
      Cinematic slow motion, psychological horror, atmospheric.
      Scene: ${visualPrompt}
      Directives: Micro-movements of breathing and fabric. Flickering light. Dust motes. No morphing.
      Aesthetic: ${VISUAL_MANDATE.style}
    `;

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

    let attempts = 0;
    while (!operation.done && attempts < 12) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
      attempts++;
    }

    if (!operation.done) return undefined;

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (videoUri) {
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

// --- ORCHESTRATOR ---

export const generateEnhancedMedia = async (
  narrative: string,
  // Now expects a fully coherent JSON visual prompt string
  visualPrompt: string, 
  ledger: YandereLedger,
  // Add target and previousTurn to orchestrate complex prompt building if needed here
  target: PrefectDNA | CharacterId, 
  previousTurn?: MultimodalTurn
): Promise<{ audioData?: string, imageData?: string, videoData?: string }> => {
  
  // The coherent visual prompt is already built by mediaController and passed here
  const imagePromise = generateNarrativeImage(visualPrompt);
  const audioPromise = generateSpeech(narrative);

  // Trigger video only on high intensity moments to save tokens/time
  let videoPromise: Promise<string | undefined> = Promise.resolve(undefined);
  
  const isHighIntensity = (ledger.traumaLevel > BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideoAboveTrauma || 
                          ledger.shamePainAbyssLevel > BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideoAboveShame) &&
                          BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideo; // Check global enable as well

  if (isHighIntensity) {
    videoPromise = (async () => {
      try {
        const imageBase64 = await imagePromise; // Await image first, as video needs it
        if (!imageBase64) {
          console.warn("Image not available for video generation.");
          return undefined;
        }
        return await animateImageWithVeo(imageBase64, visualPrompt, '16:9');
      } catch (e) {
        console.error("Conditional video generation failed:", e);
        return undefined;
      }
    })();
  }

  const [imageBytes, audioResult, videoBytes] = await Promise.all([imagePromise, audioPromise, videoPromise]);
  
  return {
    imageData: imageBytes,
    audioData: audioResult?.audioData,
    videoData: videoBytes
  };
};

export const distortImage = async (imageB64: string, instruction: string): Promise<string | undefined> => {
    if (!BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableImages) {
        if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[mediaService] Image distortion is disabled by config.");
        return Promise.resolve(undefined);
    }

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
            { text: `${ZERO_DRIFT_HEADER} ${instruction}` }, // Use imported header
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
