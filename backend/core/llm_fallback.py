"""
LLM fallback via OpenRouter (OpenAI-compatible API).
Only called when rule-based confidence < threshold.
"""
from __future__ import annotations

import json
import os
from typing import Any, Dict

import httpx

from core.extractor import ExtractionResult
from utils.logger import get_logger

logger = get_logger(__name__)

_API_BASE = "https://openrouter.ai/api/v1"
_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
_API_KEY = os.getenv("OPENROUTER_API_KEY", "")

_SYSTEM_PROMPT = (
    "You are a data extraction assistant for business/visiting cards. "
    "Return ONLY valid JSON. Do NOT hallucinate. Use empty string or [] for unknowns. "
    "Do NOT change email/phone values unless clearly garbled. "
    "Phones must be digit-only strings (no spaces, dashes, +). "
    'Schema: {"name":"","company":"","emails":[],"phones":[],"address":""}'
)


def _build_user_prompt(ocr_text: str, partial: ExtractionResult) -> str:
    hints = []
    if partial.emails:
        hints.append(f"Already found emails (keep): {partial.emails}")
    if partial.phones:
        hints.append(f"Already found phones (keep): {partial.phones}")
    hint_block = "\n".join(hints) if hints else "No partial extractions."
    return (
        f"RAW OCR TEXT:\n{ocr_text}\n\n"
        f"PARTIAL EXTRACTIONS:\n{hint_block}\n\n"
        "Extract structured JSON now."
    )


async def llm_extract(
    ocr_text: str,
    partial: ExtractionResult,
    filename: str = "",
) -> Dict[str, Any]:
    if not _API_KEY:
        logger.warning("OPENROUTER_API_KEY not set — skipping LLM for %s", filename)
        return _partial_to_dict(partial)

    payload = {
        "model": _MODEL,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(ocr_text, partial)},
        ],
        "temperature": 0.0,
        "max_tokens": 512,
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://card-extractor.local",
        "X-Title": "Card Extractor",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{_API_BASE}/chat/completions", json=payload, headers=headers)
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            parsed = json.loads(content)
            logger.info("LLM success for %s", filename)
            return _sanitize(parsed, partial)
    except Exception as exc:
        logger.error("LLM error for %s: %s", filename, exc)
        return _partial_to_dict(partial)


def _sanitize(parsed: Dict[str, Any], partial: ExtractionResult) -> Dict[str, Any]:
    emails = parsed.get("emails") or partial.emails
    phones = parsed.get("phones") or partial.phones
    phones = ["".join(filter(str.isdigit, str(p))) for p in phones]
    phones = [p for p in phones if len(p) >= 10]
    return {
        "name": str(parsed.get("name") or "").strip(),
        "company": str(parsed.get("company") or "").strip(),
        "emails": [str(e).lower().strip() for e in emails if e],
        "phones": phones,
        "address": str(parsed.get("address") or "").strip(),
    }


def _partial_to_dict(partial: ExtractionResult) -> Dict[str, Any]:
    return {
        "name": partial.name,
        "company": partial.company,
        "emails": partial.emails,
        "phones": partial.phones,
        "address": partial.address,
    }
