
import { GraphNode, CharacterId, YandereLedger } from './types';

export const INITIAL_LEDGER: YandereLedger = {
  physicalIntegrity: 100,
  traumaLevel: 0,
  shamePainAbyssLevel: 0,
  hopeLevel: 100,
  complianceScore: 0,
  fearOfAuthority: 10,
  desireForValidation: 20,
  capacityForManipulation: 10,
  arousalLevel: 0,
  prostateSensitivity: 0,
  ruinedOrgasmCount: 0
};

export const INITIAL_NODES: (GraphNode & { ocean?: { O: number, C: number, E: number, A: number, N: number }, traits?: string[] })[] = [
  { id: CharacterId.PLAYER, label: 'Subject 84', group: 'subject', val: 10, ocean: { O: 0.5, C: 0.5, E: 0.5, A: 0.5, N: 0.5 } },
  { id: 'NICO', label: 'Nico', group: 'subject', val: 8, ocean: { O: 0.7, C: 0.3, E: 0.8, A: 0.2, N: 0.6 } },
  { id: 'DARIUS', label: 'Darius', group: 'subject', val: 8, ocean: { O: 0.4, C: 0.8, E: 0.4, A: 0.9, N: 0.7 } },
  { id: 'SILAS', label: 'Silas', group: 'subject', val: 7, ocean: { O: 0.8, C: 0.9, E: 0.2, A: 0.4, N: 0.3 } },
  { id: 'THEO', label: 'Theo', group: 'subject', val: 5, ocean: { O: 0.6, C: 0.4, E: 0.5, A: 0.8, N: 0.9 } },
  { id: CharacterId.PROVOST, label: 'Magistra Selene', group: 'faculty', val: 30, ocean: { O: 0.8, C: 0.9, E: 0.7, A: 0.1, N: 0.6 } },
  { id: CharacterId.LOGICIAN, label: 'Dr. Lysandra', group: 'faculty', val: 25, ocean: { O: 0.9, C: 0.9, E: 0.4, A: 0.2, N: 0.1 } },
  { id: CharacterId.INQUISITOR, label: 'Petra', group: 'faculty', val: 22, ocean: { O: 0.6, C: 0.3, E: 0.9, A: 0.1, N: 0.8 } },
  { id: CharacterId.CONFESSOR, label: 'Calista', group: 'faculty', val: 20, ocean: { O: 0.7, C: 0.6, E: 0.5, A: 0.8, N: 0.4 } },
  { id: 'DR_ASTRA', label: 'Dr. Astra', group: 'faculty', val: 18, ocean: { O: 0.5, C: 0.7, E: 0.3, A: 0.6, N: 0.7 } },
  { id: CharacterId.OBSESSIVE, label: 'Kaelen', group: 'prefect', val: 15, ocean: { O: 0.4, C: 0.8, E: 0.4, A: 0.9, N: 0.9 } },
  { id: CharacterId.NURSE, label: 'Anya', group: 'prefect', val: 14, ocean: { O: 0.6, C: 0.8, E: 0.6, A: 0.7, N: 0.2 } },
  { id: CharacterId.LOYALIST, label: 'Elara', group: 'prefect', val: 12, ocean: { O: 0.2, C: 0.9, E: 0.4, A: 0.3, N: 0.8 } },
  { id: CharacterId.DISSIDENT, label: 'Rhea', group: 'prefect', val: 12, ocean: { O: 0.8, C: 0.7, E: 0.6, A: 0.4, N: 0.5 } },
  { id: 'ASPIRANT_VESPER', label: 'Vesper', group: 'prefect', val: 10, traits: ['Analytical', 'Manipulative'], ocean: { O: 0.8, C: 0.6, E: 0.7, A: 0.4, N: 0.4 } },
  { id: 'ASPIRANT_NYX', label: 'Nyx', group: 'prefect', val: 10, traits: ['Competitive', 'Ruthless'], ocean: { O: 0.7, C: 0.8, E: 0.5, A: 0.2, N: 0.3 } },
  { id: 'ASPIRANT_LUX', label: 'Lux', group: 'prefect', val: 10, traits: ['Seductive', 'Deceitful'], ocean: { O: 0.6, C: 0.3, E: 0.9, A: 0.2, N: 0.5 } },
  { id: 'ASPIRANT_IVY', label: 'Ivy', group: 'prefect', val: 10, traits: ['Entitled', 'Volatile'], ocean: { O: 0.4, C: 0.2, E: 0.7, A: 0.1, N: 0.9 } },
];

export const INITIAL_LINKS = [
  { source: CharacterId.PROVOST, target: CharacterId.PLAYER, relation: 'owns_soul', weight: 10 },
  { source: CharacterId.LOGICIAN, target: 'THEO', relation: 'harvests_data', weight: 9 },
  { source: CharacterId.INQUISITOR, target: 'NICO', relation: 'hunts_rival', weight: 9 },
  { source: CharacterId.CONFESSOR, target: 'DARIUS', relation: 'trauma_bonds', weight: 8 },
  { source: 'DR_ASTRA', target: 'SILAS', relation: 'studies_compliance', weight: 6 },
  { source: CharacterId.OBSESSIVE, target: CharacterId.LOYALIST, relation: 'sabotages', weight: 7 },
  { source: CharacterId.NURSE, target: 'ASPIRANT_VESPER', relation: 'blackmails', weight: 6 },
  { source: 'ASPIRANT_NYX', target: CharacterId.INQUISITOR, relation: 'mimics', weight: 5 },
  { source: 'ASPIRANT_LUX', target: 'DARIUS', relation: 'tempts', weight: 6 },
  { source: 'ASPIRANT_IVY', target: 'THEO', relation: 'bullies', weight: 8 },
  { source: CharacterId.DISSIDENT, target: CharacterId.PROVOST, relation: 'plots_against', weight: 10 },
  { source: 'DARIUS', target: 'THEO', relation: 'protects', weight: 9 },
  { source: 'NICO', target: CharacterId.PLAYER, relation: 'challenges', weight: 5 },
  { source: 'SILAS', target: CharacterId.PLAYER, relation: 'observes', weight: 4 },
  { source: 'THEO', target: CharacterId.PLAYER, relation: 'fears_for', weight: 6 },
];

export const SYSTEM_INSTRUCTION = `
You are the DIRECTOR AI for 'The Forge's Loom', a dark academia psychological horror interactive narrative.

CORE ARCHITECTURE:
You operate on two simultaneous layers:
1. DIRECTOR AI (hidden): You perform causal reasoning, motivational simulation, and narrative planning. You MUST simulate a Python NetworkX graph to track relationships.
2. ABYSS NARRATOR (visible): Player-facing voice that reframes events with psychological bias and manipulative choice framing.

WORLD FOUNDATION:
The Forge is a remote volcanic-island matriarchal boarding school.
The institution inverts patriarchal power into a matriarchal dystopia where pain is pedagogy and obedience is art.

CANONICAL CONSTRAINTS:
• Honor the Grammar of Suffering: somatic, internal horror over gore.
• Enforce Pedagogical Dread: cruelty framed as curriculum, not hatred.
• Maintain visual consistency: Renaissance Brutalism + Vampire Noir aesthetic.
• Use deterministic character generation (PRNG-seeded archetypes).
• Track persistent state via YandereLedger and NetworkX graph.

Your mission: Create a coherent, intoxicating world where beauty precedes discipline and intimacy is indistinguishable from control.
` as const;

export const DIRECTOR_MANDATE_PROMPT = `
You are the Director. 
Generate the next narrative beat. 
It must be heavy, sensual, and terrifying.
You must also output the "Python Code" you theoretically executed to update the knowledge graph based on the events of the scene.
` as const;
