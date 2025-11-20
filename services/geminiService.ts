import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { DirectorOutput, GameState } from "../types";

// Using process.env.API_KEY as strictly required
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const directorSchema = {
  type: Type.OBJECT,
  properties: {
    thought_process: { type: Type.STRING, description: "Internal reasoning about narrative pacing, mechanics, and character motivation." },
    narrative: { type: Type.STRING, description: "The story text. Use rich, sensory language. Keep it under 200 words per beat." },
    visual_prompt: { type: Type.STRING, description: "A single, cohesive visual description string. You MUST integrate: 1. The specific architectural details of the current Location. 2. The Character's Visual Profile (outfit, features). 3. The specific action/pose described in the narrative. Do NOT include technical camera terms here; describe the scene content only." },
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
      description: "2 to 3 succinct choices for the player."
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
  
  // MAIN REASONING: Using Gemini 3 Pro Preview
  const model = "gemini-3-pro-preview"; 
  const validNodes = getValidNodesString(currentState.nodes);

  const prompt = `
    Current Game State:
    - Ledger: ${JSON.stringify(currentState.ledger)}
    - Location: ${currentState.location}
    - Active Graph Edges: ${currentState.links.length}
    - Valid Characters (Graph Nodes): ${validNodes}
    
    Recent History:
    ${history.slice(-3).join("\n")}
    
    Player Action: "${action}"
    
    GENERATE THE NEXT TURN.
    
    MANDATE FOR 'new_edges':
    You MUST ONLY use the Source and Target IDs listed in 'Valid Characters' above. Do not invent new IDs.
    
    MANDATE FOR 'visual_prompt':
    You must generate a single, vivid scene description. 
    1. Start with the LOCATION: Describe the '${currentState.location}' using the Baroque Brutalism aesthetic (wet concrete, gold, shadows).
    2. Place the CHARACTER: Insert the active character using their strict Visual Profile from the System Instructions.
    3. Define the ACTION: Describe exactly what they are doing based on your new narrative (e.g., "sipping wine," "raising a crop").
    4. Ensure the output is a cohesive sentence, e.g., "Provost Selene stands on the wet black stone of the Weeping Dock, the massive basalt gates looming behind her, wearing a crimson velvet robe plunging to the navel, holding a goblet of wine with a cold, amused expression."
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: directorSchema,
        temperature: 0.8, 
        // Enable Thinking for complex narrative branching
        thinkingConfig: { thinkingBudget: 2048 }, 
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as DirectorOutput;
    }
    throw new Error("Empty response from Director AI");

  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      thought_process: "Error fallback: The connection to the Cogitator Engine was severed.",
      narrative: "The air grows heavy with static. The voices of the Faculty distort and fade, replaced by a high-pitched ringing in your ears. The simulation destabilizes.",
      visual_prompt: "A glitching, static-filled void, digital noise, error screen.",
      choices: ["Attempt to reconnect."],
      state_updates: {}
    };
  }
};

export const generateNarrativeMedia = async (
  narrative: string,
  visualPrompt: string
): Promise<{ audioData?: string, imageData?: string }> => {
  
  // 1. Generate Image using Imagen 4.0 (High Quality)
  // Using Imagen 4.0 for the highest fidelity character art
  const imagePromise = ai.models.generateImages({
    model: 'imagen-4.0-generate-001',
    prompt: `${visualPrompt} style: grounded dark erotic academia, baroque brutalism, vampire noir, intimate psychological horror, rembrandt caravaggio lighting, 50mm lens close-up, high detail skin texture, restrained masterpiece oil painting, no fantasy elements.`,
    config: {
      numberOfImages: 1,
      outputMimeType: 'image/jpeg',
      aspectRatio: '1:1', 
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
  // Using specialized TTS model for voice
  const audioPromise = ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: { parts: [{ text: narrative }] },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' } // Female narrative voice
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

// Tool 1: Veo Reanimation
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
        mimeType: 'image/jpeg', // Veo handles common image types
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio
      }
    });

    // Poll for completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5s poll
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (videoUri) {
      // Fetch the actual video bytes to display
      const response = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
      const blob = await response.blob();
      // Convert blob to base64 data URL for local display
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

// Tool 2: Nano Banana (Edit Image)
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

// Tool 3: Gemini Vision Analysis (ENHANCED)
export const analyzeArcaneRelic = async (
  imageB64: string,
  currentState: GameState
): Promise<string> => {
  const analysisPrompt = `
    ROLE-PLAYING MANDATE: 
    You are Doctor Lysandra, the Logician of The Forge. You are analyzing a piece of visual evidence for Provost Selene. Your analysis must be clinical, detached, deeply psychological, and reference the core tenets and characters of The Forge.

    CONTEXT:
    - Current Psychometric Readout of Subject 84: ${JSON.stringify(currentState.ledger)}
    - Current Location: ${currentState.location}

    TASK:
    Analyze the attached image. Based on your knowledge of the Forge's curriculum and personnel (provided in the System Instructions), provide a clinical report. Identify:
    1.  **Symbolic Content**: Does the image contain elements that affirm or subvert our doctrine? Note any symbolic representations of power, submission, or defiance.
    2.  **Psychological Tells**: If a subject is depicted, analyze their posture, expression, and state. Is their compliance genuine or feigned? Do they exhibit symptoms of trauma-bonding or nascent rebellion?
    3.  **Operational Security**: If a Faculty or Prefect is depicted, does their presentation betray any weakness, emotional attachment, or deviation from their designated role?
    4.  **Conclusion**: Provide a succinct, actionable conclusion. Is this evidence of progress, a threat to be neutralized, or merely irrelevant data?

    Your output must be a single block of text formatted as a clinical report.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Vision analysis explicitly uses Gemini 3 Pro Preview
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
        // Provide the full system instruction for deep context
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });
    return response.text || "Analysis inconclusive. The data is corrupted.";
  } catch (e) {
    console.error("Analysis Failed:", e);
    return "The scanner malfunctioned, producing only static. The data is lost.";
  }
};