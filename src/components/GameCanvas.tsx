import { useEffect, useRef } from 'react';
import { Application } from 'pixi.js';
import { ARENA, COLORS } from '../constants';
import { GameLoop, type RunEndInfo } from '../game/GameLoop';
import { Renderer } from '../game/Renderer';
import { updateMusic } from '../game/Music';

interface Props {
  gameLoop: GameLoop;
  onRunEnd: (info: RunEndInfo) => void;
  paused:   boolean;
}

export function GameCanvas({ gameLoop, onRunEnd, paused }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameLoopRef  = useRef(gameLoop);
  const onRunEndRef  = useRef(onRunEnd);
  const pausedRef    = useRef(paused);

  useEffect(() => {
    gameLoopRef.current = gameLoop;
    gameLoopRef.current.onRunEnd = (info) => onRunEndRef.current(info);
  }, [gameLoop]);

  useEffect(() => { onRunEndRef.current = onRunEnd; }, [onRunEnd]);
  useEffect(() => { pausedRef.current   = paused;   }, [paused]);

  useEffect(() => {
    let app: Application;
    let renderer: Renderer;
    let mounted = true;

    (async () => {
      app = new Application();
      await app.init({
        width:       ARENA.WIDTH,
        height:      ARENA.HEIGHT,
        background:  COLORS.BG,
        antialias:   true,
        autoDensity: true,
        resolution:  window.devicePixelRatio || 1,
      });

      if (!mounted) { app.destroy(true); return; }
      containerRef.current!.appendChild(app.canvas);

      renderer = new Renderer(app);
      gameLoopRef.current.onRunEnd = (info) => onRunEndRef.current(info);

      // Mouse tracking — converts client coords to world space
      const mouse = { x: ARENA.WIDTH / 2, y: ARENA.HEIGHT / 2 };
      const toWorld = (cx: number, cy: number) => {
        const rect = app.canvas.getBoundingClientRect();
        return {
          x: (cx - rect.left) / rect.width  * ARENA.WIDTH,
          y: (cy - rect.top)  / rect.height * ARENA.HEIGHT,
        };
      };
      const onMove = (e: MouseEvent) => {
        const w = toWorld(e.clientX, e.clientY);
        mouse.x = w.x;
        mouse.y = w.y;
      };

      // Space key hold state for shield
      const keys = { space: false };
      const onKeyDown = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); keys.space = true; } };
      const onKeyUp   = (e: KeyboardEvent) => { if (e.code === 'Space') keys.space = false; };

      app.canvas.addEventListener('mousemove', onMove);
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup',   onKeyUp);

      // Main loop
      app.ticker.add(({ deltaMS }) => {
        const gl = gameLoopRef.current;

        if (gl.phase === 'over' || pausedRef.current) {
          // Fade dynamic layers to zero while pad keeps playing
          updateMusic({ enemyCount: 0, hearts: 99, maxHearts: 99, inCountdown: false });
          return;
        }

        gl.tick(deltaMS, mouse.x, mouse.y, keys.space);
        renderer.draw(gl, mouse.x, mouse.y, deltaMS);

        updateMusic({
          enemyCount:  gl.enemies.length,
          hearts:      gl.player.currentHearts,
          maxHearts:   gl.player.maxHearts,
          inCountdown: gl.countdownDigit > 0,
        });
      });

      return () => {
        app.canvas.removeEventListener('mousemove', onMove);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup',   onKeyUp);
        renderer.destroy();
        app.destroy(true);
      };
    })().then(cleanup => { if (!mounted && cleanup) cleanup(); });

    return () => { mounted = false; };
  }, []);

  return <div ref={containerRef} style={{ width: ARENA.WIDTH, height: ARENA.HEIGHT }} />;
}
