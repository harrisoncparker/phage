import { useState, useCallback, useEffect } from 'react';
import { ARENA, CSS } from './constants';
import { saveState } from './state';
import { GameLoop, type RunEndInfo } from './game/GameLoop';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { UpgradeTree } from './components/UpgradeTree';
import { PauseModal } from './components/PauseModal';

type Phase = 'playing' | 'upgrading';

const PLAY_PADDING = 20;

function computeScale(padding = 0) {
  return Math.min(
    (window.innerWidth  - padding * 2) / ARENA.WIDTH,
    (window.innerHeight - padding * 2) / ARENA.HEIGHT,
  );
}

export function App() {
  const [phase,          setPhase]          = useState<Phase>('playing');
  const [endInfo,        setEndInfo]        = useState<RunEndInfo | null>(null);
  const [gameLoop,       setGameLoop]       = useState(() => new GameLoop());
  const [showModal,      setShowModal]      = useState(() => saveState.runCount === 0);
  const [isFirstLaunch,  setIsFirstLaunch]  = useState(() => saveState.runCount === 0);
  const [scale,          setScale]          = useState(() => computeScale(PLAY_PADDING));

  const handleRunEnd = useCallback((info: RunEndInfo) => {
    setEndInfo(info);
    setPhase('upgrading');
    setShowModal(false);
  }, []);

  const handlePlayAgain = useCallback(() => {
    setGameLoop(new GameLoop());
    setPhase('playing');
  }, []);

  const handleResume = useCallback(() => {
    setShowModal(false);
    setIsFirstLaunch(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      if (phase !== 'playing') return;
      setShowModal(v => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  useEffect(() => {
    const padding = phase === 'playing' ? PLAY_PADDING : 0;
    setScale(computeScale(padding));
    const onResize = () => setScale(computeScale(padding));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [phase]);

  const paused = phase === 'playing' && showModal;

  return (
    <div style={{
      width:           ARENA.WIDTH,
      height:          ARENA.HEIGHT,
      position:        'relative',
      transform:       `scale(${scale})`,
      transformOrigin: 'center center',
      background:      CSS.BG,
      overflow:        'hidden',
    }}>
      <GameCanvas gameLoop={gameLoop} onRunEnd={handleRunEnd} paused={paused} />

      {phase === 'playing' && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <HUD gameLoop={gameLoop} />
        </div>
      )}

      {phase === 'upgrading' && endInfo && (
        <UpgradeTree endInfo={endInfo} onPlayAgain={handlePlayAgain} />
      )}

      {paused && (
        <PauseModal isIntro={isFirstLaunch} onResume={handleResume} />
      )}
    </div>
  );
}
