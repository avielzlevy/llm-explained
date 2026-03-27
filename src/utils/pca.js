/**
 * Project a new embedding into the pre-computed UMAP space via k-NN interpolation.
 *
 * Steps:
 *   1. Project the 384D embedding into 32D PCA space (same transform used to build the map)
 *   2. Find the k nearest word vectors in 32D (Euclidean distance)
 *   3. Return the inverse-distance-weighted average of their UMAP 2D coordinates
 *
 * This lets us place new text in UMAP space without running UMAP at inference time.
 */
export function projectEmbeddingKNN(embedding, semanticMap, k = 5) {
  const { words, projection } = semanticMap;
  const { pca_mean, pca_components, word_vectors } = projection;
  const dim = pca_mean.length; // 384
  const pcaDim = pca_components.length; // 32
  const n = word_vectors.length;

  // 1. Center and project to 32D PCA space
  const coords32 = new Float32Array(pcaDim);
  for (let j = 0; j < pcaDim; j++) {
    const comp = pca_components[j];
    let dot = 0;
    for (let i = 0; i < dim; i++) {
      dot += (embedding[i] - pca_mean[i]) * comp[i];
    }
    coords32[j] = dot;
  }

  // 2. Compute Euclidean distances to all stored word vectors (32D)
  const dists = new Float32Array(n);
  for (let wi = 0; wi < n; wi++) {
    const wv = word_vectors[wi];
    let d2 = 0;
    for (let j = 0; j < pcaDim; j++) {
      const diff = coords32[j] - wv[j];
      d2 += diff * diff;
    }
    dists[wi] = Math.sqrt(d2);
  }

  // 3. Find k nearest indices
  const indices = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => dists[a] - dists[b])
    .slice(0, k);

  // 4. Inverse-distance-weighted average of their UMAP 2D positions
  const weights = indices.map((i) => 1 / (dists[i] + 1e-8));
  const totalW = weights.reduce((s, w) => s + w, 0);

  let x = 0;
  let y = 0;
  let z = 0;
  for (let ki = 0; ki < k; ki++) {
    const wi = indices[ki];
    const w = weights[ki] / totalW;
    x += words[wi].x * w;
    y += words[wi].y * w;
    z += (words[wi].z ?? 0) * w;
  }

  return { x, y, z };
}

/**
 * Convert normalized [-1,1] coords to canvas pixel coords.
 */
export function toCanvasCoords(nx, ny, width, height, padding = 40) {
  const w = width - padding * 2;
  const h = height - padding * 2;
  return {
    cx: padding + ((nx + 1) / 2) * w,
    cy: padding + ((1 - ny) / 2) * h, // flip Y so +y is up
  };
}

/**
 * Convert canvas pixel coords back to normalized [-1,1].
 */
export function toNormCoords(cx, cy, width, height, padding = 40) {
  const w = width - padding * 2;
  const h = height - padding * 2;
  return {
    x: ((cx - padding) / w) * 2 - 1,
    y: 1 - ((cy - padding) / h) * 2,
  };
}
