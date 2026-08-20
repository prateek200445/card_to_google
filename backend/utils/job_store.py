"""
In-memory job store for tracking batch processing jobs.
Thread-safe for use with asyncio.
"""
from __future__ import annotations

import asyncio
import uuid
from typing import Dict, List, Optional

from models.schemas import CardResult, ImageStatus, JobStatus, ProcessingStatus


class JobStore:
    """Simple in-memory store. Replace with Redis for multi-worker deployments."""

    def __init__(self) -> None:
        self._jobs: Dict[str, JobStatus] = {}
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Job lifecycle
    # ------------------------------------------------------------------

    async def create_job(self, filenames: List[str]) -> str:
        job_id = str(uuid.uuid4())
        images = [ImageStatus(filename=f) for f in filenames]
        async with self._lock:
            self._jobs[job_id] = JobStatus(
                job_id=job_id,
                total=len(filenames),
                completed=0,
                failed=0,
                images=images,
            )
        return job_id

    async def get_job(self, job_id: str) -> Optional[JobStatus]:
        async with self._lock:
            return self._jobs.get(job_id)

    # ------------------------------------------------------------------
    # Per-image updates
    # ------------------------------------------------------------------

    async def update_status(
        self,
        job_id: str,
        filename: str,
        status: ProcessingStatus,
        result: Optional[CardResult] = None,
        error: Optional[str] = None,
    ) -> None:
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            for img in job.images:
                if img.filename == filename:
                    img.status = status
                    if result is not None:
                        img.result = result
                    if error is not None:
                        img.error = error
                    break
            # Recount
            job.completed = sum(
                1 for i in job.images if i.status == ProcessingStatus.DONE
            )
            job.failed = sum(
                1 for i in job.images if i.status == ProcessingStatus.FAILED
            )


# Singleton instance shared across the app
job_store = JobStore()
