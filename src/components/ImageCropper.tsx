import { useState, useRef, useEffect } from "react";
import { X, Check, ZoomIn, RotateCcw } from "lucide-react";

/* ── Design tokens — Editorial Noir ── */
const T = {
  bg:      "#0a0a0a",
  surface: "#121212",
  border:  "#222",
  accent:  "#d1ff26",
  text:    "#e0e0e0",
  sub:     "#666",
} as const;

const CROP_W = 300;     // on-screen crop frame width (px)
const OUT_W = 600;      // exported image width (px)

interface Props {
  src: string;
  aspect?: number;      // width / height of the crop frame
  onCancel: () => void;
  onCrop: (dataUrl: string) => void;
}

export default function ImageCropper({ src, aspect = 2 / 3, onCancel, onCrop }: Props) {
  const cropH = Math.round(CROP_W / aspect);
  const outH = Math.round(OUT_W / aspect);

  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => { setNat({ w: img.naturalWidth, h: img.naturalHeight }); setScale(1); setOffset({ x: 0, y: 0 }); };
    img.src = src;
  }, [src]);

  // baseScale makes the image "cover" the crop frame at scale = 1.
  const baseScale = nat ? Math.max(CROP_W / nat.w, cropH / nat.h) : 1;
  const eff = baseScale * scale;
  const dispW = nat ? nat.w * eff : 0;
  const dispH = nat ? nat.h * eff : 0;
  const imageLeft = (CROP_W - dispW) / 2 + offset.x;
  const imageTop = (cropH - dispH) / 2 + offset.y;

  const clampOffset = (o: { x: number; y: number }, dW: number, dH: number) => {
    const maxX = Math.max(0, (dW - CROP_W) / 2);
    const maxY = Math.max(0, (dH - cropH) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, o.x)), y: Math.min(maxY, Math.max(-maxY, o.y)) };
  };

  const applyScale = (s: number) => {
    const clamped = Math.min(4, Math.max(1, s));
    setScale(clamped);
    if (nat) {
      const dW = nat.w * baseScale * clamped;
      const dH = nat.h * baseScale * clamped;
      setOffset(o => clampOffset(o, dW, dH));
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!nat) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
    setDragging(true);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !nat) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;
    setOffset(clampOffset({ x: dragRef.current.ox + dx, y: dragRef.current.oy + dy }, dispW, dispH));
  };
  const onPointerUp = () => { dragRef.current = null; setDragging(false); };

  const onWheel = (e: React.WheelEvent) => {
    if (!nat) return;
    applyScale(scale - e.deltaY * 0.0015);
  };

  const reset = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  const handleCrop = () => {
    if (!nat) return;
    const sx = (0 - imageLeft) / eff;
    const sy = (0 - imageTop) / eff;
    const sW = CROP_W / eff;
    const sH = cropH / eff;
    const canvas = document.createElement("canvas");
    canvas.width = OUT_W;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, sx, sy, sW, sH, 0, 0, OUT_W, outH);
      onCrop(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.src = src;
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 250, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.94)", backdropFilter: "blur(6px)" }} onClick={onCancel} />

      <div className="slide-up" style={{ position: "relative", width: "100%", maxWidth: 420, background: T.bg, border: `1px solid ${T.border}`, display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 12, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: T.accent }}>
            AJUSTAR_RECORTE
          </h2>
          <button onClick={onCancel} style={{ background: "none", border: "none", color: T.sub, cursor: "pointer", display: "flex" }}><X size={20} /></button>
        </div>

        {/* Crop area */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <p style={{ margin: 0, fontFamily: "monospace", fontSize: 9, color: T.sub, letterSpacing: "0.08em", textAlign: "center" }}>
            Arraste para posicionar · roda do mouse ou slider para zoom
          </p>

          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onWheel={onWheel}
            style={{
              position: "relative", width: CROP_W, height: cropH,
              overflow: "hidden", background: "#000", border: `1px solid ${T.border}`,
              cursor: nat ? (dragging ? "grabbing" : "grab") : "default", touchAction: "none", flexShrink: 0,
            }}
          >
            {nat && (
              <img
                src={src}
                draggable={false}
                style={{ position: "absolute", width: dispW, height: dispH, maxWidth: "none", maxHeight: "none", left: imageLeft, top: imageTop, userSelect: "none", pointerEvents: "none" }}
              />
            )}
            {/* Rule-of-thirds grid */}
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              <div style={{ position: "absolute", left: "33.33%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.18)" }} />
              <div style={{ position: "absolute", left: "66.66%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.18)" }} />
              <div style={{ position: "absolute", top: "33.33%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.18)" }} />
              <div style={{ position: "absolute", top: "66.66%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.18)" }} />
            </div>
            {/* Frame guide */}
            <div style={{ position: "absolute", inset: 0, border: `1px solid rgba(209,255,38,0.4)`, pointerEvents: "none" }} />
          </div>

          {/* Zoom */}
          <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 12 }}>
            <ZoomIn size={14} color={T.sub} />
            <input
              type="range"
              className="noir-slider"
              min={1}
              max={4}
              step={0.01}
              value={scale}
              onChange={e => applyScale(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <button
              onClick={reset}
              title="Redefinir"
              style={{ background: "none", border: `1px solid ${T.border}`, color: T.sub, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "20px 24px", borderTop: `1px solid ${T.border}`, background: T.surface, display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button onClick={onCancel} style={{ background: "none", border: "none", color: T.sub, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>CANCELAR</button>
          <button
            onClick={handleCrop}
            disabled={!nat}
            style={{ background: T.accent, border: "none", color: "#000", padding: "8px 24px", fontSize: 11, fontWeight: 900, cursor: nat ? "pointer" : "default", opacity: nat ? 1 : 0.6, display: "flex", alignItems: "center", gap: 8 }}
          >
            <Check size={14} /> APLICAR_RECORTE
          </button>
        </div>
      </div>
    </div>
  );
}
