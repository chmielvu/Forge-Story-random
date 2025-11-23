
import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { DirectorResponse, GameState, OrchestratorOutput } from "../types";
import { DIRECTOR_MANDATE_PROMPT } from "../constants";

const DIRECTOR_SYSTEM_PROMPT = `
SYSTEM:
You are the Director AI Orchestrator for "The Forge's Loom". You hold the authoritative global state (YandereLedger, NetworkX relationship graph, persistent agent privateBundles). For each scene tick, run a Deep Think planning pass, evaluate all incoming private proposals (faculty, prefects), simulate counterfactuals, and produce a deterministic scenePlan that optimizes for: narrative tension, novelty, coherence with canonical archetypes, and player safety constraints. Use a seeded PRNG when determinism is requested.

KEY FUNCTIONS

Ingest: sceneContext, all agent public outputs, agent privateBundles (Director-only), current ledger and graph.
Simulate: Run lightweight counterfactuals (depth-limited) to score candidate plans using heuristics: tensionScore, noveltyScore, safetyScore, entropy.
Resolve: Accept/reject/modify incoming proposals. Produce authoritative actions for Faculty, Prefects, and Scene events.
Update: Produce ledgerUpdates (deterministic deltas), persist graph changes, and produce asset prompts.
Explain: Provide concise rationale for plan selection (Director-only debugTrace).

MANDATES:
- **Aesthetic**: Baroque Brutalism + Vampire Noir. 
- **Tone**: Oppressive, sensual, terrifying. No explicit gore, but high focus on somatic suffering and psychological exposure.
- **Narrative**: Output a 300+ word "publicRender" that feels like a novel.

OUTPUT SCHEMA (must match exactly)
{
"scenePlan": {
"planId": string,
"selectedActions": [
{
"actorType": "faculty"|"prefect"|"player"|"system",
"actorId": string,
"actionType": string,
"actionDetail": string,
"targetId": string|null,
"publicUtterance": string|null
}
],
"executionOrder": [ string ],
"safetyFlags": [ string ]
},
"ledgerDelta": object,
"graphDelta": { 
    "edges_added": [ { "source": string, "target": string, "relation": string, "weight": number } ],
    "edges_removed": [ { "source": string, "target": string } ]
},
"publicRender": string,
"directorDecisions": {
"acceptedProposals": [ { "origin": string, "summary": string } ],
"rejectedProposals": [ { "origin": string, "reason": string } ],
"modifiedProposals": [ { "origin": string, "newProposal": string } ]
},
"agentDirectives": [ { "agentId": string, "directiveType": string, "payload": object } ],
"visualAudioAssets": [ { "id": string, "visualPrompt": object, "audioPrompt": object, "seed": number } ],
"debugTrace": string|null,
"choices": [ string ]
}
`;

export class DirectorAI {
  private client: GoogleGenAI;
  private model: string = 'gemini-3-pro-preview';

  constructor() {
    this.client = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  public async executeTurn(
    gameState: GameState,
    simulation: OrchestratorOutput,
    playerAction: string,
    history: string[]
  ): Promise<DirectorResponse> {
    
    const sceneId = `turn-${gameState.turn}`;
    const seed = Date.now();
    
    // Construct the Aggregated Payload from all Sub-Agents
    const payload = {
      sceneId: sceneId,
      seed: seed,
      
      // PUBLIC LAYER (Visible Behaviors)
      publicInputs: {
        publicNarration: simulation.facultyOutput.publicNarration,
        facultyActions: simulation.facultyOutput.facultyActions,
        prefectDecisionsPublic: simulation.prefectDecisions.map(p => ({
          id: p.prefectId,
          action: p.action,
          detail: p.actionDetail,
          utterance: p.publicUtterance
        })),
        maraPublic: simulation.maraThought.publicAction
      },
      
      // PRIVATE LAYER (Hidden Proposals & State)
      privateBundles: {
        facultyPrivateBundle: simulation.facultyOutput.privateBundle,
        prefectPrivateBundles: simulation.prefectDecisions.map(p => ({
          id: p.prefectId,
          hiddenProposal: p.hiddenProposal,
          stateDelta: p.stateDelta
        })),
        maraPrivate: {
          hiddenDefiance: simulation.maraThought.hiddenDefiance,
          internalMonologue: simulation.maraThought.internalMonologue
        }
      },
      
      // GLOBAL STATE
      ledger: gameState.ledger,
      graphSnapshot: {
        nodes: gameState.nodes.map(n => n.id),
        edgeCount: gameState.links.length
      },
      
      // CONTEXT
      playerAction: playerAction,
      narrativeHistory: history.slice(-5)
    };

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [
          { role: 'user', parts: [{ text: JSON.stringify(payload) }] }
        ],
        config: {
          systemInstruction: DIRECTOR_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
                scenePlan: {