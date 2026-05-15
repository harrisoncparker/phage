import { useState, useEffect } from 'react';
import { CSS } from '../constants';
import { saveState, availablePoints, deleteSave } from '../state';

interface Props {
  isIntro: boolean;
  onResume: () => void;
}

type Tab = 'save' | 'controls' | 'settings';

const CONTROLS: [string, string][] = [
  ['MOVE',   'aim mouse · player orbits cursor'],
  ['ATTACK', 'automatic — aim ring at prey'],
  ['PAUSE',  'ESC'],
];

// ── Shared styles ─────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position:       'absolute', inset: 0,
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  backdropFilter: 'blur(6px)',
  background:     'rgba(238,216,199,0.55)',
  zIndex:         100,
};

const modalBase: React.CSSProperties = {
  background:   CSS.BG,
  borderRadius: 18,
  padding:      '32px 44px 36px',
  boxShadow:    '0 8px 48px rgba(38,70,83,0.22), 0 2px 12px rgba(38,70,83,0.12)',
  width:        420,
  fontFamily:   'monospace',
  color:        CSS.TEXT,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ResumeButton({ label, onResume }: { label: string; onResume: () => void }) {
  return (
    <div
      onClick={onResume}
      style={{
        textAlign:    'center',
        marginTop:    24,
        padding:      '10px 0',
        border:       `1.5px solid ${CSS.PLAYER}`,
        borderRadius: 8,
        fontSize:     15,
        letterSpacing: 2,
        color:        CSS.PLAYER,
        cursor:       'pointer',
        transition:   'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = CSS.PLAYER + '16')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {label}
    </div>
  );
}

function ControlsGrid() {
  return (
    <div style={{ background: `${CSS.PLAYER}08`, borderRadius: 8, padding: '14px 20px' }}>
      {CONTROLS.map(([key, val]) => (
        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
          <span style={{ color: CSS.ACCENT, letterSpacing: 1 }}>{key}</span>
          <span style={{ opacity: 0.55 }}>{val}</span>
        </div>
      ))}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
      <span style={{ opacity: 0.5, letterSpacing: 0.5 }}>{label}</span>
      <span style={{ color: CSS.PLAYER, fontWeight: 'bold' }}>{value}</span>
    </div>
  );
}

// ── Tab content ───────────────────────────────────────────────────────────────

function SaveTab() {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = () => {
    deleteSave();
    window.location.reload();
  };

  return (
    <div>
      <div style={{ background: `${CSS.PLAYER}08`, borderRadius: 8, padding: '14px 20px', marginBottom: 20 }}>
        <StatRow label="RUNS COMPLETED"       value={saveState.runCount} />
        <StatRow label="NUTRIENTS EARNED"     value={saveState.totalPoints} />
        <StatRow label="NUTRIENTS AVAILABLE"  value={availablePoints()} />
        <StatRow label="UPGRADES UNLOCKED"    value={saveState.unlockedNodes.size} />
      </div>

      {!confirmDelete ? (
        <div
          onClick={() => setConfirmDelete(true)}
          style={{
            textAlign:    'center',
            padding:      '8px 0',
            border:       `1px solid ${CSS.RANGED}55`,
            borderRadius: 7,
            fontSize:     12,
            letterSpacing: 1.5,
            color:        CSS.RANGED,
            opacity:      0.7,
            cursor:       'pointer',
            transition:   'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
        >
          DELETE SAVE
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: CSS.RANGED, marginBottom: 12, letterSpacing: 0.5 }}>
            Delete all progress? This cannot be undone.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div
              onClick={handleDelete}
              style={{ flex: 1, textAlign: 'center', padding: '8px 0', background: CSS.RANGED + '18', border: `1px solid ${CSS.RANGED}`, borderRadius: 7, fontSize: 12, letterSpacing: 1, color: CSS.RANGED, cursor: 'pointer' }}
            >
              YES, DELETE
            </div>
            <div
              onClick={() => setConfirmDelete(false)}
              style={{ flex: 1, textAlign: 'center', padding: '8px 0', border: `1px solid ${CSS.PLAYER}44`, borderRadius: 7, fontSize: 12, letterSpacing: 1, color: CSS.TEXT, opacity: 0.6, cursor: 'pointer' }}
            >
              CANCEL
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  return (
    <div style={{ textAlign: 'center', padding: '28px 0', fontSize: 13, opacity: 0.35, letterSpacing: 1 }}>
      COMING SOON
    </div>
  );
}

// ── Modal variants ────────────────────────────────────────────────────────────

function IntroModal({ onResume }: { onResume: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); onResume(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onResume]);

  return (
    <div style={overlay}>
      <div style={{ ...modalBase, textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: 4, opacity: 0.4, marginBottom: 12 }}>
          CELL GAME
        </div>
        <div style={{ fontSize: 28, fontWeight: 'bold', letterSpacing: 3, marginBottom: 32 }}>
          NUTRIENT HUNT
        </div>
        <ResumeButton label="[ START HUNT ]" onResume={onResume} />
        <div style={{ fontSize: 11, opacity: 0.28, marginTop: 14, letterSpacing: 1.5 }}>
          SPACE TO START
        </div>
      </div>
    </div>
  );
}

function PauseMenuModal({ onResume }: { onResume: () => void }) {
  const [tab, setTab] = useState<Tab>('save');

  return (
    <div style={overlay}>
      <div style={modalBase}>
        <div style={{ textAlign: 'center', fontSize: 11, letterSpacing: 4, opacity: 0.4, marginBottom: 20 }}>
          PAUSED
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${CSS.PLAYER}22`, marginBottom: 20 }}>
          {(['save', 'controls', 'settings'] as Tab[]).map(t => {
            const labels: Record<Tab, string> = { save: 'SAVE', controls: 'CONTROLS', settings: 'SETTINGS' };
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex:           1,
                  background:     'none',
                  border:         'none',
                  borderBottom:   active ? `2px solid ${CSS.ACCENT}` : '2px solid transparent',
                  padding:        '6px 0 10px',
                  fontFamily:     'monospace',
                  fontSize:       11,
                  letterSpacing:  2,
                  color:          active ? CSS.ACCENT : CSS.TEXT,
                  opacity:        active ? 1 : 0.4,
                  cursor:         'pointer',
                  marginBottom:   -1,
                }}
              >
                {labels[t]}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {tab === 'save'     && <SaveTab />}
        {tab === 'controls' && <ControlsGrid />}
        {tab === 'settings' && <SettingsTab />}

        <ResumeButton label="[ RESUME ]" onResume={onResume} />
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export function PauseModal({ isIntro, onResume }: Props) {
  return isIntro
    ? <IntroModal    onResume={onResume} />
    : <PauseMenuModal onResume={onResume} />;
}
