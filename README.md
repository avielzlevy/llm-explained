<p align="center">
  <!-- TODO: Add a logo or hero screenshot/GIF here -->
  <!-- Recommended: a GIF of the 3D visualization in action -->
</p>

<h1 align="center">LLM Explained</h1>

<p align="center">
  <em>An interactive 3D visualization that shows how language models pay attention to your conversation</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/Three.js-0.183-black?style=flat-square&logo=three.js" alt="Three.js">
  <img src="https://img.shields.io/badge/HuggingFace-Transformers-yellow?style=flat-square&logo=huggingface" alt="Hugging Face">
  <img src="https://img.shields.io/badge/Vite-8-646cff?style=flat-square&logo=vite" alt="Vite">
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#how-it-works">How It Works</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#contributing">Contributing</a>
</p>

---

<!-- TODO: Replace with an actual screenshot or demo GIF of the 3D visualization -->
<p align="center">
  <img src="docs/demo.gif" alt="LLM Explained demo showing 3D semantic space with attention centroid moving as conversation progresses" width="95%">
</p>

---

LLM Explained makes the invisible mechanics of large language models visible. As you chat, each message is embedded into a semantic space using a real transformer model running entirely in your browser — no data leaves your machine. A glowing centroid moves through a 3D word map showing you exactly where the model's "attention" is focused, and how that focus shifts as your conversation grows.

It demonstrates three phenomena that researchers have documented in real LLMs: context decay, the **lost in the middle** effect, and how system prompts anchor initial attention. The app runs the `all-MiniLM-L6-v2` embedding model via WebAssembly and connects to any LLM through [OpenRouter](https://openrouter.ai).

## Features

- **Live semantic embeddings** — Each message is embedded in the browser using `all-MiniLM-L6-v2` (384 dimensions, projected to 3D via k-NN)
- **Interactive 3D word map** — 10,000+ landmark words plotted in semantic space; drag to rotate, scroll to zoom
- **Attention centroid** — A weighted average of all message embeddings visualized as a moving point with a history trail
- **Three attention modes** — Equal weight, recency decay, and a U-shaped transformer-style curve that reproduces the "lost in the middle" effect
- **Real LLM chat** — Streams responses from GPT-4o, Claude Sonnet, Llama 3.3, Gemini Flash, and more via OpenRouter
- **Lunge detection** — Flashes when attention makes a large contextual jump between messages
- **Hand-drawn aesthetic** — Notebook paper design with the Caveat font, rough SVG effects, and ruled lines

## Quick Start

**Prerequisites:** Node.js 18+

```bash
# Clone and install
git clone https://github.com/avielzlevy/llm-explained.git
cd llm-explained
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The embedding model (~23 MB) downloads and caches in your browser on first load.

> [!NOTE]
> To enable the chat feature, you need a free API key from [openrouter.ai](https://openrouter.ai). Enter it in the Settings panel — it's stored only in your browser's `localStorage`.

> [!NOTE]
> The semantic map (`public/semantic_map.json`) is pre-generated and included in the repo. If you want to regenerate it or customize the word list, see [Regenerating the Semantic Map](#regenerating-the-semantic-map).

## How It Works

When you send a message:

1. The browser runs `all-MiniLM-L6-v2` (via `@huggingface/transformers`) to produce a 384-dimensional embedding
2. That embedding is projected to 32D using a precomputed PCA transform, then to 3D via k-NN interpolation against the semantic map
3. Your message appears as a colored sphere in the 3D word cloud at its semantic coordinates
4. The **attention centroid** — a weighted average of all message positions — moves to reflect the conversation's current focus
5. Pull lines from each message to the centroid show relative weight (thicker = more influential)

### Attention Modes

| Mode | Description |
|------|-------------|
| **Equal** | Every message contributes equally to the centroid |
| **Recency** | Exponential decay — recent messages dominate |
| **Transformer** | U-shaped curve: first and last messages get ~20× more weight than middle ones, replicating the "lost in the middle" phenomenon |

The system prompt always receives a 3× weight multiplier in Transformer mode, reflecting how real models treat instructions.

## Usage

**Chat panel** — Type a message and press Enter. Each exchange (user + assistant) is embedded and placed in the 3D space.

**3D visualization** — Drag to orbit, scroll to zoom. Zoom in close to a cluster to reveal individual word labels. The centroid pulse and trail update after every message.

**Settings panel** — Configure your OpenRouter API key, choose a model, switch attention modes, or set a system prompt to see how it biases the starting attention position.

<details>
<summary>Supported models</summary>

| Model | Provider |
|-------|----------|
| GPT-4o | OpenAI |
| Claude 3.5 Sonnet | Anthropic |
| Llama 3.3 70B | Meta |
| Mistral 7B Instruct | Mistral |
| Gemini Flash 1.5 | Google |
| Phi-3 Mini | Microsoft |

All routed through [OpenRouter](https://openrouter.ai).

</details>

## Regenerating the Semantic Map

The semantic map is a JSON file of ~10,000 words with their PCA-projected 3D coordinates. It's prebuilt and checked in, but you can regenerate it with a different word list:

```bash
# Install Python dependencies (one time)
pip install sentence-transformers scikit-learn numpy umap-learn

# Regenerate public/semantic_map.json
python scripts/generate_semantic_map.py
```

The script embeds the word list, runs UMAP to produce 3D coordinates, and computes a PCA transform for fast browser-side projection.

## Development

```bash
npm run dev      # Start dev server with HMR at localhost:5173
npm run build    # Production build to dist/
npm run preview  # Preview production build locally
npm run lint     # Run ESLint
```

**Stack:** React 19 · Vite 8 · TailwindCSS 4 · Three.js · react-force-graph-3d · Framer Motion · @huggingface/transformers

## Contributing

Contributions are welcome. Open an issue to discuss ideas before submitting a pull request for significant changes.

## License

[MIT](LICENSE)
