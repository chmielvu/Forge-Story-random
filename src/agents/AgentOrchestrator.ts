
import { GameState, CharacterId } from '../types';
import { NPCAgent, Agents } from './NPCAgent';

export class AgentOrchestrator {
  activeAgents: NPCAgent[] = [];

  constructor() {
    // Default to Selene present
    this.activeAgents = [Agents.Selene];
  }

  determineActiveAgents(gameState: GameState): NPCAgent[] {
    // Simple logic: Location determines agents
    const loc = gameState.location.toLowerCase();
    const agents: NPCAgent[] = [];

    if (loc.includes('dock') || loc.includes('throne')) agents.push(Agents.Selene);
    if (loc.includes('lab') || loc.includes('medical') || loc.includes('archive')) agents.push(Agents.Lysandra);
    if (loc.includes('cell') || loc.includes('dungeon') || loc.includes('torture')) agents.push(Agents.Petra);

    // Fallback
    if (agents.length === 0) agents.push(Agents.Selene);

    this.activeAgents = agents;
    return agents;
  }

  generateContextBlock(gameState: GameState, lastAction: string): string {
    const agents = this.determineActiveAgents(gameState);
    
    let context = `[ACTIVE AGENTS PRESENT]:\n`;
    
    agents.forEach(agent => {
      const reaction = agent.calculateReaction(lastAction, gameState.ledger.traumaLevel);
      context += `- ${agent.state.name} (${agent.state.archetype}):\n`;
      context += `  Traits: O:${agent.state.traits.openness} C:${agent.state.traits.conscientiousness} E:${agent.state.traits.extraversion} A:${agent.state.traits.agreeableness} N:${agent.state.traits.neuroticism}\n`;
      context += `  Status: ${reaction}\n`;
    });

    return context;
  }
}

export const orchestrator = new AgentOrchestrator();
