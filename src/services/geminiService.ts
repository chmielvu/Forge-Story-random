
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { DirectorOutput, GameState } from "../types";

// Using process.env.API_KEY as strictly required
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const directorSchema = {
  type: Type.OBJECT,
  properties: {
    thought_process: { type: Type.STRING, description: "System 2 reasoning. Analyze the Subject's 'Seat of the Ego'. Decide which Faculty member should intervene and why." },
    narrative: { type: Type.STRING, description: "The story text. Literary, visceral, focusing on the 'Grammar of Suffering' (Systemic Shock, Abdominal Void). Use sensory details: smell of ozone, cold stone, damp velvet. 150-250 words." },
    visual_prompt: { type: Type.STRING, description: "A single, cohesive visual description string for the scene. MUST integrate: 1. Location Architecture (Baroque Brutalism). 2. Active Character's Visual Profile (e.g., Selene's crimson robes). 3. Lighting (Vampire Noir/Chiaroscuro). 4. The Subject's state (sweat, fear)." },
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
        capacityForManipulation: { type: Type.NUMBER }
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
      description: "3 choices: 1. Compliance (Safe but degrading). 2. Defiance (Dangerous). 3. Cunning (High risk/reward)."
    }
  },
  required: ["thought_process", "narrative", "visual_prompt", "choices"]
};

// Helper to construct list of valid nodes for the prompt
const getValidNodesString = (nodes: any[]) => {
  return nodes.map(n => `${n.id} (${n.label})`).join(", ");
};

export const generateNextTurn = async (
  history: string[], 
  currentState: GameState, 
  action: string
): Promise<DirectorOutput> => {
  
  // MAIN REASONING: Using Gemini 3 Pro Preview for System 2 Thinking
  const model = "gemini-3-pro-preview"; 
  const validNodes = getValidNodesString(currentState.nodes);

  const prompt = `
    Current Game State (The YandereLedger):
    - Psychometrics: ${JSON.stringify(currentState.ledger)}
    - Location: ${currentState.location}
    - Active Graph Edges: ${currentState.links.length}
    - Valid Characters: ${validNodes}
    
    Recent Narrative History:
    ${history.slice(-3).join("\n")}
    
    Player Action: "${action}"
    
    DIRECTOR TASK:
    1. Analyze the player's action against the "Grammar of Suffering".
    2. Determine the Faculty's response. Is it a "Lesson" (Petra), a "Correction" (Selene), or "Therapy" (Calista)?
    3. Generate the output JSON adhering to the Visual and Narrative mandates.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: directorSchema,
        temperature: 0.85, 
        // Enable Thinking for complex narrative branching and psychological modeling
        thinkingConfig: { thinkingBudget: 4096 }, 
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as DirectorOutput;
    }
    throw new Error("Empty response from Director AI");

  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      thought_process: "Emergency Fallback: The Loom has fractured.",
      narrative: "The air grows heavy with static. The voices of the Faculty distort into a high-pitched ringing. You feel the weight of the island pressing down on your chest.",
      visual_prompt: "Static noise, digital glitch, baroque frame breaking, darkness.",
      choices: ["Wake up.", "Submit to the void."],
      state_updates: {}
    };
  }
};

export const generateNarrativeMedia = async (
  narrative: string,
  visualPrompt: string
): Promise<{ audioData?: string, imageData?: string }> => {
  
  // 1. Generate Image using Imagen 4.0 (High Fidelity)
  // Enforcing the "Visual Bible" aesthetics
  const styleSuffix = " style: baroque brutalism, vampire noir, chiaroscuro, tenebrism, painterly semi-realistic, cinematic concept art, desaturated earth tones, high contrast rim lighting, dramatic top-down key light. 50mm lens. High detail.";
  
  const imagePromise = ai.models.generateImages({
    model: 'imagen-4.0-generate-001',
    prompt: `${visualPrompt} ${styleSuffix}`,
    config: {
      numberOfImages: 1,
      outputMimeType: 'image/jpeg',
      aspectRatio: '1:1', // Square for the split-view layout
    }
  })
  .then(res => {
      return res.generatedImages?.[0]?.image?.imageBytes;
  })
  .catch(error => {
      console.error("⚠️ Image generation failed:", error);
      return undefined;
  });

  // 2. Generate Speech (TTS)
  // Using the specific "Kore" voice which aligns with the "Regal Matriarch" tone
  const audioPromise = ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: { parts: [{ text: narrative }] },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' } 
        }
      }
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

// --- ARCANE TOOLS (GRIMOIRE) ---

export const animateImageWithVeo = async (
  imageB64: string, 
  prompt: string, 
  aspectRatio: '16:9' | '9:16' = '16:9'
): Promise<string | undefined> => {
  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `Cinematic, slow motion, dark atmosphere, baroque brutalism. ${prompt}`,
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
        reader.onloadend = () => {
           resolve(reader.result as string); 
        };
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
    You are Doctor Lysandra, the Logician of The Forge. Analyze this visual data.
    
    CONTEXT:
    - Subject ID: 84
    - Psychometrics: ${JSON.stringify(currentState.ledger)}
    
    TASK:
    Provide a clinical report on the image. Identify symbols of resistance or submission. Does this image align with the Magistra's vision?
    Output a brief, sterile, yet unsettling analysis.
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
      },
    });
    return response.text || "Data corrupted. Subject unreadable.";
  } catch (e) {
    console.error("Analysis Failed:", e);
    return "Scanner error.";
  }
};
