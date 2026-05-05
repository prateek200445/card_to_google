"""
Google AI Studio fallback OCR with multi-model fallback chain.

Tries models in order, moving to next on 429 rate limit or any error.

Default chain (configurable via GOOGLE_AI_MODELS env var):
  1. gemini-2.5-flash      — best quality,    20 RPD
  2. gemma-4-26b-a4b-it    — great quality, 1500 RPD
  3. gemma-4-31b-it         — great quality, 1500 RPD
  4. gemma-3-27b-it         — good quality, 14400 RPD  ← emergency fallback

Setup: Set GOOGLE_AI_API_KEY in .env (https://aistudio.google.com/apikey)
"""
from __future__ import annotations

import base64
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

from utils.logger import get_logger

logger = get_logger(__name__)

_API_KEY = os.getenv("GOOGLE_AI_API_KEY", "").strip()
_REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "45.0"))

# Comma-separated model fallback chain
_MODELS: List[str] = [
    m.strip()
    for m in os.getenv(
        "GOOGLE_AI_MODELS",
        "gemini-2.5-flash,gemma-4-26b-a4b-it,gemma-4-31b-it,gemma-3-27b-it",
    ).split(",")
    if m.strip()
]

_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

_PROMPT = """\
You are an expert OCR system for Indian business cards containing Hindi and English text.

Carefully read ALL visible text in the image — including stylized, decorative, and small fonts.

Extract and return ONLY valid JSON with this exact schema:
{
  "company": "",
  "contacts": [
    {"name": "", "phones": []}
  ],
  "emails": [],
  "address": ""
}

Rules:
🏢 company    — large central text, shop/business name (keep Hindi as-is)
👤 contacts   — extract EVERY person as a SEPARATE entry with their own phones
📱 phones     — digit-only strings, strip +/spaces/dashes
📍 address    — full postal address in one string, keep Hindi as-is
📧 emails     — all emails in lowercase
✗ Do NOT translate Hindi to English
✗ Do NOT merge multiple contacts
✗ Return ONLY the JSON — no markdown, no explanation
"""


async def _call_single_model(
    model: str,
    b64: str,
    mime: str,
    filename: str,
) -> tuple[Optional[Dict[str, Any]], bool]:
    """
    Call one Google AI Studio model.
    Returns (result_dict, is_rate_limited).
    """
    url = f"{_BASE_URL}/{model}:generateContent"
    payload = {
        "contents": [
            {
                "parts": [
                    {"inline_data": {"mime_type": mime, "data": b64}},
                    {"text": _PROMPT},
                ]
            }
        ],
        "generationConfig": {"temperature": 0.0},
    }

    try:
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
            resp = await client.post(url, params={"key": _API_KEY}, json=payload)

        if resp.status_code == 429:
            logger.warning("[%s] Google AI Studio 429 rate limit on model=%s", filename, model)
            return None, True  # rate limited → try next model

        if not resp.is_success:
            logger.warning(
                "[%s] Google AI Studio HTTP %s model=%s: %s",
                filename, resp.status_code, model, resp.text[:200],
            )
            return None, False

        data = resp.json()

        # Extract text — handle thinking models (skip thought parts)
        try:
            parts = data["candidates"][0]["content"]["parts"]
            text = next(
                (p["text"] for p in parts if not p.get("thought", False)),
                None,
            )
            if text is None:
                text = parts[0].get("text", "")
        except (KeyError, IndexError) as exc:
            logger.warning("[%s] Google AI Studio unexpected response model=%s: %s | raw: %s",
                           filename, model, exc, str(data)[:200])
            return None, False

        # Strip markdown fences if present
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()

        if not text:
            logger.warning("[%s] Google AI Studio returned empty text model=%s", filename, model)
            return None, False

        result = json.loads(text)
        logger.info("[%s] ✓ Google AI Studio succeeded (model=%s)", filename, model)
        return result, False

    except httpx.TimeoutException:
        logger.warning("[%s] Google AI Studio timeout model=%s", filename, model)
    except json.JSONDecodeError as exc:
        logger.warning("[%s] Google AI Studio parse error model=%s: %s", filename, model, exc)
    except Exception as exc:
        logger.warning("[%s] Google AI Studio error model=%s: %s", filename, model, exc)

    return None, False


async def extract_from_image(
    image_path: str,
    filename: str,
) -> Optional[Dict[str, Any]]:
    """
    Try each Google AI Studio model in order.
    Moves to next model on 429 rate limit.
    Returns parsed dict on success, None if all models fail.
    """
    if not _API_KEY:
        logger.warning("[%s] GOOGLE_AI_API_KEY not set — skipping Google AI Studio", filename)
        return None

    # Encode image
    p = Path(image_path)
    mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}
    mime = mime_map.get(p.suffix.lower(), "image/jpeg")
    with open(p, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

    for model in _MODELS:
        logger.info("[%s] Trying Google AI Studio model=%s", filename, model)
        result, is_rate_limited = await _call_single_model(model, b64, mime, filename)

        if result is not None:
            return result

        if is_rate_limited:
            logger.info("[%s] Rate limited on model=%s, trying next...", filename, model)
            continue  # try next model

        # Non-rate-limit error → still try next model (might be model-specific issue)
        logger.info("[%s] Failed on model=%s, trying next...", filename, model)

    logger.error("[%s] All Google AI Studio models failed", filename)
    return None
