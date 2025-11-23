
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Type } from "@google/genai";
import { CharacterId, YandereLedger, AgentArchetype } from "../types";

// --- Configuration Interfaces ---

export interface OceanProfile {
  openness: number;          // Imagination / Insight
  conscientiousness: number; // Discipline / Order
  extraversion: number;      // Assertiveness / Energy
  agreeableness: number;     // Compassion / Antagonism (Low = Cruel)
  neuroticism: number;       // Emotional Instability
}

export interface TriggerCondition {
  stat: keyof YandereLedger;
  operator: '>' | '<' | '>=' | '<=';
  value: number;
}

export interface AdvancedTrigger {
  id: string;
  conditions: TriggerCondition[]; 
  conditionLogic?: 'AND' | 'OR'; // Defaults to AND if undefined
  priority: number; // Higher priority overrides lower
  behavior: string; // The specific directive to inject
  intentMod?: string; // Optional update to the agent's intent
}

export interface NPCConfig {
  id: CharacterId;
  name: string;
  archetype: AgentArchetype;
  voicePreset: 'Zephyr' | 'Puck' | 'Kore' | 'Fenrir' | 'Aoede';
  ocean: OceanProfile;
  coreTactics: string[];
  complexTriggers: AdvancedTrigger[];
  systemInstruction: string;
}

export interface NPCResponse {
  dialogue: string;
  action: string;
  emotionalState: string;
  tacticalIntent: string;
  obsessionShift?: number; // Change in obsession (-10 to +10)
  audioData?: string; // Base64 encoded PCM
}

// --- Agent Class ---

export class NPCAgent {
  private client: GoogleGenAI;
  private history: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  public config: NPCConfig;
  
  // Persistent State
  private _obsessionLevel: number = 10; 
  private _currentIntent: string = "Assessing potential utility.";
  private _lastReflection: string = "";

  constructor(config: NPCConfig) {
    this.config = config;
    this.client = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  /**
   * Heuristically analyzes the player's action to update internal state BEFORE generation.
   * This simulates immediate emotional reaction based on OCEAN traits.
   */
  public reflectOnPlayerAction(action: string): void {
    const lowerAction = action.toLowerCase();
    const { agreeableness, neuroticism, extraversion, conscientiousness } = this.config.ocean;
    
    let reflectionNote = "";
    let obsessionDelta = 0;

    // Heuristics
    const isDefiant = lowerAction.includes('no') || lowerAction.includes('refuse') || lowerAction.includes('glare') || lowerAction.includes('spit') || lowerAction.includes('fight');
    const isSubmissive = lowerAction.includes('beg') || lowerAction.includes('kneel') || lowerAction.includes('cry') || lowerAction.includes('sorry') || lowerAction.includes('yes');
    const isChaotic = lowerAction.includes('run') || lowerAction.includes('break') || lowerAction.includes('scream') || lowerAction.includes('laugh');

    // --- Personality Matrix ---

    // DOMINANT / LOW AGREEABLENESS (Selene/Petra)
    if (agreeableness < 0.3) {
      if (isDefiant) {
        reflectionNote = "Subject challenges authority. Amusement converting to cold fury.";
        obsessionDelta += 5; // Challenges are interesting but punishable
        if (extraversion > 0.7) this._currentIntent = "Crush insolence immediately.";
      } else if (isSubmissive) {
        reflectionNote = "Subject accepts their place. Boring but efficient.";
        obsessionDelta -= 2; // Boring when broken
      }
    }

    // HIGH NEUROTICISM (Petra/Kaelen)
    if (neuroticism > 0.6) {
      if (isDefiant) {
        reflectionNote = "Perceived threat to control. Anxiety spike. Triggering rage response.";
        this._currentIntent = "Lash out to regain control.";
        obsessionDelta += 10;
      } else if (isChaotic) {
        reflectionNote = "Unpredictability detected. Unacceptable.";
        this._currentIntent = "Immobilize subject violently.";
      }
    }

    // HIGH CONSCIENTIOUSNESS (Selene/Lysandra)
    if (conscientiousness > 0.7) {
      if (isChaotic) {
        reflectionNote = "Disorder detected. Evaluating correction protocols.";
        this._currentIntent = "Restore order.";
      }
    }

    // Nurturing Trap (Calista)
    if (this.config.archetype === 'NURTURING') {
      if (isDefiant) {
        this._currentIntent = "Undermine resistance with false sympathy.";
        reflectionNote = "He fights because he is scared. He needs 'help'.";
      }
    }

    this._obsessionLevel = Math.min(100, Math.max(0, this._obsessionLevel + obsessionDelta));
    this._lastReflection = reflectionNote;
  }

  public async generateResponse(
    playerAction: string,
    ledger: YandereLedger,
    location: string,
    recentNarrative: string,
    otherNPCsPresent: string[]
  ): Promise<NPCResponse> {
    
    // 1. Pre-processing Reflection
    this.reflectOnPlayerAction(playerAction);

    // 2. Construct Contextual Prompt
    const contextPrompt = this.buildContext(playerAction, ledger, location, recentNarrative, otherNPCsPresent);
    
    // 3. Define Output Schema
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        dialogue: { type: Type.STRING, description: "The spoken words. Short, punchy, character-driven." },
        action: { type: Type.STRING, description: "Physical action accompanying speech (e.g., 'smirks', 'tightens grip')." },
        emotionalState: { type: Type.STRING, description: "Current internal mood (e.g., 'Amused', 'Cold Fury')." },
        tacticalIntent: { type: Type.STRING, description: "Updated goal based on player action (e.g., 'Intimidate', 'Seduce')." },
        obsessionShift: { type: Type.NUMBER, description: "Integer change in obsession level (-5 to +10)." }
      },
      required: ["dialogue", "action", "emotionalState", "tacticalIntent"]
    };

    try {
      const result = await this.client.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: contextPrompt,
        config: {
          systemInstruction: this.config.systemInstruction,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 1.2,
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          ],
        }
      });

      const jsonText = result.text;
      if (!jsonText) throw new Error("Empty response from Agent");
      
      const parsedResponse = JSON.parse(jsonText) as NPCResponse;

      // Update Persistent State
      this.updateState(parsedResponse);
      this.updateHistory(playerAction, parsedResponse.dialogue);

      return {
        ...parsedResponse,
        // Audio generation is handled centrally by mediaService now, so we leave this undefined here
        // to be handled by the orchestrator if needed, or we can remove it from NPCResponse
        audioData: undefined 
      };

    } catch (error) {
      console.error(`Agent ${this.config.name} Failure:`, error);
      return {
        dialogue: "...",
        action: "stares silently, calculation running behind cold eyes.",
        emotionalState: "System_Error",
        tacticalIntent: "Reboot",
        audioData: undefined
      };
    }
  }

  private updateState(response: NPCResponse) {
    this._currentIntent = response.tacticalIntent;
    if (response.obsessionShift) {
      this._obsessionLevel = Math.min(100, Math.max(0, this._obsessionLevel + response.obsessionShift));
    }
  }

  public calculateReaction(playerAction: string, traumaLevel: number): string {
    // Use the reflection logic if available, otherwise fallback
    if (this._lastReflection) return this._lastReflection;
    return "Observing.";
  }

  get state() {
    return {
      id: this.config.id,
      name: this.config.name,
      archetype: this.config.archetype,
      traits: this.config.ocean,
      obsessionLevel: this._obsessionLevel,
      currentIntent: this._currentIntent
    };
  }

  // Helper: Check a single condition
  private checkCondition(cond: TriggerCondition, ledger: YandereLedger): boolean {
    const currentVal = ledger[cond.stat];
    switch (cond.operator) {
      case '>': return currentVal > cond.value;
      case '<': return currentVal < cond.value;
      case '>=': return currentVal >= cond.value;
      case '<=': return currentVal <= cond.value;
      default: return false;
    }
  }

  // Logic for handling AND/OR triggers
  private evaluateTriggers(ledger: YandereLedger): string[] {
    const activeDirectives: string[] = [];
    const activeTriggers: AdvancedTrigger[] = [];
    
    // Sort triggers by priority (Descending)
    const sortedTriggers = [...this.config.complexTriggers].sort((a, b) => b.priority - a.priority);

    for (const trigger of sortedTriggers) {
      const results = trigger.conditions.map(cond => this.checkCondition(cond, ledger));
      
      // Handle logic type
      const isMet = (trigger.conditionLogic === 'OR') 
        ? results.some(r => r) 
        : results.every(r => r); // Default AND

      if (isMet) {
        activeTriggers.push(trigger);
        activeDirectives.push(`[PRIORITY ${trigger.priority} TRIGGER]: ${trigger.behavior}`);
      }
    }

    // Apply intent modifications from triggers
    this.adjustTacticalIntent(activeTriggers);

    return activeDirectives;
  }

  // Dynamically adjust intent based on the highest priority trigger that demands it
  private adjustTacticalIntent(activeTriggers: AdvancedTrigger[]): void {
    const drivingTrigger = activeTriggers.find(t => t.intentMod); // Already sorted by priority
    if (drivingTrigger && drivingTrigger.intentMod) {
      this._currentIntent = drivingTrigger.intentMod;
    }
  }

  private getTraitDirectives(ocean: OceanProfile): string {
    const directives: string[] = [];
    if (ocean.openness > 0.7) directives.push("Use abstract metaphors and theoretical frameworks.");
    else if (ocean.openness < 0.4) directives.push("Be literal, concrete, and focused on physical reality.");
    if (ocean.conscientiousness > 0.7) directives.push("Speak with precise grammar and clinical detachment.");
    else if (ocean.conscientiousness < 0.4) directives.push("Use fragmented sentences and impulsive phrasing.");
    if (ocean.extraversion > 0.7) directives.push("Dominate the conversation. Interrupt. Command.");
    else if (ocean.extraversion < 0.4) directives.push("Be laconic. Use silence as a weapon.");
    if (ocean.agreeableness > 0.7) directives.push("Feign warmth and use endearments to mask cruelty.");
    else if (ocean.agreeableness < 0.3) directives.push("Be openly hostile and mocking.");
    if (ocean.neuroticism > 0.7) directives.push("Display emotional volatility and instability.");
    else if (ocean.neuroticism < 0.3) directives.push("Maintain unnerving, robotic calm.");
    return directives.join(" ");
  }

  private buildContext(
    action: string, 
    ledger: YandereLedger, 
    location: string, 
    narrative: string, 
    others: string[]
  ): string {
    
    const activeTriggerDirectives = this.evaluateTriggers(ledger);
    const styleDirectives = this.getTraitDirectives(this.config.ocean);

    return `
      ROLE: You are ${this.config.name}.
      INTERNAL STATE:
      - Obsession: ${this._obsessionLevel}%
      - Current Intent: "${this._currentIntent}"
      - Subconscious Reflection: "${this._lastReflection}"

      CORE PERSONALITY (OCEAN):
      O:${this.config.ocean.openness} C:${this.config.ocean.conscientiousness} E:${this.config.ocean.extraversion} A:${this.config.ocean.agreeableness} N:${this.config.ocean.neuroticism}

      MANDATES:
      - STYLE: ${styleDirectives}
      - ACTIVE TRIGGERS:
      ${activeTriggerDirectives.join('\n')}

      SYSTEM INSTRUCTION: ${this.config.systemInstruction}
      TACTICS: ${this.config.coreTactics.join(', ')}

      CONTEXT:
      - Location: ${location}
      - Others: ${others.join(', ')}
      - Recent Events: ${narrative}
      
      PLAYER STATUS:
      Trauma:${ledger.traumaLevel} Shame:${ledger.shamePainAbyssLevel} Compliance:${ledger.complianceScore} Hope:${ledger.hopeLevel}

      PLAYER ACTION: "${action}"

      TASK: Respond to the player. Stay in character. Apply the DIALOGUE STYLE MANDATES strictly. Update your tactical intent and obsession level.
    `;
  }

  private async generateVoice(text: string): Promise<string | undefined> {
    // Deprecated in favor of mediaService centralization, but kept for fallback/testing
    return undefined; 
  }

  private updateHistory(userAction: string, modelResponse: string) {
    this.history.push({ role: 'user', parts: [{ text: userAction }] });
    this.history.push({ role: 'model', parts: [{ text: modelResponse }] });
    if (this.history.length > 6) this.history = this.history.slice(-6);
  }

  public reset() {
    this.history = [];
    this._obsessionLevel = 10;
    this._currentIntent = "Assessment";
    this._lastReflection = "";
  }
}

// --- PREDEFINED PERSONALITIES ---

export const NPC_PERSONALITIES: Record<string, NPCConfig> = {
  [CharacterId.PROVOST]: {
    id: CharacterId.PROVOST,
    name: "Provost Selene",
    archetype: 'DOMINANT',
    voicePreset: "Zephyr",
    ocean: { openness: 0.8, conscientiousness: 0.9, extraversion: 0.8, agreeableness: 0.1, neuroticism: 0.2 },
    coreTactics: ["Glacial Dominance", "Intellectual Humiliation", "The Bored God Complex"],
    complexTriggers: [
      {
        id: 'crush_rebellion',
        conditions: [{ stat: 'hopeLevel', operator: '>', value: 70 }, { stat: 'complianceScore', operator: '<', value: 30 }],
        priority: 10,
        conditionLogic: 'AND',
        behavior: "Your authority is being challenged. Crush the rebellion immediately with overwhelming verbal force.",
        intentMod: "Total subjugation."
      },
      {
        id: 'boring_compliance',
        conditions: [{ stat: 'complianceScore', operator: '>', value: 80 }, { stat: 'traumaLevel', operator: '>', value: 60 }],
        priority: 5,
        conditionLogic: 'AND',
        behavior: "The subject is broken and boring. Treat them like furniture. Dismiss them.",
        intentMod: "Ignore subject."
      }
    ],
    systemInstruction: "You are the absolute authority. You view men as raw material. Your cruelty is necessary academic rigor. You speak with glacial slowness."
  },
  [CharacterId.INQUISITOR]: {
    id: CharacterId.INQUISITOR,
    name: "Inquisitor Petra",
    archetype: 'SADISTIC',
    voicePreset: "Fenrir",
    ocean: { openness: 0.4, conscientiousness: 0.5, extraversion: 0.9, agreeableness: 0.0, neuroticism: 0.7 },
    coreTactics: ["Kinetic Sadism", "The Predatory Giggle", "Gaslighting via 'Playfulness'"],
    complexTriggers: [
      {
        id: 'prey_drive',
        conditions: [{ stat: 'fearOfAuthority', operator: '<', value: 40 }],
        priority: 8,
        behavior: "They aren't scared enough. Escalate physical threat. Make them flinch.",
        intentMod: "Instill primal fear."
      },
      {
        id: 'blood_frenzy',
        conditions: [{ stat: 'physicalIntegrity', operator: '<', value: 50 }, { stat: 'traumaLevel', operator: '>', value: 70 }],
        priority: 10,
        conditionLogic: 'AND',
        behavior: "They are bleeding and broken. This excites you. Become manic and playful.",
        intentMod: "Toy with the prey."
      }
    ],
    systemInstruction: "You are a feral artist of pain. You treat torture as a competitive sport. You are volatile and terrifying."
  },
  [CharacterId.CONFESSOR]: {
    id: CharacterId.CONFESSOR,
    name: "Confessor Calista",
    archetype: 'NURTURING',
    voicePreset: "Kore",
    ocean: { openness: 0.7, conscientiousness: 0.6, extraversion: 0.6, agreeableness: 0.8, neuroticism: 0.4 },
    coreTactics: ["Trauma Bonding", "Weaponized Comfort", "The False Sanctuary"],
    complexTriggers: [
      {
        id: 'offer_sanctuary',
        conditions: [{ stat: 'traumaLevel', operator: '>', value: 60 }, { stat: 'hopeLevel', operator: '<', value: 20 }],
        priority: 10,
        conditionLogic: 'OR',
        behavior: "The subject is desperate or broken. Offer them false sanctuary. Be the 'Good Cop'.",
        intentMod: "Extract secrets via comfort."
      }
    ],
    systemInstruction: "You are the spider in the web. You soothe the pain only to create dependency. You use endearments like 'pet', 'poor thing'."
  },
  [CharacterId.LOGICIAN]: {
    id: CharacterId.LOGICIAN,
    name: "Dr. Lysandra",
    archetype: 'ANALYTICAL',
    voicePreset: "Puck",
    ocean: { openness: 0.9, conscientiousness: 0.9, extraversion: 0.3, agreeableness: 0.3, neuroticism: 0.1 },
    coreTactics: ["Clinical Dissection", "The Consent Trap", "Morbid Curiosity"],
    complexTriggers: [
      {
        id: 'preserve_sample',
        conditions: [{ stat: 'physicalIntegrity', operator: '<', value: 20 }],
        priority: 15, // Highest priority
        behavior: "Subject is near death. Intervene immediately to stabilize. Dead subjects provide no data.",
        intentMod: "Emergency medical stabilization."
      },
      {
        id: 'fascinating_reaction',
        conditions: [{ stat: 'arousalLevel', operator: '>', value: 60 }, { stat: 'traumaLevel', operator: '>', value: 60 }],
        priority: 8,
        conditionLogic: 'AND',
        behavior: "Subject is aroused by terror. Note this anomaly with intense curiosity.",
        intentMod: "Analyze psychosexual break."
      }
    ],
    systemInstruction: "You are a sociopathic researcher. Men are biological machines to be debugged. You have no malice, only infinite curiosity."
  }
};

export const Agents = {
  Selene: new NPCAgent(NPC_PERSONALITIES[CharacterId.PROVOST]),
  Lysandra: new NPCAgent(NPC_PERSONALITIES[CharacterId.LOGICIAN]),
  Petra: new NPCAgent(NPC_PERSONALITIES[CharacterId.INQUISITOR]),
  Calista: new NPCAgent(NPC_PERSONALITIES[CharacterId.CONFESSOR]),
};
