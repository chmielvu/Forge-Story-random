
import { GoogleGenAI, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { YandereLedger, PrefectDNA, CharacterId } from "../types";
import { VISUAL_PROFILES } from "../constants";
import { BEHAVIOR_CONFIG } from "../config/behaviorTuning"; // Import behavior config

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- VISUAL DNA MANDATES ---

const VISUAL_MANDATE = {
  style: "grounded dark erotic academia + baroque brutalism + vampire noir + intimate psychological horror + rembrandt caravaggio lighting",
  technical: {
    camera: "intimate 50mm or 85mm close-up, shallow depth of field",
    // CHANGE: Added "rim lighting" and "volumetric" to separate subject from background
    lighting: "cinematic rembrandt lighting, volumetric gaslight with cool blue rim-light, deep shadows but detailed midtones, atmospheric fog"
  },
  mood: "predatory intimacy, clinical amusement, suffocating dread, weaponized sexuality",
  quality: "restrained masterpiece oil painting, no fantasy elements, high detail on skin texture and fabric strain",
  negative_prompt: [
    "bright colors", "cheerful", "modern architecture", "soft focus", "natural daylight", 
    "explicit nudity", "graphic violence", "anime", "cartoon", "3d render", "low res",
    // ADDED: Negative prompts for better visibility
    "underexposed", 
    "crushed blacks", 
    "illegible", 
    "too dark", 
    "flat lighting",
    "muddy textures"
  ]
};

const ARCHETYPE_VISUAL_MAP: Record<string, { mood?: string, physique?: string, face?: string, attire?: string }> = {
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

// --- VISUAL PROMPT BUILDERS ---

export function buildVisualPrompt(
  target: PrefectDNA | CharacterId, 
  sceneContext: string,
  ledger?: YandereLedger
): string {
  
  let subject: any = {};
  let moodModifiers: string[] = ["clinical-chiaroscuro"];
  
  // Clone strict mandates to avoid mutation
  const promptTechnical = { ...VISUAL_MANDATE.technical };

  // 1. RESOLVE SUBJECT
  if (typeof target === 'string') {
    // FACULTY or PLAYER
    const profile = VISUAL_PROFILES[target] || "Figure in shadow";
    const name = target.replace(/_/g, " ");
    
    subject = {
      name: name,
      role: target.includes('Subject') ? "Subject" : "Faculty",
      description: profile, 
      physique: profile.includes("Regal") ? "statuesque, imposing" : "defined, athletic",
      attire: profile.includes("velvet") ? "crimson velvet robes" : "dark academic formal",
    };

    if (target === CharacterId.PLAYER) {
      moodModifiers.push("vulnerable", "exposed", "sweat-slicked", "kneeling", "submissive");
    } else {
      moodModifiers.push("dominant", "predatory", "elegant", "looming", "control");
    }

  } else {
    // PREFECT (DNA)
    const map = ARCHETYPE_VISUAL_MAP[target.archetype] || {};
    subject = {
      name: target.displayName,
      role: "Prefect",
      archetype: target.archetype,
      physique: map.physique || "lean",
      face: map.face || "distinct features",
      attire: map.attire || "dark academic uniform"
    };

    moodModifiers.push(map.mood || "febrile");
    
    // Inject Trait-Based Visuals
    const { cruelty, charisma, submission_to_authority, ambition, cunning } = target.traitVector;

    // Charisma
    if (charisma > 0.8) moodModifiers.push("mesmeric-gaze", "magnetic-presence", "glowing-skin");
    else if (charisma < 0.3) moodModifiers.push("unnoticed", "plain", "blending-in");

    // Cruelty
    if (cruelty > 0.7) moodModifiers.push("cold-sneer", "predatory-stance", "holding-instrument", "blood-flecked");
    else if (cruelty < 0.3) moodModifiers.push("hesitant", "soft-touch", "worried-brow", "gentle-hands");

    // Submission
    if (submission_to_authority > 0.8) moodModifiers.push("head-bowed", "hands-clasped", "eyes-downcast", "rigid-obedience");
    else if (submission_to_authority < 0.3) moodModifiers.push("chin-up", "defiant-glance", "slouching", "disordered-uniform");

    // Ambition
    if (ambition > 0.8) moodModifiers.push("chin-raised", "intense-focus", "sharp-silhouette", "calculating");
    
    // Cunning
    if (cunning > 0.8) moodModifiers.push("calculating-eyes", "shadowed-face", "half-smile", "watchful");

    // Drive/Weakness Hints (Subtle)
    if (target.drive.includes("Sabotage") || target.drive.includes("Undermine")) moodModifiers.push("hiding-something", "duplicitous-shadows");
    if (target.secretWeakness.includes("Horrified") || target.secretWeakness.includes("Empathy")) moodModifiers.push("tear-stained-cheek", "trembling-hands");
  }

  // 2. RESOLVE CONTEXT (Enhanced)
  let environment = "dimly lit stone corridor, flickering gaslight";
  const lowerContext = sceneContext.toLowerCase();
  
  if (lowerContext.includes("dock") || lowerContext.includes("arrival")) environment = "volcanic rock dock, stormy sky, weeping stone, ocean spray, iron gates, monolithic architecture";
  // CHANGE: Added emissive elements to office/selene
  else if (lowerContext.includes("office") || lowerContext.includes("study") || lowerContext.includes("selene")) environment = "mahogany desk, glowing fireplace casting warm light, velvet curtains, wine goblet catching the light, oppressive luxury, bookshelves, fireplace, persian rugs";
  else if (lowerContext.includes("infirmary") || lowerContext.includes("clinic") || lowerContext.includes("lab") || lowerContext.includes("lysandra")) environment = "tiled walls, surgical tools, sterile light, medical cabinet, anatomical charts, stainless steel, cold atmosphere";
  else if (lowerContext.includes("cell") || lowerContext.includes("cage") || lowerContext.includes("dungeon")) environment = "rusted iron bars, damp straw, stone walls, claustrophobic, chains, dripping water, oubliette";
  else if (lowerContext.includes("lecture") || lowerContext.includes("hall") || lowerContext.includes("theater") || lowerContext.includes("rotunda")) environment = "tiered lecture hall, chalkboard, imposing podium, dust motes, spotlights, panopticon layout";
  else if (lowerContext.includes("bath") || lowerContext.includes("pool") || lowerContext.includes("water")) environment = "tiled bathhouse, steam, stagnant water, echoing, cracked tiles, roman columns";
  else if (lowerContext.includes("garden") || lowerContext.includes("greenhouse") || lowerContext.includes("apothecary")) environment = "overgrown nightshade, glass bottles, dried herbs, humid, earthy smell, poisonous flowers";
  else if (lowerContext.includes("dorm") || lowerContext.includes("quarters")) environment = "spartan room, iron bed frame, moonlight through window, shadows, personal artifacts";
  else if (lowerContext.includes("corridor") || lowerContext.includes("hallway")) environment = "endless stone corridor, flickering torches, arched ceiling, weeping walls, distant footsteps";

  // 3. RESOLVE PSYCHOMETRICS (Trauma Overlay -> Cinematography)
  if (ledger) {
    // Trauma -> Camera instability & Distortion
    if (ledger.traumaLevel > 40) promptTechnical.camera = "handheld, shaky, slight dutch angle, 50mm";
    if (ledger.traumaLevel > 70) promptTechnical.camera = "extreme close-up, disorienting fish-eye, blurred edges, panic, sweaty-lens";
    
    // Shame -> Lighting exposure
    if (ledger.shamePainAbyssLevel > 50) promptTechnical.lighting = "high-contrast, harsh shadows";
    if (ledger.shamePainAbyssLevel > 80) {
        // CHANGE: "surrounding pitch black" -> "surrounding oppressive shadows"
        // CHANGE: Added "specular highlights" to ensure skin/sweat reflects light even in dark
        promptTechnical.lighting = "harsh clinical spotlight from above, surrounding oppressive shadows, high contrast specular highlights on skin, visible sweat texture";
        moodModifiers.push("humiliated-posture", "tearing-up", "flushed-skin", "avoiding-eye-contact", "covering-self");
    }

    // Compliance -> Body language
    if (ledger.complianceScore > 70) moodModifiers.push("broken-posture", "pliant", "doll-like", "slack-jawed", "empty-eyes");

    // Arousal -> Physiological cues
    if (ledger.arousalLevel > 60) moodModifiers.push("heavy-breathing", "dilated-pupils", "fabric-tension", "flushed-chest", "sweat-beads", "biting-lip");
    
    // Hope -> Lighting color
    if (ledger.hopeLevel < 20) promptTechnical.lighting += ", cold blue tones, desaturated, hopeless";
    else if (ledger.hopeLevel > 80) promptTechnical.lighting += ", warm candle glow, golden accents, defiant spark";
  }

  // Constructing the JSON object as mandated
  const promptObject = {
    ...VISUAL_MANDATE,
    technical: promptTechnical,
    subject: subject,
    specific_mood: moodModifiers.filter(Boolean).join(", "),
    scene_context: sceneContext.substring(0, 300),
    environment: environment, 
    composition: "close-up waist-up, three-quarter pose, cinematic, masterpiece"
  };

  return JSON.stringify(promptObject, null, 2);
}

// --- IMAGEN 3 GENERATION ---

export const generateNarrativeImage = async (visualPromptRaw: string): Promise<string | undefined> => {
  
  if (!BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableImages) {
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[mediaService] Image generation is disabled by config.");
    return Promise.resolve(undefined);
  }

  // Enforcing the JSON Structure Mandate
  const structuredPrompt = {
    ...VISUAL_MANDATE,
    scene_description: visualPromptRaw,
    environment_directives: "raw concrete chamber, leather books, surgical tools, faint wine goblet, damp stone walls",
    character_directives: "Female characters: White shirts half-unbuttoned revealing lace bra/cleavage, high slits, sheer stockings. Male characters: Disheveled, sweating, open shirts. Predatory expressions.",
    lighting_directives: "Single gaslight source, deep shadows, volumetric fog, rim lighting on sweat/skin."
  };

  // Flattening for the model to interpret as a strict directive
  const finalPrompt = `
    GENERATE AN IMAGE BASED ON THIS STRICT JSON CONFIGURATION:
    \`\`\`json
    ${JSON.stringify(structuredPrompt, null, 2)}
    \`\`\`
    
    CRITICAL VISUAL RULES:
    1. ART STYLE: Baroque Brutalism + Vampire Noir. Oil painting aesthetic.
    2. LIGHTING: Deep Chiaroscuro. 
    3. NO FANTASY ELEMENTS. Grounded, gritty, erotic realism.
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', 
      contents: { parts: [{ text: finalPrompt }] },
      config: {
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData?.data) {
        return part.inlineData.data;
      }
    }
    return undefined;
  } catch (error) {
    console.error("⚠️ Image generation failed:", error);
    return undefined;
  }
};

// --- AUDIO ENGINE ---

const selectVoiceForNarrative = (narrative: string): string => {
  const lower = narrative.toLowerCase();
  if (lower.includes('shout') || lower.includes('fury') || lower.includes('petra')) return 'Fenrir';
  if (lower.includes('whisper') || lower.includes('calista') || lower.includes('kaelen')) return 'Kore';
  if (lower.includes('analyze') || lower.includes('lysandra') || lower.includes('elara')) return 'Puck';
  return 'Zephyr'; // Selene/Default
};

export const generateSpeech = async (narrative: string): Promise<string | undefined> => {
  if (!BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableAudio) {
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[mediaService] Audio generation is disabled by config.");
    return Promise.resolve(undefined);
  }

  try {
    const voiceName = selectVoiceForNarrative(narrative);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: { parts: [{ text: narrative }] },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName }
          }
        },
      }
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("⚠️ Audio generation failed:", error);
    return undefined;
  }
};

// --- VEO 3.1 VIDEO GENERATION ---

export const animateImageWithVeo = async (
  imageB64: string, 
  visualPrompt: string, 
  aspectRatio: '16:9' | '9:16' = '16:9'
): Promise<string | undefined> => {
  if (!BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideo) {
    if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[mediaService] Video generation is disabled by config.");
    return Promise.resolve(undefined);
  }

  try {
    const motionPrompt = `
      Cinematic slow motion, psychological horror, atmospheric.
      Scene: ${visualPrompt}
      Directives: Micro-movements of breathing and fabric. Flickering light. Dust motes. No morphing.
      Aesthetic: ${VISUAL_MANDATE.style}
    `;

    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: motionPrompt,
      image: {
        imageBytes: imageB64,
        mimeType: 'image/jpeg',
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio
      }
    });

    let attempts = 0;
    while (!operation.done && attempts < 12) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
      attempts++;
    }

    if (!operation.done) return undefined;

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (videoUri) {
      const response = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
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

// --- ORCHESTRATOR ---

export const generateEnhancedMedia = async (
  narrative: string,
  visualPrompt: string,
  ledger: YandereLedger
): Promise<{ audioData?: string, imageData?: string, videoData?: string }> => {
  
  const imagePromise = generateNarrativeImage(visualPrompt);
  const audioPromise = generateSpeech(narrative);

  // Trigger video only on high intensity moments to save tokens/time
  let videoPromise: Promise<string | undefined> = Promise.resolve(undefined);
  
  const isHighIntensity = (ledger.traumaLevel > BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideoAboveTrauma || 
                          ledger.shamePainAbyssLevel > BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideoAboveShame) &&
                          BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableVideo; // Check global enable as well

  if (isHighIntensity) {
    videoPromise = (async () => {
      try {
        const imageBase64 = await imagePromise; // Await image first, as video needs it
        if (!imageBase64) {
          console.warn("Image not available for video generation.");
          return undefined;
        }
        return await animateImageWithVeo(imageBase64, visualPrompt, '16:9');
      } catch (e) {
        console.error("Conditional video generation failed:", e);
        return undefined;
      }
    })();
  }

  const [imageBytes, audioBytes, videoBytes] = await Promise.all([imagePromise, audioPromise, videoPromise]);
  
  return {
    imageData: imageBytes,
    audioData: audioBytes,
    videoData: videoBytes
  };
};

export const distortImage = async (imageB64: string, instruction: string): Promise<string | undefined> => {
    if (!BEHAVIOR_CONFIG.MEDIA_THRESHOLDS.enableImages) {
        if (BEHAVIOR_CONFIG.DEV_MODE.verboseLogging) console.log("[mediaService] Image distortion is disabled by config.");
        return Promise.resolve(undefined);
    }

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
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          ],
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