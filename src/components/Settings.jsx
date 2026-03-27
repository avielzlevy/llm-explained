import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MODELS } from '../hooks/useOpenRouter';
import { WEIGHT_MODES } from '../utils/attention';

const WEIGHT_OPTIONS = [
  { id: WEIGHT_MODES.EQUAL,       label: 'Equal',        desc: 'all messages same weight' },
  { id: WEIGHT_MODES.RECENCY,     label: 'Recency',      desc: 'recent messages pull harder' },
  { id: WEIGHT_MODES.TRANSFORMER, label: 'Transformer',  desc: 'system + U-shape curve' },
];

const panelStyle = {
  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
  width: '300px',
  background: 'var(--paper)',
  border: '1.5px solid var(--ink)',
  padding: '20px',
  zIndex: 50,
  boxShadow: '3px 3px 0 rgba(26,25,22,0.08)',
};

const labelStyle = {
  fontFamily: 'Inter, sans-serif', fontSize: '9px', fontWeight: 600,
  letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)',
  display: 'block', marginBottom: '5px',
};

const inputStyle = {
  width: '100%',
  fontFamily: 'Inter, sans-serif', fontSize: '12px',
  color: 'var(--ink)', background: 'transparent',
  border: 'none', borderBottom: '1px solid rgba(26,25,22,0.15)',
  outline: 'none', padding: '4px 0', borderRadius: 0,
};

export default function Settings({
  apiKey, onApiKeyChange,
  model, onModelChange,
  weightMode, onWeightModeChange,
  systemPrompt, onSystemPromptChange,
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          fontFamily: 'Caveat, cursive', fontSize: '15px', fontWeight: 600,
          color: open ? 'var(--ink)' : 'var(--ink-3)',
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '2px 6px', transition: 'color 0.15s',
          display: 'flex', alignItems: 'center', gap: '4px',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
        </svg>
        settings
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            style={panelStyle}
          >
            {/* Section: API Key */}
            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>OpenRouter API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                placeholder="sk-or-v1-..."
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '11px' }}
              />
            </div>

            {/* Section: Model */}
            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Model</label>
              <select
                value={model}
                onChange={(e) => onModelChange(e.target.value)}
                style={{
                  ...inputStyle,
                  appearance: 'none', cursor: 'pointer',
                  paddingRight: '16px',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%235A5850'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 2px center',
                }}
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Section: Attention Weighting */}
            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Attention Weighting</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {WEIGHT_OPTIONS.map((opt) => {
                  const active = weightMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => onWeightModeChange(opt.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '6px 8px',
                        background: active ? 'rgba(196,0,27,0.05)' : 'transparent',
                        border: `1px solid ${active ? 'var(--red)' : 'rgba(26,25,22,0.1)'}`,
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s',
                      }}
                    >
                      <span style={{
                        width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                        background: active ? 'var(--red)' : 'transparent',
                        border: `1.5px solid ${active ? 'var(--red)' : 'rgba(26,25,22,0.25)'}`,
                        transition: 'all 0.12s',
                      }} />
                      <span style={{
                        fontFamily: 'Caveat, cursive', fontSize: '15px', fontWeight: 600,
                        color: active ? 'var(--red)' : 'var(--ink)',
                      }}>
                        {opt.label}
                      </span>
                      <span style={{
                        fontFamily: 'Inter, sans-serif', fontSize: '10px',
                        color: 'var(--ink-3)', marginLeft: 'auto',
                      }}>
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section: System Prompt */}
            <div>
              <label style={labelStyle}>
                System Prompt
                <span style={{ marginLeft: '4px', color: 'var(--red)', opacity: 0.6, textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>
                  — biases starting attention
                </span>
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => onSystemPromptChange(e.target.value)}
                placeholder="e.g. You are a helpful assistant who loves cats…"
                rows={3}
                style={{
                  ...inputStyle,
                  border: '1px solid rgba(26,25,22,0.12)',
                  padding: '6px 8px',
                  resize: 'vertical', display: 'block',
                  lineHeight: 1.5,
                }}
              />
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: '10px', color: 'var(--ink-3)', marginTop: '5px' }}>
                Gets embedded and given extra weight in the attention centroid.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
