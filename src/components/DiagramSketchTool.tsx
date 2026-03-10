"use client";

import { useRef, useState, useEffect, useCallback } from "react";

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 350;
const SHAPES_PANEL_WIDTH = 120;
const GRID_SPACING = 20;
const GRID_DOT_RADIUS = 1;

type Tool = "select" | "freehand" | "line" | "rectangle" | "circle" | "text" | "eraser";
type StrokeWidth = "thin" | "medium" | "thick";
const STROKE_WIDTH_MAP: Record<StrokeWidth, number> = { thin: 1, medium: 3, thick: 6 };
const COLORS = [
  { name: "Black", value: "#000000" },
  { name: "Red", value: "#dc2626" },
  { name: "Blue", value: "#2563eb" },
] as const;

export interface DiagramSketchToolProps {
  onSave: (imageBase64: string) => void;
  onCancel: () => void;
  existingImage?: string; // base64 (data:image/png;base64,... or raw) or URL to load existing diagram
}

type Point = { x: number; y: number };
type Handle =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w";

export type Shape = {
  id: string;
  type:
    | "freehand"
    | "line"
    | "rect"
    | "circle"
    | "triangle"
    | "rightTriangle"
    | "semicircle"
    | "parallelogram"
    | "trapezium"
    | "segment"
    | "arrow"
    | "angle"
    | "axes"
    | "text"
    | "image";
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: { x: number; y: number }[]; // for freehand
  color: string;
  strokeWidth: number;
  text?: string; // for text type
  imageData?: string; // for image type (data URL)
  composite?: "source-over" | "destination-out"; // used for eraser strokes
};

function drawGridDots(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  for (let x = GRID_SPACING; x < CANVAS_WIDTH; x += GRID_SPACING) {
    for (let y = GRID_SPACING; y < CANVAS_HEIGHT; y += GRID_SPACING) {
      ctx.beginPath();
      ctx.arc(x, y, GRID_DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function drawArrowhead(ctx: CanvasRenderingContext2D, from: Point, to: Point, size: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const tip = to;
  const base = { x: to.x - ux * size, y: to.y - uy * size };
  const left = { x: base.x + px * (size * 0.6), y: base.y + py * (size * 0.6) };
  const right = { x: base.x - px * (size * 0.6), y: base.y - py * (size * 0.6) };
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.closePath();
  ctx.fill();
}

function getBounds(s: Shape) {
  if (s.type === "freehand" && s.points && s.points.length > 0) {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const p of s.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const pad = Math.max(6, s.strokeWidth);
    return { left: minX - pad, top: minY - pad, right: maxX + pad, bottom: maxY + pad };
  }
  const w = s.width ?? 0;
  const h = s.height ?? 0;
  const pad = 10;
  return {
    left: s.x - w / 2 - pad,
    right: s.x + w / 2 + pad,
    top: s.y - h / 2 - pad,
    bottom: s.y + h / 2 + pad,
  };
}

function pointInBounds(p: Point, b: { left: number; top: number; right: number; bottom: number }) {
  return p.x >= b.left && p.x <= b.right && p.y >= b.top && p.y <= b.bottom;
}

function drawShape(ctx: CanvasRenderingContext2D, s: Shape, imageCache: Map<string, HTMLImageElement>) {
  const w = s.width ?? 0;
  const h = s.height ?? 0;
  const x0 = s.x - w / 2;
  const y0 = s.y - h / 2;

  ctx.save();
  ctx.globalCompositeOperation = s.composite ?? "source-over";
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (s.type) {
    case "freehand": {
      const pts = s.points ?? [];
      if (pts.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      break;
    }
    case "rect": {
      ctx.strokeRect(x0, y0, w, h);
      break;
    }
    case "triangle": {
      const p1 = { x: s.x, y: y0 };
      const p2 = { x: x0 + w, y: y0 + h };
      const p3 = { x: x0, y: y0 + h };
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case "rightTriangle": {
      const p1 = { x: x0, y: y0 };
      const p2 = { x: x0, y: y0 + h };
      const p3 = { x: x0 + w, y: y0 + h };
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case "circle": {
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "semicircle": {
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, w / 2, h / 2, 0, Math.PI, 0);
      ctx.stroke();
      break;
    }
    case "parallelogram": {
      const skew = w * 0.25;
      ctx.beginPath();
      ctx.moveTo(x0 + skew, y0);
      ctx.lineTo(x0 + w, y0);
      ctx.lineTo(x0 + w - skew, y0 + h);
      ctx.lineTo(x0, y0 + h);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case "trapezium": {
      const inset = w * 0.2;
      ctx.beginPath();
      ctx.moveTo(x0 + inset, y0);
      ctx.lineTo(x0 + w - inset, y0);
      ctx.lineTo(x0 + w, y0 + h);
      ctx.lineTo(x0, y0 + h);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case "line":
    case "segment": {
      const p1 = { x: s.x - w / 2, y: s.y };
      const p2 = { x: s.x + w / 2, y: s.y };
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      if (s.type === "segment") {
        const r = Math.max(2, s.strokeWidth + 1);
        ctx.beginPath();
        ctx.arc(p1.x, p1.y, r, 0, Math.PI * 2);
        ctx.arc(p2.x, p2.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "arrow": {
      const from = { x: s.x - w / 2, y: s.y };
      const to = { x: s.x + w / 2, y: s.y };
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      drawArrowhead(ctx, from, to, Math.max(8, s.strokeWidth * 3));
      break;
    }
    case "angle": {
      const v = { x: s.x - w * 0.15, y: s.y + h * 0.15 };
      const r1 = { x: v.x + w * 0.7, y: v.y };
      const r2 = { x: v.x, y: v.y - h * 0.7 };
      ctx.beginPath();
      ctx.moveTo(v.x, v.y);
      ctx.lineTo(r1.x, r1.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(v.x, v.y);
      ctx.lineTo(r2.x, r2.y);
      ctx.stroke();
      const arcR = Math.min(w, h) * 0.25;
      ctx.beginPath();
      ctx.arc(v.x, v.y, arcR, -Math.PI / 2, 0, false);
      ctx.stroke();
      break;
    }
    case "axes": {
      const left = { x: s.x - w / 2, y: s.y };
      const right = { x: s.x + w / 2, y: s.y };
      const bottom = { x: s.x, y: s.y + h / 2 };
      const top = { x: s.x, y: s.y - h / 2 };
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bottom.x, bottom.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
      drawArrowhead(ctx, { x: right.x - 1, y: right.y }, right, Math.max(8, s.strokeWidth * 3));
      drawArrowhead(ctx, { x: top.x, y: top.y + 1 }, top, Math.max(8, s.strokeWidth * 3));
      break;
    }
    case "text": {
      const text = s.text ?? "";
      if (!text) break;
      const fontSize = Math.max(12, s.strokeWidth * 6);
      ctx.fillStyle = s.color;
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillText(text, s.x, s.y);
      break;
    }
    case "image": {
      const src = s.imageData;
      if (!src) break;
      let img = imageCache.get(src);
      if (!img) {
        img = new Image();
        img.src = src;
        imageCache.set(src, img);
      }
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, x0, y0, w, h);
      } else {
        img.onload = () => {
          // No-op: the next render effect will draw it.
        };
      }
      break;
    }
  }

  ctx.restore();
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function handlePositions(b: { left: number; top: number; right: number; bottom: number }) {
  const cx = (b.left + b.right) / 2;
  const cy = (b.top + b.bottom) / 2;
  return {
    nw: { x: b.left, y: b.top },
    n: { x: cx, y: b.top },
    ne: { x: b.right, y: b.top },
    e: { x: b.right, y: cy },
    se: { x: b.right, y: b.bottom },
    s: { x: cx, y: b.bottom },
    sw: { x: b.left, y: b.bottom },
    w: { x: b.left, y: cy },
  } as const;
}

function hitHandle(p: Point, b: { left: number; top: number; right: number; bottom: number }): Handle | null {
  const handles = handlePositions(b);
  const size = 8;
  const half = size / 2;
  const entries = Object.entries(handles) as [Handle, Point][];
  for (const [k, hp] of entries) {
    if (p.x >= hp.x - half && p.x <= hp.x + half && p.y >= hp.y - half && p.y <= hp.y + half) return k;
  }
  return null;
}

export default function DiagramSketchTool({ onSave, onCancel, existingImage }: DiagramSketchToolProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tool, setTool] = useState<Tool>("freehand");
  const [color, setColor] = useState<string>(COLORS[0].value);
  const [strokeWidth, setStrokeWidth] = useState<StrokeWidth>("medium");
  const [textValue, setTextValue] = useState("");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const isDrawing = useRef(false);
  const startPoint = useRef<Point | null>(null);
  const lastPoint = useRef<Point | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const draggingShapeId = useRef<string | null>(null);
  const dragOffset = useRef<Point>({ x: 0, y: 0 });
  const resizing = useRef<{ id: string; handle: Handle; start: Point; startBounds: { left: number; top: number; right: number; bottom: number } } | null>(
    null
  );
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const draftFreehand = useRef<Point[]>([]);

  useEffect(() => {
    if (tool !== "select") return;
    const onKeyDown = (ev: KeyboardEvent) => {
      if (!selectedShapeId) return;
      if (ev.key === "Delete" || ev.key === "Backspace") {
        ev.preventDefault();
        setShapes((prev) => prev.filter((s) => s.id !== selectedShapeId));
        setSelectedShapeId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedShapeId, tool]);

  const renderComposite = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // draw all shapes first (including eraser strokes)
    const cache = imageCacheRef.current;
    for (const s of shapes) drawShape(ctx, s, cache);

    // grid dots on top so eraser doesn't remove the grid
    drawGridDots(ctx);

    // selection overlay
    if (tool === "select" && selectedShapeId) {
      const sel = shapes.find((s) => s.id === selectedShapeId);
      if (sel) {
        const b = getBounds(sel);
        ctx.save();
        ctx.strokeStyle = "#2563eb";
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
        ctx.setLineDash([]);
        const handles = handlePositions(b);
        ctx.fillStyle = "#2563eb";
        for (const hp of Object.values(handles)) {
          ctx.fillRect(hp.x - 4, hp.y - 4, 8, 8);
        }
        ctx.restore();
      }
    }
  }, [shapes, selectedShapeId, tool]);

  useEffect(() => {
    renderComposite();
  }, [renderComposite]);

  const undo = useCallback(() => {
    setSelectedShapeId(null);
    setShapes((prev) => prev.slice(0, -1));
  }, []);

  // Load existing image (base64 or URL)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !existingImage) return;
    const loadAndAdd = (src: string) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // Fit to canvas bounds, centered
        const scale = Math.min(CANVAS_WIDTH / img.width, CANVAS_HEIGHT / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = CANVAS_WIDTH / 2;
        const y = CANVAS_HEIGHT / 2;
        setShapes([
          {
            id: uid("img"),
            type: "image",
            x,
            y,
            width: w,
            height: h,
            color: "#000000",
            strokeWidth: 1,
            imageData: src,
          },
        ]);
        setSelectedShapeId(null);
      };
      img.onerror = () => {
        setShapes([]);
        setSelectedShapeId(null);
      };
      img.src = src;
    };

    const dataUrl = existingImage.startsWith("data:") ? existingImage : null;
    const url = existingImage.startsWith("http") ? existingImage : null;

    if (dataUrl) {
      loadAndAdd(dataUrl);
    } else if (url) {
      loadAndAdd(url);
    }
  }, [existingImage]); // eslint-disable-line react-hooks/exhaustive-deps

  const getPoint = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = getPoint(e);
    if (tool === "select") {
      const sel = selectedShapeId ? shapes.find((s) => s.id === selectedShapeId) : null;
      if (sel) {
        const b = getBounds(sel);
        const hh = hitHandle(p, b);
        if (hh) {
          resizing.current = { id: sel.id, handle: hh, start: p, startBounds: b };
          return;
        }
      }

      const hit = [...shapes].reverse().find((s) => pointInBounds(p, getBounds(s)));
      if (!hit) {
        setSelectedShapeId(null);
        renderComposite();
        return;
      }
      setSelectedShapeId(hit.id);
      draggingShapeId.current = hit.id;
      dragOffset.current = { x: p.x - hit.x, y: p.y - hit.y };
      return;
    }

    isDrawing.current = true;
    startPoint.current = p;
    lastPoint.current = p;
    if (tool === "freehand" || tool === "eraser") {
      draftFreehand.current = [p];
      return;
    }
    if (tool === "text") {
      const text = textValue.trim() || "Text";
      setShapes((prev) => [
        ...prev,
        {
          id: uid("text"),
          type: "text",
          x: p.x,
          y: p.y,
          color,
          strokeWidth: STROKE_WIDTH_MAP[strokeWidth],
          text,
        },
      ]);
      return;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = getPoint(e);
    if (tool === "select") {
      const resize = resizing.current;
      if (resize) {
        const { id, handle, startBounds } = resize;
        const dx = p.x - resize.start.x;
        const dy = p.y - resize.start.y;
        let left = startBounds.left;
        let right = startBounds.right;
        let top = startBounds.top;
        let bottom = startBounds.bottom;

        const isCorner = handle === "nw" || handle === "ne" || handle === "sw" || handle === "se";
        if (handle.includes("w")) left = startBounds.left + dx;
        if (handle.includes("e")) right = startBounds.right + dx;
        if (handle.includes("n")) top = startBounds.top + dy;
        if (handle.includes("s")) bottom = startBounds.bottom + dy;

        const startW = startBounds.right - startBounds.left;
        const startH = startBounds.bottom - startBounds.top;
        if (isCorner) {
          const newW = Math.max(10, right - left);
          const ratio = startH / (startW || 1);
          const newH = Math.max(10, newW * ratio);
          // Anchor opposite corner based on handle
          if (handle === "nw") {
            right = startBounds.right;
            bottom = startBounds.bottom;
            left = right - newW;
            top = bottom - newH;
          } else if (handle === "ne") {
            left = startBounds.left;
            bottom = startBounds.bottom;
            right = left + newW;
            top = bottom - newH;
          } else if (handle === "sw") {
            right = startBounds.right;
            top = startBounds.top;
            left = right - newW;
            bottom = top + newH;
          } else if (handle === "se") {
            left = startBounds.left;
            top = startBounds.top;
            right = left + newW;
            bottom = top + newH;
          }
        } else {
          // edge handles: one axis only
          if (handle === "n" || handle === "s") {
            left = startBounds.left;
            right = startBounds.right;
          } else {
            top = startBounds.top;
            bottom = startBounds.bottom;
          }
        }

        const newBounds = { left, top, right, bottom };
        setShapes((prev) =>
          prev.map((s) => {
            if (s.id !== id) return s;
            const cx = (newBounds.left + newBounds.right) / 2;
            const cy = (newBounds.top + newBounds.bottom) / 2;
            const nw = Math.max(10, newBounds.right - newBounds.left);
            const nh = Math.max(10, newBounds.bottom - newBounds.top);

            if (s.type === "freehand" && s.points && s.points.length > 0) {
              const ob = getBounds(s);
              const ow = ob.right - ob.left || 1;
              const oh = ob.bottom - ob.top || 1;
              const sx = nw / ow;
              const sy = nh / oh;
              const pts = s.points.map((pt) => ({
                x: (pt.x - ob.left) * sx + newBounds.left,
                y: (pt.y - ob.top) * sy + newBounds.top,
              }));
              return { ...s, x: cx, y: cy, points: pts };
            }

            return { ...s, x: cx, y: cy, width: nw, height: nh };
          })
        );
        return;
      }

      if (draggingShapeId.current) {
        const id = draggingShapeId.current;
        setShapes((prev) =>
          prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  x: clamp(p.x - dragOffset.current.x, 0, CANVAS_WIDTH),
                  y: clamp(p.y - dragOffset.current.y, 0, CANVAS_HEIGHT),
                }
              : s
          )
        );
      }
      return;
    }

    if (!isDrawing.current) return;
    if (tool === "freehand" || tool === "eraser") {
      draftFreehand.current.push(p);
      lastPoint.current = p;
      return;
    }

    // Preview for line/rectangle/circle (drawn transiently)
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderComposite();
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = STROKE_WIDTH_MAP[strokeWidth];
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const s = startPoint.current!;
    if (tool === "line") {
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else if (tool === "rectangle") {
      ctx.strokeRect(Math.min(s.x, p.x), Math.min(s.y, p.y), Math.abs(p.x - s.x), Math.abs(p.y - s.y));
    } else if (tool === "circle") {
      const rx = Math.abs(p.x - s.x) / 2;
      const ry = Math.abs(p.y - s.y) / 2;
      const cx = (s.x + p.x) / 2;
      const cy = (s.y + p.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "select") {
      draggingShapeId.current = null;
      resizing.current = null;
      return;
    }

    if (!isDrawing.current) return;
    const p = getPoint(e);

    if (tool === "freehand" || tool === "eraser") {
      const pts = draftFreehand.current;
      if (pts.length >= 2) {
        setShapes((prev) => [
          ...prev,
          {
            id: uid(tool === "eraser" ? "erase" : "pen"),
            type: "freehand",
            x: 0,
            y: 0,
            points: pts.map((pp) => ({ ...pp })),
            color: tool === "eraser" ? "#000000" : color,
            strokeWidth: tool === "eraser" ? STROKE_WIDTH_MAP[strokeWidth] * 2 : STROKE_WIDTH_MAP[strokeWidth],
            composite: tool === "eraser" ? "destination-out" : "source-over",
          },
        ]);
      }
      draftFreehand.current = [];
    } else if (tool === "line" || tool === "rectangle" || tool === "circle") {
      const s = startPoint.current!;
      const cx = (s.x + p.x) / 2;
      const cy = (s.y + p.y) / 2;
      const w = Math.max(2, Math.abs(p.x - s.x));
      const h = Math.max(2, Math.abs(p.y - s.y));
      setShapes((prev) => [
        ...prev,
        {
          id: uid("shape"),
          type: tool === "line" ? "line" : tool === "rectangle" ? "rect" : "circle",
          x: cx,
          y: cy,
          width: w,
          height: tool === "line" ? Math.max(20, STROKE_WIDTH_MAP[strokeWidth] * 6) : h,
          color,
          strokeWidth: STROKE_WIDTH_MAP[strokeWidth],
        },
      ]);
    }

    isDrawing.current = false;
    startPoint.current = null;
    lastPoint.current = null;
  };

  const handleClear = () => {
    setSelectedShapeId(null);
    setShapes([]);
  };

  const handleSave = () => {
    // Render to an offscreen canvas so we always export a clean composite
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = CANVAS_WIDTH;
    exportCanvas.height = CANVAS_HEIGHT;
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) return;
    exportCtx.fillStyle = "#ffffff";
    exportCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const cache = imageCacheRef.current;
    for (const s of shapes) drawShape(exportCtx, s, cache);
    drawGridDots(exportCtx);
    const dataUrl = exportCanvas.toDataURL("image/png");
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
    onSave(base64);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result !== "string") return;
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(CANVAS_WIDTH / img.width, CANVAS_HEIGHT / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        setShapes((prev) => [
          ...prev,
          {
            id: uid("img"),
            type: "image",
            x: CANVAS_WIDTH / 2,
            y: CANVAS_HEIGHT / 2,
            width: w,
            height: h,
            color: "#000000",
            strokeWidth: 1,
            imageData: result,
          },
        ]);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
    // allow re-uploading same file again
    e.target.value = "";
  };

  const insertShape = (type: Shape["type"]) => {
    const sw = STROKE_WIDTH_MAP[strokeWidth];
    const center = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    const sized: Shape = (() => {
      const base: Shape = {
        id: uid("shape"),
        type,
        x: center.x,
        y: center.y,
        width: 90,
        height: 70,
        color,
        strokeWidth: sw,
      };
      switch (type) {
        case "rect":
          return { ...base, width: 95, height: 65 };
        case "circle":
          return { ...base, width: 80, height: 80 };
        case "triangle":
          return { ...base, width: 90, height: 80 };
        case "rightTriangle":
          return { ...base, width: 90, height: 75 };
        case "semicircle":
          return { ...base, width: 90, height: 70 };
        case "parallelogram":
        case "trapezium":
          return { ...base, width: 95, height: 65 };
        case "segment":
          return { ...base, width: 110, height: 30 };
        case "arrow":
          return { ...base, width: 120, height: 30 };
        case "angle":
          return { ...base, width: 110, height: 90 };
        case "axes":
          return { ...base, width: 120, height: 120 };
        default:
          return base;
      }
    })();
    setShapes((prev) => [...prev, sized]);
  };

  const shapesPanel: { type: Shape["type"]; label: string; icon: React.ReactNode }[] = [
    {
      type: "rect",
      label: "Square",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <rect x="5" y="5" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
    },
    {
      type: "rect",
      label: "Rectangle",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <rect x="4" y="7" width="16" height="10" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
    },
    {
      type: "triangle",
      label: "Triangle",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <path d="M12 5 L20 19 H4 Z" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
    },
    {
      type: "rightTriangle",
      label: "Right △",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <path d="M6 6 V18 H18 Z" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
    },
    {
      type: "circle",
      label: "Circle",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
    },
    {
      type: "semicircle",
      label: "Semicircle",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <path d="M4 14 A8 8 0 0 1 20 14" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
    },
    {
      type: "parallelogram",
      label: "Parallelogram",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <path d="M7 7 H20 L17 17 H4 Z" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
    },
    {
      type: "trapezium",
      label: "Trapezium",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <path d="M8 7 H16 L20 17 H4 Z" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
    },
    {
      type: "segment",
      label: "Segment",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" />
          <circle cx="5" cy="12" r="2" fill="currentColor" />
          <circle cx="19" cy="12" r="2" fill="currentColor" />
        </svg>
      ),
    },
    {
      type: "arrow",
      label: "Arrow",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <line x1="5" y1="12" x2="17" y2="12" stroke="currentColor" strokeWidth="2" />
          <path d="M17 8 L21 12 L17 16" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
    },
    {
      type: "angle",
      label: "Angle",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <path d="M7 17 L7 7 L17 17" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M7 13 A4 4 0 0 0 11 17" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
    },
    {
      type: "axes",
      label: "Axes",
      icon: (
        <svg viewBox="0 0 24 24" className="w-6 h-6">
          <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" />
          <line x1="12" y1="20" x2="12" y2="4" stroke="currentColor" strokeWidth="2" />
          <path d="M20 12 L17 10 M20 12 L17 14" stroke="currentColor" strokeWidth="2" />
          <path d="M12 4 L10 7 M12 4 L14 7" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
    },
  ];

  const tools: { id: Tool; label: string }[] = [
    { id: "select", label: "↖ Select" },
    { id: "freehand", label: "Freehand" },
    { id: "line", label: "Line" },
    { id: "rectangle", label: "Rectangle" },
    { id: "circle", label: "Circle" },
    { id: "text", label: "Text" },
    { id: "eraser", label: "Eraser" },
  ];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col max-w-full">
        <div className="bg-slate-800 text-white px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="font-semibold text-sm">Tools</span>
          {tools.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTool(t.id)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                tool === t.id ? "bg-slate-600 text-white" : "bg-slate-700 text-slate-200 hover:bg-slate-600"
              }`}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded text-sm font-medium transition-colors bg-slate-700 text-slate-200 hover:bg-slate-600"
          >
            Upload Image
          </button>
          <span className="text-slate-400 mx-1">|</span>
          <span className="text-sm text-slate-300">Color</span>
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              className={`w-6 h-6 rounded-full border-2 ${
                color === c.value ? "border-white ring-2 ring-slate-400" : "border-slate-600"
              }`}
              style={{ backgroundColor: c.value }}
              title={c.name}
            />
          ))}
          <span className="text-sm text-slate-300 ml-1">Width</span>
          {(["thin", "medium", "thick"] as const).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setStrokeWidth(w)}
              className={`px-2 py-1 rounded text-xs capitalize ${
                strokeWidth === w ? "bg-slate-600" : "bg-slate-700 hover:bg-slate-600"
              }`}
            >
              {w}
            </button>
          ))}
          {tool === "text" && (
            <input
              type="text"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="Label text"
              className="ml-2 px-2 py-1 rounded bg-slate-700 text-white text-sm w-32 placeholder-slate-400"
            />
          )}
          <span className="text-slate-400 mx-1">|</span>
          <button
            type="button"
            onClick={undo}
            disabled={shapes.length === 0}
            className="px-3 py-1.5 rounded text-sm font-semibold bg-slate-600 hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ↩ Undo
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-1.5 rounded text-sm bg-slate-700 hover:bg-slate-600"
          >
            Clear all
          </button>
        </div>
        {/* File input (hidden, triggered by button click) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={handleImageUpload}
        />
        <div className="p-2 bg-slate-100">
          <div className="flex items-start gap-2">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={() => {
                isDrawing.current = false;
                draggingShapeId.current = null;
                resizing.current = null;
                startPoint.current = null;
                lastPoint.current = null;
              }}
              className="cursor-crosshair bg-white border border-slate-300 rounded shadow-inner block"
              style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
            />
            <div
              className="bg-white border border-slate-300 rounded shadow-inner overflow-hidden"
              style={{ width: SHAPES_PANEL_WIDTH }}
            >
              <div className="px-2 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">
                Shapes
              </div>
              <div className="p-2 grid grid-cols-2 gap-2">
                {shapesPanel.map((s) => (
                  <button
                    key={s.type}
                    type="button"
                    onClick={() => insertShape(s.type)}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded border border-slate-200 hover:bg-slate-50 text-slate-700"
                    title={s.label}
                  >
                    <span className="text-slate-700">{s.icon}</span>
                    <span className="text-[10px] leading-tight text-slate-600">{s.label}</span>
                  </button>
                ))}
              </div>
              <div className="px-2 pb-2 text-[10px] text-slate-500">
                Tip: click a shape to insert, then drag to move.
              </div>
            </div>
          </div>
        </div>
        <div className="px-4 py-3 border-t flex justify-end gap-3 bg-slate-50">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 font-medium hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
