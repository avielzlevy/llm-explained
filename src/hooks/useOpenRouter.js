import { useState, useCallback } from 'react';

export const MODELS = [
  { id: 'openai/gpt-4o', label: 'GPT-4o' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { id: 'anthropic/claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
  { id: 'mistralai/mistral-7b-instruct', label: 'Mistral 7B' },
  { id: 'google/gemini-flash-1.5', label: 'Gemini Flash 1.5' },
];

/**
 * Hook for sending messages to OpenRouter and streaming responses back.
 */
export function useOpenRouter() {
  const [streaming, setStreaming] = useState(false);

  const sendMessage = useCallback(async ({
    messages,
    model,
    apiKey,
    onToken,
    onDone,
    onError,
  }) => {
    if (!apiKey) {
      onError?.('No API key provided');
      return;
    }

    setStreaming(true);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'LLM Explained',
        },
        body: JSON.stringify({
          model,
          messages,
          stream: true,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenRouter error ${response.status}: ${err}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) {
              fullText += token;
              onToken?.(token, fullText);
            }
          } catch {
            // Partial JSON chunk, skip
          }
        }
      }

      onDone?.(fullText);
    } catch (err) {
      console.error('OpenRouter request failed:', err);
      onError?.(err.message);
    } finally {
      setStreaming(false);
    }
  }, []);

  return { sendMessage, streaming };
}
