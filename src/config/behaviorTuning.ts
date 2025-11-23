
// Central configuration for tuning agent and game loop behavior
export const BEHAVIOR_CONFIG = {
  PREFECT_SPOTLIGHT_COUNT: 4,
  TRAUMA_THRESHOLDS: {
    HIGH: 80,
    CRITICAL: 90,
    SHAKE_START: 50,
    GLITCH_START: 70
  },
  ANIMATION: {
    ENABLE_VEO: true, // Set to false to disable video generation (save tokens)
    ENABLE_TTS: true,
    ENABLE_HAPTICS: true
  },
  DEV_MODE: {
    ENABLED: true,
    TRIGGER_KEY: '`', // Tilde key
    LOG_ACTIONS: true
  },
  GAMEPLAY: {
    TURN_DELAY_MS: 1500, // Artificial delay for "thinking" feel
    HISTORY_WINDOW_SIZE: 15
  }
};
