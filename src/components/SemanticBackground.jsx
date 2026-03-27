import { useEffect, useRef, useMemo } from 'react';
import { toCanvasCoords } from '../utils/pca';

// Words prominent enough to label
const LABEL_WORDS = new Set([
  'dog', 'cat', 'love', 'fear', 'anger', 'joy', 'computer',
  'food', 'water', 'fire', 'mountain', 'ocean', 'sun', 'moon', 'star',
  'heart', 'brain', 'music', 'art', 'war', 'peace', 'money',
  'tree', 'fish', 'bird', 'death', 'time', 'space',
  'horse', 'wolf', 'flower', 'river', 'rain',
  'school', 'family', 'friend', 'home', 'city', 'world',
  'happy', 'sad', 'run', 'sleep', 'eat', 'fast', 'slow',
]);

const PADDING = 44;

export default function SemanticBackground({ words, width, height }) {
  const canvasRef = useRef(null);

  const wordPoints = useMemo(() => {
    if (!words || width === 0 || height === 0) return [];
    // Seed random jitter consistently per word
    return words.map((w, i) => {
      const { cx, cy } = toCanvasCoords(w.x, w.y, width, height, PADDING);
      const seed = i * 9301 + 49297;
      const jx = (((seed % 233) / 233) - 0.5) * 1.4;
      const jy = (((seed % 197) / 197) - 0.5) * 1.4;
      return { ...w, cx: cx + jx, cy: cy + jy };
    });
  }, [words, width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !wordPoints.length) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    // ── Background paper texture: very faint random noise ──
    // Use ImageData for micro-texture
    const imageData = ctx.createImageData(width, height);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const v = 249 + Math.floor(Math.random() * 4); // 249-252, warm white
      imageData.data[i]     = v;
      imageData.data[i + 1] = v - 1;
      imageData.data[i + 2] = v - 4;
      imageData.data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    // ── Ruled-paper horizontal lines (very subtle) ──
    ctx.strokeStyle = 'rgba(26,25,22,0.04)';
    ctx.lineWidth = 0.5;
    const lineSpacing = 28;
    for (let y = PADDING + 16; y < height - PADDING; y += lineSpacing) {
      ctx.beginPath();
      ctx.moveTo(PADDING, y);
      ctx.lineTo(width - PADDING, y);
      ctx.stroke();
    }

    // ── Red margin line (left) ──
    ctx.strokeStyle = 'rgba(196,0,27,0.08)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(PADDING + 12, PADDING * 0.5);
    ctx.lineTo(PADDING + 12, height - PADDING * 0.5);
    ctx.stroke();

    // ── Word dots ──
    for (const pt of wordPoints) {
      const isLabel = LABEL_WORDS.has(pt.word);
      const r = isLabel ? 1.6 : 1.0;
      const alpha = isLabel ? 0.38 : 0.14;

      ctx.beginPath();
      ctx.arc(pt.cx, pt.cy, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(26,25,22,${alpha})`;
      ctx.fill();
    }

    // ── Word labels (Caveat font, handwritten feel) ──
    ctx.font = '600 11px Caveat, cursive';
    ctx.textBaseline = 'middle';
    for (const pt of wordPoints) {
      if (!LABEL_WORDS.has(pt.word)) continue;
      // slight per-word angle for hand-drawn feel
      const seed = pt.word.charCodeAt(0) * 137;
      const angle = ((seed % 20) - 10) * 0.004; // ±0.04 rad

      ctx.save();
      ctx.translate(pt.cx + 3.5, pt.cy - 3.5);
      ctx.rotate(angle);
      ctx.fillStyle = 'rgba(26,25,22,0.28)';
      ctx.fillText(pt.word, 0, 0);
      ctx.restore();
    }

  }, [wordPoints, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
    />
  );
}
