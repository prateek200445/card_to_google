"""
Hugging Face Inference API fallback OCR.

Uses HF's free serverless inference with vision models.
Best model: Qwen/Qwen2.5-VL-7B-Instruct — multilingual, excellent Hindi OCR.

Free limits: generous daily quota, resets daily.
No credit card required — just a free HF account.

Setup:
  1. Go to https://huggingface.co/settings/tokens
  2. Create a token (Read access is enough)
  3. Set HF_TOKEN=hf_xxxxxxxxxxxx in your .env
"""
from __future__ import annotations

import base64
import json
import os
from pathlib import Path
from typing import Any, Dict, Optional

import httpx

from utils.logger import get_logger

logger = get_logger(__name__)

_HF_TOKEN = os.getenv("HF_TOKEN", "").strip()
_REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "60.0"))  # HF can be slower
_MODEL = os.getenv("HF_MODEL", "Qwen/Qwen2.5-VL-7B-Instruct")

# HuggingFace router — OpenAI-compatible chat completions for serverless inference
_API_URL = "https://router.huggingface.co/hf-inference/v1/chat/completions"

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
    Send image to HuggingFace vision model for OCR + extraction.
    Returns parsed dict on success, None on failure.
    """
    if not _HF_TOKEN:
        logger.warning("[%s] HF_TOKEN not set — skipping HuggingFace fallback", filename)
        return None

    # Encode image
    p = Path(image_path)
    mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}
    mime = mime_map.get(p.suffix.lower(), "image/jpeg")
    with open(p, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

    payload = {
        "model": _MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{b64}"},
                    },
                    {"type": "text", "text": _PROMPT},
                ],
            }
        ],
        "temperature": 0.0,
        "max_tokens": 600,
        "response_format": {"type": "json_object"},
    }

    headers = {
        "Authorization": f"Bearer {_HF_TOKEN}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
            resp = await client.post(_API_URL, json=payload, headers=headers)

        if not resp.is_success:
            logger.warning(
                "[%s] HuggingFace API HTTP %s: %s",
                filename, resp.status_code, resp.text[:300],
            )
            return None

        data = resp.json()

        try:
            text = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError):
            logger.warning("[%s] HF unexpected response shape: %s", filename, str(data)[:200])
            return None

        # Strip markdown code fences if present
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()

        if not text:
            logger.warning("[%s] HuggingFace returned empty text", filename)
            return None

        result = json.loads(text)
        logger.info("[%s] ✓ HuggingFace extraction succeeded (model=%s)", filename, _MODEL)
        return result

    except httpx.TimeoutException:
        logger.warning("[%s] HuggingFace API timed out (model loading may take ~30s on first call)", filename)
    except json.JSONDecodeError as exc:
        logger.warning("[%s] HF response parse error: %s", filename, exc)
    except Exception as exc:
        logger.warning("[%s] HuggingFace API error: %s", filename, exc)

    return None
