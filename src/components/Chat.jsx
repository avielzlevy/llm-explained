import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Chat({ messages, streamingText, onSend, disabled }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  function handleSubmit(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || disabled) return;
    setInput('');
    onSend(text);
  }

  const isEmpty = messages.length === 0 && !streamingText;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--paper)' }}>

      {/* Message list */}
      <div style={{
        flex: '1 1 0', minHeight: 0, overflowY: 'auto',
        padding: '12px 20px 8px 20px',
        display: 'flex', flexDirection: 'column', gap: '8px',
      }}>
        {isEmpty && (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Caveat, cursive', fontSize: '15px',
            color: 'rgba(26,25,22,0.2)', userSelect: 'none',
          }}>
            start typing to watch attention shift ↑
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
            >
              {msg.role === 'user' ? (
                <UserBubble text={msg.content} />
              ) : (
                <AssistantBubble text={msg.content} />
              )}
            </motion.div>
          ))}

          {streamingText && (
            <motion.div
              key="streaming"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', justifyContent: 'flex-start' }}
            >
              <AssistantBubble text={streamingText} streaming />
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <form
        onSubmit={handleSubmit}
        style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 20px 10px 20px',
          borderTop: '1px solid var(--rule)',
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything — watch the dot move…"
          disabled={disabled}
          style={{
            flex: 1,
            fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 400,
            color: 'var(--ink)',
            background: 'transparent',
            border: 'none', outline: 'none',
            padding: '6px 0',
            borderBottom: '1.5px solid rgba(26,25,22,0.15)',
            borderRadius: 0,
            transition: 'border-color 0.15s',
            opacity: disabled ? 0.4 : 1,
          }}
          onFocus={(e) => { e.target.style.borderBottomColor = 'var(--ink)'; }}
          onBlur={(e) => { e.target.style.borderBottomColor = 'rgba(26,25,22,0.15)'; }}
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          style={{
            fontFamily: 'Caveat, cursive', fontSize: '16px', fontWeight: 700,
            color: input.trim() && !disabled ? 'var(--ink)' : 'var(--ink-3)',
            background: 'none', border: 'none', cursor: input.trim() && !disabled ? 'pointer' : 'default',
            padding: '4px 8px', transition: 'color 0.15s',
            letterSpacing: '-0.2px',
          }}
        >
          send →
        </button>
      </form>
    </div>
  );
}

function UserBubble({ text }) {
  return (
    <div style={{
      maxWidth: '72%',
      fontFamily: 'Inter, sans-serif', fontSize: '12.5px', lineHeight: 1.6,
      color: 'var(--paper)',
      background: 'var(--ink)',
      padding: '7px 12px',
      borderRadius: '3px 3px 0 3px',
    }}>
      {text}
    </div>
  );
}

function AssistantBubble({ text, streaming }) {
  return (
    <div style={{
      maxWidth: '80%',
      fontFamily: 'Inter, sans-serif', fontSize: '12.5px', lineHeight: 1.6,
      color: 'var(--ink)',
      borderLeft: '2px solid var(--red)',
      paddingLeft: '10px',
      paddingRight: '4px',
    }}>
      {text}
      {streaming && (
        <span style={{
          display: 'inline-block', width: '6px', height: '12px',
          background: 'var(--ink-3)', marginLeft: '2px',
          verticalAlign: 'middle', animation: 'pulse 0.8s infinite',
        }} />
      )}
    </div>
  );
}
