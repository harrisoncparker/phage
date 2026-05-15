import { useState, useRef } from 'react';
import { CSS, ARENA } from '../constants';
import { gridPos } from './upgradeGrid';
import { saveState, availablePoints, spendPoints, persistSave } from '../state';
import type { RunEndInfo } from '../game/GameLoop';
import { SFX } from '../game/Sound';

interface TreeNode {
  id:          string;
  label:       string;
  description: string;
  cost:        number;
  requires:    string[];
  apply:       () => void;
}

const NODES: TreeNode[] = [
  // Tier 1
  { id: 'speed_1',  label: 'Speed I',    description: '+20 move speed',        cost: 5,  requires: [],           apply: () => { saveState.stats.speed += 20; } },
  { id: 'attack_1', label: 'Attack I',   description: '+5 damage',             cost: 5,  requires: [],           apply: () => { saveState.stats.attack += 5; } },
  { id: 'range_1',  label: 'Range I',    description: '+30 orbit radius',      cost: 6,  requires: [],           apply: () => { saveState.stats.range += 30; } },
  { id: 'time_1',   label: 'Time +5s',   description: '+5s run duration',      cost: 10, requires: [],           apply: () => { saveState.stats.bonusTime += 5000; } },
  // Tier 2
  { id: 'speed_2',  label: 'Speed II',   description: '+20 move speed',        cost: 12, requires: ['speed_1'],  apply: () => { saveState.stats.speed += 20; } },
  { id: 'hearts_1', label: '+1 Heart',   description: 'Max hearts +1',         cost: 20, requires: ['speed_1'],  apply: () => { saveState.stats.maxHearts += 1; } },
  { id: 'attack_2', label: 'Attack II',  description: '+8 damage',             cost: 14, requires: ['attack_1'], apply: () => { saveState.stats.attack += 8; } },
  { id: 'rate_1',   label: 'Rate I',     description: '+0.4 attacks/s',        cost: 8,  requires: ['attack_1'], apply: () => { saveState.stats.rate += 0.4; } },
  { id: 'range_2',  label: 'Range II',   description: '+30 orbit radius',      cost: 15, requires: ['range_1'],  apply: () => { saveState.stats.range += 30; } },
  { id: 'time_2',   label: 'Time +5s',   description: '+5s run duration',      cost: 22, requires: ['time_1'],   apply: () => { saveState.stats.bonusTime += 5000; } },
  // Tier 3
  { id: 'speed_3',  label: 'Speed III',  description: '+20 move speed',        cost: 25, requires: ['speed_2'],  apply: () => { saveState.stats.speed += 20; } },
  { id: 'hearts_2', label: '+1 Heart',   description: 'Max hearts +1',         cost: 40, requires: ['hearts_1'], apply: () => { saveState.stats.maxHearts += 1; } },
  { id: 'shield_1', label: 'Shield',     description: 'Unlock shield (Space)', cost: 30, requires: ['hearts_1'], apply: () => { saveState.stats.shieldCapacity = 3000; } },
  { id: 'attack_3', label: 'Attack III', description: '+8 damage',             cost: 28, requires: ['attack_2'], apply: () => { saveState.stats.attack += 8; } },
  { id: 'rate_2',   label: 'Rate II',    description: '+0.4 attacks/s',        cost: 20, requires: ['rate_1'],   apply: () => { saveState.stats.rate += 0.4; } },
  { id: 'range_3',  label: 'Range III',  description: '+30 orbit radius',      cost: 25, requires: ['range_2'],  apply: () => { saveState.stats.range += 30; } },
  { id: 'time_3',   label: 'Time +5s',   description: '+5s run duration',      cost: 40, requires: ['time_2'],   apply: () => { saveState.stats.bonusTime += 5000; } },
  { id: 'shield_2', label: 'Shield II',  description: '+2s shield charge',     cost: 20, requires: ['shield_1'], apply: () => { saveState.stats.shieldCapacity += 2000; } },
];

const HUB_POS   = gridPos(0, 0);
const HUB_TIER1 = ['speed_1', 'attack_1', 'range_1', 'time_1'];

const GRID_POS: Record<string, { x: number; y: number }> = {
  // Speed — west, branches up into hearts/shield
  speed_1:  gridPos(-1,  0),
  speed_2:  gridPos(-2,  0),
  speed_3:  gridPos(-3,  0),
  hearts_1: gridPos(-1, -1),
  hearts_2: gridPos(-2, -1),
  shield_1: gridPos(-1, -2),
  shield_2: gridPos(-2, -2),

  // Attack — north, then branches east
  attack_1: gridPos( 0, -1),
  attack_2: gridPos( 0, -2),
  attack_3: gridPos( 1, -2),
  rate_1:   gridPos( 1, -1),
  rate_2:   gridPos( 2, -1),

  // Range — east then L-turn down-right
  range_1:  gridPos( 1,  0),
  range_2:  gridPos( 1,  1),
  range_3:  gridPos( 2,  1),

  // Time — south then L-turn left-down
  time_1:   gridPos( 0,  1),
  time_2:   gridPos(-1,  1),
  time_3:   gridPos(-1,  2),
};

const NODE_SIZE = 52;
const HALF      = NODE_SIZE / 2;
const FOG       = 3;
const EDGE_GAP  = HALF + 30; // 30px clear of node edge

type NodeState = 'unlocked' | 'available' | 'prereq_met' | 'locked' | 'hidden';

function computeStates(unlocked: Set<string>): Map<string, NodeState> {
  const result = new Map<string, NodeState>();
  const depth  = new Map<string, number>();
  const queue: { id: string; d: number }[] = [];

  for (const n of NODES) {
    if (unlocked.has(n.id)) {
      depth.set(n.id, 0);
      queue.push({ id: n.id, d: 0 });
      result.set(n.id, 'unlocked');
    }
  }
  for (const n of NODES) {
    if (n.requires.length === 0 && !depth.has(n.id)) {
      depth.set(n.id, 0);
      queue.push({ id: n.id, d: 0 });
    }
  }
  while (queue.length) {
    const { id, d } = queue.shift()!;
    for (const n of NODES) {
      if (depth.has(n.id)) continue;
      if (n.requires.includes(id)) {
        depth.set(n.id, d + 1);
        queue.push({ id: n.id, d: d + 1 });
      }
    }
  }
  for (const [id, d] of depth) {
    if (result.has(id)) continue;
    if (d > FOG) { result.set(id, 'hidden'); continue; }
    const n         = NODES.find(x => x.id === id)!;
    const prereqMet = n.requires.every(r => unlocked.has(r));
    const canAfford = availablePoints() >= n.cost;
    if (prereqMet && canAfford)  result.set(id, 'available');
    else if (prereqMet)          result.set(id, 'prereq_met');
    else                         result.set(id, 'locked');
  }
  return result;
}

function edgePath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return '';
  const ux = dx / dist;
  const uy = dy / dist;
  return `M ${from.x + ux * EDGE_GAP} ${from.y + uy * EDGE_GAP} L ${to.x - ux * EDGE_GAP} ${to.y - uy * EDGE_GAP}`;
}

function nodeColor(state: NodeState): string {
  if (state === 'unlocked')   return CSS.PLAYER;
  if (state === 'available')  return CSS.ACCENT;
  if (state === 'prereq_met') return '#5a8a96';
  return '#6a8290';
}

function edgeStroke(from: NodeState, to: NodeState): { color: string; opacity: number } {
  if (from === 'unlocked' && to === 'unlocked')   return { color: CSS.PLAYER, opacity: 0.65 };
  if (from === 'unlocked' && to === 'available')  return { color: CSS.ACCENT,  opacity: 0.6  };
  if (from === 'unlocked' && to === 'prereq_met') return { color: CSS.ACCENT,  opacity: 0.35 };
  return { color: '#5a7282', opacity: 0.25 };
}

interface BurstParticle { angle: number; dist: number }
interface Burst { id: number; x: number; y: number; particles: BurstParticle[] }
let _burstId = 0;

function mkBurst(x: number, y: number): Burst {
  return {
    id: _burstId++, x, y,
    particles: Array.from({ length: 12 }, (_, i) => ({
      angle: (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
      dist:  36 + Math.random() * 28,
    })),
  };
}

export function UpgradeTree({ endInfo, onPlayAgain }: { endInfo: RunEndInfo; onPlayAgain: () => void }) {
  const { rawScore, earned, reason } = endInfo;
  const [, forceRender] = useState(0);
  const [tooltip,    setTooltip]    = useState('');
  const [bursts,     setBursts]     = useState<Burst[]>([]);
  const [pan,        setPan]        = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);

  const unlocked = saveState.unlockedNodes;
  const states   = computeStates(unlocked);

  const purchase = (node: TreeNode, x: number, y: number) => {
    if (!spendPoints(node.cost)) return;
    unlocked.add(node.id);
    node.apply();
    persistSave();
    SFX.upgradeUnlock();
    const b = mkBurst(x, y);
    setBursts(prev => [...prev, b]);
    setTimeout(() => setBursts(prev => prev.filter(p => p.id !== b.id)), 600);
    forceRender(n => n + 1);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
    setIsDragging(true);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    setPan({
      x: dragRef.current.px + e.clientX - dragRef.current.sx,
      y: dragRef.current.py + e.clientY - dragRef.current.sy,
    });
  };
  const onMouseUp = () => { dragRef.current = null; setIsDragging(false); };

  const edgePaths = (
    <>
      {HUB_TIER1.map(id => {
        const to = GRID_POS[id];
        if (!to) return null;
        const ts = states.get(id);
        if (!ts || ts === 'hidden') return null;
        const { color, opacity } = edgeStroke('unlocked', ts);
        return (
          <path key={`hub-${id}`} d={edgePath(HUB_POS, to)}
            fill="none" stroke={color} strokeWidth={3.5}
            strokeOpacity={opacity} strokeLinecap="round" />
        );
      })}
      {NODES.flatMap(node =>
        node.requires.map(reqId => {
          const from = GRID_POS[reqId];
          const to   = GRID_POS[node.id];
          if (!from || !to) return null;
          const fs = states.get(reqId);
          const ts = states.get(node.id);
          if (!fs || !ts || fs === 'hidden' || ts === 'hidden') return null;
          const { color, opacity } = edgeStroke(fs, ts);
          return (
            <path key={`${reqId}-${node.id}`} d={edgePath(from, to)}
              fill="none" stroke={color} strokeWidth={3.5}
              strokeOpacity={opacity} strokeLinecap="round" />
          );
        })
      )}
    </>
  );

  return (
    <div
      style={{
        position:   'absolute', inset: 0,
        width:      ARENA.WIDTH, height: ARENA.HEIGHT,
        background: CSS.BG,
        fontFamily: 'monospace',
        color:      CSS.TEXT,
        overflow:   'hidden',
        cursor:     isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <style>{`
        @keyframes bp { 0% { opacity:1; transform:translate(-50%,-50%) scale(1); } 100% { opacity:0; transform:translate(var(--bx),var(--by)) scale(0.2); } }
        .bp { position:absolute; width:7px; height:7px; border-radius:2px; background:${CSS.ACCENT}; animation:bp 0.55s ease-out forwards; pointer-events:none; }
      `}</style>

      {/* Fixed: header */}
      <div style={{ position:'relative', zIndex:10, pointerEvents:'none' }}>
        <div style={{ textAlign:'center', paddingTop:20, fontSize:22, letterSpacing:3, opacity:0.65 }}>
          UPGRADES
        </div>
        {reason === 'death' ? (
          <div style={{ textAlign:'center', marginTop:6 }}>
            <div style={{ fontSize:14, color:CSS.RANGED, fontWeight:'bold', letterSpacing:1 }}>YOU DIED</div>
            <div style={{ fontSize:12, color:CSS.TEXT, opacity:0.55, marginTop:2 }}>
              {rawScore} nutrients — 75% lost on death
            </div>
            <div style={{ fontSize:14, color:CSS.ACCENT, marginTop:3 }}>+{earned} kept</div>
          </div>
        ) : (
          <div style={{ textAlign:'center', fontSize:13, color:CSS.ACCENT, marginTop:6 }}>
            +{earned} nutrients this run
          </div>
        )}
        <div style={{ textAlign:'center', fontSize:15, marginTop:5 }}>
          <strong style={{ color:CSS.PLAYER }}>{availablePoints()}</strong>
          <span style={{ opacity:0.45, marginLeft:6 }}>nutrients</span>
        </div>
      </div>

      {/* Pannable layer */}
      <div style={{ position:'absolute', inset:0, transform:`translate(${pan.x}px,${pan.y}px)` }}>

        {/* Edges SVG */}
        <svg style={{ position:'absolute', top:0, left:0, width:ARENA.WIDTH, height:ARENA.HEIGHT, pointerEvents:'none' }}>
          {edgePaths}
        </svg>

        {/* Hub */}
        <div style={{
          position:     'absolute',
          left:         HUB_POS.x - HALF,
          top:          HUB_POS.y - HALF,
          width:        NODE_SIZE,
          height:       NODE_SIZE,
          borderRadius: '50%',
          background:   CSS.ACCENT,
          pointerEvents: 'none',
        }} />

        {/* Nodes */}
        {NODES.map(node => {
          const state = states.get(node.id);
          if (!state || state === 'hidden') return null;
          const pos = GRID_POS[node.id];
          if (!pos) return null;

          const isUnlocked  = state === 'unlocked';
          const isAvailable = state === 'available';
          const isPrereqMet = state === 'prereq_met';
          const isLocked    = state === 'locked';
          const col = nodeColor(state);

          return (
            <div key={node.id}>
              <div
                onClick={() => isAvailable && purchase(node, pos.x, pos.y)}
                onMouseEnter={() => setTooltip(
                  isUnlocked  ? node.label :
                  isAvailable ? `${node.label} — ${node.cost} nutrients` :
                  isPrereqMet ? `${node.label} — ${node.cost} nutrients (need ${node.cost - availablePoints()} more)` :
                                `${node.label} — locked`
                )}
                onMouseLeave={() => setTooltip('')}
                style={{
                  position:       'absolute',
                  left:           pos.x - HALF,
                  top:            pos.y - HALF,
                  width:          NODE_SIZE,
                  height:         NODE_SIZE,
                  borderRadius:   11,
                  background:     col,
                  opacity:        isLocked ? 0.35 : 1,
                  cursor:         isAvailable ? 'pointer' : 'grab',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  fontSize:       isAvailable ? 15 : 13,
                  fontWeight:     'bold',
                  color:          isUnlocked ? CSS.BG : 'rgba(255,255,255,0.9)',
                  userSelect:     'none',
                  transition:     'opacity 0.15s, transform 0.12s, box-shadow 0.15s',
                  transform:      isAvailable ? 'scale(1.1)' : 'scale(1)',
                  boxShadow:      isAvailable ? `0 0 0 3px ${CSS.ACCENT}60, 0 4px 16px ${CSS.ACCENT}30` : 'none',
                }}
              >
                {isUnlocked ? '✓' : (!isLocked ? node.cost : '')}
              </div>
              <div style={{
                position:      'absolute',
                left:          pos.x - 52,
                top:           pos.y + HALF + 6,
                width:         104,
                textAlign:     'center',
                fontSize:      10,
                letterSpacing: 0.5,
                color:         col,
                opacity:       isLocked ? 0.3 : 0.7,
                pointerEvents: 'none',
              }}>
                {node.label}
              </div>
            </div>
          );
        })}

        {/* Burst particles */}
        {bursts.flatMap(burst =>
          burst.particles.map((p, i) => (
            <div
              key={`${burst.id}-${i}`}
              className="bp"
              style={{
                left: burst.x,
                top:  burst.y,
                animationDelay: `${i * 18}ms`,
                '--bx': `calc(${(Math.cos(p.angle) * p.dist).toFixed(1)}px - 50%)`,
                '--by': `calc(${(Math.sin(p.angle) * p.dist).toFixed(1)}px - 50%)`,
              } as React.CSSProperties}
            />
          ))
        )}
      </div>

      {/* Fixed: tooltip */}
      {tooltip && (
        <div style={{
          position:      'absolute', bottom:52, left:'50%',
          transform:     'translateX(-50%)',
          fontSize:      13, color:CSS.TEXT, opacity:0.55,
          pointerEvents: 'none',
          whiteSpace:    'nowrap',
          zIndex:        20,
        }}>
          {tooltip}
        </div>
      )}

      {/* Fixed: hunt again */}
      <div
        onClick={onPlayAgain}
        style={{
          position:     'absolute', bottom:18, right:20,
          fontSize:     17, color:CSS.PLAYER,
          cursor:       'pointer',
          padding:      '6px 14px',
          border:       `1px solid ${CSS.PLAYER}`,
          borderRadius: 6,
          letterSpacing: 1,
          transition:   'background 0.15s',
          zIndex:       20,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = CSS.PLAYER + '18')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        [ HUNT AGAIN ]
      </div>
    </div>
  );
}
