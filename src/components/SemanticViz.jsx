import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const RED = '#C4001B';
const INK = '#1A1916';
const SCALE = 100;
const LABEL_DIST = 38; // camera distance below which non-landmark labels appear

// ── Shared geometries & materials ──────────────────────────────────────────
const GEO_WORD     = new THREE.IcosahedronGeometry(0.28, 1);
const GEO_LANDMARK = new THREE.IcosahedronGeometry(0.55, 1);
const GEO_ATTENTION = new THREE.IcosahedronGeometry(1.3, 2);
const MAT_WORD     = new THREE.MeshLambertMaterial({ color: INK, transparent: true, opacity: 0.22 });
const MAT_LANDMARK = new THREE.MeshLambertMaterial({ color: INK, transparent: true, opacity: 0.6 });

const WEIGHT_LABELS = { equal: 'equal weight', recency: 'recency weight', transformer: 'transformer weight' };

export default function SemanticViz({
  words, embeddedMessages = [], messageWeights = [], trailPositions = [],
  attentionPos, isLunge, weightMode, pulseKey,
}) {
  const graphRef    = useRef(null);
  const containerRef = useRef(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });

  const labelRenderer = useMemo(() => {
    const r = new CSS2DRenderer();
    r.domElement.style.position = 'absolute';
    r.domElement.style.top = '0';
    r.domElement.style.left = '0';
    r.domElement.style.pointerEvents = 'none';
    return r;
  }, []);

  // Dynamic scene object refs
  const trailLineRef       = useRef(null);
  const messageGroupRef    = useRef(null);
  const attentionMeshRef   = useRef(null);
  const pulseGroupRef      = useRef(null);
  const lungeFlashRef      = useRef(null); // temporary line on lunge

  // Animation state
  const currentPosRef      = useRef(null);
  const targetPosRef       = useRef(null);
  const prevAttentionRef   = useRef(null); // for lunge flash
  const isLungeRef         = useRef(false);
  const animFrameRef       = useRef(null);
  const allLabelsRef       = useRef(null); // collected after scene populates

  useEffect(() => { isLungeRef.current = isLunge; }, [isLunge]);

  // Container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setDims({ w: width, h: height });
    });
    obs.observe(el);
    setDims({ w: el.clientWidth, h: el.clientHeight });
    return () => obs.disconnect();
  }, []);

  // ── Graph data ────────────────────────────────────────────────────────────
  const graphData = useMemo(() => ({
    nodes: (words ?? []).map((w, i) => ({
      id: i, word: w.word, landmark: !!w.landmark,
      fx: w.x * SCALE, fy: w.y * SCALE, fz: (w.z ?? 0) * SCALE,
    })),
    links: [],
  }), [words]);

  // Reset label cache when words change
  useEffect(() => { allLabelsRef.current = null; }, [words]);

  // ── Node renderer ─────────────────────────────────────────────────────────
  const nodeThreeObject = useCallback((node) => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(node.landmark ? GEO_LANDMARK : GEO_WORD,
                             node.landmark ? MAT_LANDMARK : MAT_WORD));

    // All words get a label div; non-landmarks start hidden (toggled by camera dist)
    const div = document.createElement('div');
    div.textContent = node.word;
    Object.assign(div.style, {
      fontFamily: 'Caveat, cursive',
      fontSize: node.landmark ? '11px' : '9px',
      fontWeight: node.landmark ? '600' : '500',
      color: `rgba(26,25,22,${node.landmark ? 0.65 : 0.5})`,
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      textShadow: '0 0 4px rgba(249,248,245,1), 0 0 8px rgba(249,248,245,0.8)',
    });
    const label = new CSS2DObject(div);
    label.position.set(0.7, 0.7, 0);
    label.userData.isLandmark = node.landmark;
    if (!node.landmark) label.visible = false;
    group.add(label);

    return group;
  }, []);

  // ── Scene lighting ────────────────────────────────────────────────────────
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const scene = graph.scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xe8e8f0, 1.3));
    const key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(50, 80, 40);
    scene.add(key);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Trail line ────────────────────────────────────────────────────────────
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const scene = graph.scene();

    if (trailLineRef.current) {
      scene.remove(trailLineRef.current);
      trailLineRef.current.geometry.dispose();
      trailLineRef.current.material.dispose();
      trailLineRef.current = null;
    }

    const pts = [...trailPositions, attentionPos]
      .filter(Boolean)
      .map((p) => new THREE.Vector3(p.x * SCALE, p.y * SCALE, (p.z ?? 0) * SCALE));
    if (pts.length < 2) return;

    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: RED, transparent: true, opacity: 0.6 });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    trailLineRef.current = line;
  }, [trailPositions, attentionPos]);

  // ── Lunge flash: bright red line from prev → new centroid ─────────────────
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !attentionPos) return;
    const scene = graph.scene();

    // Remove previous flash
    if (lungeFlashRef.current) {
      scene.remove(lungeFlashRef.current);
      lungeFlashRef.current.geometry.dispose();
      lungeFlashRef.current.material.dispose();
      lungeFlashRef.current = null;
    }

    if (isLunge && prevAttentionRef.current) {
      const pts = [
        new THREE.Vector3(prevAttentionRef.current.x * SCALE, prevAttentionRef.current.y * SCALE, (prevAttentionRef.current.z ?? 0) * SCALE),
        new THREE.Vector3(attentionPos.x * SCALE, attentionPos.y * SCALE, (attentionPos.z ?? 0) * SCALE),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: RED, transparent: true, opacity: 0.9 });
      const flash = new THREE.Line(geo, mat);
      flash._born = performance.now();
      scene.add(flash);
      lungeFlashRef.current = flash;
    }

    prevAttentionRef.current = attentionPos;
  }, [attentionPos, isLunge]);

  // ── Message dots + pull lines ─────────────────────────────────────────────
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const scene = graph.scene();

    if (messageGroupRef.current) {
      scene.remove(messageGroupRef.current);
      messageGroupRef.current.traverse((obj) => {
        if (obj.isMesh || obj.isLine) {
          obj.geometry?.dispose();
          obj.material?.dispose();
        }
      });
      messageGroupRef.current = null;
    }

    if (embeddedMessages.length === 0) return;

    const group = new THREE.Group();
    embeddedMessages.forEach((msg, i) => {
      const w = messageWeights[i] ?? 1;
      const r = 0.28 + w * 0.5;
      const opacity = 0.1 + w * 0.9;
      const isUser = msg.role === 'user';

      const geo = new THREE.IcosahedronGeometry(r, 1);
      const mat = new THREE.MeshLambertMaterial({ color: isUser ? INK : '#666', transparent: true, opacity });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(msg.x * SCALE, msg.y * SCALE, (msg.z ?? 0) * SCALE);
      group.add(mesh);

      // Pull line to centroid — opacity & thickness reflect weight
      if (attentionPos) {
        const lineOpacity = 0.06 + w * 0.4;
        const pts = [
          new THREE.Vector3(msg.x * SCALE, msg.y * SCALE, (msg.z ?? 0) * SCALE),
          new THREE.Vector3(attentionPos.x * SCALE, attentionPos.y * SCALE, (attentionPos.z ?? 0) * SCALE),
        ];
        const lgeo = new THREE.BufferGeometry().setFromPoints(pts);
        const lmat = new THREE.LineBasicMaterial({
          color: isUser ? INK : RED,
          transparent: true,
          opacity: lineOpacity,
        });
        group.add(new THREE.Line(lgeo, lmat));
      }
    });

    scene.add(group);
    messageGroupRef.current = group;
  }, [embeddedMessages, messageWeights, attentionPos]);

  // ── Attention centroid (created once, position lerped each frame) ─────────
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const scene = graph.scene();

    if (!attentionMeshRef.current) {
      const mat = new THREE.MeshLambertMaterial({ color: RED, emissive: RED, emissiveIntensity: 0.35 });
      const mesh = new THREE.Mesh(GEO_ATTENTION, mat);
      scene.add(mesh);
      attentionMeshRef.current = mesh;

      const pg = new THREE.Group();
      scene.add(pg);
      pulseGroupRef.current = pg;
    }

    if (attentionPos) {
      const t = new THREE.Vector3(attentionPos.x * SCALE, attentionPos.y * SCALE, (attentionPos.z ?? 0) * SCALE);
      targetPosRef.current = t;
      if (!currentPosRef.current) currentPosRef.current = t.clone();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attentionPos]);

  // ── Pulse rings on each commit ────────────────────────────────────────────
  useEffect(() => {
    if (!attentionPos || !pulseGroupRef.current) return;
    const pos = new THREE.Vector3(attentionPos.x * SCALE, attentionPos.y * SCALE, (attentionPos.z ?? 0) * SCALE);

    [{ maxScale: 14, dur: 700 }, { maxScale: 22, dur: 1100, delay: 100 }].forEach(({ maxScale, dur, delay = 0 }) => {
      const geo = new THREE.SphereGeometry(1.5, 12, 8);
      const mat = new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.5, wireframe: true });
      const ring = new THREE.Mesh(geo, mat);
      ring.position.copy(pos);
      ring._startTime = performance.now() + delay;
      ring._maxScale = maxScale;
      ring._duration = dur;
      pulseGroupRef.current.add(ring);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseKey]);

  // ── Main animation loop ───────────────────────────────────────────────────
  useEffect(() => {
    function tick() {
      animFrameRef.current = requestAnimationFrame(tick);
      const graph = graphRef.current;
      if (!graph) return;
      const now = performance.now();

      // Collect CSS2D labels once after scene is populated
      if (!allLabelsRef.current) {
        const labels = [];
        graph.scene().traverse((obj) => { if (obj.isCSS2DObject) labels.push(obj); });
        if (labels.length > 0) allLabelsRef.current = labels;
      }

      // Zoom-based label visibility: show non-landmark labels when camera is close
      if (allLabelsRef.current) {
        const camera = graph.camera();
        const camPos = camera.position;
        allLabelsRef.current.forEach((label) => {
          if (label.userData.isLandmark) return;
          const wp = new THREE.Vector3();
          label.getWorldPosition(wp);
          label.visible = camPos.distanceTo(wp) < LABEL_DIST;
        });
      }

      // Lerp centroid position
      if (currentPosRef.current && targetPosRef.current && attentionMeshRef.current) {
        currentPosRef.current.lerp(targetPosRef.current, isLungeRef.current ? 0.14 : 0.06);
        attentionMeshRef.current.position.copy(currentPosRef.current);
      }

      // Animate pulse rings
      if (pulseGroupRef.current) {
        const dead = [];
        pulseGroupRef.current.children.forEach((ring) => {
          const elapsed = now - ring._startTime;
          if (elapsed < 0) return;
          const t = elapsed / ring._duration;
          if (t >= 1) { dead.push(ring); return; }
          ring.scale.setScalar(1 + t * ring._maxScale);
          ring.material.opacity = 0.45 * (1 - t);
        });
        dead.forEach((r) => {
          pulseGroupRef.current.remove(r);
          r.geometry.dispose();
          r.material.dispose();
        });
      }

      // Fade lunge flash
      if (lungeFlashRef.current) {
        const t = (now - lungeFlashRef.current._born) / 600;
        if (t >= 1) {
          graph.scene().remove(lungeFlashRef.current);
          lungeFlashRef.current.geometry.dispose();
          lungeFlashRef.current.material.dispose();
          lungeFlashRef.current = null;
        } else {
          lungeFlashRef.current.material.opacity = 0.9 * (1 - t);
        }
      }
    }

    tick();
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, []);

  // ── Middle mouse: lock orbit onto nearest word node ───────────────────────
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 1) return;
    e.preventDefault();
    const graph = graphRef.current;
    if (!graph) return;
    const controls = graph.controls();
    const camera   = graph.camera();
    const renderer = graph.renderer();
    if (!controls || !camera || !renderer) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    let best = null;
    let bestDist = Infinity;
    (words ?? []).forEach((w) => {
      const pt = new THREE.Vector3(w.x * SCALE, w.y * SCALE, (w.z ?? 0) * SCALE);
      const d = raycaster.ray.distanceToPoint(pt);
      if (d < bestDist) { bestDist = d; best = pt; }
    });

    if (best && bestDist < 20) controls.target.copy(best);
  }, [words]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}
      onMouseDown={handleMouseDown}
    >
      <ForceGraph3D
        ref={graphRef}
        graphData={graphData}
        width={dims.w}
        height={dims.h}
        backgroundColor="#F9F8F5"
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        nodeLabel={() => ''}
        linkVisibility={false}
        d3AlphaDecay={1}
        d3VelocityDecay={1}
        cooldownTicks={0}
        enableNodeDrag={false}
        extraRenderers={[labelRenderer]}
      />

      <div style={{
        position: 'absolute', bottom: 16, left: 20,
        display: 'flex', flexDirection: 'column', gap: 6, pointerEvents: 'none',
      }}>
        <LegendRow color={RED}    label="attention centroid" />
        <LegendRow color={INK}    label="user message" />
        <LegendRow color="#666"   label="assistant message" />
        <div style={{ marginTop: 4, fontFamily: 'Caveat, cursive', fontSize: 12, color: 'rgba(26,25,22,0.38)' }}>
          {WEIGHT_LABELS[weightMode] ?? weightMode}
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'rgba(26,25,22,0.28)', marginTop: 2 }}>
          drag · scroll zoom · M3 lock orbit
        </div>
      </div>
    </div>
  );
}

function LegendRow({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontFamily: 'Caveat, cursive', fontSize: 12, color: 'rgba(26,25,22,0.38)' }}>
        {label}
      </span>
    </div>
  );
}
