"""
Puter.com AI fallback — free vision OCR when OpenRouter hits rate limits.

Puter provides free access to GPT-4o-mini with vision capabilities.
No credit card required, generous free tier.

Setup:
  1. Go to https://puter.com and create a free account
  2. Open browser DevTools (F12) → Application → Local Storage → puter.com
  3. Copy the value of `puter.auth.token`
  4. Set PUTER_API_TOKEN=<that token> in your .env
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

_TOKEN = os.getenv("PUTER_API_TOKEN", "").strip()
_REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "45.0"))
_API_URL = "https://api.puter.com/drivers/call"

# Puter uses OpenAI-compatible models; gpt-4o-mini has vision + is free on Puter
_MODEL = os.getenv("PUTER_MODEL", "gpt-4o-mini")

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
    Send image to Puter's free AI (GPT-4o-mini with vision).
    Returns parsed dict on success, None on failure.
    """
    if not _TOKEN:
        logger.warning("[%s] PUTER_API_TOKEN not set — skipping Puter fallback", filename)
        return None

    # Encode image
    p = Path(image_path)
    mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}
    mime = mime_map.get(p.suffix.lower(), "image/jpeg")
    with open(p, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

    payload = {
        "interface": "puter-chat-completion",
        "driver": "openai-completion",
        "method": "complete",
        "args": {
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
            "response_format": {"type": "json_object"},
        },
    }

    headers = {
        "Authorization": f"Bearer {_TOKEN}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
            resp = await client.post(_API_URL, json=payload, headers=headers)

        if not resp.is_success:
            logger.warning(
                "[%s] Puter API HTTP %s: %s", filename, resp.status_code, resp.text[:300]
            )
            return None

        data = resp.json()

        # Puter returns OpenAI-compatible response
        try:
            text = data["result"]["message"]["content"]
        except (KeyError, TypeError):
            # Try standard OpenAI format
            try:
                text = data["choices"][0]["message"]["content"]
            except (KeyError, IndexError):
                logger.warning("[%s] Puter unexpected response: %s", filename, str(data)[:200])
                return None

        text = text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()

        if not text:
            logger.warning("[%s] Puter returned empty text", filename)
            return None

        result = json.loads(text)
        logger.info("[%s] ✓ Puter fallback extraction succeeded (model=%s)", filename, _MODEL)
        return result

    except httpx.TimeoutException:
        logger.warning("[%s] Puter API timed out", filename)
    except json.JSONDecodeError as exc:
        logger.warning("[%s] Puter response parse error: %s", filename, exc)
    except Exception as exc:
        logger.warning("[%s] Puter API error: %s", filename, exc)

    return None
