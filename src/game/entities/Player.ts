import { PLAYER_BASE, ARENA, ORBIT, SHIELD, TARGETING_RING_RADIUS } from '../../constants';
import type { PlayerStats } from '../../state';
import type { EnemyCell } from './EnemyCell';
import { SFX } from '../Sound';

export interface AttackEvent {
  target: EnemyCell;
  fromX:  number;
  fromY:  number;
}

export class Player {
  x: number;
  y: number;
  readonly radius = PLAYER_BASE.RADIUS;

  private stats: PlayerStats;
  private hearts: number;
  private attackTimer = 0;

  // Orbit state
  private orbitAngle:     number;
  private orbitDirection = 1;
  private orbitFlipTimer: number;
  private bobTime   = 0;
  private omega     = 0;
  private radialVel = 0;

  // Shield state
  private shieldCharge: number;  // current charge in ms
  private _shielding = false;

  constructor(x: number, y: number, stats: PlayerStats) {
    this.x = x;
    this.y = y;
    this.stats = { ...stats };
    this.hearts = stats.maxHearts;
    this.orbitAngle     = Math.random() * Math.PI * 2;
    this.orbitFlipTimer = ORBIT.FLIP_MIN + Math.random() * (ORBIT.FLIP_MAX - ORBIT.FLIP_MIN);
    this.shieldCharge   = stats.shieldCapacity;
  }

  get currentHearts()    { return this.hearts; }
  get maxHearts()        { return this.stats.maxHearts; }
  get attackRange()      { return this.stats.range; }
  get isShielding()      { return this._shielding; }
  get shieldChargeFrac() {
    return this.stats.shieldCapacity > 0
      ? this.shieldCharge / this.stats.shieldCapacity
      : 0;
  }
  get hasShield()        { return this.stats.shieldCapacity > 0; }

  update(delta: number, mx: number, my: number, enemies: EnemyCell[], spaceHeld: boolean): AttackEvent | null {
    this.tickShield(delta, spaceHeld);
    this.move(delta, mx, my);
    if (this._shielding) return null;
    return this.tickAttack(delta, mx, my, enemies);
  }

  // Returns true if dead
  takeDamage(): boolean {
    this.hearts = Math.max(0, this.hearts - 1);
    return this.hearts === 0;
  }

  // ── Shield ────────────────────────────────────────────────────────────────

  private tickShield(delta: number, spaceHeld: boolean): void {
    if (this.stats.shieldCapacity <= 0) return;
    const wasShielding = this._shielding;

    if (spaceHeld && this.shieldCharge > 0) {
      this._shielding   = true;
      this.shieldCharge = Math.max(0, this.shieldCharge - delta);
      if (this.shieldCharge === 0) this._shielding = false;
    } else {
      this._shielding   = false;
      this.shieldCharge = Math.min(
        this.stats.shieldCapacity,
        this.shieldCharge + SHIELD.RECHARGE_RATE * delta / 1000,
      );
    }

    if (!wasShielding && this._shielding) SFX.shieldActivate();
    else if (wasShielding && !this._shielding) SFX.shieldDeactivate();
  }

  // ── Movement ──────────────────────────────────────────────────────────────

  private move(delta: number, cx: number, cy: number): void {
    const dt = delta / 1000;

    this.bobTime += delta;
    this.orbitFlipTimer -= delta;
    if (this.orbitFlipTimer <= 0) {
      this.orbitDirection *= -1;
      this.orbitFlipTimer = ORBIT.FLIP_MIN + Math.random() * (ORBIT.FLIP_MAX - ORBIT.FLIP_MIN);
    }

    const dx = this.x - cx;
    const dy = this.y - cy;
    let r = Math.hypot(dx, dy);
    if (r > 1) this.orbitAngle = Math.atan2(dy, dx);

    const bob     = Math.sin(this.bobTime / ORBIT.BOB_PERIOD * Math.PI * 2) * ORBIT.BOB_AMOUNT;
    const targetR = this.stats.range + bob;

    const orbitScale  = Math.min(1, targetR / Math.max(r, 1));
    const targetOmega = ORBIT.SPEED * this.orbitDirection * orbitScale;
    this.omega += (targetOmega - this.omega) * ORBIT.ANGULAR_STIFFNESS * dt;
    this.orbitAngle += this.omega * dt;

    const springF = ORBIT.RADIAL_K * (targetR - r);
    const dampF   = -ORBIT.RADIAL_D * this.radialVel;
    this.radialVel += (springF + dampF) * dt;
    this.radialVel = Math.max(-this.stats.speed, Math.min(this.stats.speed, this.radialVel));
    r = Math.max(0, r + this.radialVel * dt);

    this.x = cx + Math.cos(this.orbitAngle) * r;
    this.y = cy + Math.sin(this.orbitAngle) * r;

    const prevX = this.x, prevY = this.y;
    this.x = Math.max(this.radius, Math.min(ARENA.WIDTH  - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(ARENA.HEIGHT - this.radius, this.y));
    if (this.x !== prevX || this.y !== prevY) {
      this.orbitDirection *= -1;
      this.orbitFlipTimer = ORBIT.FLIP_MIN + Math.random() * (ORBIT.FLIP_MAX - ORBIT.FLIP_MIN);
    }
  }

  // ── Attack ────────────────────────────────────────────────────────────────

  private tickAttack(delta: number, ringX: number, ringY: number, enemies: EnemyCell[]): AttackEvent | null {
    this.attackTimer += delta;
    if (this.attackTimer < 1000 / this.stats.rate) return null;

    const distToCursor = Math.hypot(this.x - ringX, this.y - ringY);
    if (distToCursor > this.stats.range + ORBIT.BOB_AMOUNT) return null;

    this.attackTimer = 0;
    const target = this.nearestInRing(enemies, ringX, ringY);
    return target ? { target, fromX: this.x, fromY: this.y } : null;
  }

  private nearestInRing(enemies: EnemyCell[], ringX: number, ringY: number): EnemyCell | null {
    let best: EnemyCell | null = null;
    let bestDist = TARGETING_RING_RADIUS;
    for (const e of enemies) {
      if (!e.active) continue;
      const d = Math.hypot(e.x - ringX, e.y - ringY);
      if (d < bestDist) { bestDist = d; best = e; }
    }
    return best;
  }
}
