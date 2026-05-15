export const COLORS = {
  BG:              0xeed8c7,  // cream
  PLAYER:          0x264653,  // dark navy
  OBLIVIOUS:       0xf4a261,  // orange
  AWARE:           0xe9c46a,  // gold
  RANGED:          0xe76f51,  // red-orange
  ARMOURED:        0xf4a261,  // orange ring
  ARMOURED_INNER:  0xe9c46a,  // gold square inside armoured
  PROJECTILE:      0xe76f51,
  PLAYER_PROJ:     0x264653,  // navy — player bullets
  HEART:           0xe76f51,
  ACCENT:          0x2a9d8f,  // teal — UI + active targeting ring
  BUBBLE:          0xd4b8a8,  // darker cream — bubble particles
  RING_IDLE:       0xc8b0a8,  // muted warm grey — targeting ring when empty
} as const;

export const CSS = {
  BG:       '#EED8C7',
  PLAYER:   '#264653',
  ACCENT:   '#2A9D8F',   // teal — UI text, highlights
  OBLIVIOUS:'#F4A261',
  AWARE:    '#E9C46A',
  RANGED:   '#E76F51',
  ARMOURED: '#F4A261',
  HEART:    '#E76F51',
  TEXT:     '#264653',   // dark navy body text
  DIM:      '#8c9e9e',
} as const;

export const ARENA = {
  WIDTH:  1200,
  HEIGHT: 800,
} as const;

export const PLAYER_BASE = {
  SPEED:      119,
  ATTACK:     10,
  RANGE:      140,
  RATE:       1.2,
  RADIUS:     28,
  MAX_HEARTS: 2,
} as const;

export const TARGETING_RING_RADIUS = 40;

export const ORBIT = {
  SPEED:              0.4,   // rad/s — target angular velocity
  BOB_AMOUNT:         20,    // px ± around range
  BOB_PERIOD:         2500,  // ms per full bob cycle
  FLIP_MIN:           3000,  // ms min between direction flips
  FLIP_MAX:           7000,  // ms max between direction flips
  RADIAL_K:           10,    // spring stiffness — pull toward orbit radius
  RADIAL_D:           5,     // radial damping — ζ≈0.79, slight elastic overshoot
  ANGULAR_STIFFNESS:  4,     // how quickly omega tracks target — lower = more inertia on flip
} as const;

export const PLAYER_PROJECTILE_SPEED = 350;

export const SHIELD = {
  RECHARGE_RATE: 800,  // ms of charge recovered per real-second when not shielding
} as const;

export const RUN = {
  BASE_DURATION: 15000,
} as const;

export const ENEMY = {
  OBLIVIOUS: { RADIUS: 16, SPEED: 40,  HP: 15, POINTS: 1 },
  AWARE:     { RADIUS: 14, SPEED: 100, HP: 10, POINTS: 3, DETECTION_RADIUS: 150, PACK_ALERT_RADIUS: 200 },
  RANGED:    { RADIUS: 18, SPEED: 60,  HP: 30, POINTS: 4, DETECTION_RADIUS: 200, RETREAT_SPEED: 70, FIRE_COOLDOWN: 2500, PROJECTILE_SPEED: 180 },
  ARMOURED:  { RADIUS: 44, SPEED: 25,  HP: 100, POINTS: 8 },
} as const;
