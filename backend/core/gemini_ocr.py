"""
Google AI Studio (Gemini) fallback OCR.

Sends the image directly to Gemini — vision + OCR + JSON structuring in ONE call.
No intermediate steps, no OpenRouter needed for this path.

Free limits (Gemini 1.5 Flash via AI Studio):
  - 1,500 requests/day
  - 15 requests/minute
  - 1M tokens/minute

Setup: Get key at https://aistudio.google.com/apikey
Set env var: GOOGLE_AI_API_KEY=your_key
"""
from __future__ import annotations

import base64
import json
import os
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import httpx

from utils.logger import get_logger

logger = get_logger(__name__)

_API_KEY = os.getenv("GOOGLE_AI_API_KEY", "").strip()
_REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "45.0"))
_MODEL = os.getenv("GOOGLE_AI_MODEL", "gemini-1.5-flash")
_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{_MODEL}:generateContent"

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


async def extract_from_image(
    image_path: str,
    filename: str,
) -> Optional[Dict[str, Any]]:
    """
    Send image directly to Gemini — OCR + extraction in one API call.
    Returns parsed dict on success, None on failure.
    """
    if not _API_KEY:
        logger.warning("[%s] GOOGLE_AI_API_KEY not set — skipping Gemini fallback", filename)
        return None

    # Encode image
    p = Path(image_path)
    mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}
    mime = mime_map.get(p.suffix.lower(), "image/jpeg")
    with open(p, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

    payload = {
        "contents": [
            {
                "parts": [
                    {"inline_data": {"mime_type": mime, "data": b64}},
                    {"text": _PROMPT},
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.0,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
            resp = await client.post(
                _API_URL,
                params={"key": _API_KEY},
                json=payload,
            )

        if not resp.is_success:
            logger.warning(
                "[%s] Gemini API HTTP %s: %s",
                filename, resp.status_code, resp.text[:300],
            )
            return None

        data = resp.json()

        # Extract text — handle thinking models (skip thought parts)
        try:
            parts = data["candidates"][0]["content"]["parts"]
            # Find the first non-thought part (actual response)
            text = next(
                (p["text"] for p in parts if not p.get("thought", False)),
                None,
            )
            if text is None:
                text = parts[0].get("text", "")
        except (KeyError, IndexError, StopIteration) as exc:
            logger.warning("[%s] Gemini unexpected response shape: %s | raw: %s", filename, exc, str(data)[:200])
            return None

        # Strip markdown code fences if present (e.g. ```json ... ```)
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()

        if not text:
            logger.warning("[%s] Gemini returned empty text body", filename)
            return None

        logger.debug("[%s] Gemini raw text (first 200): %s", filename, text[:200])
        result = json.loads(text)
        logger.info("[%s] ✓ Gemini AI Studio extraction succeeded (model=%s)", filename, _MODEL)
        return result

    except httpx.HTTPStatusError as exc:
        logger.warning(
            "[%s] Gemini API HTTP %s: %s",
            filename, exc.response.status_code, exc.response.text[:200],
        )
    except (KeyError, json.JSONDecodeError) as exc:
        logger.warning("[%s] Gemini response parse error: %s", filename, exc)
    except Exception as exc:
        logger.warning("[%s] Gemini API error: %s", filename, exc)

    return None
