"""
Validation layer for OpenRouter OCR extraction results.
Supports both:
  - New schema: { company, contacts: [{name, phones}], emails, address }
  - Legacy schema: { name, company, emails, phones, address }
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Tuple

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", re.IGNORECASE)


def validate_result(data: Any) -> Tuple[bool, str]:
    """
    Validate an extracted result dict.
    Returns (True, "OK") or (False, reason).
    """
    if not isinstance(data, dict):
        return False, f"Expected dict, got {type(data).__name__}"

    has_contacts_schema = "contacts" in data
    has_legacy_schema = "name" in data or "phones" in data

    if not has_contacts_schema and not has_legacy_schema:
        return False, "Missing both 'contacts' and 'name'/'phones' fields"

    # ── Validate contacts-array schema ────────────────────────────────
    if has_contacts_schema:
        contacts = data["contacts"]
        if not isinstance(contacts, list):
            return False, f"'contacts' must be a list, got {type(contacts).__name__}"
        # Each contact entry
        for i, c in enumerate(contacts):
            if not isinstance(c, dict):
                return False, f"contacts[{i}] must be a dict"
            if "phones" in c and not isinstance(c["phones"], list):
                return False, f"contacts[{i}].phones must be a list"
    else:
        # ── Legacy schema ─────────────────────────────────────────────
        if "phones" in data and not isinstance(data["phones"], list):
            return False, "'phones' must be a list"

    # ── Validate emails ───────────────────────────────────────────────
    emails = data.get("emails") or []
    if not isinstance(emails, list):
        return False, "'emails' must be a list"
    for e in emails:
        if isinstance(e, str) and e.strip():
            if not _EMAIL_RE.fullmatch(e.strip()):
                return False, f"Invalid email: {e!r}"

    # ── At least one meaningful field ──────────────────────────────────
    has_data = (
        str(data.get("company") or "").strip()
        or str(data.get("address") or "").strip()
        or emails
        or _any_phone(data)
        or _any_name(data)
    )
    if not has_data:
        return False, "All fields are empty — likely extraction failure"

    return True, "OK"


def sanitize(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalise validated result: clean strings, lowercase emails, digit-only phones.
    Works for both contacts schema and legacy schema.
    """
    data["company"] = str(data.get("company") or "").strip()
    data["address"] = str(data.get("address") or "").strip()

    # Emails
    raw_emails = data.get("emails") or []
    data["emails"] = [str(e).lower().strip() for e in raw_emails if e and str(e).strip()]

    if "contacts" in data:
        cleaned_contacts = []
        for c in (data["contacts"] or []):
            cleaned_contacts.append({
                "name": str(c.get("name") or "").strip(),
                "phones": _clean_phones(c.get("phones") or []),
            })
        data["contacts"] = cleaned_contacts
    else:
        # Legacy
        data["name"] = str(data.get("name") or "").strip()
        data["phones"] = _clean_phones(data.get("phones") or [])

    return data


# ── Helpers ───────────────────────────────────────────────────────────────

def _clean_phones(raw: List) -> List[str]:
    cleaned = []
    for p in raw:
        digits = re.sub(r"\D", "", str(p))
        if len(digits) >= 6:
            cleaned.append(digits)
    return cleaned


def _any_phone(data: Dict) -> bool:
    if "contacts" in data:
        return any(c.get("phones") for c in (data.get("contacts") or []))
    return bool(data.get("phones"))


def _any_name(data: Dict) -> bool:
    if "contacts" in data:
        return any(str(c.get("name") or "").strip() for c in (data.get("contacts") or []))
    return bool(str(data.get("name") or "").strip())
