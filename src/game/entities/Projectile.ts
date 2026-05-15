import { ENEMY, ARENA, PLAYER_PROJECTILE_SPEED } from '../../constants';

export class Projectile {
  x: number;
  y: number;
  readonly radius = 5;
  readonly owner:  'player' | 'enemy';
  readonly damage: number;
  expired = false;

  private vx: number;
  private vy: number;

  constructor(
    fromX: number, fromY: number,
    toX:   number, toY:   number,
    owner:  'player' | 'enemy' = 'enemy',
    damage: number = 1,
  ) {
    this.x = fromX;
    this.y = fromY;
    this.owner  = owner;
    this.damage = damage;
    const speed = owner === 'player' ? PLAYER_PROJECTILE_SPEED : ENEMY.RANGED.PROJECTILE_SPEED;
    const dist  = Math.hypot(toX - fromX, toY - fromY) || 1;
    this.vx = (toX - fromX) / dist * speed;
    this.vy = (toY - fromY) / dist * speed;
  }

  update(delta: number): void {
    const dt = delta / 1000;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < 0 || this.x > ARENA.WIDTH || this.y < 0 || this.y > ARENA.HEIGHT) {
      this.expired = true;
    }
  }

  hits(px: number, py: number, pr: number): boolean {
    return Math.hypot(this.x - px, this.y - py) < pr + this.radius;
  }
}
