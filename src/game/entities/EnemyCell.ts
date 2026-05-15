import { COLORS, ENEMY, ARENA } from '../../constants';
import { SFX } from '../Sound';

export type EnemyType = 'oblivious' | 'aware' | 'ranged' | 'armoured';

export type EnemyEvent =
  | { type: 'fire'; toX: number; toY: number }
  | { type: 'escape' }
  | null;

const EDGE_MARGIN = 20;

const CFG = {
  oblivious: ENEMY.OBLIVIOUS,
  aware:     ENEMY.AWARE,
  ranged:    ENEMY.RANGED,
  armoured:  ENEMY.ARMOURED,
} as const;

const COLOR_MAP: Record<EnemyType, number> = {
  oblivious: COLORS.OBLIVIOUS,
  aware:     COLORS.AWARE,
  ranged:    COLORS.RANGED,
  armoured:  COLORS.ARMOURED,
};

export class EnemyCell {
  x: number;
  y: number;
  active = true;
  readonly type: EnemyType;
  readonly radius: number;
  readonly color: number;
  readonly points: number;

  private hp: number;
  private vx = 0;
  private vy = 0;
  private wanderTimer = 0;
  private fireCooldown: number;
  private _inRange    = false;
  private _activated  = false;
  private _hitFlashTimer = 0;

  // Fade-in on spawn
  alpha = 0;
  private fadeTimer = 400;
  // Alert pulse when aware cell detects player
  alertPulse = 0; // 0–1, drives ring expand on renderer

  constructor(x: number, y: number, type: EnemyType) {
    this.x = x;
    this.y = y;
    this.type = type;
    const cfg = CFG[type];
    this.radius = cfg.RADIUS;
    this.points = cfg.POINTS;
    this.hp = cfg.HP;
    this.color = COLOR_MAP[type];
    this.fireCooldown = type === 'ranged' ? ENEMY.RANGED.FIRE_COOLDOWN : 0;
    this.pickDir();
  }

  // 0 = just fired / not in range, 1 = about to fire
  get chargeProgress(): number {
    if (this.type !== 'ranged' || !this._activated) return 0;
    return 1 - this.fireCooldown / ENEMY.RANGED.FIRE_COOLDOWN;
  }

  get inDetectionRange(): boolean { return this._inRange; }

  get hitFlashAlpha(): number { return this._hitFlashTimer / 80; }
  get hpFraction(): number    { return Math.max(0, this.hp / CFG[this.type].HP); }

  update(delta: number, px: number, py: number): EnemyEvent {
    // Fade in
    if (this.fadeTimer > 0) {
      this.fadeTimer = Math.max(0, this.fadeTimer - delta);
      this.alpha = 1 - this.fadeTimer / 400;
    }

    if (this._hitFlashTimer > 0) this._hitFlashTimer = Math.max(0, this._hitFlashTimer - delta);

    const dt = delta / 1000;
    let event: EnemyEvent = null;

    switch (this.type) {
      case 'oblivious': this.wander(dt, ENEMY.OBLIVIOUS.SPEED); break;
      case 'aware':     event = this.updateAware(dt, px, py); break;
      case 'ranged':    event = this.updateRanged(delta, dt, px, py); break;
      case 'armoured':  this.wander(dt, ENEMY.ARMOURED.SPEED); break;
    }

    if (!this.active) return event;
    const m = this.radius + EDGE_MARGIN;
    this.x = Math.max(m, Math.min(ARENA.WIDTH  - m, this.x));
    this.y = Math.max(m, Math.min(ARENA.HEIGHT - m, this.y));
    return event;
  }

  private updateAware(dt: number, px: number, py: number): EnemyEvent {
    const dx = this.x - px, dy = this.y - py;
    const dist = Math.hypot(dx, dy);

    this._inRange = dist < ENEMY.AWARE.DETECTION_RADIUS;
    if (this._inRange && !this._activated) {
      this._activated = true;
      this.alertPulse = 1;
      SFX.enemyAlert();
    }

    if (this._activated) {
      const len = dist || 1;
      this.vx = dx / len;
      this.vy = dy / len;
      this.x += this.vx * ENEMY.AWARE.SPEED * dt;
      this.y += this.vy * ENEMY.AWARE.SPEED * dt;
    } else {
      this.wander(dt, ENEMY.AWARE.SPEED * 0.4);
    }

    if (this.alertPulse > 0) this.alertPulse = Math.max(0, this.alertPulse - dt * 2.5);

    if (this.x <= 0 || this.x >= ARENA.WIDTH || this.y <= 0 || this.y >= ARENA.HEIGHT) {
      this.active = false;
      return { type: 'escape' };
    }
    return null;
  }

  private updateRanged(delta: number, dt: number, px: number, py: number): EnemyEvent {
    const dx = px - this.x, dy = py - this.y;
    const dist = Math.hypot(dx, dy);
    let event: EnemyEvent = null;

    if (dist < ENEMY.RANGED.DETECTION_RADIUS) {
      this._inRange   = true;
      this._activated = true;
      const len = dist || 1;
      const m = this.radius + EDGE_MARGIN;
      const rx = -dx / len, ry = -dy / len;
      if (!(this.x < m && rx < 0) && !(this.x > ARENA.WIDTH  - m && rx > 0))
        this.x += rx * ENEMY.RANGED.RETREAT_SPEED * dt;
      if (!(this.y < m && ry < 0) && !(this.y > ARENA.HEIGHT - m && ry > 0))
        this.y += ry * ENEMY.RANGED.RETREAT_SPEED * dt;
    } else {
      this._inRange = false;
      if (this._activated) {
        const len = dist || 1;
        this.x += (dx / len) * ENEMY.RANGED.SPEED * 0.5 * dt;
        this.y += (dy / len) * ENEMY.RANGED.SPEED * 0.5 * dt;
      } else {
        this.wander(dt, ENEMY.RANGED.SPEED * 0.3);
      }
    }

    if (this._activated) {
      this.fireCooldown -= delta;
      if (this.fireCooldown <= 0) {
        this.fireCooldown = ENEMY.RANGED.FIRE_COOLDOWN;
        SFX.rangedFire();
        event = { type: 'fire', toX: px, toY: py };
      }
    }
    return event;
  }

  private wander(dt: number, speed: number): void {
    this.wanderTimer -= dt * 1000;
    if (this.wanderTimer <= 0) this.pickDir();

    const m = this.radius + EDGE_MARGIN;
    if (this.x < m && this.vx < 0) this.vx = Math.abs(this.vx);
    if (this.x > ARENA.WIDTH  - m && this.vx > 0) this.vx = -Math.abs(this.vx);
    if (this.y < m && this.vy < 0) this.vy = Math.abs(this.vy);
    if (this.y > ARENA.HEIGHT - m && this.vy > 0) this.vy = -Math.abs(this.vy);

    this.x += this.vx * speed * dt;
    this.y += this.vy * speed * dt;
  }

  private pickDir(): void {
    const a = Math.random() * Math.PI * 2;
    this.vx = Math.cos(a);
    this.vy = Math.sin(a);
    this.wanderTimer = 1000 + Math.random() * 2000;
  }

  takeDamage(amount: number): boolean {
    this.hp -= amount;
    this._hitFlashTimer = 80;
    return this.hp <= 0;
  }
}
