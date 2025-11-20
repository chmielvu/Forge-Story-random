export enum CharacterId {
  PROVOST = 'Provost_Selene',
  LOGICIAN = 'Dr_Lysandra',
  INQUISITOR = 'Petra',
  CONFESSOR = 'Calista',
  NURSE = 'Anya',
  PLAYER = 'Subject_84',
  OBSESSIVE = 'Kaelen',
  LOYALIST = 'Elara',
  DISSIDENT = 'Rhea'
}

export interface YandereLedger {
  // Physical
  physicalIntegrity: number;
  // Core Psyche
  traumaLevel: number;
  shamePainAbyssLevel: number;
  hopeLevel: number;
  complianceScore: number;
  // Granular Metrics
  fearOfAuthority: number;      // Governs hesitation/flinching
  desireForValidation: number;  // Governs susceptibility to 'Good Boy' tactics
  capacityForManipulation: number; // Governs ability to lie/plot
}

export interface GraphNode {
  id: string;
  label: string;
  group: string;
  val: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  relation: string;
  weight: number;
}

export interface LogEntry {
  id: string;
  type: 'system' | 'narrative' | 'thought' | 'tool_output';
  content: string;
  visualContext?: string; 
  // New media fields
  imageData?: string; // Base64 encoded image
  audioData?: string; // Base64 encoded PCM audio
  videoData?: string; // Base64 data URL for video
}

export interface GameState {
  ledger: YandereLedger;
  nodes: GraphNode[];
  links: GraphLink[];
  turn: number;
  location: string;
}

export interface DirectorOutput {
  thought_process: string;
  narrative: string;
  visual_prompt: string; // Specific prompt for Imagen
  state_updates?: Partial<YandereLedger>;
  new_edges?: GraphLink[];
  choices: string[];
}

export type ToolMode = 'ANALYZE' | 'REANIMATE' | 'DISTORT';