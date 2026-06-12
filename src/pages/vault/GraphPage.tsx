import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GRAPH_STYLES, setPrefs, usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";
import { useVault } from "@/lib/vault";

interface GNode extends SimulationNodeDatum {
  id: string;
  title: string;
  degree: number;
}
type GLink = SimulationLinkDatum<GNode>;

function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function GraphPage() {
  const { notes, linksOf } = useVault();
  const navigate = useNavigate();
  const { graphStyle } = usePrefs();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const graph = useMemo(() => {
    const degree = new Map<string, number>();
    const links: { source: string; target: string }[] = [];
    for (const n of notes) {
      for (const t of linksOf.get(n.id) ?? []) {
        links.push({ source: n.id, target: t });
        degree.set(n.id, (degree.get(n.id) ?? 0) + 1);
        degree.set(t, (degree.get(t) ?? 0) + 1);
      }
    }
    const nodes: GNode[] = notes.map(n => ({
      id: n.id,
      title: n.title,
      degree: degree.get(n.id) ?? 0,
    }));
    return { nodes, links };
  }, [notes, linksOf]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = wrap.clientWidth;
    let height = wrap.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    const view = { x: 0, y: 0, k: 1 };
    let hoveredNode: GNode | null = null;
    let dragNode: GNode | null = null;
    let panning = false;
    let lastPointer = { x: 0, y: 0 };

    const nodes: GNode[] = graph.nodes.map(n => ({ ...n }));
    const links: GLink[] = graph.links.map(l => ({ ...l }));

    const sim: Simulation<GNode, GLink> = forceSimulation(nodes)
      .force(
        "link",
        forceLink<GNode, GLink>(links)
          .id(d => d.id)
          .distance(110)
          .strength(0.5),
      )
      .force("charge", forceManyBody().strength(-260))
      .force("center", forceCenter(0, 0))
      .force(
        "collide",
        forceCollide<GNode>().radius(d => radius(d) + 14),
      );

    function radius(d: GNode): number {
      return 6 + Math.min(10, d.degree * 2);
    }

    function resize() {
      if (!wrap || !canvas) return;
      width = wrap.clientWidth;
      height = wrap.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    resize();

    const styleOf = () => {
      const cs = getComputedStyle(document.documentElement);
      const primary = cs.getPropertyValue("--primary").trim() || "#7c3aed";
      const fg = cs.getPropertyValue("--foreground").trim() || "#ddd";
      const bg = cs.getPropertyValue("--background").trim() || "#1a1626";
      return { primary, fg, bg };
    };

    function toWorld(px: number, py: number) {
      return {
        x: (px - width / 2 - view.x) / view.k,
        y: (py - height / 2 - view.y) / view.k,
      };
    }

    function findNode(px: number, py: number): GNode | null {
      const { x, y } = toWorld(px, py);
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const dx = x - (n.x ?? 0);
        const dy = y - (n.y ?? 0);
        if (dx * dx + dy * dy <= (radius(n) + 4) ** 2) return n;
      }
      return null;
    }

    // ── shape paths ──

    function shardPath(x: number, y: number, r: number, seed: number) {
      if (!ctx) return;
      const rng = mulberry32(seed);
      const k = 5 + Math.floor(rng() * 3);
      const rot = rng() * Math.PI * 2;
      ctx.beginPath();
      for (let i = 0; i < k; i++) {
        const ang = rot + (i / k) * Math.PI * 2 + (rng() - 0.5) * 0.55;
        const rad = r * (0.8 + rng() * 0.55);
        const px = x + Math.cos(ang) * rad;
        const py = y + Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }

    function hexPath(x: number, y: number, r: number) {
      if (!ctx) return;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const px = x + Math.cos(ang) * r * 1.15;
        const py = y + Math.sin(ang) * r * 1.15;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }

    function starPath(x: number, y: number, r: number) {
      if (!ctx) return;
      const o = r * 1.35;
      const inn = r * 0.32;
      ctx.beginPath();
      ctx.moveTo(x, y - o);
      ctx.quadraticCurveTo(x + inn, y - inn, x + o, y);
      ctx.quadraticCurveTo(x + inn, y + inn, x, y + o);
      ctx.quadraticCurveTo(x - inn, y + inn, x - o, y);
      ctx.quadraticCurveTo(x - inn, y - inn, x, y - o);
      ctx.closePath();
    }

    function drawNode(n: GNode, dim: boolean, s: ReturnType<typeof styleOf>) {
      if (!ctx) return;
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      const r = radius(n);
      ctx.save();
      ctx.globalAlpha = dim ? 0.3 : 1;

      if (graphStyle === "crystal") {
        const seed = hashSeed(n.id);
        shardPath(x, y, r, seed);
        ctx.fillStyle = s.primary;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 1;
        ctx.stroke();
        // inner facets
        const rng = mulberry32(seed ^ 0xbeef);
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 0.7;
        for (let i = 0; i < 2; i++) {
          const ang = rng() * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(ang) * r * 1.1, y + Math.sin(ang) * r * 1.1);
          ctx.stroke();
        }
      } else if (graphStyle === "neon") {
        ctx.shadowColor = s.primary;
        ctx.shadowBlur = 18;
        ctx.fillStyle = s.bg;
        ctx.strokeStyle = s.primary;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = s.primary;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else if (graphStyle === "stars") {
        ctx.shadowColor = s.primary;
        ctx.shadowBlur = 10;
        starPath(x, y, r);
        ctx.fillStyle = s.primary;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.arc(x, y, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
      } else if (graphStyle === "hex") {
        hexPath(x, y, r);
        ctx.fillStyle = s.primary;
        ctx.fill();
        ctx.strokeStyle = s.bg;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = s.primary;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (hoveredNode?.id === n.id) {
        ctx.strokeStyle = s.primary;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.35 + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    function drawLink(l: GLink, hi: boolean, s: ReturnType<typeof styleOf>) {
      if (!ctx) return;
      const a = l.source as GNode;
      const b = l.target as GNode;
      const ax = a.x ?? 0;
      const ay = a.y ?? 0;
      const bx = b.x ?? 0;
      const by = b.y ?? 0;
      ctx.save();
      ctx.strokeStyle = s.primary;
      ctx.globalAlpha = hi ? 0.85 : 0.25;
      ctx.lineWidth = hi ? 1.8 : 1;

      if (graphStyle === "crystal") {
        // jagged two-segment fracture line
        const seed = hashSeed(a.id) ^ hashSeed(b.id);
        const rng = mulberry32(seed);
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy) || 1;
        const off = (rng() - 0.5) * Math.min(26, len * 0.3);
        const px = mx + (-dy / len) * off;
        const py = my + (dx / len) * off;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(px, py);
        ctx.lineTo(bx, by);
        ctx.stroke();
      } else if (graphStyle === "neon") {
        ctx.shadowColor = s.primary;
        ctx.shadowBlur = hi ? 12 : 6;
        ctx.globalAlpha = hi ? 0.9 : 0.4;
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy) || 1;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(
          mx + (-dy / len) * len * 0.12,
          my + (dx / len) * len * 0.12,
          bx,
          by,
        );
        ctx.stroke();
      } else if (graphStyle === "stars") {
        ctx.setLineDash([2, 6]);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (graphStyle === "hex") {
        ctx.globalAlpha = hi ? 0.6 : 0.14;
        ctx.lineWidth = hi ? 5 : 4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
      ctx.restore();
    }

    function draw() {
      if (!ctx) return;
      const s = styleOf();
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);
      ctx.translate(width / 2 + view.x, height / 2 + view.y);
      ctx.scale(view.k, view.k);

      const neighbors = new Set<string>();
      if (hoveredNode) {
        neighbors.add(hoveredNode.id);
        for (const l of links) {
          const sId = (l.source as GNode).id;
          const tId = (l.target as GNode).id;
          if (sId === hoveredNode.id) neighbors.add(tId);
          if (tId === hoveredNode.id) neighbors.add(sId);
        }
      }

      for (const l of links) {
        const a = l.source as GNode;
        const b = l.target as GNode;
        const hi = Boolean(
          hoveredNode && (a.id === hoveredNode.id || b.id === hoveredNode.id),
        );
        drawLink(l, hi, s);
      }

      for (const n of nodes) {
        const dim = Boolean(hoveredNode && !neighbors.has(n.id));
        drawNode(n, dim, s);
        const r = radius(n);
        const fontSize = Math.max(11, 12 / Math.sqrt(view.k));
        ctx.font = `${fontSize}px ui-sans-serif, system-ui`;
        ctx.textAlign = "center";
        ctx.save();
        ctx.globalAlpha = dim ? 0.3 : 0.85;
        ctx.fillStyle = s.fg;
        const title =
          n.title.length > 24 ? `${n.title.slice(0, 24)}…` : n.title;
        ctx.fillText(title, n.x ?? 0, (n.y ?? 0) + r + fontSize + 6);
        ctx.restore();
      }
      ctx.restore();
    }

    sim.on("tick", draw);

    function onPointerDown(e: PointerEvent) {
      const rect = canvas?.getBoundingClientRect();
      if (!rect) return;
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      lastPointer = { x: px, y: py };
      const n = findNode(px, py);
      if (n) {
        dragNode = n;
        sim.alphaTarget(0.3).restart();
        const w = toWorld(px, py);
        n.fx = w.x;
        n.fy = w.y;
      } else {
        panning = true;
      }
      canvas?.setPointerCapture(e.pointerId);
    }

    let moved = false;
    function onPointerMove(e: PointerEvent) {
      const rect = canvas?.getBoundingClientRect();
      if (!rect) return;
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const dx = px - lastPointer.x;
      const dy = py - lastPointer.y;
      if (e.buttons) moved = moved || Math.abs(dx) + Math.abs(dy) > 3;

      if (dragNode) {
        const w = toWorld(px, py);
        dragNode.fx = w.x;
        dragNode.fy = w.y;
      } else if (panning) {
        view.x += dx;
        view.y += dy;
        draw();
      } else {
        const n = findNode(px, py);
        if (n?.id !== hoveredNode?.id) {
          hoveredNode = n;
          setHovered(n?.title ?? null);
          if (canvas) canvas.style.cursor = n ? "pointer" : "grab";
          draw();
        }
      }
      lastPointer = { x: px, y: py };
    }

    function onPointerUp(e: PointerEvent) {
      if (dragNode) {
        dragNode.fx = null;
        dragNode.fy = null;
        sim.alphaTarget(0);
      }
      if (!moved) {
        const rect = canvas?.getBoundingClientRect();
        if (rect) {
          const n = findNode(e.clientX - rect.left, e.clientY - rect.top);
          if (n) navigate(`/note/${n.id}`);
        }
      }
      dragNode = null;
      panning = false;
      moved = false;
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const nk = Math.min(4, Math.max(0.25, view.k * factor));
      view.k = nk;
      draw();
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    const ro = new ResizeObserver(() => {
      resize();
      draw();
    });
    ro.observe(wrap);

    return () => {
      sim.stop();
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [graph, navigate, graphStyle]);

  const linkCount = graph.links.length;

  return (
    <div className="relative h-full" ref={wrapRef} data-testid="graph-view">
      <canvas ref={canvasRef} className="block size-full cursor-grab" />
      <div className="pointer-events-none absolute left-4 top-4">
        <h1 className="text-lg font-semibold">Граф связей</h1>
        <p className="text-sm text-muted-foreground">
          {notes.length} заметок · {linkCount} связей
          {hovered ? ` · ${hovered}` : ""}
        </p>
      </div>
      <div className="absolute right-4 top-4 flex max-w-[60%] flex-wrap justify-end gap-1.5">
        {GRAPH_STYLES.map(g => (
          <button
            key={g.id}
            type="button"
            data-testid={`graph-style-${g.id}`}
            onClick={() => setPrefs({ graphStyle: g.id })}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium backdrop-blur transition-colors",
              graphStyle === g.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/70 bg-card/80 text-muted-foreground hover:text-foreground",
            )}
          >
            {g.name}
          </button>
        ))}
      </div>
      <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-border/60 bg-card/80 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
        Клик — открыть · перетаскивай узлы · колесо — масштаб
      </div>
    </div>
  );
}
