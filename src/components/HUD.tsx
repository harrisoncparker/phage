import { useEffect, useRef, useState } from 'react';
import { CSS, ARENA } from '../constants';
import { availablePoints } from '../state';
import { GameLoop, type GameSnapshot } from '../game/GameLoop';

const BASE: React.CSSProperties = {
  position:      'absolute',
  fontFamily:    'monospace',
  userSelect:    'none',
  pointerEvents: 'none',
};

export function HUD({ gameLoop }: { gameLoop: GameLoop }) {
  const [snap, setSnap] = useState<GameSnapshot>(gameLoop.getSnapshot());
  const prevScore = useRef(snap.runScore);
  const [scorePop, setScorePop] = useState(false);

  useEffect(() => {
    let raf: number;
    const poll = () => {
      const s = gameLoop.getSnapshot();
      setSnap(s);
      if (s.runScore !== prevScore.current) {
        prevScore.current = s.runScore;
        setScorePop(true);
        setTimeout(() => setScorePop(false), 250);
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [gameLoop]);

  const secs   = Math.ceil(snap.runTimeLeft / 1000);
  const urgent = secs <= 5;

  return (
    <div style={{ position: 'absolute', inset: 0, width: ARENA.WIDTH, height: ARENA.HEIGHT }}>

      {/* Nutrients — top right */}
      <div style={{
        ...BASE, top: 20, right: 24, fontSize: 20, fontStyle: 'italic', color: CSS.ACCENT,
        transform: scorePop ? 'scale(1.18)' : 'scale(1)',
        transition: 'transform 0.12s ease-out',
        transformOrigin: 'right center',
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }}>
         {availablePoints() + snap.runScore} <span style={{ fontSize: 15, color: CSS.TEXT, opacity: 0.6, letterSpacing: 1 }}>NUTRIENTS</span>
      </div>

      {/* Timer — top center */}
      <div style={{
        ...BASE, top: 20, left: '50%',
        transform: `translateX(-50%) ${urgent ? 'scale(1.15)' : 'scale(1)'}`,
        fontSize:   urgent ? 34 : 28,
        color:      urgent ? CSS.RANGED : CSS.TEXT,
        opacity:    urgent ? 1 : 0.7,
        transition: 'color 0.3s, font-size 0.3s',
      }}>
        {secs}s
      </div>

      {/* HP — top left */}
      <div style={{ ...BASE, top: 18, left: 20, display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 15, color: CSS.TEXT, opacity: 0.6, letterSpacing: 1 }}>HP</span>
        {Array.from({ length: snap.maxHearts }, (_, i) => (
          <div
            key={i}
            style={{
              width:        22, height: 22,
              borderRadius: '50%',
              background:   i < snap.hearts ? CSS.HEART : '#c8b0a8',
              transition:   'background 0.1s',
            }}
          />
        ))}
      </div>

      {/* Shield bar — bottom center */}
      {snap.hasShield && (
        <div style={{ ...BASE, bottom: 32, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 10, color: CSS.ACCENT, opacity: snap.isShielding ? 1 : 0.5, letterSpacing: 1.5, transition: 'opacity 0.15s' }}>
            {snap.isShielding ? 'SHIELDING' : 'SHIELD'}
          </div>
          <div style={{ width: 120, height: 5, background: '#c8b0a8', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width:        `${snap.shieldChargeFrac * 100}%`,
              height:       '100%',
              background:   CSS.ACCENT,
              borderRadius: 3,
              opacity:      snap.isShielding ? 1 : 0.55,
              transition:   snap.isShielding ? 'none' : 'width 0.08s linear',
            }} />
          </div>
        </div>
      )}

      {/* Controls — bottom left */}
      <div style={{ ...BASE, bottom: 14, left: 14, fontSize: 12, color: CSS.TEXT, opacity: 0.35 }}>
        MOVE: mouse · ATTACK: automatic{snap.hasShield ? ' · SHIELD: space' : ''}
      </div>
    </div>
  );
}
