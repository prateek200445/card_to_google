"""
Output normalizer — assembles a CardResult from the extraction dict.
Handles both:
  - New contacts-array schema (Hindi/multi-contact cards)
  - Legacy name/phones schema
"""
from __future__ import annotations

import re
from typing import Any, Dict, List

from models.schemas import CardResult, ExtractionMethod


def normalize(
    filename: str,
    data: Dict[str, Any],
    method: str,
    status: str,
) -> CardResult:
    """
    Build a CardResult from raw extraction output.

    For multi-contact cards (contacts[] schema):
      - name  → all contact names joined with " | "
      - phones → all phones from all contacts merged and deduplicated
    """
    emails = [e.lower().strip() for e in (data.get("emails") or []) if e]

    city = str(data.get("city") or "").strip()

    if "contacts" in data:
        # ── New multi-contact schema ──────────────────────────────────
        contacts: List[Dict] = data.get("contacts") or []

        # Flatten names
        names = [str(c.get("name") or "").strip() for c in contacts]
        name = " | ".join(n for n in names if n)

        # Flatten job titles
        job_titles = [str(c.get("job_title") or "").strip() for c in contacts]
        job_title = " | ".join(j for j in job_titles if j) or str(data.get("job_title") or "").strip()

        # Flatten + deduplicate phones (preserve per-contact order)
        seen: set[str] = set()
        all_phones: List[str] = []
        for c in contacts:
            for p in (c.get("phones") or []):
                digits = re.sub(r"\D", "", str(p))
                if len(digits) >= 6 and digits not in seen:
                    seen.add(digits)
                    all_phones.append(digits)
        phones = [_fmt_phone(p) for p in all_phones]

    else:
        # ── Legacy schema ─────────────────────────────────────────────
        name = str(data.get("name") or "").strip()
        phones = [_fmt_phone(p) for p in (data.get("phones") or [])]
        job_title = str(data.get("job_title") or "").strip()

    extraction_method = (
        ExtractionMethod.RULE_BASED if method == "primary" else ExtractionMethod.LLM
    )
    confidence = _infer_confidence(data, status)

    return CardResult(
        image=filename,
        name=name,
        company=str(data.get("company") or "").strip(),
        emails=emails,
        phones=phones,
        address=str(data.get("address") or "").strip(),
        city=city,
        job_title=job_title,
        confidence=confidence,
        method=extraction_method,
        status=status,
        raw_text="",
    )


def _fmt_phone(raw: str) -> str:
    """Format digit-only phone: prefix +91 for 10-digit Indian numbers."""
    digits = re.sub(r"\D", "", str(raw))
    if len(digits) == 10 and digits[0] in "6789":
        return f"+91{digits}"
    if len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    return digits if digits else str(raw)


def _infer_confidence(data: Dict[str, Any], status: str) -> float:
    if status == "failed":
        return 0.0
    score = 0.0
    if data.get("emails"):
        score += 0.25
    # Phone presence (works for both schemas)
    has_phones = False
    if "contacts" in data:
        has_phones = any(c.get("phones") for c in (data.get("contacts") or []))
    else:
        has_phones = bool(data.get("phones"))
    if has_phones:
        score += 0.30
    if str(data.get("company") or "").strip():
        score += 0.25
    if str(data.get("address") or "").strip():
        score += 0.10
    # Name presence
    has_name = False
    if "contacts" in data:
        has_name = any(str(c.get("name") or "").strip() for c in (data.get("contacts") or []))
    else:
        has_name = bool(str(data.get("name") or "").strip())
    if has_name:
        score += 0.10
    return round(min(score, 1.0), 4)
