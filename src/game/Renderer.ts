import { Application, Graphics, Text, Container } from 'pixi.js';
import { ARENA, COLORS, ORBIT, TARGETING_RING_RADIUS } from '../constants';
import type { GameLoop } from './GameLoop';

export class Renderer {
  private readonly app:        Application;
  private readonly gfx:        Graphics;
  private readonly textLayer:  Container;
  private readonly activeTexts = new Map<number, Text>();
  private shakeTimer = 0;
  private timeMs     = 0;

  constructor(app: Application) {
    this.app       = app;
    this.gfx       = new Graphics();
    this.textLayer = new Container();
    app.stage.addChild(this.gfx, this.textLayer);
  }

  draw(gl: GameLoop, mouseX: number, mouseY: number, deltaMS: number): void {
    this.timeMs += deltaMS;
    this.applyShake(gl, deltaMS);
    this.gfx.clear();
    this.drawBorder();
    this.drawTargetingRing(gl, mouseX, mouseY);
    this.drawCorpses(gl);
    this.drawEnemies(gl);
    this.drawProjectiles(gl);
    this.drawParticles(gl);
    this.drawPlayer(gl, mouseX, mouseY);
    this.syncFloatTexts(gl);
  }

  destroy(): void {
    for (const t of this.activeTexts.values()) t.destroy();
    this.activeTexts.clear();
  }

  // ── Private draw methods ───────────────────────────────────────────────────

  private applyShake(gl: GameLoop, deltaMS: number): void {
    if (gl.playerHitFlash) this.shakeTimer = 220;
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - deltaMS);
      const mag = (this.shakeTimer / 220) * 7;
      this.app.stage.x = (Math.random() - 0.5) * mag * 2;
      this.app.stage.y = (Math.random() - 0.5) * mag * 2;
    } else {
      this.app.stage.x = 0;
      this.app.stage.y = 0;
    }
  }

  private drawBorder(): void {
    this.gfx.roundRect(6, 6, ARENA.WIDTH - 12, ARENA.HEIGHT - 12, 20);
    this.gfx.stroke({ color: 0xd4b0a0, width: 3, alpha: 0.55 });
  }

  private drawTargetingRing(gl: GameLoop, mouseX: number, mouseY: number): void {
    const hasEnemiesInRing = gl.enemies.some(
      e => e.active && Math.hypot(e.x - mouseX, e.y - mouseY) < TARGETING_RING_RADIUS
    );
    const playerInRange = Math.hypot(gl.player.x - mouseX, gl.player.y - mouseY)
      <= gl.player.attackRange + ORBIT.BOB_AMOUNT;

    this.gfx.circle(mouseX, mouseY, TARGETING_RING_RADIUS);

    if (!hasEnemiesInRing) {
      // Nothing in ring — most subtle
      this.gfx.stroke({ color: COLORS.RING_IDLE, width: 2, alpha: 0.2 });
    } else if (!playerInRange) {
      // Prey in ring, player still approaching — medium contrast
      this.gfx.stroke({ color: COLORS.AWARE, width: 2, alpha: 0.55 });
    } else {
      // Prey in ring + player in range — most prominent, firing
      this.gfx.stroke({ color: COLORS.ACCENT, width: 2, alpha: 0.85 });
    }
  }

  private drawCorpses(gl: GameLoop): void {
    for (const c of gl.corpses) {
      const alpha = c.life / c.maxLife;
      const scale = 1 + (1 - alpha) * 0.3;
      this.gfx.circle(c.x, c.y, c.radius * scale);
      this.gfx.stroke({
        color: c.type === 'armoured' ? COLORS.ARMOURED : COLORS.PLAYER,
        width: 2.5,
        alpha,
      });
    }
  }

  private drawEnemies(gl: GameLoop): void {
    for (const e of gl.enemies) {
      if (!e.active) continue;

      // Ranged charge bar
      if (e.type === 'ranged' && e.chargeProgress > 0) {
        const bw = 38, bh = 5;
        const bx = e.x - bw / 2;
        const by = e.y - e.radius - 12;
        this.gfx.roundRect(bx, by, bw, bh, 3);
        this.gfx.fill({ color: 0xd4b0a0 });
        const filled = bw * e.chargeProgress;
        if (filled > 1) {
          this.gfx.roundRect(bx, by, filled, bh, 3);
          this.gfx.fill({ color: e.chargeProgress > 0.75 ? COLORS.RANGED : COLORS.AWARE });
        }
      }

      // Alert pulse (aware cells on detection)
      if (e.alertPulse > 0) {
        const ringR = e.radius + (1 - e.alertPulse) * 22;
        this.gfx.circle(e.x, e.y, ringR);
        this.gfx.stroke({ color: COLORS.AWARE, width: 2, alpha: e.alertPulse * 0.8 });
      }

      if (e.type === 'armoured') {
        this.gfx.circle(e.x, e.y, e.radius);
        this.gfx.stroke({ color: COLORS.ARMOURED, width: 2.5, alpha: e.alpha });
        const sq = e.radius * 0.85 * e.hpFraction;
        if (sq > 1) {
          this.gfx.roundRect(e.x - sq / 2, e.y - sq / 2, sq, sq, sq * 0.22);
          this.gfx.fill({ color: COLORS.ARMOURED_INNER, alpha: e.alpha });
        }
      } else {
        this.gfx.circle(e.x, e.y, e.radius);
        this.gfx.fill({ color: e.color, alpha: e.alpha });
      }

      if (e.hitFlashAlpha > 0) {
        this.gfx.circle(e.x, e.y, e.radius);
        this.gfx.fill({ color: 0xffffff, alpha: e.hitFlashAlpha * 0.75 });
      }
    }
  }

  private drawProjectiles(gl: GameLoop): void {
    for (const p of gl.projectiles) {
      this.gfx.circle(p.x, p.y, p.radius);
      this.gfx.fill({ color: p.owner === 'player' ? COLORS.PLAYER_PROJ : COLORS.PROJECTILE });
    }
  }

  private drawParticles(gl: GameLoop): void {
    for (const p of gl.particles) {
      const alpha = p.life / p.maxLife;
      this.gfx.circle(p.x, p.y, p.radius * alpha);
      this.gfx.fill({ color: COLORS.BUBBLE, alpha });
    }
  }

  private drawPlayer(gl: GameLoop, mouseX: number, mouseY: number): void {
    const color = gl.playerHitFlash ? COLORS.RANGED : COLORS.PLAYER;
    this.gfx.circle(gl.player.x, gl.player.y, gl.player.radius);
    this.gfx.fill({ color });

    // Eye — BG-colored dot that snaps directly toward mouse, no lerp
    const eyeAngle  = Math.atan2(mouseY - gl.player.y, mouseX - gl.player.x);
    const eyeDist   = gl.player.radius * 0.42;
    const ex        = gl.player.x + Math.cos(eyeAngle) * eyeDist;
    const ey        = gl.player.y + Math.sin(eyeAngle) * eyeDist;
    this.gfx.circle(ex, ey, 5);
    this.gfx.fill({ color: COLORS.BG });

    if (gl.player.isShielding) {
      const pulse = 0.55 + 0.35 * Math.sin(this.timeMs / 140);
      const ringR = gl.player.radius + 7 + Math.sin(this.timeMs / 210) * 3;
      this.gfx.circle(gl.player.x, gl.player.y, ringR);
      this.gfx.stroke({ color: COLORS.ACCENT, width: 3, alpha: pulse });
    }
  }

  private syncFloatTexts(gl: GameLoop): void {
    // Remove stale text objects
    for (const [id, t] of this.activeTexts) {
      if (!gl.floatTexts.find(f => f.id === id)) {
        this.textLayer.removeChild(t);
        t.destroy();
        this.activeTexts.delete(id);
      }
    }
    // Add / update active float texts
    for (const ft of gl.floatTexts) {
      let t = this.activeTexts.get(ft.id);
      if (!t) {
        t = new Text({
          text:  ft.text,
          style: { fontFamily: 'monospace', fontSize: 18, fontStyle: 'italic', fill: COLORS.ACCENT },
        });
        this.textLayer.addChild(t);
        this.activeTexts.set(ft.id, t);
      }
      const progress = 1 - ft.life / ft.maxLife;
      t.x     = ft.x - t.width / 2;
      t.y     = ft.y - progress * 52;
      t.alpha = ft.life / ft.maxLife;
    }
  }
}
