
import { GameState, CharacterId } from '../types';
import { NPCAgent, Agents } from './NPCAgent';

// Define dynamic relationships between agents to fuel emergent subplots
const INTER_AGENT_RELATIONSHIPS: Record<string, string> = {
  [`${CharacterId.PROVOST}_${CharacterId.INQUISITOR}`]: "DYNAMIC: Master/Hound. Selene keeps Petra on a tight leash. Petra chafes at the restraint but fears Selene.",
  [`${CharacterId.PROVOST}_${CharacterId.LOGICIAN}`]: "DYNAMIC: Political/Scientific Alliance. Selene funds the research; Lysandra provides the intellectual justification. Mutual respect, zero warmth.",
  [`${CharacterId.INQUISITOR}_${CharacterId.LOGICIAN}`]: "DYNAMIC: Conflict. Petra finds Lysandra boring. Lysandra finds Petra's methods messy and inefficient.",
  [`${CharacterId.CONFESSOR}_${CharacterId.INQUISITOR}`]: "DYNAMIC: Good Cop/Bad Cop. They work in tandem. Calista cleans up Petra's mess to build the trauma bond.",
  [`${CharacterId.PROVOST}_${CharacterId.CONFESSOR}`]: "DYNAMIC: Tool/User. Selene views Calista as a useful spy but finds her 'soft' methods distasteful.",
  // New Dynamics
  [`${CharacterId.INQUISITOR}_${CharacterId.CONFESSOR}`]: "DYNAMIC: Sadistic/Nurturing Friction. Petra wants to break the toy; Calista wants to fix it to break it again later. They argue over the subject's durability.",
  [`${CharacterId.LOGICIAN}_${CharacterId.CONFESSOR}`]: "DYNAMIC: Data vs. Emotion. Lysandra views Calista's psychological manipulation as 'soft science' compared to her hard data. Calista views Lysandra as autistic and blind to the soul.",
};

export class AgentOrchestrator {
  activeAgents: NPCAgent[] = [];

  constructor() {
    this.activeAgents = [Agents.Selene];
  }

  determineActiveAgents(gameState: GameState): NPCAgent[] {
    const loc = gameState.location.toLowerCase();
    const agents: NPCAgent[] = [];

    // Location-based logic
    if (loc.includes('dock') || loc.includes('throne') || loc.includes('office') || loc.includes('atrium')) agents.push(Agents.Selene);
    if (loc.includes('lab') || loc.includes('medical') || loc.includes('archive') || loc.includes('examination')) agents.push(Agents.Lysandra);
    if (loc.includes('cell') || loc.includes('dungeon') || loc.includes('torture') || loc.includes('gym') || loc.includes('calibration')) agents.push(Agents.Petra);
    if (loc.includes('chapel') || loc.includes('garden') || loc.includes('parlor') || loc.includes('bedroom') || loc.includes('confessional')) agents.push(Agents.Calista);

    // Default fallback
    if (agents.length === 0) agents.push(Agents.Selene);

    // Obsession Override: If an agent is highly obsessed (>85), they might follow the player
    Object.values(Agents).forEach(agent => {
      if (agent.state.obsessionLevel > 85 && !agents.includes(agent)) {
        agents.push(agent);
      }
    });

    this.activeAgents = Array.from(new Set(agents));
    return this.activeAgents;
  }

  /**
   * Generates a subplot string describing how the agents are interacting with EACH OTHER.
   * Enhanced to be intent-aware.
   */
  private simulateInteractions(): string {
    if (this.activeAgents.length < 2) return "";

    const agentIds = this.activeAgents.map(a => a.config.id);
    let interactionLog = "\n[EMERGENT INTER-AGENT DYNAMICS]:\n";

    // Check for pairs
    for (let i = 0; i < agentIds.length; i++) {
      for (let j = i + 1; j < agentIds.length; j++) {
        const agentA = this.activeAgents[i];
        const agentB = this.activeAgents[j];
        const key1 = `${agentIds[i]}_${agentIds[j]}`;
        const key2 = `${agentIds[j]}_${agentIds[i]}`;
        
        let baseDynamic = INTER_AGENT_RELATIONSHIPS[key1] || INTER_AGENT_RELATIONSHIPS[key2];

        if (baseDynamic) {
          // Dynamic modifier based on current intent
          if (agentA.state.currentIntent.toLowerCase().includes("crush") || agentB.state.currentIntent.toLowerCase().includes("crush")) {
             baseDynamic += " [CURRENT STATE: Escalation. One agent is aggressive, causing tension.]";
          }
          if (agentA.state.obsessionLevel > 80 && agentB.state.obsessionLevel > 80) {
             baseDynamic += " [CURRENT STATE: Rivalry. Both agents are obsessed with the Subject. They are fighting for ownership.]";
          }

          interactionLog += `> ${baseDynamic}\n`;
        }
      }
    }
    return interactionLog;
  }

  generateContextBlock(gameState: GameState, lastAction: string): string {
    const agents = this.determineActiveAgents(gameState);
    
    let context = `[ACTIVE AGENTS PRESENT]:\n`;
    
    agents.forEach(agent => {
      const s = agent.state;
      // We call calculateReaction to get the nuanced string based on ocean/reflection
      const reaction = agent.calculateReaction(lastAction, gameState.ledger.traumaLevel);
      
      context += `- ${s.name} (${s.archetype}):\n`;
      context += `  [INTERNAL STATE]: Obsession: ${s.obsessionLevel}% | Intent: "${s.currentIntent}"\n`;
      context += `  Traits: O:${s.traits.openness} C:${s.traits.conscientiousness} E:${s.traits.extraversion} A:${s.traits.agreeableness} N:${s.traits.neuroticism}\n`;
      context += `  Reaction to Player: ${reaction}\n`;
    });

    // Add the interaction layer
    context += this.simulateInteractions();

    return context;
  }
}

export const orchestrator = new AgentOrchestrator();
