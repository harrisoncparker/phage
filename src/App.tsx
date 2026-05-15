import { useState, useCallback, useEffect } from 'react';
import { ARENA, CSS } from './constants';
import { saveState, saveWasReset } from './state';
import { GameLoop, type RunEndInfo } from './game/GameLoop';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { UpgradeTree } from './components/UpgradeTree';
import { PauseModal } from './components/PauseModal';
import { unlockAudio } from './game/Sound';
import { startMusic, pauseMusic, resumeMusic } from './game/Music';

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
  const [soundLocked,    setSoundLocked]    = useState(true);
  const [showResetNote,  setShowResetNote]  = useState(saveWasReset);

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
    resumeMusic();
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

  // Pause on window/tab blur
  useEffect(() => {
    const pause = () => {
      if (phase !== 'playing') return;
      setShowModal(true);
      pauseMusic();
    };
    const onVisibility = () => { if (document.hidden) pause(); };

    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [phase]);

  useEffect(() => {
    const padding = phase === 'playing' ? PLAY_PADDING : 0;
    setScale(computeScale(padding));
    const onResize = () => setScale(computeScale(padding));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [phase]);

  // Start backing track on first interaction — permanent for session
  useEffect(() => {
    const handleFirstClick = () => {
      setSoundLocked(false);
      unlockAudio().then(() => startMusic());
      window.removeEventListener('mousedown', handleFirstClick);
    };
    window.addEventListener('mousedown', handleFirstClick);
    return () => window.removeEventListener('mousedown', handleFirstClick);
  }, []);

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

      {showResetNote && (
        <div
          onClick={() => setShowResetNote(false)}
          style={{
            position:       'absolute',
            inset:          0,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            backdropFilter: 'blur(6px)',
            background:     'rgba(238,216,199,0.72)',
            zIndex:         200,
            cursor:         'pointer',
          }}
        >
          <div style={{
            fontFamily:   'monospace',
            textAlign:    'center',
            color:        CSS.TEXT,
            padding:      '32px 44px',
            background:   CSS.BG,
            borderRadius: 18,
            boxShadow:    '0 8px 48px rgba(38,70,83,0.22)',
            maxWidth:     380,
          }}>
            <div style={{ fontSize: 11, letterSpacing: 4, opacity: 0.4, marginBottom: 14 }}>
              NOTICE
            </div>
            <div style={{ fontSize: 15, fontWeight: 'bold', letterSpacing: 1, marginBottom: 16 }}>
              Save data reset
            </div>
            <div style={{ fontSize: 13, opacity: 0.6, lineHeight: 1.7, marginBottom: 24 }}>
              Your progress has been cleared as part of an update during playtesting. Thanks for playing — your feedback helps!
            </div>
            <div style={{ fontSize: 11, letterSpacing: 2, opacity: 0.35 }}>
              CLICK TO CONTINUE
            </div>
          </div>
        </div>
      )}

      {soundLocked && !paused && (
        <div style={{
          position:      'absolute',
          bottom:        20,
          left:          '50%',
          transform:     'translateX(-50%)',
          fontSize:      11,
          letterSpacing: 2,
          color:         CSS.TEXT,
          opacity:       0.38,
          pointerEvents: 'none',
        }}>
          CLICK FOR SOUND
        </div>
      )}
    </div>
  );
}
