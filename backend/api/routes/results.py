"""
GET /results/{job_id} — Return all extracted results for a completed job.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from models.schemas import CardResult, ProcessingStatus
from utils.job_store import job_store

router = APIRouter()


@router.get("/results/{job_id}", response_model=list[CardResult])
async def get_results(job_id: str):
    job = await job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    results: list[CardResult] = []
    for img in job.images:
        if img.result:
            results.append(img.result)
        elif img.status == ProcessingStatus.FAILED:
            results.append(CardResult(image=img.filename, error=img.error))
        else:
            # Still processing — return placeholder
            results.append(CardResult(image=img.filename))

    return results
