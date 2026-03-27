import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import SemanticViz from './components/SemanticViz';
import Chat from './components/Chat';
import Settings from './components/Settings';
import { useEmbedding } from './hooks/useEmbedding';
import { useOpenRouter, MODELS } from './hooks/useOpenRouter';
import { computeAttentionPosition, computeWeights, isLunge, WEIGHT_MODES } from './utils/attention';

export default function App() {
  const [semanticMap, setSemanticMap] = useState(null);
  const [mapError, setMapError] = useState(null);

  const embMsgRef = useRef([]);
  const attnPosRef = useRef(null);
  const lastCommittedPosRef = useRef(null);
  const weightModeRef = useRef(WEIGHT_MODES.TRANSFORMER);

  const [embeddedMessages, setEmbeddedMessages] = useState([]);
  const [attentionPos, setAttentionPos] = useState(null);
  const [trailPositions, setTrailPositions] = useState([]);
  const [lastIsLunge, setLastIsLunge] = useState(false);
  const [pulseKey, setPulseKey] = useState(0); // increments on each committed move → triggers pulse

  const [chatMessages, setChatMessages] = useState([]);
  const [streamingText, setStreamingText] = useState('');

  const [apiKey, setApiKey] = useState(() => localStorage.getItem('or_api_key') || '');
  const [model, setModel] = useState(MODELS[0].id);
  const [weightMode, setWeightMode] = useState(WEIGHT_MODES.TRANSFORMER);
  const [systemPrompt, setSystemPrompt] = useState('');

  const { status: embedStatus, progress: embedProgress, embed } = useEmbedding(
    semanticMap ?? null
  );
  const { sendMessage, streaming } = useOpenRouter();

  useEffect(() => { weightModeRef.current = weightMode; }, [weightMode]);
  useEffect(() => { if (apiKey) localStorage.setItem('or_api_key', apiKey); }, [apiKey]);

  useEffect(() => {
    fetch('/semantic_map.json')
      .then((r) => r.json())
      .then(setSemanticMap)
      .catch(() => setMapError('Could not load semantic_map.json. Run the generation script first.'));
  }, []);

  // ── Commit an embedded point: update messages, centroid, trail, pulse ──
  function commitEmbeddedPoint(pos, role) {
    const prev = embMsgRef.current;
    const newMessages = [
      ...prev,
      { ...pos, role, index: prev.filter((m) => m.role !== 'system').length },
    ];
    embMsgRef.current = newMessages;
    setEmbeddedMessages(newMessages);

    const newPos = computeAttentionPosition(newMessages, weightModeRef.current);
    const prevCommitted = lastCommittedPosRef.current;
    const lunged = isLunge(prevCommitted, newPos);

    attnPosRef.current = newPos;
    lastCommittedPosRef.current = newPos;
    setAttentionPos(newPos);
    setLastIsLunge(lunged);
    setPulseKey((k) => k + 1);
    if (prevCommitted) setTrailPositions((t) => [...t, prevCommitted]);
  }

  const handleSend = useCallback(async (text) => {
    if (!text.trim()) return;
    const userMessage = { role: 'user', content: text };
    setChatMessages((prev) => [...prev, userMessage]);

    // ── Move 1: embed user message ──
    if (embedStatus === 'ready') {
      const pos = await embed(text);
      if (pos) commitEmbeddedPoint(pos, 'user');
    }

    const apiMessages = [
      ...(systemPrompt.trim() ? [{ role: 'system', content: systemPrompt }] : []),
      ...chatMessages,
      userMessage,
    ];
    setStreamingText('');

    sendMessage({
      messages: apiMessages,
      model,
      apiKey,
      onToken: (_, full) => setStreamingText(full),
      onDone: async (full) => {
        setStreamingText('');
        const assistantMessage = { role: 'assistant', content: full };
        setChatMessages((prev) => [...prev, assistantMessage]);

        // ── Move 2: embed full response — now includes full history context ──
        // The response mirrors the full conversation in its language, so embedding
        // it captures how context rot is reshaping the attention focus.
        if (embedStatus === 'ready') {
          const pos = await embed(full);
          if (pos) commitEmbeddedPoint(pos, 'assistant');
        }
      },
      onError: (err) => {
        setStreamingText('');
        setChatMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err}` }]);
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedStatus, embed, systemPrompt, chatMessages, model, apiKey]);

  // Re-compute centroid (and clear trail) when weight mode changes
  useEffect(() => {
    const msgs = embMsgRef.current;
    if (msgs.length === 0) return;
    const newPos = computeAttentionPosition(msgs, weightMode);
    attnPosRef.current = newPos;
    lastCommittedPosRef.current = newPos;
    setAttentionPos(newPos);
    setTrailPositions([]);
  }, [weightMode]);

  // Compute per-message weights for visual scaling
  const messageWeights = useMemo(() => {
    if (embeddedMessages.length === 0) return [];
    const raw = computeWeights(embeddedMessages, weightMode);
    const maxW = Math.max(...raw);
    return raw.map((w) => w / maxW); // normalize to [0, 1]
  }, [embeddedMessages, weightMode]);

  const disabled = streaming || embedStatus === 'loading';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: 'var(--paper)', overflow: 'hidden' }}>

      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px 10px 24px',
        borderBottom: '1.5px solid var(--ink)',
        flexShrink: 0, zIndex: 10, background: 'var(--paper)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <span style={{ fontFamily: 'Caveat, cursive', fontSize: '26px', fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>
            LLM Explained
          </span>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '11px', color: 'var(--ink-3)', letterSpacing: '0.02em' }}>
            attention in semantic space
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <EmbedStatus status={embedStatus} progress={embedProgress} />
          <Settings
            apiKey={apiKey} onApiKeyChange={setApiKey}
            model={model} onModelChange={setModel}
            weightMode={weightMode} onWeightModeChange={setWeightMode}
            systemPrompt={systemPrompt} onSystemPromptChange={setSystemPrompt}
          />
        </div>
      </header>

      <div style={{ position: 'relative', flex: '1 1 0', minHeight: 0 }}>
        {mapError ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--red)', fontSize: '13px', padding: '0 32px', textAlign: 'center' }}>
            {mapError}
          </div>
        ) : semanticMap ? (
          <SemanticViz
            words={semanticMap.words}
            embeddedMessages={embeddedMessages}
            messageWeights={messageWeights}
            trailPositions={trailPositions}
            attentionPos={attentionPos}
            isLunge={lastIsLunge}
            weightMode={weightMode}
            pulseKey={pulseKey}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-3)', fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
            loading semantic map...
          </div>
        )}
      </div>

      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: '10px',
        padding: '0 24px', height: '28px',
        borderTop: '1.5px solid var(--ink)', background: 'var(--paper)',
      }}>
        <span style={{ fontFamily: 'Caveat, cursive', fontSize: '13px', color: 'var(--ink-3)' }}>
          conversation
        </span>
        {chatMessages.length > 0 && (
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: 'var(--ink-3)' }}>
            — {chatMessages.length} message{chatMessages.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div style={{ flexShrink: 0, height: '36vh', minHeight: '200px', overflow: 'hidden' }}>
        <Chat messages={chatMessages} streamingText={streamingText} onSend={handleSend} disabled={disabled} />
      </div>
    </div>
  );
}

function EmbedStatus({ status, progress }) {
  const base = { fontFamily: 'Inter, sans-serif', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' };
  if (status === 'ready') return (
    <span style={{ ...base, color: '#2D6A2D' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4A9B4A', display: 'inline-block' }} />
      embedding ready
    </span>
  );
  if (status === 'loading') return (
    <span style={{ ...base, color: '#7A5C00' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C49A00', display: 'inline-block', animation: 'pulse 1s infinite' }} />
      loading model{progress > 0 ? ` ${progress}%` : '…'}
    </span>
  );
  if (status === 'error') return (
    <span style={{ ...base, color: 'var(--red)' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', display: 'inline-block' }} />
      model error
    </span>
  );
  return null;
}
