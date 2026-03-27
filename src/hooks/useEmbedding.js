import { useState, useEffect, useRef, useCallback } from 'react';
import { projectEmbeddingKNN } from '../utils/pca';

/**
 * Loads the all-MiniLM-L6-v2 model via @huggingface/transformers (runs in browser).
 * Provides a function to embed text and project it into the pre-computed UMAP space
 * via k-NN interpolation in 32D PCA space.
 */
export function useEmbedding(semanticMap) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'ready' | 'error'
  const [progress, setProgress] = useState(0);
  const pipelineRef = useRef(null);

  useEffect(() => {
    if (!semanticMap?.projection) return;

    let cancelled = false;

    async function loadModel() {
      setStatus('loading');
      try {
        // Dynamic import to avoid SSR issues and allow Vite to handle the module
        const { pipeline, env } = await import('@huggingface/transformers');

        // Allow loading from HuggingFace hub (cached in browser IndexedDB)
        env.allowLocalModels = false;
        env.useBrowserCache = true;

        const pipe = await pipeline(
          'feature-extraction',
          'Xenova/all-MiniLM-L6-v2',
          {
            progress_callback: (progressInfo) => {
              if (progressInfo.status === 'downloading') {
                setProgress(Math.round((progressInfo.loaded / progressInfo.total) * 100) || 0);
              }
            },
          }
        );

        if (!cancelled) {
          pipelineRef.current = pipe;
          setStatus('ready');
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load embedding model:', err);
          setStatus('error');
        }
      }
    }

    loadModel();
    return () => { cancelled = true; };
  }, [semanticMap]);

  const embed = useCallback(async (text) => {
    if (!pipelineRef.current || !semanticMap?.projection) return null;

    try {
      const output = await pipelineRef.current(text, {
        pooling: 'mean',
        normalize: true,
      });

      // output.data is a Float32Array of shape [384]
      const embedding = Array.from(output.data);
      const pos = projectEmbeddingKNN(embedding, semanticMap);
      console.log(`[embed] "${text}" → x=${pos.x.toFixed(3)}, y=${pos.y.toFixed(3)}`);
      return pos;
    } catch (err) {
      console.error('Embedding failed:', err);
      return null;
    }
  }, [semanticMap]);

  return { status, progress, embed };
}
