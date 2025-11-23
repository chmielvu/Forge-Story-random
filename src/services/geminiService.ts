
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { SYSTEM_INSTRUCTION, DIRECTOR_MANDATE_PROMPT } from "../constants";
import { DirectorOutput, GameState } from "../types";
import { orchestrator } from "../agents/AgentOrchestrator";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const directorSchema = {
  type: Type.OBJECT,
  properties: {
    thought_process: { type: Type.STRING, description: "Deep psychological analysis of the Subject's current state and the Agents' hidden agendas." },
    narrative: { type: Type.STRING, description: "EXTENDED NARRATIVE (300+ words). Visceral, sensory, and oppressive. Focus on textures (wet stone, velvet), smells (ozone, iron), and internal somatic sensations. Use second-person 'You'." },
    visual_prompt: { type: Type.STRING, description: "A structured, cinematographer-grade prompt for Imagen. FORMAT: '[SUBJECT] + [ACTION] + [ENVIRONMENT] + [LIGHTING] + [CAMERA]'. Example: 'Provost Selene in crimson robes, holding a wine goblet, damp stone dungeon, single shaft of moonlight, low angle.'" },
    executed_code: { type: Type.STRING, description: "The Python NetworkX code that represents the changes to the social graph for this turn. E.g., `G.add_edge('Selene', 'Subject', weight=0.9, relation='owns')`" },
    graph_updates: {
      type: Type.OBJECT,
      properties: {
        nodes_added: { 
          type: Type.ARRAY, 
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              label: { type: Type.STRING },
              group: { type: Type.STRING },
              val: { type: Type.NUMBER }
            }
          }
        },
        nodes_removed: { type: Type.ARRAY, items: { type: Type.STRING } },
        edges_added: {
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
        edges_removed: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              source: { type: Type.STRING },
              target: { type: Type.STRING }
            }
          }
        }
      }
    },
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
  const recentHistory = history.slice(-10).join("\n\n");

  // ORCHESTRATOR INJECTION
  const agentContext = orchestrator.generateContextBlock(currentState, action);

  const prompt = `
    ${DIRECTOR_MANDATE_PROMPT}

    [GAME STATE MATRIX]
    - Psychometrics (YandereLedger): ${JSON.stringify(currentState.ledger)}
    - Current Location: ${currentState.location}
    - Active Relationships: ${currentState.links.length} edges
    - Characters Present: ${validNodes}
    
    ${agentContext}

    [NARRATIVE MEMORY - PREVIOUS TURNS]
    ${recentHistory}
    
    [PLAYER INPUT]
    Action: "${action}"
    
    Think like a Director. Plan the scene. Update the graph. Break the subject.
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
        thinkingConfig: { thinkingBudget: 4096 }, // Deep Think enabled
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
      visual_prompt: "Abstract digital horror, bleeding pixels, red and black static, corrupted data stream.",
      choices: ["Stabilize consciousness.", "Reboot system."],
      state_updates: {}
    };
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
