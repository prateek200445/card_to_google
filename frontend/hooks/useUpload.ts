"use client";
import { useState, useCallback } from "react";
import { uploadImages, startProcessing, UploadResponse } from "@/lib/api";

export function useUpload() {
  const [uploadPct, setUploadPct] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (files: File[]): Promise<UploadResponse | null> => {
    setIsUploading(true);
    setUploadPct(0);
    setError(null);
    try {
      const resp = await uploadImages(files, setUploadPct);
      await startProcessing(resp.job_id);
      return resp;
    } catch (e: any) {
      setError(e.message || "Upload failed");
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  return { upload, uploadPct, isUploading, error };
}
