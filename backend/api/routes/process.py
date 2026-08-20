"""
POST /process  — Kick off async pipeline for a job.
GET  /status/{job_id} — Poll per-image processing status.
"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, BackgroundTasks, HTTPException

from core.pipeline import process_batch
from models.schemas import JobStatus, ProcessRequest, ProcessResponse
from utils.job_store import job_store
from utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.post("/process", response_model=ProcessResponse)
async def start_processing(req: ProcessRequest, background_tasks: BackgroundTasks):
    job = await job_store.get_job(req.job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{req.job_id}' not found.")

    filenames = [img.filename for img in job.images]

    # Fire-and-forget — runs in background without blocking the response
    background_tasks.add_task(_run_pipeline, req.job_id, filenames)

    return ProcessResponse(
        job_id=req.job_id,
        message=f"Processing started for {len(filenames)} image(s).",
    )


@router.get("/status/{job_id}", response_model=JobStatus)
async def get_status(job_id: str):
    job = await job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return job


async def _run_pipeline(job_id: str, filenames: list[str]) -> None:
    try:
        await process_batch(job_id, filenames)
        logger.info("Batch complete for job %s", job_id)
    except Exception as exc:
        logger.error("Batch pipeline crashed for job %s: %s", job_id, exc)
