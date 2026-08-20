"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, RotateCcw, Check, SwitchCamera, Zap } from "lucide-react";

interface Props {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);  // ref for the card alignment box

  const [isReady, setIsReady] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [flash, setFlash] = useState(false);

  // ── Start / restart camera ───────────────────────────────────────────────
  const startCamera = useCallback(async (mode: "environment" | "user") => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsReady(false);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width:  { ideal: 4096 },
          height: { ideal: 2160 },
          // ask for the highest frame quality the device supports
          advanced: [{ width: 4096 }, { width: 3840 }, { width: 1920 }],
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsReady(true);
      }
    } catch {
      setError("Camera access denied or unavailable. Please allow camera permissions.");
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facingMode, startCamera]);

  // ── Capture frame — crop to card alignment box ──────────────────────────
  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isReady || !frameRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    // Bounding rects in screen pixels
    const videoRect = v.getBoundingClientRect();
    const frameRect = frameRef.current.getBoundingClientRect();

    // object-cover scale: video fills the element, potentially clipping sides
    const scaleX = videoRect.width  / v.videoWidth;
    const scaleY = videoRect.height / v.videoHeight;
    const scale  = Math.max(scaleX, scaleY);

    // How far the scaled video is offset inside the element (may be negative = clipped)
    const offsetX = (videoRect.width  - v.videoWidth  * scale) / 2;
    const offsetY = (videoRect.height - v.videoHeight * scale) / 2;

    // Frame position relative to video element top-left
    const relX = frameRect.left - videoRect.left;
    const relY = frameRect.top  - videoRect.top;

    // Map to actual video pixel coordinates
    const cropX = (relX - offsetX) / scale;
    const cropY = (relY - offsetY) / scale;
    const cropW = frameRect.width  / scale;
    const cropH = frameRect.height / scale;

    // Output at 2× the cropped video pixels for sharper result
    const DPR = 2;
    c.width  = Math.round(cropW * DPR);
    c.height = Math.round(cropH * DPR);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      v,
      Math.round(cropX), Math.round(cropY),
      Math.round(cropW), Math.round(cropH),
      0, 0, c.width, c.height
    );

    // Flash animation
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    setCaptured(c.toDataURL("image/jpeg", 0.95));
  }, [isReady]);

  const retake = () => setCaptured(null);

  const confirm = async () => {
    if (!captured) return;
    const res = await fetch(captured);
    const blob = await res.blob();
    const file = new File([blob], `card_camera_${Date.now()}.jpg`, { type: "image/jpeg" });
    onCapture(file);
    onClose();
  };

  const flipCamera = () => {
    setCaptured(null);
    setFacingMode((m) => (m === "environment" ? "user" : "environment"));
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* ── Camera / Preview area ────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden">
        {/* Video feed */}
        <video
          ref={videoRef}
          className={`w-full h-full object-cover transition-opacity duration-300 ${captured ? "opacity-0" : "opacity-100"}`}
          playsInline
          muted
        />

        {/* Captured photo preview */}
        {captured && (
          <img
            src={captured}
            alt="Captured card"
            className="absolute inset-0 w-full h-full object-contain bg-black"
          />
        )}

        {/* White flash on capture */}
        <div
          className={`absolute inset-0 bg-white pointer-events-none transition-opacity duration-100 ${flash ? "opacity-70" : "opacity-0"}`}
        />

        {/* ── Card alignment overlay (only during live view) ────────── */}
        {!captured && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {/* Dimmed outer overlay */}
            <div className="absolute inset-0 bg-black/40" />

            {/* Card frame */}
            <div
              ref={frameRef}
              className="relative z-10"
              style={{ width: "82%", maxWidth: "360px", aspectRatio: "1.586" }}
            >
              {/* Clear cutout */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden">
                <div className="w-full h-full bg-transparent" />
              </div>

              {/* Animated border */}
              <div className="absolute inset-0 rounded-2xl border border-white/20" />

              {/* Corner brackets — violet */}
              <Corner pos="top-left" />
              <Corner pos="top-right" />
              <Corner pos="bottom-left" />
              <Corner pos="bottom-right" />

              {/* Center label */}
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-white/80 text-sm font-medium bg-black/40 px-4 py-1.5 rounded-full backdrop-blur-md tracking-wide">
                  Align card within frame
                </p>
              </div>
            </div>

            {/* Hint text */}
            <p className="relative z-10 mt-5 text-white/40 text-xs text-center px-8">
              Hold steady · Good lighting gives better results
            </p>
          </div>
        )}

        {/* Top bar */}
        <div className="absolute top-0 inset-x-0 flex items-center justify-between px-5 pt-5 pb-3 bg-gradient-to-b from-black/60 to-transparent z-20">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <span className="text-white/80 text-sm font-semibold tracking-wide">
            {captured ? "Use this photo?" : "Scan Card"}
          </span>
          <button
            onClick={flipCamera}
            disabled={!!captured}
            className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition-colors disabled:opacity-30"
          >
            <SwitchCamera className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="absolute bottom-4 left-4 right-4 z-30 bg-red-500/20 border border-red-500/40 text-red-300 text-sm px-4 py-3 rounded-2xl text-center backdrop-blur-md">
            {error}
          </div>
        )}
      </div>

      {/* ── Bottom controls ──────────────────────────────────────────── */}
      <div className="bg-black px-6 pt-5 pb-8 z-20">
        <canvas ref={canvasRef} className="hidden" />

        {!captured ? (
          /* Live view controls */
          <div className="flex items-center justify-between max-w-xs mx-auto">
            {/* Gallery / upload placeholder */}
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white/30" />
            </div>

            {/* Shutter button */}
            <button
              onClick={capture}
              disabled={!isReady}
              className="relative w-[72px] h-[72px] rounded-full disabled:opacity-30 active:scale-95 transition-transform"
            >
              {/* Outer ring */}
              <span className="absolute inset-0 rounded-full border-4 border-white/80" />
              {/* Inner circle */}
              <span className="absolute inset-[6px] rounded-full bg-white shadow-xl shadow-white/30" />
            </button>

            {/* Flip camera */}
            <button
              onClick={flipCamera}
              className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <RotateCcw className="w-5 h-5 text-white/70" />
            </button>
          </div>
        ) : (
          /* Post-capture controls */
          <div className="flex gap-3 max-w-xs mx-auto">
            <button
              onClick={retake}
              className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-sm bg-white/10 text-white border border-white/10 hover:bg-white/20 transition-colors active:scale-95"
            >
              <RotateCcw className="w-4 h-4" /> Retake
            </button>
            <button
              onClick={confirm}
              className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-sm
                bg-gradient-to-r from-violet-600 to-fuchsia-600
                hover:from-violet-500 hover:to-fuchsia-500
                text-white shadow-lg shadow-violet-500/30 active:scale-95 transition-all"
            >
              <Check className="w-4 h-4" /> Use Photo
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}


// ── Corner bracket helper ──────────────────────────────────────────────────

function Corner({ pos }: { pos: "top-left" | "top-right" | "bottom-left" | "bottom-right" }) {
  const base = "absolute w-7 h-7 border-violet-400";
  const styles: Record<typeof pos, string> = {
    "top-left":     "top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-xl",
    "top-right":    "top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-xl",
    "bottom-left":  "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-xl",
    "bottom-right": "bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-xl",
  };
  return <div className={`${base} ${styles[pos]}`} />;
}
