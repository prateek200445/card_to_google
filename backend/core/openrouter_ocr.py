"""
OpenRouter OCR Engine — unified image → structured JSON extractor.

Pipeline per image:
  1. Try each OpenRouter vision model (primary + fallbacks), 2 attempts each
  2. If ALL vision models fail → Google Vision API (pure OCR) + text-only LLM (structuring)
  3. Return empty result with failed status if everything fails

Concurrency: controlled via asyncio.Semaphore (MAX_CONCURRENCY env var, default 6).
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx

from core.validator import sanitize, validate_result
from utils.logger import get_logger

logger = get_logger(__name__)

# ── API Key pool — rotate on 429 ─────────────────────────────────────────
# Supports multiple keys via OPENROUTER_API_KEYS (comma-separated)
# Falls back to single OPENROUTER_API_KEY for backwards compatibility
_raw_keys = os.getenv("OPENROUTER_API_KEYS", "") or os.getenv("OPENROUTER_API_KEY", "")
_API_KEYS: List[str] = [k.strip() for k in _raw_keys.split(",") if k.strip()]

if not _API_KEYS:
    logger.warning("No OpenRouter API keys configured!")

_API_BASE = "https://openrouter.ai/api/v1"
_REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "45.0"))
_MAX_CONCURRENCY = int(os.getenv("MAX_CONCURRENCY", "6"))

# Vision model priority: primary first, then fallbacks (only keep working models)
_MODELS: List[str] = [
    m for m in [
        os.getenv("OPENROUTER_PRIMARY_MODEL", "baidu/qianfan-ocr-fast:free"),
        os.getenv("OPENROUTER_FALLBACK_1", ""),   # empty = disabled
        os.getenv("OPENROUTER_FALLBACK_2", ""),   # empty = disabled
    ] if m.strip()
]

# Text-only LLM used to structure raw OCR text (Google Vision fallback path)
_TEXT_LLM = os.getenv("OPENROUTER_TEXT_LLM", "google/gemma-3-12b-it:free")

# Lazy semaphore (created on first use to respect event loop)
_semaphore: Optional[asyncio.Semaphore] = None


def _get_semaphore() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(_MAX_CONCURRENCY)
    return _semaphore


# ── Extraction prompt ─────────────────────────────────────────────────────

_PROMPT = """\
This is a Hindi + English visiting card. Read ALL visible text carefully — including stylized, decorative, and handwritten-style fonts. Do NOT skip any text.

You are an expert OCR system specialized in Indian business cards with mixed Hindi and English text.

━━━ STEP 1: READ TEXT ━━━
Extract ALL visible text exactly as it appears (keep Hindi in Hindi, English in English).
Pay special attention to:
• Top-left and top-right corners
• Large central text (often the shop/company name in stylized Hindi)
• Smaller sub-text beside names (designation, role)
• Bottom section (usually the full address)
• Any decorative or ornamental text blocks

━━━ STEP 2: IDENTIFY STRUCTURE ━━━
This card may contain:
• A business/shop name in large stylized Hindi (e.g. "साड़ी हाउस", "मेडिकल स्टोर")
• MULTIPLE person names — each may have their OWN phone number
• One or more email addresses
• A full postal address at the bottom

━━━ STEP 3: RETURN STRUCTURED JSON ━━━
Return ONLY valid JSON — no explanation, no markdown, no code fences.

Schema:
{
  "company": "",
  "contacts": [
    {
      "name": "",
      "phones": []
    }
  ],
  "emails": [],
  "address": ""
}

━━━ EXTRACTION RULES ━━━

🏢 company
  • Usually the large central text (shop or business name)
  • Keep it in the original language (Hindi stays Hindi)
  • Example: "साड़ी हाउस", "Sharma General Store"

👤 contacts (IMPORTANT — do NOT merge multiple people)
  • Extract EVERY person shown on the card as a SEPARATE entry
  • Each contact has their own name and their own phone list
  • If a phone number is clearly next to a specific person, link it to that person
  • If a phone number has no clear owner, add it to the FIRST contact

📱 phones
  • Return as digit-only strings (strip +, spaces, dashes, parentheses)
  • Extract ALL numbers — mobile, landline, WhatsApp
  • Keep linked to the correct person

📍 address
  • Combine the full postal address into one string
  • Include street, locality, city, state, pincode if visible
  • Keep Hindi text as-is

📧 emails
  • Return all email addresses in lowercase

━━━ STRICT RULES ━━━
✗ Do NOT hallucinate or guess missing data — use "" or [] for unknowns
✗ Do NOT translate Hindi to English
✗ Do NOT merge multiple contacts into one
✗ Return ONLY the JSON object — nothing else
"""

# ── Image encoding ────────────────────────────────────────────────────────

def _encode_image(path: str | Path) -> Tuple[str, str]:
    """Read image file and return (base64_string, mime_type)."""
    p = Path(path)
    mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}
    mime = mime_map.get(p.suffix.lower(), "image/jpeg")
    with open(p, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    return b64, mime


# ── Single model call ─────────────────────────────────────────────────────

async def _call_model(
    image_b64: str,
    mime: str,
    model: str,
    filename: str,
    api_key: str,
) -> Tuple[Optional[Dict[str, Any]], bool]:
    """
    Call one OpenRouter vision model with the given API key.
    Returns (parsed_dict, is_rate_limited).
    """
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{image_b64}"},
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
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://cardscan.local",
        "X-Title": "CardScan AI",
    }

    try:
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
            resp = await client.post(
                f"{_API_BASE}/chat/completions",
                json=payload,
                headers=headers,
            )
            if resp.status_code == 429:
                logger.warning(
                    "[%s] HTTP 429 from model=%s: %s",
                    filename, model, resp.text[:200],
                )
                return None, True  # rate limited
            resp.raise_for_status()
            raw_content = resp.json()["choices"][0]["message"]["content"]
            return json.loads(raw_content), False

    except httpx.HTTPStatusError as exc:
        logger.warning(
            "[%s] HTTP %s from model=%s: %s",
            filename, exc.response.status_code, model, exc.response.text[:200],
        )
    except json.JSONDecodeError as exc:
        logger.warning("[%s] JSON parse error from model=%s: %s", filename, model, exc)
    except httpx.TimeoutException:
        logger.warning("[%s] Timeout after %.0fs from model=%s", filename, _REQUEST_TIMEOUT, model)
    except Exception as exc:
        logger.warning("[%s] Unexpected error from model=%s: %s", filename, model, exc)

    return None, False


# ── Main extraction entrypoint ────────────────────────────────────────────

async def extract_from_image(
    image_path: str,
    filename: str,
) -> Tuple[Dict[str, Any], str, str]:
    """
    Full extraction pipeline with retry and model fallback.

    Returns:
        (result_dict, method, status)
        method: "primary" | "fallback"
        status: "success" | "failed"
    """
    b64, mime = _encode_image(image_path)
    method = "primary"
    all_rate_limited = True  # track if ALL failures are 429s

    async with _get_semaphore():
        for model_idx, model in enumerate(_MODELS):
            if model_idx > 0:
                method = "fallback"
                logger.info("[%s] Switching to fallback model: %s", filename, model)

            # Try each API key for this model — rotate on 429
            for key_idx, api_key in enumerate(_API_KEYS):
                if key_idx > 0:
                    logger.info("[%s] Rotating to API key #%d for model=%s", filename, key_idx + 1, model)

                for attempt in range(1, 3):
                    logger.info(
                        "[%s] model=%s key=#%d attempt=%d/2", filename, model, key_idx + 1, attempt
                    )

                    raw, is_rate_limited = await _call_model(b64, mime, model, filename, api_key)

                    if is_rate_limited:
                        logger.warning("[%s] Key #%d hit 429 on model=%s", filename, key_idx + 1, model)
                        break  # break attempt loop → try next key

                    all_rate_limited = False  # at least one non-429 response

                    if raw is None:
                        logger.warning(
                            "[%s] model=%s key=#%d attempt=%d returned no data",
                            filename, model, key_idx + 1, attempt,
                        )
                        continue

                    is_valid, reason = validate_result(raw)
                    if is_valid:
                        logger.info(
                            "[%s] ✓ Valid result model=%s key=#%d attempt=%d method=%s",
                            filename, model, key_idx + 1, attempt, method,
                        )
                        return sanitize(raw), method, "success"
                    else:
                        logger.warning(
                            "[%s] ✗ Validation failed model=%s key=#%d attempt=%d reason=%s",
                            filename, model, key_idx + 1, attempt, reason,
                        )
                else:
                    # attempt loop completed without 429 or success → done with this key
                    break

    # ── All OpenRouter models failed → HuggingFace fallback ─────────────────
    if all_rate_limited:
        logger.warning("[%s] All OpenRouter models hit 429. Trying Gemini AI Studio...", filename)
    else:
        logger.warning("[%s] All OpenRouter models failed. Trying Gemini AI Studio...", filename)

    from core.gemini_ocr import extract_from_image as gemini_extract
    raw = await gemini_extract(image_path, filename)
    if raw is not None:
        is_valid, reason = validate_result(raw)
        if is_valid:
            return sanitize(raw), "fallback", "success"
        logger.warning("[%s] Gemini result failed validation: %s", filename, reason)

    logger.error("[%s] All methods failed. Returning empty result.", filename)
    return _empty_result(), "fallback", "failed"


# ── Google Vision fallback ────────────────────────────────────────────────

_TEXT_STRUCTURING_PROMPT = """\
You are a business card data extraction assistant.
Below is raw OCR text extracted from an Indian business card (may contain Hindi and English).

Extract the contact information and return ONLY valid JSON with this exact schema:
{
  "company": "",
  "contacts": [
    {"name": "", "phones": []}
  ],
  "emails": [],
  "address": ""
}

Rules:
- Keep Hindi text as-is (do NOT translate)
- phones: digit-only strings
- Extract ALL contacts, phones, and emails
- Return ONLY the JSON — no explanation

RAW OCR TEXT:
{raw_text}
"""


async def _google_vision_fallback(
    image_path: str,
    filename: str,
) -> Optional[Dict[str, Any]]:
    """
    Last-resort fallback:
    1. Google Vision API → extract raw text
    2. Text-only LLM on OpenRouter → structure into JSON
    """
    from core.google_vision_ocr import extract_text

    # Step 1: Google Vision OCR
    raw_text = await extract_text(image_path)
    if not raw_text:
        logger.warning("[%s] Google Vision returned no text", filename)
        return None

    logger.info("[%s] Google Vision OCR success (%d chars). Structuring...", filename, len(raw_text))

    # Step 2: Send raw text to a text-only LLM for structuring
    prompt = _TEXT_STRUCTURING_PROMPT.format(raw_text=raw_text)
    payload = {
        "model": _TEXT_LLM,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.0,
        "max_tokens": 600,
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://cardscan.local",
        "X-Title": "CardScan AI",
    }

    try:
        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
            resp = await client.post(f"{_API_BASE}/chat/completions", json=payload, headers=headers)
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            data = json.loads(content)
    except Exception as exc:
        logger.warning("[%s] Text LLM structuring failed: %s", filename, exc)
        return None

    is_valid, reason = validate_result(data)
    if is_valid:
        logger.info("[%s] ✓ Google Vision + LLM structuring succeeded", filename)
        return sanitize(data)
    else:
        logger.warning("[%s] Google Vision path validation failed: %s", filename, reason)
        return None


def _empty_result() -> Dict[str, Any]:
    return {"name": "", "company": "", "emails": [], "phones": [], "address": ""}
