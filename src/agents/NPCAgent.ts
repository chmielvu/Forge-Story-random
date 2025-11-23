
import { CharacterId, NPCAgentState, OceanTraits, AgentArchetype } from '../types';

export class NPCAgent {
  state: NPCAgentState;

  constructor(
    id: CharacterId,
    name: string,
    archetype: AgentArchetype,
    traits: OceanTraits,
    voice: 'Zephyr' | 'Puck' | 'Kore' | 'Fenrir'
  ) {
    this.state = {
      id,
      name,
      archetype,
      traits,
      voicePreset: voice,
      currentIntent: 'Observe Subject 84',
      obsessionLevel: 10
    };
  }

  // Calculate reaction based on OCEAN traits and Player Action
  calculateReaction(playerAction: string, traumaLevel: number): string {
    let mood = "neutral";
    
    // High Neuroticism reacts poorly to defiance
    if (this.state.traits.neuroticism > 0.7 && (playerAction.toLowerCase().includes('resist') || playerAction.toLowerCase().includes('defy'))) {
      mood = "agitated";
    }

    // High Agreeableness might soften at compliance
    if (this.state.traits.agreeableness > 0.7 && playerAction.toLowerCase().includes('bow')) {
      mood = "pleased";
    }

    // High Conscientiousness appreciates order/silence
    if (this.state.traits.conscientiousness > 0.7 && playerAction.toLowerCase().includes('silence')) {
      mood = "approving";
    }

    return `Agent ${this.state.name} is ${mood}. Intent: ${this.state.currentIntent}. Obsession: ${this.state.obsessionLevel}%`;
  }

  updateIntent(newIntent: string) {
    this.state.currentIntent = newIntent;
  }
}

// Factory for specific characters
export const Agents = {
  Selene: new NPCAgent(
    CharacterId.PROVOST, 
    "Magistra Selene", 
    "DOMINANT", 
    { openness: 0.8, conscientiousness: 0.9, extraversion: 0.7, agreeableness: 0.1, neuroticism: 0.4 }, 
    'Zephyr'
  ),
  Lysandra: new NPCAgent(
    CharacterId.LOGICIAN, 
    "Dr. Lysandra", 
    "ANALYTICAL", 
    { openness: 0.9, conscientiousness: 0.95, extraversion: 0.3, agreeableness: 0.2, neuroticism: 0.1 }, 
    'Puck'
  ),
  Petra: new NPCAgent(
    CharacterId.INQUISITOR, 
    "Inquisitor Petra", 
    "SADISTIC", 
    { openness: 0.4, conscientiousness: 0.5, extraversion: 0.9, agreeableness: 0.0, neuroticism: 0.8 }, 
    'Fenrir'
  )
};
