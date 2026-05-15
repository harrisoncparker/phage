# PHAGE

A browser-based incremental predator cell game. Survive timed runs, earn nutrients, and spend them on a persistent upgrade tree between runs.

**Play:** https://harrisoncparker.github.io/cell-game/

## Gameplay

- Your cell orbits the mouse cursor — aim by moving the mouse
- Kill enemies to earn nutrients; dying loses 75% of that run's haul
- Between runs, spend nutrients on the upgrade tree
- Survive until the timer runs out, or die trying

### Controls

| Input | Action |
|-------|--------|
| Mouse | Aim / orbit target |
| Space (hold) | Shield (requires unlock) |
| Esc | Pause |

### Enemy types

| Enemy | Behaviour |
|-------|-----------|
| Oblivious | Wanders randomly |
| Aware | Chases when you get close |
| Ranged | Retreats and fires projectiles |
| Armoured | Slow, high HP, armoured square shrinks as it takes damage |

## Stack

- **Vite** — build tooling
- **React** — UI (HUD, upgrade tree, pause modal)
- **Pixi.js** — game canvas rendering
- **TypeScript** throughout

## Development

```bash
npm install
npm run dev       # localhost:5173
npm run build     # production build → dist/
npm run preview   # preview the built output
```

## Deploy

Pushing to `main` auto-deploys to GitHub Pages via `.github/workflows/deploy.yml`.
