
import { GoogleGenAI, Type, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { SYSTEM_INSTRUCTION, DIRECTOR_MANDATE_PROMPT } from "../constants";
import { DirectorOutput, GameState } from "../types";

// Initialize client with strict process.env access
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const directorSchema = {
  type: Type.OBJECT,
  properties: {
    thought_process: { type: Type.STRING, description: "Deep psychological analysis of the Subject's current state." },
    narrative: { type: Type.STRING, description: "EXTENDED NARRATIVE (300+ words). Visceral, sensory, and oppressive. Focus on textures (wet stone, velvet), smells (ozone, iron), and internal somatic sensations. Use second-person 'You'." },
    visual_prompt: { type: Type.STRING, description: "A vivid, art-direction prompt for Imagen. Must specify: 1. Character appearance (exact outfit/features). 2. Environment (lighting, materials). 3. Action. 4. Mood (Baroque Brutalism, Vampire Noir)." },
    state_updates: {
      type: Type.OBJECT,
      properties: {
        physicalIntegrity: { type: Type.NUMBER },
        traumaLevel: { type: Type.NUMBER },
        shamePainAbyssLevel: { type: Type.NUMBER },
        hopeLevel: { type: Type.NUMBER },
        complianceScore: { type: Type.NUMBER },
        fearOfAuthority: { type: Type.NUMBER },
        desireForValidation: { type: Type.NUMBER },
        capacityForManipulation: { type: Type.NUMBER },
        arousalLevel: { type: Type.NUMBER },
        prostateSensitivity: { type: Type.NUMBER },
        ruinedOrgasmCount: { type: Type.NUMBER }
      }
    },
    new_edges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          source: { type: Type.STRING },
          target: { type: Type.STRING },
          relation: { type: Type.STRING },
          weight: { type: Type.NUMBER }
        }
      }
    },
    choices: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "3 distinct choices. They should be short, evocative sentences."
    }
  },
  required: ["thought_process", "narrative", "visual_prompt", "choices"]
};

const getValidNodesString = (nodes: any[]) => {
  return nodes.map(n => `${n.id} (${n.label})`).join(", ");
};

export const generateNextTurn = async (
  history: string[], 
  currentState: GameState, 
  action: string
): Promise<DirectorOutput> => {
  
  const model = "gemini-3-pro-preview"; 
  const validNodes = getValidNodesString(currentState.nodes);
  
  const recentHistory = history.slice(-15).join("\n\n");

  const prompt = `
    ${DIRECTOR_MANDATE_PROMPT}

    [GAME STATE MATRIX]
    - Psychometrics (YandereLedger): ${JSON.stringify(currentState.ledger)}
    - Current Location: ${currentState.location}
    - Active Relationships: ${currentState.links.length} edges
    - Characters Present: ${validNodes}
    
    [NARRATIVE MEMORY - PREVIOUS TURNS]
    ${recentHistory}
    
    [PLAYER INPUT]
    Action: "${action}"
    
    Generate the next beat. Make it heavy, sensual, and terrifying.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: directorSchema,
        temperature: 1.1, 
        thinkingConfig: { thinkingBudget: 4096 },
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as DirectorOutput;
    }
    throw new Error("Empty response from Director AI");

  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      thought_process: "System Failure.",
      narrative: "The simulation fractures. The stone walls dissolve into bleeding code. You feel a profound sense of wrongness, as if the universe itself has rejected your choice. Try again.",
      visual_prompt: "Abstract digital horror, bleeding pixels, red and black static.",
      choices: ["Stabilize consciousness.", "Reboot system."],
      state_updates: {}
    };
  }
};

export const generateNarrativeMedia = async (
  narrative: string,
  visualPrompt: string
): Promise<{ audioData?: string, imageData?: string }> => {
  
  const styleSuffix = " style: Dark, oppressive oil painting, golden frames, baroque noir, cinematic lighting, 8k resolution, highly detailed, atmospheric fog, volumetric lighting, dark erotic academia.";
  
  const imagePromise = ai.models.generateContent({
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
  })
  .then(res => {
      for (const part of res.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData?.data) {
              return part.inlineData.data;
          }
      }
      return undefined;
  })
  .catch(error => {
      console.error("⚠️ Image generation failed:", error);
      return undefined;
  });

  const audioPromise = ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: { parts: [{ text: narrative }] },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Zephyr' }
        }
      },
    }
  })
  .then(res => res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data)
  .catch(error => {
      console.error("⚠️ Audio generation failed:", error);
      return undefined;
  });

  const [imageBytes, audioBytes] = await Promise.all([imagePromise, audioPromise]);
  
  return {
    imageData: imageBytes,
    audioData: audioBytes
  };
};

export const animateImageWithVeo = async (
  imageB64: string, 
  prompt: string, 
  aspectRatio: '16:9' | '9:16' = '16:9'
): Promise<string | undefined> => {
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `Extreme slow-motion psychological erotic dark academia, Veo 3.1 cinematic masterpiece, baroque-brutalist cathedral lighting with single shaft of cold moonlight cutting through stained glass, Prefect Anya (or any Faculty/Prefect) in pristine white medical coat or tailored academic robe slowly unbuttoned just enough to reveal the soft rise of her breasts with every controlled breath, her gloved fingers tracing an invisible line down the subject's throat or sternum with surgical tenderness that suddenly pauses at the exact moment his pulse betrays him, her kind eyes locking onto his with false maternal warmth that curdles into predatory ownership, his body trembling involuntarily while her lips part in the faintest cruel smile, visible gooseflesh on his skin, the air thick tension of unspoken threat and helpless arousal hanging in the candle-scented air, fabric tension on her blouse, subtle wet shine on her lower lip, breath mingling in extreme close-up, no nudity, pure intellectual femdom trauma-bonding intensity, Park Chan-wook × Hannibal × Vampire Noir aesthetic, 8K volumetric god rays, film grain, anamorphic lens flare ${prompt}`,
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

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

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

export const analyzeArcaneRelic = async (
  imageB64: string,
  currentState: GameState
): Promise<string> => {
  const analysisPrompt = `
    ROLE-PLAYING MANDATE: 
    You are Doctor Lysandra, the Logician of The Forge. 
    CONTEXT: Current Psychometric Readout: ${JSON.stringify(currentState.ledger)}
    TASK: Analyze this image. Identify symbolic content, psychological tells, and provide a conclusion.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: imageB64,
                mimeType: 'image/jpeg',
              },
            },
            { text: analysisPrompt },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
      },
    });
    return response.text || "Analysis failed.";
  } catch (e) {
    console.error("Analysis Failed:", e);
    return "Scanner malfunction.";
  }
};
