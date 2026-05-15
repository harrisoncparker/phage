# CLAUDE.md

## Commands

```bash
npm run dev      # dev server (localhost:5173)
npm run build    # tsc + vite build → dist/
npm run preview  # serve dist/
```

## Architecture

```
src/
  constants.ts          # all magic numbers — ARENA, COLORS, ENEMY, ORBIT, etc.
  state.ts              # persistent save state, localStorage (key: cell-game-v1)
  App.tsx               # top-level: phase machine (playing | upgrading), scale/pan
  main.tsx              # React root mount

  game/
    GameLoop.ts         # pure game sim: tick(), spawning, collision, scoring
    Renderer.ts         # Pixi.js draw calls — reads GameLoop state, no mutation

  game/entities/
    Player.ts           # orbit physics, shield, attack targeting
    EnemyCell.ts        # per-type AI (wander/aware/ranged/armoured), wall bounce
    Projectile.ts       # straight-line projectile

  components/
    GameCanvas.tsx      # mounts Pixi app, wires mouse + keyboard → GameLoop
    HUD.tsx             # hearts, timer, shield bar
    PauseModal.tsx      # intro / pause overlay
    UpgradeTree.tsx     # upgrade tree UI, pan/drag, burst particles
    upgradeGrid.ts      # grid layout helper — gridPos(col, row) → {x, y}
```

## Key conventions

- **All tuning values live in `constants.ts`** — don't hardcode numbers in entity or renderer files.
- **GameLoop never imports Renderer; Renderer never mutates GameLoop.** One-way data flow.
- **`upgradeGrid.ts`** owns node layout. To move nodes, change `GRID.ORIGIN_X/Y` or `GRID.CELL`, or adjust the `gridPos(col, row)` call in `UpgradeTree.tsx`.
- Save state persists across hot-reloads in dev (localStorage). Use `deleteSave()` from `state.ts` to reset.
- GitHub Pages base is `/cell-game/` — set in `vite.config.ts`. Don't remove it.

## Enemy AI summary

| Type | Movement | Special |
|------|----------|---------|
| oblivious | wander, wall-bounce | — |
| aware | wander until player in range, then chase; escapes if cornered | alert pulse on detection |
| ranged | wander; retreat + fire when player in range | charge bar, configurable cooldown |
| armoured | wander, wall-bounce | high HP, armoured square shrinks with HP |

All enemies use `EDGE_MARGIN = 20` buffer inside arena walls to prevent wall-hugging.

## Upgrade tree

Nodes defined in `UpgradeTree.tsx` (`NODES` array). Each node has `requires: string[]` for prereqs.
Visibility uses fog-of-war: nodes more than `FOG = 3` hops from any unlocked node are hidden.
Grid positions assigned via `gridPos(col, row)` — hub is `(0, 0)`, cell size 160px.
