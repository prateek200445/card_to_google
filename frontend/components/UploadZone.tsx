"use client";

import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, ImagePlus, X, AlertCircle, Camera } from "lucide-react";
import dynamic from "next/dynamic";

// Lazy-load camera (requires browser APIs — must not SSR)
const CameraCapture = dynamic(() => import("./CameraCapture"), { ssr: false });

interface Props {
  onFiles: (files: File[]) => void;
  isUploading: boolean;
  uploadPct: number;
  disabled?: boolean;
}

const MAX = 25;
const ACCEPTED = { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] };

export default function UploadZone({ onFiles, isUploading, uploadPct, disabled }: Props) {
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  // ── Dropzone ──────────────────────────────────────────────────────────
  const onDrop = useCallback((accepted: File[]) => {
    setValidationError(null);
    const combined = [...previews.map((p) => p.file), ...accepted];
    if (combined.length > MAX) {
      setValidationError(`Maximum ${MAX} images allowed.`);
      return;
    }
    const newPreviews = accepted.map((f) => ({ file: f, url: URL.createObjectURL(f) }));
    setPreviews((prev) => [...prev, ...newPreviews]);
  }, [previews]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxFiles: MAX,
    multiple: true,
    disabled: disabled || isUploading,
  });

  // ── Camera capture callback ───────────────────────────────────────────
  const handleCameraCapture = (file: File) => {
    if (previews.length >= MAX) {
      setValidationError(`Maximum ${MAX} images allowed.`);
      return;
    }
    setPreviews((prev) => [...prev, { file, url: URL.createObjectURL(file) }]);
  };

  const removeFile = (idx: number) => {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleUpload = () => {
    if (previews.length === 0) return;
    onFiles(previews.map((p) => p.file));
  };

  return (
    <div className="w-full space-y-5">
      {/* ── Mode buttons ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Upload tab — triggers dropzone via its own click */}
        <div
          {...getRootProps()}
          className={`
            flex-1 flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed cursor-pointer
            transition-all duration-300
            ${isDragActive
              ? "border-violet-500 bg-violet-500/10 scale-[1.01]"
              : "border-white/20 bg-white/5 hover:border-violet-500/60 hover:bg-white/10"
            }
            ${(disabled || isUploading) ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <input {...getInputProps()} />
          <div className={`p-3.5 rounded-full transition-colors ${isDragActive ? "bg-violet-500/20" : "bg-white/10"}`}>
            {isDragActive
              ? <ImagePlus className="w-8 h-8 text-violet-400" />
              : <Upload className="w-8 h-8 text-white/50" />
            }
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-white">
              {isDragActive ? "Drop cards here" : "Upload files"}
            </p>
            <p className="text-sm text-white/40 mt-0.5">
              Drag & drop or <span className="text-violet-400">browse</span> · JPG, PNG
            </p>
          </div>
        </div>

        {/* Camera tab */}
        <button
          onClick={() => setCameraOpen(true)}
          disabled={disabled || isUploading}
          className={`
            flex flex-col items-center gap-3 px-8 py-8 rounded-2xl border-2 border-dashed cursor-pointer
            transition-all duration-300
            border-white/20 bg-white/5 hover:border-fuchsia-500/60 hover:bg-fuchsia-500/5
            ${(disabled || isUploading) ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <div className="p-3.5 rounded-full bg-white/10 group-hover:bg-fuchsia-500/20 transition-colors">
            <Camera className="w-8 h-8 text-white/50" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-white">Camera</p>
            <p className="text-sm text-white/40 mt-0.5">Take a photo</p>
          </div>
        </button>
      </div>

      {/* ── Validation Error ──────────────────────────────────────────── */}
      {validationError && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {validationError}
        </div>
      )}

      {/* ── Previews grid ─────────────────────────────────────────────── */}
      {previews.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-white/60 font-medium">
            {previews.length} card{previews.length > 1 ? "s" : ""} selected
            <span className="text-white/30 ml-2 text-xs">(click + to add more)</span>
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {previews.map(({ file, url }, idx) => (
              <div key={idx} className="relative group aspect-[3/2] rounded-xl overflow-hidden bg-white/5 border border-white/10">
                <img src={url} alt={file.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => removeFile(idx)}
                    className="p-1.5 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1">
                  <p className="text-[9px] text-white/80 truncate">{file.name}</p>
                </div>
                {/* Camera badge */}
                {file.name.startsWith("card_camera_") && (
                  <div className="absolute top-1 left-1 bg-fuchsia-500/80 rounded-full p-0.5">
                    <Camera className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Progress / Extract button */}
          {isUploading ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-white/60">
                <span>Uploading...</span>
                <span>{uploadPct}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-300"
                  style={{ width: `${uploadPct}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={handleUpload}
              className="w-full py-3.5 rounded-xl font-semibold text-white
                bg-gradient-to-r from-violet-600 to-fuchsia-600
                hover:from-violet-500 hover:to-fuchsia-500
                active:scale-[0.98] transition-all duration-200 shadow-lg shadow-violet-500/25"
            >
              Extract Data from {previews.length} Card{previews.length > 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}

      {/* ── Camera overlay (full-screen) ──────────────────────────────── */}
      {cameraOpen && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
}
