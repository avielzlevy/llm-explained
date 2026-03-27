/**
 * Compute the weighted centroid (attention position) from a list of embedded messages.
 *
 * Each message: { x, y, role: 'system' | 'user' | 'assistant', index }
 *
 * Modes:
 *   'equal'        - all messages same weight
 *   'recency'      - exponential decay: recent messages pull harder
 *   'transformer'  - system prompt 2x, U-shaped curve for the rest
 *                    (high at start + end, lower in middle — "lost in the middle")
 */

export const WEIGHT_MODES = {
  EQUAL: 'equal',
  RECENCY: 'recency',
  TRANSFORMER: 'transformer',
};

export function computeAttentionPosition(messages, mode = WEIGHT_MODES.EQUAL) {
  if (messages.length === 0) return null;
  if (messages.length === 1) return { x: messages[0].x, y: messages[0].y, z: messages[0].z ?? 0 };

  const weights = computeWeights(messages, mode);
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < messages.length; i++) {
    x += messages[i].x * weights[i];
    y += messages[i].y * weights[i];
    z += (messages[i].z ?? 0) * weights[i];
  }

  return {
    x: x / totalWeight,
    y: y / totalWeight,
    z: z / totalWeight,
  };
}

// Exported so the UI can use weights for visual scaling (opacity, line thickness)
export function computeWeights(messages, mode) {
  const n = messages.length;

  if (mode === WEIGHT_MODES.EQUAL) {
    return messages.map(() => 1);
  }

  if (mode === WEIGHT_MODES.RECENCY) {
    // Exponential decay: most recent = weight 1, older get e^(-λ*k) where k is steps back
    const lambda = 0.3;
    return messages.map((_, i) => Math.exp(-lambda * (n - 1 - i)));
  }

  if (mode === WEIGHT_MODES.TRANSFORMER) {
    // System prompt gets strong priority (anchors the context)
    // User/assistant: steep U-shape — edges dominate, middle nearly forgotten
    // Research shows ~10x difference between edge and middle tokens ("lost in the middle")
    return messages.map((msg, i) => {
      if (msg.role === 'system') return 3.0;
      const normalizedPos = n > 1 ? i / (n - 1) : 0;
      // Steeper U: raise cosine to power 2 to sharpen the curve
      const uShape = 0.5 + 0.5 * Math.cos(Math.PI * (2 * normalizedPos - 1));
      return 0.08 + Math.pow(uShape, 2) * 1.5; // range [0.08, 1.58] — ~20x difference
    });
  }

  return messages.map(() => 1);
}

/**
 * Detect if movement is a "lunge" (large jump to new semantic area)
 * vs a "drift" (small weighted shift).
 * Returns true if distance > threshold.
 */
export function isLunge(fromPos, toPos, threshold = 0.15) {
  if (!fromPos) return true;
  const dx = toPos.x - fromPos.x;
  const dy = toPos.y - fromPos.y;
  const dz = (toPos.z ?? 0) - (fromPos.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz) > threshold;
}

/**
 * Euclidean distance between two normalized positions.
 */
export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
