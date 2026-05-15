import { ARENA, RUN, ENEMY } from '../constants';
import { saveState, addPoints, persistSave } from '../state';
import { Player, type AttackEvent } from './entities/Player';
import { EnemyCell, type EnemyType } from './entities/EnemyCell';
import { Projectile } from './entities/Projectile';
import { SFX } from './Sound';

const SPAWN_BASE = 1200;
const SPAWN_MIN  = 350;

export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  life: number;
  maxLife: number;
}

export interface FloatText {
  id: number;
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
}

export interface Corpse {
  x: number; y: number;
  radius: number;
  type: EnemyType;
  life: number;
  maxLife: number;
}

export interface RunEndInfo {
  rawScore: number;
  earned:   number;
  reason:   'timeout' | 'death';
}

export interface GameSnapshot {
  runTimeLeft:     number;
  runScore:        number;
  hearts:          number;
  maxHearts:       number;
  hasShield:       boolean;
  shieldChargeFrac: number;
  isShielding:     boolean;
}

let _uid = 0;

export class GameLoop {
  readonly player: Player;
  enemies:    EnemyCell[]  = [];
  projectiles: Projectile[] = [];
  floatTexts: FloatText[]  = [];
  corpses:    Corpse[]     = [];
  particles:  Particle[]   = [];
  playerHitFlash = false;

  runScore    = 0;
  runTimeLeft: number;
  phase: 'playing' | 'over' = 'playing';
  hitStopTimer = 0;

  countdownDigit = 0;
  countdownPulse = 0;
  private lastCountdownSec = -1;

  onRunEnd?: (info: RunEndInfo) => void;

  private spawnTimer = 0;

  constructor() {
    this.runTimeLeft = RUN.BASE_DURATION + saveState.stats.bonusTime;
    this.player = new Player(ARENA.WIDTH / 2, ARENA.HEIGHT / 2, saveState.stats);
  }

  tick(delta: number, mouseX: number, mouseY: number, spaceHeld = false): void {
    if (this.phase !== 'playing') return;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - delta);
      return;
    }

    this.playerHitFlash = false;

    // Timer
    this.runTimeLeft = Math.max(0, this.runTimeLeft - delta);
    if (this.runTimeLeft === 0) { this.endRun('timeout'); return; }

    // Countdown pulse (last 5 seconds)
    const secsLeft = Math.ceil(this.runTimeLeft / 1000);
    if (secsLeft <= 5 && secsLeft > 0 && secsLeft !== this.lastCountdownSec) {
      this.lastCountdownSec = secsLeft;
      this.countdownDigit   = secsLeft;
      this.countdownPulse   = 1;
      SFX.countdown(secsLeft);
    }
    if (this.countdownPulse > 0) {
      this.countdownPulse = Math.max(0, this.countdownPulse - delta / 900);
    }

    // Spawn
    this.spawnTimer -= delta;
    if (this.spawnTimer <= 0) {
      this.spawnEnemy();
      const t = 1 - this.runTimeLeft / (RUN.BASE_DURATION + saveState.stats.bonusTime);
      this.spawnTimer = lerp(SPAWN_BASE, SPAWN_MIN, t);
    }

    // Player
    const atk = this.player.update(delta, mouseX, mouseY, this.enemies, spaceHeld);
    if (atk) this.firePlayerProjectile(atk);

    // Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const evt = e.update(delta, this.player.x, this.player.y);
      if (!e.active || evt?.type === 'escape') {
        this.enemies.splice(i, 1);
        continue;
      }
      if (evt?.type === 'fire') {
        this.projectiles.push(new Projectile(e.x, e.y, evt.toX, evt.toY, 'enemy', 1));
        this.spawnMuzzleParticles(e.x, e.y, evt.toX, evt.toY);
      }
    }

    // Pack alerting — activated aware cells alert nearby aware cells
    for (const e of this.enemies) {
      if (e.type !== 'aware' || !e.isActivated) continue;
      for (const other of this.enemies) {
        if (other !== e && other.type === 'aware' && !other.isActivated) {
          if (Math.hypot(other.x - e.x, other.y - e.y) < ENEMY.AWARE.PACK_ALERT_RADIUS) {
            other.activate();
          }
        }
      }
    }

    // Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(delta);
      if (p.expired) { this.projectiles.splice(i, 1); continue; }

      if (p.owner === 'enemy') {
        if (p.hits(this.player.x, this.player.y, this.player.radius)) {
          this.projectiles.splice(i, 1);
          if (!this.player.isShielding) {
            SFX.playerDamage();
            this.playerHitFlash = true;
            this.hitStopTimer = 60;
            const dead = this.player.takeDamage();
            if (dead) { SFX.playerDie(); this.endRun('death'); return; }
          } else {
            SFX.shieldAbsorb();
          }
        }
      } else {
        let hit = false;
        for (const e of this.enemies) {
          if (!e.active) continue;
          if (p.hits(e.x, e.y, e.radius)) {
            this.projectiles.splice(i, 1);
            this.applyHit(e, p.damage);
            hit = true;
            break;
          }
        }
        if (hit) continue;
      }
    }

    // Float texts
    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      this.floatTexts[i].life -= delta;
      if (this.floatTexts[i].life <= 0) this.floatTexts.splice(i, 1);
    }

    // Corpses
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      this.corpses[i].life -= delta;
      if (this.corpses[i].life <= 0) this.corpses.splice(i, 1);
    }

    // Particles
    const dt = delta / 1000;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= delta;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  getSnapshot(): GameSnapshot {
    return {
      runTimeLeft:      this.runTimeLeft,
      runScore:         this.runScore,
      hearts:           this.player.currentHearts,
      maxHearts:        this.player.maxHearts,
      hasShield:        this.player.hasShield,
      shieldChargeFrac: this.player.shieldChargeFrac,
      isShielding:      this.player.isShielding,
    };
  }

  private firePlayerProjectile(atk: AttackEvent): void {
    const { target, fromX, fromY } = atk;
    SFX.playerFire();
    this.projectiles.push(new Projectile(fromX, fromY, target.x, target.y, 'player', saveState.stats.attack));
    this.spawnMuzzleParticles(fromX, fromY, target.x, target.y);
  }

  private applyHit(target: EnemyCell, damage: number): void {
    const dead = target.takeDamage(damage);
    if (!dead) SFX.enemyHit();
    if (dead) {
      SFX.enemyDie();
      target.active = false;
      this.hitStopTimer = 45;
      this.spawnBurstParticles(target.x, target.y);
      this.corpses.push({
        x: target.x, y: target.y,
        radius: target.radius, type: target.type,
        life: 220, maxLife: 220,
      });
      this.runScore += target.points;
      this.floatTexts.push({
        id: _uid++,
        x: target.x, y: target.y,
        text: `+${target.points}`,
        life: 900, maxLife: 900,
      });
      this.enemies = this.enemies.filter(e => e !== target);
    }
  }

  private spawnMuzzleParticles(ex: number, ey: number, tx: number, ty: number): void {
    const dx = tx - ex, dy = ty - ey;
    const len = Math.hypot(dx, dy) || 1;
    for (let i = 0; i < 5; i++) {
      const speed = 60 + Math.random() * 80;
      this.particles.push({
        x: ex, y: ey,
        vx: (dx / len + (Math.random() - 0.5) * 0.6) * speed,
        vy: (dy / len + (Math.random() - 0.5) * 0.6) * speed,
        radius: 3 + Math.random() * 5,
        life: 150 + Math.random() * 100,
        maxLife: 250,
      });
    }
  }

  private spawnBurstParticles(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
      const speed = 100 + Math.random() * 140;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 5 + Math.random() * 8,
        life: 300 + Math.random() * 150,
        maxLife: 450,
      });
    }
  }

  private spawnEnemy(): void {
    const pos = Math.random() < 0.3 ? randInterior() : randEdge();
    this.enemies.push(new EnemyCell(pos.x, pos.y, pickType()));
  }

  private endRun(reason: 'timeout' | 'death'): void {
    if (this.phase !== 'playing') return;
    this.phase = 'over';
    if (reason === 'timeout') SFX.runSurvived();
    const rawScore = this.runScore;
    const earned   = reason === 'death' ? Math.floor(rawScore * 0.25) : rawScore;
    addPoints(earned);
    saveState.runCount += 1;
    persistSave();
    setTimeout(() => this.onRunEnd?.({ rawScore, earned, reason }), 600);
  }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function randInterior(): { x: number; y: number } {
  const mx = ARENA.WIDTH  * 0.2, my = ARENA.HEIGHT * 0.2;
  return {
    x: mx + Math.random() * (ARENA.WIDTH  - mx * 2),
    y: my + Math.random() * (ARENA.HEIGHT - my * 2),
  };
}

function randEdge(): { x: number; y: number } {
  const m = 20;
  switch (Math.floor(Math.random() * 4)) {
    case 0: return { x: ri(m, ARENA.WIDTH  - m), y: m };
    case 1: return { x: ARENA.WIDTH  - m,        y: ri(m, ARENA.HEIGHT - m) };
    case 2: return { x: ri(m, ARENA.WIDTH  - m), y: ARENA.HEIGHT - m };
    default: return { x: m,                      y: ri(m, ARENA.HEIGHT - m) };
  }
}

function ri(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickType(): EnemyType {
  const r = Math.random();
  if (r < 0.60) return 'oblivious';
  if (r < 0.85) return 'aware';
  if (r < 0.95) return 'ranged';
  return 'armoured';
}
