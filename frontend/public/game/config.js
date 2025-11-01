// config.js — constants only
export const Y_EXP_RADIUS = 2.6;
export const BASE_TIME_SEC = 15;
export const EXTRA_TIME_ON_CONTINUE = 10;

export const BLAST_DAMAGE = 15;
export const BLAST_STUN_MS = 1000;

export const GHOST_SPEED_TPS = 10;
export const REVIVE_RADIUS = 1.5; // reserved
export const SEEK_RADIUS = 15.0;
export const GIVEUP_RADIUS = 10.0;
export const GO_SPEED_TPS = 7;

export const PAINT_RADIUS = 0.75; // reserved
export const PAINT_INTERVAL = 0.05;
export const MIX_RED_RATIO = 0.01; // reserved
export const PAINT_PROB = 0.35;
export const PAINT_MAX_PER_CALL = 3; // reserved
export const PAINT_TOUCH_DIST = 0.35;

export const BLAST_RING_LIFE = 450;
export const BLAST_RING_WIDTH = 3;
export const BLAST_SPARKS = 24;
export const BLAST_SPARK_LIFE = 500;
export const BLAST_SHAKE_MS = 120;
export const BLAST_SHAKE_MAG = 3;

export const PAC_VISUAL_SIZE_TILES = 0.9;
export const PAC_EAT_RADIUS_TILES = 0.5;

export const SCORE_UI = { MIN: 0, MAX: 100, DYNAMIC: false };
export const SCORE_CFG = {
  WHITE_POINT: 3,
  TIME_DECAY_PER_SEC: 1,
  HP_PENALTY_PER_DAMAGE: 0.5,
  MIN: 0,
};
export const SCORING = {
  damageWeight: 40,
  timeWeight: 30,
  hpWeight: 30,
  continuePenalty: 15,
};
