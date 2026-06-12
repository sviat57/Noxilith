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
import { useVault } from "@/lib/vault";

interface GNode extends SimulationNodeDatum {
  id: string;
  title: string;
  degree: number;
}
type GLink = SimulationLinkDatum<GNode>;

export function GraphPage() {
  const { notes, linksOf } = useVault();
  const navigate = useNavigate();
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

    const css = getComputedStyle(document.documentElement);
    const styleOf = () => {
      const isDark = document.documentElement.classList.contains("dark");
      return {
        link: isDark ? "rgba(167,139,250,0.25)" : "rgba(109,40,217,0.22)",
        linkHi: isDark ? "rgba(167,139,250,0.8)" : "rgba(109,40,217,0.75)",
        node: isDark ? "#a78bfa" : "#7c3aed",
        nodeDim: isDark ? "rgba(167,139,250,0.35)" : "rgba(124,58,237,0.35)",
        label: isDark ? "rgba(232,230,240,0.85)" : "rgba(30,27,45,0.85)",
        labelDim: isDark ? "rgba(232,230,240,0.35)" : "rgba(30,27,45,0.35)",
      };
    };
    void css;

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

      // links
      for (const l of links) {
        const a = l.source as GNode;
        const b = l.target as GNode;
        const hi =
          hoveredNode && (a.id === hoveredNode.id || b.id === hoveredNode.id);
        ctx.strokeStyle = hi ? s.linkHi : s.link;
        ctx.lineWidth = hi ? 1.8 : 1;
        ctx.beginPath();
        ctx.moveTo(a.x ?? 0, a.y ?? 0);
        ctx.lineTo(b.x ?? 0, b.y ?? 0);
        ctx.stroke();
      }

      // nodes + labels
      for (const n of nodes) {
        const dim = hoveredNode && !neighbors.has(n.id);
        const r = radius(n);
        ctx.fillStyle = dim ? s.nodeDim : s.node;
        ctx.beginPath();
        ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, Math.PI * 2);
        ctx.fill();
        if (hoveredNode?.id === n.id) {
          ctx.strokeStyle = s.linkHi;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(n.x ?? 0, n.y ?? 0, r + 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        const fontSize = Math.max(11, 12 / Math.sqrt(view.k));
        ctx.font = `${fontSize}px ui-sans-serif, system-ui`;
        ctx.textAlign = "center";
        ctx.fillStyle = dim ? s.labelDim : s.label;
        const title =
          n.title.length > 24 ? `${n.title.slice(0, 24)}…` : n.title;
        ctx.fillText(title, n.x ?? 0, (n.y ?? 0) + r + fontSize + 4);
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
  }, [graph, navigate]);

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
      <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-border/60 bg-card/80 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
        Клик — открыть · перетаскивай узлы · колесо — масштаб
      </div>
    </div>
  );
}
