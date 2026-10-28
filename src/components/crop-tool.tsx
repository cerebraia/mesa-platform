"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ── Constants ─────────────────────────────────────────────────

const THUMB_MAX = 1080;  // max output px (both dimensions)
const MIN_CROP  = 60;    // minimum display-px crop size

// ── Types ─────────────────────────────────────────────────────

interface Crop { x: number; y: number; size: number }

type DragState =
  | { type: "move";   startX: number; startY: number; origX: number; origY: number }
  | { type: "resize"; startX: number; startY: number; origSize: number; origX: number; origY: number };

export interface CropToolProps {
  // file is for new uploads; url is for existing images in Storage
  file?: File;
  url?: string;
  onConfirm: (thumb: File) => void;
  onSkip?: () => void;  // "use without crop" (only available for new file uploads)
  onCancel: () => void;
}

// ── Component ─────────────────────────────────────────────────

export function CropTool({ file, url, onConfirm, onSkip, onCancel }: CropToolProps) {
  const imgRef    = useRef<HTMLImageElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const stageRef  = useRef<HTMLDivElement>(null);

  const [src, setSrc]         = useState<string>("");
  const [crop, setCrop]       = useState<Crop | null>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [generating, setGenerating] = useState(false);

  // Load source from file or url
  useEffect(() => {
    if (file) {
      const objUrl = URL.createObjectURL(file);
      setSrc(objUrl);
      return () => URL.revokeObjectURL(objUrl);
    } else if (url) {
      setSrc(url);
    }
  }, [file, url]);

  // Initialise crop when image loads
  function handleLoad() {
    const img = imgRef.current;
    if (!img) return;
    const w = img.clientWidth;
    const h = img.clientHeight;
    const size = Math.min(w, h) * 0.85;
    setCrop({ x: (w - size) / 2, y: (h - size) / 2, size });
  }

  // Draw preview canvas whenever crop changes
  useEffect(() => {
    if (!crop || !imgRef.current || !previewRef.current) return;
    const img = imgRef.current;
    if (!img.complete || !img.naturalWidth) return;
    const scaleX = img.naturalWidth  / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;
    const sx = crop.x * scaleX;
    const sy = crop.y * scaleY;
    const sw = crop.size * scaleX;
    const sh = crop.size * scaleY;
    const canvas = previewRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  }, [crop]);

  // ── Drag handlers ─────────────────────────────────────────────

  function onOverlayDown(e: React.PointerEvent, type: "move" | "resize") {
    e.preventDefault();
    e.stopPropagation();
    if (!crop) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (type === "move") {
      setDragging({ type: "move", startX: e.clientX, startY: e.clientY,
                    origX: crop.x, origY: crop.y });
    } else {
      setDragging({ type: "resize", startX: e.clientX, startY: e.clientY,
                    origSize: crop.size, origX: crop.x, origY: crop.y });
    }
  }

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !crop || !imgRef.current) return;
    e.preventDefault();
    const img  = imgRef.current;
    const maxW = img.clientWidth;
    const maxH = img.clientHeight;
    const dx   = e.clientX - dragging.startX;
    const dy   = e.clientY - dragging.startY;

    if (dragging.type === "move") {
      setCrop(c => c ? {
        ...c,
        x: Math.max(0, Math.min(dragging.origX + dx, maxW - c.size)),
        y: Math.max(0, Math.min(dragging.origY + dy, maxH - c.size)),
      } : c);
    } else {
      // Resize: keep top-left fixed, expand/contract via bottom-right drag
      const delta   = Math.max(dx, dy);
      const newSize = Math.max(
        MIN_CROP,
        Math.min(dragging.origSize + delta,
                 maxW - dragging.origX,
                 maxH - dragging.origY),
      );
      setCrop(c => c ? { ...c, size: newSize } : c);
    }
  }, [dragging, crop]);

  function onPointerUp() { setDragging(null); }

  // ── Generate thumbnail ─────────────────────────────────────────

  async function handleConfirm() {
    if (!crop || !imgRef.current) return;
    setGenerating(true);

    const img    = imgRef.current;
    const scaleX = img.naturalWidth  / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;
    const sx     = Math.round(crop.x * scaleX);
    const sy     = Math.round(crop.y * scaleY);
    const sSize  = Math.round(crop.size * Math.max(scaleX, scaleY));

    // Don't upscale artificially: output at native crop size or THUMB_MAX
    const outSize = Math.min(THUMB_MAX, sSize);

    // Draw using the full-resolution source
    const fullImg = new Image();
    fullImg.crossOrigin = "anonymous";
    fullImg.src = src;
    await new Promise<void>(resolve => {
      if (fullImg.complete && fullImg.naturalWidth) { resolve(); return; }
      fullImg.onload = () => resolve();
      fullImg.onerror = () => resolve();
    });

    const canvas = document.createElement("canvas");
    canvas.width  = outSize;
    canvas.height = outSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setGenerating(false); return; }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(fullImg, sx, sy, sSize, sSize, 0, 0, outSize, outSize);

    canvas.toBlob(blob => {
      setGenerating(false);
      if (!blob) return;
      onConfirm(new File([blob], "thumb.webp", { type: "image/webp" }));
    }, "image/webp", 0.92);
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="cropt-bg" role="dialog" aria-modal="true" aria-label="Recortar imagen">
      <div className="cropt-modal">
        <div className="cropt-header">
          <span className="cropt-title">Recortar miniatura</span>
          <button type="button" className="cropt-close" onClick={onCancel} aria-label="Cancelar">
            ✕
          </button>
        </div>
        <p className="cropt-hint">
          Arrastra el cuadro para elegir el área. Arrastra la esquina para cambiar el tamaño.
        </p>

        {/* ── Image stage ── */}
        <div
          ref={stageRef}
          className="cropt-stage"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt=""
            className="cropt-img"
            crossOrigin="anonymous"
            onLoad={handleLoad}
            draggable={false}
          />

          {/* Dark mask: 4 rects outside the crop */}
          {crop && (<>
            <div className="cropt-mask" style={{ top: 0, left: 0, right: 0, height: crop.y }} />
            <div className="cropt-mask" style={{ top: crop.y + crop.size, left: 0, right: 0, bottom: 0 }} />
            <div className="cropt-mask" style={{ top: crop.y, left: 0, width: crop.x, height: crop.size }} />
            <div className="cropt-mask" style={{ top: crop.y, left: crop.x + crop.size, right: 0, height: crop.size }} />
          </>)}

          {/* Crop overlay */}
          {crop && (
            <div
              className="cropt-overlay"
              style={{ left: crop.x, top: crop.y, width: crop.size, height: crop.size }}
              onPointerDown={(e) => onOverlayDown(e, "move")}
            >
              {/* Rule of thirds lines */}
              <div className="cropt-thirds" aria-hidden="true" />
              {/* Corner indicators */}
              <span className="cropt-corner cropt-corner-tl" aria-hidden="true" />
              <span className="cropt-corner cropt-corner-tr" aria-hidden="true" />
              <span className="cropt-corner cropt-corner-bl" aria-hidden="true" />
              <span className="cropt-corner cropt-corner-br" aria-hidden="true" />
              {/* Resize handle */}
              <div
                className="cropt-resize-handle"
                onPointerDown={(e) => { e.stopPropagation(); onOverlayDown(e, "resize"); }}
                aria-label="Cambiar tamaño del recorte"
              />
            </div>
          )}
        </div>

        {/* ── Footer: preview + actions ── */}
        <div className="cropt-footer">
          <div className="cropt-preview-wrap">
            <canvas ref={previewRef} width={96} height={96} className="cropt-preview" aria-label="Vista previa del recorte" />
            <p className="cropt-preview-label">1:1</p>
          </div>
          <div className="cropt-actions">
            {onSkip && (
              <button type="button" className="button secondary small" onClick={onSkip}>
                Usar original
              </button>
            )}
            <button
              type="button"
              className="button small"
              onClick={handleConfirm}
              disabled={!crop || generating}
            >
              {generating ? "Generando…" : "Confirmar recorte"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
