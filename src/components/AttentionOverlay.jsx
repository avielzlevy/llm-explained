import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toCanvasCoords } from '../utils/pca';

const PADDING = 44;
const DOT_R = 9;
const RED = '#C4001B';

export default function AttentionOverlay({ positions, currentPos, isLunge, width, height }) {
  const toSVG = useCallback(
    (nx, ny) => toCanvasCoords(nx, ny, width, height, PADDING),
    [width, height]
  );

  if (!currentPos || width === 0 || height === 0) return null;

  const { cx: tx, cy: ty } = toSVG(currentPos.x, currentPos.y);

  const allPoints = [...positions, currentPos];
  const pathParts = allPoints.map((p) => {
    const { cx, cy } = toSVG(p.x, p.y);
    return `${cx},${cy}`;
  });
  const trailPath = pathParts.length > 1 ? `M ${pathParts.join(' L ')}` : null;

  const prevPos = positions.length > 0 ? positions[positions.length - 1] : null;

  return (
    <svg
      width={width}
      height={height}
      style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}
    >
      <defs>
        {/* Sketch displacement — makes lines slightly wobbly */}
        <filter id="sketch" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="8" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.8" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        {/* Dot glow */}
        <filter id="dot-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Highlight ring blur */}
        <filter id="ring-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* Soft halo behind current position */}
      <circle cx={tx} cy={ty} r={32} fill={RED} opacity={0.04} filter="url(#ring-blur)" />

      {/* Trail line — drawn with sketch displacement */}
      {trailPath && (
        <path
          d={trailPath}
          stroke={RED}
          strokeWidth={2.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter="url(#sketch)"
          opacity={0.75}
        />
      )}

      {/* Lunge flash — bold temporary line for the last jump */}
      {isLunge && prevPos && (
        <LungeFlash
          from={toSVG(prevPos.x, prevPos.y)}
          to={{ cx: tx, cy: ty }}
        />
      )}

      {/* Animated attention dot */}
      <AnimatedDot tx={tx} ty={ty} isLunge={isLunge} />

      {/* Coord annotation near dot */}
      <PositionLabel tx={tx} ty={ty} pos={currentPos} />
    </svg>
  );
}

function AnimatedDot({ tx, ty, isLunge }) {
  const spring = isLunge
    ? { type: 'spring', stiffness: 300, damping: 22, mass: 0.7 }
    : { type: 'spring', stiffness: 55, damping: 22, mass: 1.3 };

  return (
    <motion.g animate={{ x: tx, y: ty }} transition={spring} initial={false}>
      {/* Outer pulse ring */}
      <motion.circle
        r={DOT_R + 5}
        fill="none"
        stroke={RED}
        strokeWidth={1}
        opacity={0.2}
        animate={{ r: [DOT_R + 5, DOT_R + 13], opacity: [0.25, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
      />
      {/* Main dot with glow */}
      <circle r={DOT_R} fill={RED} filter="url(#dot-glow)" />
      {/* Inner white spot for depth */}
      <circle r={DOT_R * 0.32} cx={-2.5} cy={-2.5} fill="rgba(255,255,255,0.55)" />
    </motion.g>
  );
}

function LungeFlash({ from, to }) {
  const [alive, setAlive] = useState(true);

  useEffect(() => {
    setAlive(true);
    const t = setTimeout(() => setAlive(false), 700);
    return () => clearTimeout(t);
  }, [from.cx, from.cy, to.cx, to.cy]);

  if (!alive) return null;

  return (
    <motion.line
      x1={from.cx} y1={from.cy}
      x2={to.cx}   y2={to.cy}
      stroke={RED}
      strokeWidth={5}
      strokeLinecap="round"
      initial={{ opacity: 0.9 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.65, ease: 'easeOut' }}
    />
  );
}

function PositionLabel({ tx, ty, pos }) {
  // Position annotation offset to avoid overlapping the dot
  const offX = tx > 120 ? -14 : 14;
  const offY = ty > 60 ? -18 : 18;

  return (
    <text
      x={tx + offX}
      y={ty + offY}
      textAnchor={offX < 0 ? 'end' : 'start'}
      style={{
        fontFamily: 'Caveat, cursive',
        fontSize: '11px',
        fill: RED,
        opacity: 0.45,
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {pos.x.toFixed(2)}, {pos.y.toFixed(2)}
    </text>
  );
}
