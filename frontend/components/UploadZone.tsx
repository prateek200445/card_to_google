"use client";

import React, { useCallback, useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, AlertCircle, Camera, BookUser, ChevronRight, Sparkles, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { getSheetContacts } from "@/lib/api";

// Lazy-load camera (requires browser APIs — must not SSR)
const CameraCapture = dynamic(() => import("./CameraCapture"), { ssr: false });

interface Props {
  onFiles: (files: File[]) => void;
  isUploading: boolean;
  uploadPct: number;
  disabled?: boolean;
  onViewAll: () => void;
}

const MAX = 25;
const ACCEPTED = { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"] };

function getInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function UploadZone({ onFiles, isUploading, uploadPct, disabled, onViewAll }: Props) {
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [recent, setRecent] = useState<any[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [errorRecent, setErrorRecent] = useState<string | null>(null);

  // Load recent contacts for bento grid Card 3
  useEffect(() => {
    setLoadingRecent(true);
    setErrorRecent(null);
    getSheetContacts()
      .then((data) => {
        if (data && data.length > 0) {
          setRecent([...data].reverse().slice(0, 3));
        } else {
          setRecent([]);
        }
      })
      .catch((err) => {
        setErrorRecent(err.message || "Failed to load recent contacts");
        setRecent([]);
      })
      .finally(() => {
        setLoadingRecent(false);
      });
  }, []);

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
    <div className="w-full">
      {previews.length === 0 ? (
        /* Bento Grid Layout - optimized side-by-side layout for mobile */
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-8 w-full max-w-6xl mx-auto">
          
          {/* Card 1: Upload */}
          <div
            {...getRootProps()}
            className={`bg-white border border-surface-border rounded-xl md:rounded-2xl p-4 md:p-10 flex flex-col items-center justify-center min-h-[170px] md:min-h-[340px] bouncy-hover cursor-pointer group relative overflow-hidden shadow-lg transition-all duration-300
              ${isDragActive ? "border-primary bg-primary/5 scale-[1.01]" : "hover:border-primary/30"}
              ${(disabled || isUploading) ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <input {...getInputProps()} />
            <div className="w-11 h-11 md:w-20 md:h-20 rounded-full bg-surface-container flex items-center justify-center mb-2 md:mb-6 group-hover:bg-primary/10 transition-colors duration-300">
              <Upload className="w-5 h-5 md:w-8 md:h-8 text-primary stroke-[1.5]" />
            </div>
            <h3 className="font-headline text-sm md:text-2xl font-bold text-on-surface mb-0.5 md:mb-3">Upload files</h3>
            <p className="hidden sm:block text-center text-on-surface-variant text-xs md:text-sm mb-6 md:mb-8 leading-relaxed font-body">
              Drag & drop or <span className="text-primary hover:underline underline-offset-4 cursor-pointer font-semibold">browse</span>
              <br />
              <span className="text-[10px] md:text-xs mt-2 block uppercase tracking-wider text-on-surface-variant/70">JPG, PNG</span>
            </p>
            <button
              type="button"
              className="bg-white border border-surface-border text-on-surface px-4 md:px-8 py-1 md:py-2.5 rounded-full font-semibold text-[10px] md:text-sm hover:border-primary hover:text-primary transition-all active:scale-95 shadow-sm"
            >
              Select Files
            </button>
          </div>

          {/* Card 2: Camera */}
          <div
            onClick={() => { if (!disabled && !isUploading) setCameraOpen(true); }}
            className={`bg-primary text-white rounded-xl md:rounded-2xl p-4 md:p-10 flex flex-col items-center justify-center min-h-[170px] md:min-h-[340px] bouncy-hover cursor-pointer relative overflow-hidden group shadow-lg shadow-primary/20
              ${(disabled || isUploading) ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <div className="w-11 h-11 md:w-20 md:h-20 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center mb-2 md:mb-6 group-hover:scale-110 transition-transform duration-500">
              <Camera className="w-5 h-5 md:w-8 md:h-8 text-white stroke-[1.5]" />
            </div>
            <h3 className="font-headline text-sm md:text-2xl font-bold mb-0.5 md:mb-3 text-white">Camera</h3>
            <p className="hidden sm:block text-center text-white/80 text-xs md:text-sm mb-6 md:mb-8 leading-relaxed max-w-[200px] font-body">
              Take a photo of a business card instantly.
            </p>
            <button
              type="button"
              className="bg-white text-primary px-4 py-1.5 md:px-8 md:py-3 rounded-full font-bold text-[10px] md:text-sm w-full hover:bg-white/95 transition-all active:scale-95 flex items-center justify-center gap-1 shadow-sm"
            >
              <span>Open Camera</span>
              <ChevronRight className="w-3 h-3 md:w-4 md:h-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </div>

          {/* Card 3: Recent Contacts - spans 2 columns on mobile */}
          <div className="col-span-2 lg:col-span-1 bg-white border border-surface-border rounded-xl md:rounded-2xl p-4 md:p-8 flex flex-col min-h-[190px] md:min-h-[340px] bouncy-hover shadow-lg">
            <div className="flex justify-between items-center mb-3 md:mb-6 border-b border-surface-border pb-2 md:pb-4">
              <h3 className="font-headline text-sm md:text-xl font-bold text-on-surface flex items-center gap-1.5 md:gap-2">
                <BookUser className="w-4 h-4 md:w-5 md:h-5 text-primary stroke-[1.5]" />
                Recent
              </h3>
              <button
                type="button"
                onClick={onViewAll}
                className="text-primary text-xs md:text-sm font-semibold hover:underline underline-offset-4"
              >
                View All
              </button>
            </div>
            <div className="flex flex-col gap-1.5 md:gap-3 flex-1 justify-center">
              {loadingRecent && (
                <div className="flex flex-col items-center justify-center py-4 gap-2 text-on-surface-variant/50">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-[10px] md:text-xs font-semibold font-body">Loading...</span>
                </div>
              )}

              {!loadingRecent && errorRecent && (
                <div className="flex flex-col items-center justify-center py-4 text-center text-red-500/80 gap-1">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <span className="text-[10px] md:text-xs font-semibold font-body">{errorRecent}</span>
                </div>
              )}

              {!loadingRecent && !errorRecent && recent.length === 0 && (
                <div className="flex flex-col items-center justify-center py-4 text-center text-on-surface-variant/40">
                  <BookUser className="w-6 h-6 stroke-[1.5]" />
                  <span className="text-[10px] md:text-xs font-semibold font-body">No contacts yet</span>
                </div>
              )}

              {!loadingRecent && !errorRecent && recent.map((c, i) => {
                const mail = c.emails ? c.emails.split(";")[0] : "no email";
                return (
                  <div
                    key={i}
                    onClick={onViewAll}
                    className="flex items-center gap-2 md:gap-3.5 p-1.5 md:p-2.5 rounded-lg md:rounded-xl hover:bg-surface-container transition-all duration-200 cursor-pointer group"
                  >
                    <div className="w-8 h-8 md:w-11 md:h-11 rounded-full bg-surface-container border border-surface-border flex items-center justify-center text-primary font-headline font-bold text-xs md:text-sm group-hover:border-primary/45 transition-colors shrink-0">
                      {getInitials(c.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-headline font-bold text-on-surface text-xs md:text-sm truncate">
                        {c.name || "Unknown"}
                      </h4>
                      <p className="text-[10px] md:text-xs text-on-surface-variant truncate font-body">
                        {mail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      ) : (
        /* Preview Grid State */
        <div className="max-w-4xl mx-auto bg-white border border-surface-border rounded-2xl md:rounded-3xl p-5 md:p-8 shadow-xl space-y-4 md:space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base md:text-xl font-bold text-on-surface">Selected Cards</h3>
              <p className="text-[10px] md:text-xs text-on-surface-variant font-medium mt-0.5 font-body">
                {previews.length} card{previews.length > 1 ? "s" : ""} ready for extraction
              </p>
            </div>
            <button
              onClick={() => setPreviews([])}
              className="text-xs text-on-surface-variant hover:text-primary transition-colors font-semibold"
            >
              Clear all
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
            {previews.map(({ file, url }, idx) => (
              <div key={idx} className="relative group aspect-[3/2] rounded-xl overflow-hidden bg-surface-container border border-surface-border">
                <img src={url} alt={file.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => removeFile(idx)}
                    className="p-1.5 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
                  <p className="text-[10px] text-white/90 truncate font-body">{file.name}</p>
                </div>
                {file.name.startsWith("card_camera_") && (
                  <div className="absolute top-2 left-2 bg-primary rounded-full p-1 shadow">
                    <Camera className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </div>
            ))}
            
            {previews.length < MAX && (
              <div
                {...getRootProps()}
                className="border border-dashed border-surface-border hover:border-primary/50 rounded-xl aspect-[3/2] flex flex-col items-center justify-center cursor-pointer hover:bg-primary/[0.02] transition-colors"
              >
                <input {...getInputProps()} />
                <Upload className="w-5 h-5 text-on-surface-variant mb-1" />
                <span className="text-[10px] text-on-surface-variant font-semibold font-body">Add more</span>
              </div>
            )}
          </div>

          {validationError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/10 text-red-500 text-sm font-body">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {validationError}
            </div>
          )}

          {/* Extract button / progress */}
          {isUploading ? (
            <div className="space-y-2 pt-1">
              <div className="flex justify-between text-xs text-on-surface-variant font-semibold font-body">
                <span>Uploading files...</span>
                <span>{uploadPct}%</span>
              </div>
              <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${uploadPct}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={handleUpload}
              className="w-full py-3.5 md:py-4 rounded-full font-bold text-white bg-primary hover:bg-primary/95 transition-all active:scale-[0.98] shadow-lg shadow-primary/20 flex items-center justify-center gap-2 text-xs md:text-sm"
            >
              <Sparkles className="w-4 h-4" />
              Extract {previews.length} Card{previews.length > 1 ? "s" : ""}
            </button>
          )}
        </div>
      )}

      {/* Camera Full-screen overlay */}
      {cameraOpen && (
        <CameraCapture
          onCapture={handleCameraCapture}
          onClose={() => setCameraOpen(false)}
        />
      )}
    </div>
  );
}
