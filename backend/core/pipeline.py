"""
Pipeline orchestrator — new OpenRouter-based flow.

Old flow: preprocess → OCR → clean → extract → score → LLM → normalize
New flow: encode → OpenRouter model → validate → retry → fallback → normalize
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path

from core.openrouter_ocr import extract_from_image
from core.normalizer import normalize
from models.schemas import CardResult, ProcessingStatus
from utils.job_store import job_store
from utils.logger import get_logger

logger = get_logger(__name__)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")


async def process_image(job_id: str, filename: str) -> CardResult:
    """
    Full pipeline for a single image.
    Updates job store at each stage.
    """
    filepath = str(Path(UPLOAD_DIR) / job_id / filename)

    # ── Stage: calling OCR model ──────────────────────────────────────
    await job_store.update_status(job_id, filename, ProcessingStatus.OCR)

    try:
        data, method, status = await extract_from_image(filepath, filename)
        # ── Normalize and store ───────────────────────────────────────────
        result = normalize(filename, data, method, status)

        final_status = ProcessingStatus.DONE if status == "success" else ProcessingStatus.FAILED
        error_msg = None if status == "success" else "All OCR models failed"

        await job_store.update_status(
            job_id, filename, final_status, result=result, error=error_msg
        )

        logger.info(
            "Finished %s → status=%s method=%s confidence=%.2f",
            filename, status, method, result.confidence,
        )
        return result
    except Exception as exc:
        logger.error("Pipeline crashed for %s: %s", filename, exc)
        result = CardResult(image=filename, error=str(exc), status="failed")
        await job_store.update_status(
            job_id, filename, ProcessingStatus.FAILED, result=result, error=str(exc)
        )
        return result
    finally:
        # Delete the uploaded image file immediately after encoding/sending to LLM
        # to conserve memory buffer cache and disk space on the host container.
        try:
            import os
            if os.path.exists(filepath):
                os.remove(filepath)
                logger.info("Deleted source image file after LLM processing: %s", filepath)
        except Exception as delete_exc:
            logger.warning("Failed to delete source image %s: %s", filepath, delete_exc)


async def process_batch(job_id: str, filenames: list[str]) -> list[CardResult]:
    """
    Process all images in the batch concurrently.
    Concurrency is controlled inside openrouter_ocr via semaphore.
    """
    tasks = [process_image(job_id, fn) for fn in filenames]
    outcomes = await asyncio.gather(*tasks, return_exceptions=True)

    final: list[CardResult] = []
    for fn, outcome in zip(filenames, outcomes):
        if isinstance(outcome, Exception):
            logger.error("Unhandled exception in batch for %s: %s", fn, outcome)
            err = CardResult(image=fn, error=str(outcome), status="failed")
            await job_store.update_status(
                job_id, fn, ProcessingStatus.FAILED, result=err, error=str(outcome)
            )
            final.append(err)
        else:
            final.append(outcome)

    done = sum(1 for r in final if r.status == "success")
    failed = sum(1 for r in final if r.status == "failed")
    logger.info("Batch %s complete: %d success, %d failed", job_id, done, failed)

    return final
