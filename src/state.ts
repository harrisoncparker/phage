// Persistent save state across runs
// Bump SAVE_VERSION to invalidate all existing saves on next load

import { PLAYER_BASE } from './constants';

const SAVE_VERSION = 3;

export interface PlayerStats {
  speed:          number;
  attack:         number;
  range:          number;
  rate:           number;
  bonusTime:      number;   // extra ms added to run duration
  maxHearts:      number;
  shieldCapacity: number;   // max shield charge in ms; 0 = not unlocked
}

export interface SaveState {
  totalPoints:   number;
  spentPoints:   number;
  runCount:      number;
  unlockedNodes: Set<string>;
  stats:         PlayerStats;
}

const DEFAULT_STATS: PlayerStats = {
  speed:          PLAYER_BASE.SPEED,
  attack:         PLAYER_BASE.ATTACK,
  range:          PLAYER_BASE.RANGE,
  rate:           PLAYER_BASE.RATE,
  bonusTime:      0,
  maxHearts:      PLAYER_BASE.MAX_HEARTS,
  shieldCapacity: 0,
};

export const saveState: SaveState = {
  totalPoints:   0,
  spentPoints:   0,
  runCount:      0,
  unlockedNodes: new Set(),
  stats:         { ...DEFAULT_STATS },
};

// ── Persistence ──────────────────────────────────────────────────────────────

const SAVE_KEY = 'cell-game-v1';

export let saveWasReset = false;

function loadFromStorage(): void {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if ((d.version ?? 0) !== SAVE_VERSION) {
      localStorage.removeItem(SAVE_KEY);
      saveWasReset = true;
      return;
    }
    saveState.totalPoints   = d.totalPoints   ?? 0;
    saveState.spentPoints   = d.spentPoints   ?? 0;
    saveState.runCount      = d.runCount      ?? 0;
    saveState.unlockedNodes = new Set(d.unlockedNodes ?? []);
    saveState.stats         = { ...DEFAULT_STATS, ...d.stats };
  } catch {
    // corrupt or missing save — start fresh
  }
}

export function deleteSave(): void {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export function persistSave(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      version:       SAVE_VERSION,
      totalPoints:   saveState.totalPoints,
      spentPoints:   saveState.spentPoints,
      runCount:      saveState.runCount,
      unlockedNodes: [...saveState.unlockedNodes],
      stats:         saveState.stats,
    }));
  } catch {
    // storage unavailable — silently skip
  }
}

// Load on module init so first GameLoop constructor sees persisted stats
loadFromStorage();

// ── State helpers ─────────────────────────────────────────────────────────────

export function addPoints(pts: number): void {
  saveState.totalPoints += pts;
}

export function spendPoints(pts: number): boolean {
  const available = saveState.totalPoints - saveState.spentPoints;
  if (available < pts) return false;
  saveState.spentPoints += pts;
  return true;
}

export function availablePoints(): number {
  return saveState.totalPoints - saveState.spentPoints;
}
