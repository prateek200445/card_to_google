"""
POST /upload — Accept up to 25 images, save to disk, create job.
"""
from __future__ import annotations

import os
import shutil
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from models.schemas import UploadResponse
from utils.job_store import job_store
from utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))
MAX_BATCH_SIZE = int(os.getenv("MAX_BATCH_SIZE", "25"))
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/jpg"}
ALLOWED_EXTS = {".jpg", ".jpeg", ".png"}


@router.post("/upload", response_model=UploadResponse)
async def upload_images(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")
    if len(files) > MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {MAX_BATCH_SIZE} images per batch. Got {len(files)}.",
        )

    # Validate file types
    for f in files:
        ext = Path(f.filename or "").suffix.lower()
        if ext not in ALLOWED_EXTS:
            raise HTTPException(
                status_code=422,
                detail=f"Unsupported file type '{f.filename}'. Allowed: JPG, JPEG, PNG.",
            )

    # Create job + directory
    filenames = [f.filename for f in files]
    job_id = await job_store.create_job(filenames)
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    # Save files
    saved: list[str] = []
    for upload in files:
        dest = job_dir / upload.filename
        try:
            with dest.open("wb") as out:
                shutil.copyfileobj(upload.file, out)
            saved.append(upload.filename)
            logger.info("Saved %s → %s", upload.filename, dest)
        except Exception as exc:
            logger.error("Failed to save %s: %s", upload.filename, exc)
            raise HTTPException(status_code=500, detail=f"Failed to save {upload.filename}.")
        finally:
            await upload.close()

    return UploadResponse(
        job_id=job_id,
        filenames=saved,
        message=f"{len(saved)} image(s) uploaded successfully.",
    )
