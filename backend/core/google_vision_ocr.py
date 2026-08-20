"""
Google Cloud Vision OCR — supports two auth methods:

Priority 1: GOOGLE_VISION_API_KEY (simple REST API key — recommended)
Priority 2: Service account credentials (GOOGLE_CREDENTIALS_JSON / GOOGLE_CREDENTIALS_PATH)

Enable Vision API at:
  https://console.cloud.google.com/apis/library/vision.googleapis.com

Cost: 1,000 images/month FREE, then ~$1.50 per 1,000 images.
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
from pathlib import Path
from typing import Optional

import httpx

from utils.logger import get_logger

logger = get_logger(__name__)

_VISION_REST_URL = "https://vision.googleapis.com/v1/images:annotate"
_API_KEY = os.getenv("GOOGLE_VISION_API_KEY", "").strip()
_REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "45.0"))


# ── REST API key approach (preferred) ────────────────────────────────────

async def _extract_via_api_key(image_path: str) -> Optional[str]:
    """Call Vision REST API using GOOGLE_VISION_API_KEY."""
    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

    payload = {
        "requests": [
            {
                "image": {"content": b64},
                "features": [{"type": "DOCUMENT_TEXT_DETECTION"}],
                "imageContext": {
                    "languageHints": ["hi", "en"]   # Hindi + English
                },
            }
        ]
    }

    try:
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
            resp = await client.post(
                _VISION_REST_URL,
                params={"key": _API_KEY},
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            text = (
                data.get("responses", [{}])[0]
                .get("fullTextAnnotation", {})
                .get("text", "")
            )
            return text.strip() or None
    except Exception as exc:
        logger.warning("Google Vision REST API error for %s: %s", image_path, exc)
        return None


# ── Service account approach (fallback) ──────────────────────────────────

def _extract_via_service_account(image_path: str) -> Optional[str]:
    """Call Vision API using service account credentials (sync)."""
    try:
        from google.cloud import vision
        from google.oauth2 import service_account

        raw_json = os.getenv("GOOGLE_CREDENTIALS_JSON", "").strip()
        if raw_json:
            info = json.loads(raw_json)
            creds = service_account.Credentials.from_service_account_info(info)
        else:
            creds_path = os.getenv("GOOGLE_CREDENTIALS_PATH", "credentials.json")
            creds = service_account.Credentials.from_service_account_file(creds_path)

        client = vision.ImageAnnotatorClient(credentials=creds)

        with open(image_path, "rb") as f:
            content = f.read()

        image = vision.Image(content=content)
        response = client.document_text_detection(
            image=image,
            image_context={"language_hints": ["hi", "en"]},
        )

        if response.error.message:
            logger.warning("Vision service account error: %s", response.error.message)
            return None

        text = response.full_text_annotation.text
        return text.strip() or None

    except ImportError:
        logger.warning(
            "google-cloud-vision not installed. "
            "Set GOOGLE_VISION_API_KEY for API key mode instead."
        )
        return None
    except Exception as exc:
        logger.warning("Vision service account error for %s: %s", image_path, exc)
        return None


# ── Public entrypoint ─────────────────────────────────────────────────────

async def extract_text(image_path: str) -> Optional[str]:
    """
    Extract text from image using Google Vision.
    Tries API key first (faster, simpler), then service account.
    """
    filename = Path(image_path).name

    if _API_KEY:
        logger.info("[%s] Using Google Vision REST API (API key)", filename)
        text = await _extract_via_api_key(image_path)
    else:
        logger.info("[%s] Using Google Vision service account", filename)
        text = await asyncio.to_thread(_extract_via_service_account, image_path)

    if text:
        logger.info("[%s] Google Vision extracted %d chars", filename, len(text))
    else:
        logger.warning("[%s] Google Vision returned no text", filename)

    return text
