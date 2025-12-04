
import { YandereLedger, PrefectDNA, CharacterId, MultimodalTurn, CharacterVisualState, EnvironmentState, VisualMemory, VisualTurnSnapshot } from '../types';
import { VISUAL_PROFILES } from '../constants';

// --- I. THE ZERO-DRIFT AESTHETIC KERNEL ---
// Exported for mediaService to import
export const ZERO_DRIFT_HEADER = "((MASTER STYLE LOCK)): hyper-detailed 8K oil painting texture, soft digital brushwork, expressive linework, ((Milo Manara sensual elegance, Bruce Timm angular minimalism fusion)), dramatic Rembrandt Caravaggio lighting, shallow depth of field, clean sharp focus. (Technical Lock: intimate 85mm portrait lens, rim lighting on sweat-glistened skin). NO TEXT/WATERMARKS.";

// Exported for mediaService to import
export const AESTHETIC_TOKENS = {
  // Core Face & Expression
  FelineEyes: "Heavy-lidded, almond-shaped feline eyes with thick lashes and a permanent glint of amused cruelty.",
  CruelHalfSmile: "One corner of the mouth lifted in a subtle, knowing half-smile that never reaches the eyes.",
  TeasingCruelty: "Expression that promises pleasure and pain, eyebrow slightly arched, gaze locked on vulnerability.",
  LiquidStrands: "Hair rendered as individual glossy strands that catch and refract light, escaping to caress skin.",

  // Body Language & Poses
  LanguidDominance: "Weight shifted to one hip, shoulders relaxed, head tilted slightly down while eyes look up.",
  KneelingGoddess: "Woman kneeling over a victim yet looking down from above, back arched to accentuate curves.",
  VoyeurSilhouette: "Figure half in shadow, only the curve of waist, breast, and thigh outlined by rim-light.",
  
  // Details
  BoundWrists: "Light silk or leather restraints on wrists, symbolizing non-consensual control without pain.",
  FlushedSkin: "Flushed, sweat-glistened skin with subtle bruises, conveying unwilling arousal.",
  TremblingHands: "Hands trembling slightly, fingers clenched in fear-tinged desire.",
  ClingingVelvet: "Velvet that clings to every curve like a second skin, folds drawn with liquid linework.",
  RimLitCleavage: "Strong rim-light traces the edge of plunging neckline and shadowed valley between breasts.",
  VelvetShadowPool: "Deep velvet shadows deliberately pooled in cleavage, under jawlines, and between parted thighs.",
  ImpossibleElegance: "Unnaturally long, aristocratic fingers with perfect nails.",
  LethalCaress: "Hand performing a gesture that is simultaneously tender and threatening.",
  SlitToHip: "Skirt slit to the hip bone, revealing the entire length of a sculpted leg and lace garter.",
  WetSilkEffect: "Fabric rendered semi-transparent with sweat or steam, clinging to skin."
};

// Exported for mediaService to import
export const VISUAL_MANDATE = {
  style: "grounded dark erotic academia + baroque brutalism + vampire noir + intimate psychological tension + rembrandt caravaggio lighting + painterly anime-fusion gothic overlays. masterpiece, oil painting texture with soft digital brushwork, hyper-detailed fabrics and hair textures.",
  technical: {
    camera: "intimate 50mm or 85mm close-up, shallow depth of field",
    lighting: "single flickering gaslight or cold surgical lamp, deep shadows pooling in cleavage and skirt slits, volumetric fog, rim lighting on sweat/skin, subtle bruises visible."
  },
  mood: "predatory intimacy, clinical amusement, suffocating desire, weaponized sexuality, voyeuristic, non-consensual fear, unwilling arousal, languid dominance.",
  quality: "restrained masterpiece oil painting, no fantasy elements, high detail on skin texture and fabric strain",
  negative_prompt: [
    "bright colors", "cheerful", "modern architecture", "soft focus", "natural daylight", 
    "anime exaggeration", "cartoon", "3d render", "low res", "flat lighting", 
    "muddy textures", "fantasy armor", "capes", "lightning", "gore", "blood", 
    "screaming", "supernatural elements", "monsters", "ghosts", "ugly", 
    "deformed", "extra limbs", "blurry", "overexposed", "watermark", "text"
  ]
};

// Exported for mediaService to import
export const ARCHETYPE_VISUAL_MAP: Record<string, { mood?: string, physique?: string, face?: string, attire?: string }> = {
    'The Zealot': { mood: "stern, judgmental, brittle", physique: "rigid posture", face: "severe, tight bun", attire: "pristine uniform, fully buttoned, no skin showing" },
    'The Yandere': { mood: "unnerving stillness, manic-pixie-nightmare", physique: "petite, delicate, deceptively weak", face: "wide doe-eyes, dark bangs, flat affect", attire: "uniform with subtle disarray, choker" },
    'The Dissident': { mood: "guarded, intense, cynical", physique: "lithe, agile, tense", face: "sharp features, fiery hair, smudged makeup", attire: "untucked blouse, blazer slung over shoulder" },
    'The Nurse': { mood: "warm, clinical, false-comfort", physique: "soft, fuller curves, maternal", face: "kind open face, flushed cheeks", attire: "white medical jacket over unbuttoned blouse" },
    'The Sadist': { mood: "cruel, kinetic, exhilarated", physique: "athletic, tense, coiled", face: "manic grin, dilated pupils", attire: "leather gloves, holding riding crop" },
    'The Perfectionist': { mood: "neurotic, precise, anxious", physique: "immaculate, stiff", face: "pinched, focused, sweat-bead", attire: "perfectly pressed uniform, measuring tape" },
    'The Voyeur': { mood: "detached, observant, hungry", physique: "unassuming, shadow-blending", face: "glasses, watchful eyes, lip-biting", attire: "hiding in oversized blazer, notebook" },
    'The Martyr': { mood: "suffering, beatific, ecstatic", physique: "gaunt, exhausted, trembling", face: "eyes rolled back, pale, tear-stained", attire: "stained or torn uniform, exposed collarbone" },
    'The Parasite': { mood: "mimetic, hollow, clingy", physique: "shadowy, leaning", face: "shifting expression, mirroring", attire: "copies nearest authority figure exactly" },
    'The Wildcard': { mood: "chaotic, manic, unpredictable", physique: "restless, twitchy", face: "wild eyes, smirk, smeared lipstick", attire: "mismatched accessories, jewelry" },
    'The Defector': { mood: "paranoid, furtive, terrified", physique: "hunched, protective", face: "darting eyes, sweat-slicked", attire: "ready to run, bag packed" },
    'The Mimic': { mood: "uncanny, blank, artificial", physique: "average, unremarkable", face: "placid mirror, unblinking", attire: "standard uniform, flawless" },
    'The Brat Princess': { mood: "haughty, entitled, bratty", physique: "curvaceous, poised, displaying assets", face: "sneer, flawless makeup, bored", attire: "floral tiara, silk ribbons, shorter skirt" },
    'The Siren': { mood: "languid, wet, heavy", physique: "slender, sinuous, arched", face: "wet-lips, heavy lids, flushed", attire: "off-shoulder gown, sea-glass jewelry, translucent fabric" },
    'The Psychologist': { mood: "analytical, cold, probing", physique: "composed, still, seated", face: "calm gaze, glasses, assessing", attire: "leather notebook, pen tucked, pristine cuffs" },
    'The Contender': { mood: "aggressive, sharp, competitive", physique: "muscular, coiled, imposing", face: "determined, scarred, clenched jaw", attire: "scuffed boots, cropped jacket, sleeves rolled" }
};


/**
 * COHERENCE ENGINE V2
 * Ensures visual continuity across turns by tracking:
 * - Character appearance consistency
 * - Environmental continuity
 * - Lighting/time consistency
 * - Emotional state visualization
 */
class VisualCoherenceEngine {
  private memory: VisualMemory;
  
  constructor() {
    this.memory = {
      lastCharacterAppearances: new Map(),
      environmentState: {
        location: 'The Arrival Dock',
        lightingScheme: 'stormy natural light, deep shadows',
        atmosphericEffects: ['volcanic ash', 'sea spray', 'heavy humidity'],
        dominantColors: ['#050505', '#881337', '#facc15', '#1c1917']
      },
      timeOfDay: 'evening',
      weatherCondition: 'stormy',
      turnHistory: []
    };
  }

  /**
   * Builds a prompt with full temporal and visual continuity
   * This function combines base visual mandates with dynamic game state and history
   */
  public buildCoherentPrompt(
    target: PrefectDNA | CharacterId,
    sceneContext: string,
    ledger: YandereLedger,
    narrativeText: string,
    previousTurn?: MultimodalTurn
  ): string {
    // 1. Update character state based on ledger
    this.updateCharacterStates(target, ledger);
    
    // 2. Determine environmental continuity
    this.inferEnvironmentFromContext(sceneContext); // Updates memory.environmentState
    
    // 3. Build base prompt with strict continuity directives
    const basePromptParts = this.constructBasePrompt(target, sceneContext, ledger, narrativeText);
    
    // 4. Inject continuity constraints from history
    const continuityDirectives = this.generateContinuityDirectives(previousTurn);
    
    // 5. Add style consistency locks (ZERO_DRIFT_HEADER already included in generateNarrativeImage)
    const styleConsistencyLock = this.getStyleConsistencyLock();

    // The final prompt object structure for the LLM
    const finalPromptObject = {
      ...VISUAL_MANDATE, // Base style mandate
      ...basePromptParts.subject, // Character-specific directives
      ...basePromptParts.environment, // Environment-specific directives
      ...basePromptParts.psychometricVisualization, // Emotional/psychological state visualization
      sceneContext: sceneContext.substring(0, 300), // Raw scene context
      narrativeTone: this.inferEmotionalState(ledger), // Overall emotional tone (FIXED: used inferEmotionalState)
      continuity: continuityDirectives, // Directives for visual consistency
      styleConsistency: styleConsistencyLock, // Strict style enforcement
      narrativeDetail: narrativeText.substring(0, 500) // Include narrative for deeper context
    };
    
    return JSON.stringify(finalPromptObject, null, 2);
  }

  private updateCharacterStates(
    target: PrefectDNA | CharacterId,
    ledger: YandereLedger
  ): void {
    const characterId = typeof target === 'string' ? target : target.id;
    
    const currentState: CharacterVisualState = {
      characterId,
      lastSeenTurn: this.memory.turnHistory.length,
      clothingState: this.inferClothingState(ledger),
      emotionalState: this.inferEmotionalState(ledger),
      injuries: this.inferInjuries(ledger),
      dominancePosture: this.inferDominancePosture(characterId, ledger)
    };
    
    this.memory.lastCharacterAppearances.set(characterId, currentState);
  }

  private inferClothingState(ledger: YandereLedger): CharacterVisualState['clothingState'] {
    if (ledger.physicalIntegrity < 50) return 'torn';
    if (ledger.traumaLevel > 70) return 'disheveled';
    if (ledger.shamePainAbyssLevel > 80) return 'bloodstained';
    return 'pristine';
  }

  private inferEmotionalState(ledger: YandereLedger): CharacterVisualState['emotionalState'] {
    if (ledger.hopeLevel < 20) return 'despairing';
    if (ledger.traumaLevel > 80) return 'terrified';
    if (ledger.shamePainAbyssLevel > 80) return 'humiliated';
    if (ledger.arousalLevel > 70) return 'desirous';
    if (ledger.complianceScore > 80) return 'composed';
    if (ledger.traumaLevel > 50 || ledger.shamePainAbyssLevel > 50) return 'agitated';
    return 'composed'; // Default
  }

  private inferInjuries(ledger: YandereLedger): string[] {
    const injuries: string[] = [];
    
    if (ledger.physicalIntegrity < 80) {
      injuries.push('visible bruising on wrists and neck');
    }
    if (ledger.traumaLevel > 60) {
      injuries.push('trembling hands, stress-induced muscle tension');
    }
    if (ledger.shamePainAbyssLevel > 70) {
      injuries.push('tear-stained cheeks, bloodshot eyes, puffy eyes');
    }
    
    return injuries;
  }

  private inferDominancePosture(characterId: string, ledger: YandereLedger): number {
    if (characterId === CharacterId.PLAYER) {
      // Player posture based on compliance/hope: higher compliance/lower hope = lower dominance
      return Math.max(0, Math.min(1, (100 - ledger.complianceScore + ledger.hopeLevel) / 200));
    }
    // Faculty/Prefects are generally dominant, adjust based on their traits or specific actions
    // For simplicity, assume high dominance unless specified otherwise by scene context or character DNA.
    return 0.9; 
  }

  private inferEnvironmentFromContext(context: string): void {
    const lower = context.toLowerCase();
    
    let location = this.memory.environmentState.location;
    let lightingScheme = this.memory.environmentState.lightingScheme;
    let atmosphericEffects = [...this.memory.environmentState.atmosphericEffects];
    let dominantColors = [...this.memory.environmentState.dominantColors];
    
    // Location inference
    if (lower.includes("dock") || lower.includes("arrival")) {
        location = "volcanic rock dock, stormy sky, weeping stone, ocean spray, iron gates, monolithic architecture";
        lightingScheme = "stormy natural light, deep shadows, flickering emergency lights";
        atmosphericEffects = ['volcanic ash', 'sea spray', 'heavy humidity', 'wind-swept'];
        dominantColors = ['#050505', '#1c1917', '#78716c', '#000000']; // Dark, grey, black tones
    }
    else if (lower.includes("office") || lower.includes("study") || lower.includes("selene")) {
        location = "provost's mahogany desk, glowing fireplace, velvet curtains, oppressive luxury, bookshelves";
        lightingScheme = "warm fireplace glow, single candelabra, deep shadows, amber highlights";
        atmosphericEffects = ['wine aroma', 'old leather-bound books smell', 'crackling fire sound'];
        dominantColors = ['#450a0a', '#881337', '#7f1d1d', '#050505', '#ca8a04']; // Crimson, gold, dark tones
    }
    else if (lower.includes("infirmary") || lower.includes("clinic") || lower.includes("lab") || lower.includes("lysandra")) {
        location = "medical wing, tiled walls, surgical tools, sterile light, anatomical charts, stainless steel";
        lightingScheme = "harsh fluorescent overhead, cold sterile white, sharp clinical shadows";
        atmosphericEffects = ['antiseptic smell', 'faint metallic tang'];
        dominantColors = ['#e7e5e4', '#78716c', '#1c1917', '#050505']; // Whites, greys, stark contrasts
    }
    else if (lower.includes("cell") || lower.includes("cage") || lower.includes("dungeon")) {
        location = "isolation cell, rusted iron bars, damp straw, stone walls, claustrophobic, chains";
        lightingScheme = "single bare bulb, harsh shadows, oppressive darkness, faint flickering";
        atmosphericEffects = ['damp stone smell', 'dripping water sound', 'metallic echoes'];
        dominantColors = ['#050505', '#1c1917', '#44403c', '#be123c']; // Dark, rusty, oppressive
    }
    // Add more location-specific logic as needed

    this.memory.environmentState = {
      location,
      lightingScheme,
      atmosphericEffects,
      dominantColors
    };
  }

  private constructBasePrompt(
    target: PrefectDNA | CharacterId,
    sceneContext: string,
    ledger: YandereLedger,
    narrativeText: string
  ): any {
    const characterId = typeof target === 'string' ? target : target.id;
    const visualState = this.memory.lastCharacterAppearances.get(characterId);
    const env = this.memory.environmentState;
    const moodModifiers: string[] = ["clinical-chiaroscuro"];
    const aestheticInjects: string[] = [];

    // Resolve subject based on type
    let subjectDescription: any = {};
    if (typeof target === 'string') {
      const profile = VISUAL_PROFILES[target] || "Figure in shadow";
      const name = target.replace(/_/g, " ");
      subjectDescription = {
        name: name,
        role: target.includes('Subject') ? "Subject" : "Faculty",
        description: profile,
        physique: profile.includes("Regal") ? "statuesque, imposing" : "defined, athletic",
        attire: profile.includes("velvet") ? "crimson velvet robes" : "dark academic formal",
      };
      if (target === CharacterId.PLAYER) {
        moodModifiers.push("vulnerable", "exposed", "sweat-slicked", "kneeling", "submissive");
        aestheticInjects.push(AESTHETIC_TOKENS.BoundWrists, AESTHETIC_TOKENS.FlushedSkin);
      } else {
        moodModifiers.push("dominant", "predatory", "elegant", "looming", "control");
        aestheticInjects.push(AESTHETIC_TOKENS.FelineEyes, AESTHETIC_TOKENS.ImpossibleElegance, AESTHETIC_TOKENS.LanguidDominance);
      }
    } else { // Prefect DNA
      const map = ARCHETYPE_VISUAL_MAP[target.archetype] || {};
      subjectDescription = {
        name: target.displayName,
        role: "Prefect",
        archetype: target.archetype,
        physique: map.physique || "lean",
        face: map.face || "distinct features",
        attire: map.attire || "dark academic uniform"
      };
      moodModifiers.push(map.mood || "febrile");
      aestheticInjects.push(AESTHETIC_TOKENS.CruelHalfSmile);

      // Inject Trait-Based Visuals
      const { cruelty, charisma, submission_to_authority, ambition, cunning } = target.traitVector;

      if (charisma > 0.8) { moodModifiers.push("mesmeric-gaze", "magnetic-presence"); aestheticInjects.push(AESTHETIC_TOKENS.LiquidStrands); }
      if (cruelty > 0.7) { moodModifiers.push("cold-sneer", "predatory-stance"); aestheticInjects.push(AESTHETIC_TOKENS.TeasingCruelty); }
      if (submission_to_authority > 0.8) moodModifiers.push("head-bowed", "hands-clasped", "eyes-downcast", "rigid-obedience");
      else if (submission_to_authority < 0.3) moodModifiers.push("chin-up", "defiant-glance", "slouching", "disordered-uniform");
      if (ambition > 0.8) moodModifiers.push("chin-raised", "intense-focus", "sharp-silhouette", "calculating");
      if (cunning > 0.8) moodModifiers.push("calculating-eyes", "shadowed-face", "half-smile", "watchful");
      if (target.drive.includes("Sabotage") || target.drive.includes("Undermine")) moodModifiers.push("hiding-something", "duplicitous-shadows");
      if (target.secretWeakness.includes("Horrified") || target.secretWeakness.includes("Empathy")) { moodModifiers.push("tear-stained-cheek", "trembling-hands"); aestheticInjects.push(AESTHETIC_TOKENS.TremblingHands); }
    }

    // Apply ledger-based dynamic visual elements
    const dynamicTechnical = { ...VISUAL_MANDATE.technical };
    if (ledger) {
      if (ledger.traumaLevel > 40) dynamicTechnical.camera = "handheld, shaky, slight dutch angle, 50mm";
      if (ledger.traumaLevel > 70) dynamicTechnical.camera = "extreme close-up, disorienting fish-eye, blurred edges, panic, sweaty-lens";
      if (ledger.shamePainAbyssLevel > 50) dynamicTechnical.lighting = "high-contrast, harsh shadows";
      if (ledger.shamePainAbyssLevel > 80) {
          dynamicTechnical.lighting = "harsh clinical spotlight from above, surrounding oppressive shadows, high contrast specular highlights on skin, visible sweat texture";
          moodModifiers.push("humiliated-posture", "tearing-up", "flushed-skin", "avoiding-eye-contact", "covering-self");
      }
      if (ledger.complianceScore > 70) moodModifiers.push("broken-posture", "pliant", "doll-like", "slack-jawed", "empty-eyes");
      if (ledger.arousalLevel > 60) {
          moodModifiers.push("heavy-breathing", "dilated-pupils", "fabric-tension", "flushed-chest", "sweat-beads", "biting-lip");
          aestheticInjects.push(AESTHETIC_TOKENS.RimLitCleavage, AESTHETIC_TOKENS.WetSilkEffect);
      }
      if (ledger.hopeLevel < 20) dynamicTechnical.lighting += ", cold blue tones, desaturated, hopeless";
      else if (ledger.hopeLevel > 80) dynamicTechnical.lighting += ", warm candle glow, golden accents, defiant spark";
    }

    return {
      subject: {
        characterId,
        appearance: this.getCharacterAppearance(characterId, visualState, subjectDescription, ledger),
        posture: this.getPostureDescription(visualState, subjectDescription, ledger),
        clothing: visualState?.clothingState || subjectDescription.attire || 'pristine dark academic uniform',
        injuries: visualState?.injuries || [],
        specificMood: moodModifiers.filter(Boolean).join(", "),
        aestheticInjects: aestheticInjects.join(" | ") // Inject the aesthetic tokens
      },
      environment: {
        location: env.location,
        lighting: dynamicTechnical.lighting, // Use dynamic lighting
        atmosphere: env.atmosphericEffects.join(", "),
        timeOfDay: this.memory.timeOfDay,
        weather: this.memory.weatherCondition
      },
      psychometricVisualization: {
        traumaLevel: ledger.traumaLevel,
        shamePainAbyssLevel: ledger.shamePainAbyssLevel,
        arousalLevel: ledger.arousalLevel,
        hopeLevel: ledger.hopeLevel,
        visualCues: this.getTraumaVisualization(ledger).join(", ")
      },
      sceneNarrative: narrativeText.substring(0, 500)
    };
  }

  private getCharacterAppearance(
    characterId: string,
    state?: CharacterVisualState,
    subjectDescription?: any,
    ledger?: YandereLedger
  ): string {
    const baseProfile = VISUAL_PROFILES[characterId as CharacterId] || 
                       subjectDescription?.description || 'Figure in shadow, details obscured';
    
    if (!state || !ledger) return baseProfile;
    
    let appearance = baseProfile;
    
    if (state.clothingState === 'disheveled') {
      appearance += ', uniform partially unbuttoned, hair escaping from restraints';
    } else if (state.clothingState === 'torn') {
      appearance += ', clothing torn at seams, exposed skin, fabric clinging';
    } else if (state.clothingState === 'bloodstained') {
        appearance += ', bloodstained uniform, dried blood, fresh crimson smears';
    }
    
    if (state.injuries.length > 0) {
      appearance += `, visible signs of distress: ${state.injuries.join(', ')}`;
    }

    if (ledger.arousalLevel > 60) {
        appearance += `, flushed skin, glistening with sweat, heavy-lidded eyes`;
    }
    if (ledger.shamePainAbyssLevel > 70) {
        appearance += `, downcast gaze, tear-stained cheeks, pained expression`;
    }
    
    return appearance;
  }

  private getPostureDescription(state?: CharacterVisualState, subjectDescription?: any, ledger?: YandereLedger): string {
    if (!state || !ledger) return subjectDescription?.posture || 'neutral stance';
    
    const dominance = state.dominancePosture;
    const emotional = state.emotionalState;
    
    if (dominance > 0.7) {
      return 'dominant, looming, weight shifted confidently, chin raised';
    } else if (dominance < 0.3) {
      return 'submissive, kneeling or cowering, head bowed, shoulders hunched, broken posture';
    }
    
    switch (emotional) {
      case 'broken': return 'collapsed posture, slack limbs, empty gaze, defeated';
      case 'terrified': return 'tense, rigid, hands trembling, fists clenched';
      case 'humiliated': return 'covering face, avoiding eye contact, cowering';
      case 'desirous': return 'arched back, head tilted exposing neck, languid, seeking touch';
      case 'ecstatic': return 'eyes rolled back, slight smile, trembling with sensation';
      case 'agitated': return 'restless, fidgeting, tense muscles, anxious';
      default: return 'cautious, guarded, ready to flee or fight';
    }
  }

  private getTraumaVisualization(ledger: YandereLedger): string[] {
    const cues: string[] = [];
    
    if (ledger.traumaLevel > 40) {
      cues.push('visible sweat on forehead and neck');
    }
    if (ledger.traumaLevel > 70) {
      cues.push('trembling hands, dilated pupils, rapid breathing, subtle facial tics');
    }
    if (ledger.shamePainAbyssLevel > 60) {
      cues.push('flushed face, tear tracks, avoiding eye contact, bitten lip');
    }
    if (ledger.arousalLevel > 50) {
      cues.push('heavy breathing, fabric tension, parted lips, visible pulse at neck');
    }
    if (ledger.hopeLevel < 20) {
        cues.push('hollow eyes, slumped shoulders, desaturated skin tones');
    }
    
    return cues;
  }

  private generateContinuityDirectives(previousTurn?: MultimodalTurn): any {
    if (!previousTurn) {
      return {
        note: 'First turn - establish baseline visual style',
        mandate: 'Lock artistic style, lighting scheme, and character design for consistency in all subsequent images.'
      };
    }
    
    const prevMetadata = previousTurn.metadata;
    const prevLedger = prevMetadata?.ledgerSnapshot;
    const prevEnvironment = this.memory.environmentState; // Use current inferred env as previous is not stored per turn

    return {
      mandate: 'CRITICAL CONTINUITY REQUIREMENTS',
      rules: [
        'Character appearance MUST match previous turn exactly (hair, clothing, build, face details, specific injuries).',
        'Facial expression should reflect emotional progression from previous turn, not a sudden change.',
        `Lighting scheme must be consistent with '${prevEnvironment.lightingScheme}' unless a major location change is explicitly stated.`,
        'Artistic style (brushwork, color grading, detail level) must be identical to previous turns.',
        'Environmental elements (architecture, key props) must persist unless explicitly removed or changed by narrative.',
        'No sudden jumps in time or major changes in character attire unless explicitly specified by the narrative.',
        `Previous scene was: "${previousTurn.text.substring(0, 100)}..."`
      ],
      previousContext: {
        turnIndex: previousTurn.turnIndex,
        location: prevMetadata?.location,
        dominantCharacter: prevMetadata?.activeCharacters[0],
        emotionalState: this.inferEmotionalState(prevLedger),
        visualCues: this.getTraumaVisualization(prevLedger).join(", ")
      }
    };
  }

  private getStyleConsistencyLock(): any {
    return {
      enforced: true,
      reference: 'All previous turns in this session',
      technicalLock: {
        brushStrokes: 'soft digital with visible texture',
        colorGrading: 'desaturated with selective crimson/gold accents',
        lighting: 'single-source dramatic, deep shadows',
        composition: 'cinematic medium-close, shallow depth of field',
        anatomyStyle: 'realistic proportions with subtle stylization'
      },
      prohibited: [
        'anime exaggeration',
        'cartoon simplification',
        '3D render appearance',
        'photorealistic CGI',
        'bright cheerful colors',
        'flat even lighting',
        'ugly', 'deformed', 'extra limbs', 'blurry', 'low res', 'watermark', 'text'
      ]
    };
  }

  /**
   * Record this turn for future continuity
   */
  public recordTurn(turn: MultimodalTurn): void {
    if (!turn.metadata?.ledgerSnapshot) {
      console.warn(`[VisualCoherenceEngine] Cannot record turn ${turn.id} without ledger snapshot.`);
      return;
    }
    this.memory.turnHistory.push({
      turnId: turn.id,
      turnIndex: turn.turnIndex,
      dominantCharacterId: turn.metadata?.activeCharacters[0] || CharacterId.PLAYER,
      location: turn.metadata?.location || 'Unknown',
      emotionalTone: this.inferEmotionalState(turn.metadata.ledgerSnapshot)
    });
    
    // Keep only last N turns in memory to avoid excessive context
    const HISTORY_MAX_LENGTH = 5; // Adjust as needed for performance vs. coherence
    if (this.memory.turnHistory.length > HISTORY_MAX_LENGTH) {
      this.memory.turnHistory = this.memory.turnHistory.slice(-HISTORY_MAX_LENGTH);
    }
  }

  /**
   * Reset memory (for new game)
   */
  public reset(): void {
    this.memory.lastCharacterAppearances.clear();
    this.memory.environmentState = { // Reset to initial state
        location: 'The Arrival Dock',
        lightingScheme: 'stormy natural light, deep shadows',
        atmosphericEffects: ['volcanic ash', 'sea spray', 'heavy humidity'],
        dominantColors: ['#050505', '#881337', '#facc15', '#1c1917']
    };
    this.memory.timeOfDay = 'evening';
    this.memory.weatherCondition = 'stormy';
    this.memory.turnHistory = [];
  }
}

// Singleton instance
export const visualCoherenceEngine = new VisualCoherenceEngine();