"""
Rule-based extraction: email, phone, name, company, address.
All extractors return (value, confidence: float) tuples.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List, Tuple

from core.cleaner import get_lines

# ---------------------------------------------------------------------------
# Compiled regex patterns
# ---------------------------------------------------------------------------

# Email — RFC-5321-ish
_EMAIL_RE = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
    re.IGNORECASE,
)

# Phone — Indian + international formats
_PHONE_RE = re.compile(
    r"""
    (?:
        (?:\+?91[\s\-\.]?)?         # Country code +91 optional
        (?:\(?0\)?[\s\-\.]?)?       # STD 0 optional
        [6789]\d{9}                 # Indian mobile
    |
        \+?[1-9]\d{1,3}[\s\-\.]?   # International code
        (?:\(?\d{1,4}\)?[\s\-\.]?)? # Area code
        \d{3,5}[\s\-\.]\d{3,5}     # Number parts
    )
    """,
    re.VERBOSE,
)

# Pincode (Indian 6-digit)
_PINCODE_RE = re.compile(r"\b\d{6}\b")

# Company keywords
_COMPANY_KEYWORDS = re.compile(
    r"\b(pvt\.?\s*ltd\.?|ltd\.?|llp|limited|inc\.?|corp\.?|"
    r"solutions?|technologies|tech|systems?|services?|group|"
    r"enterprises?|associates?|consultants?|consulting|"
    r"industries|international|global|digital|agency|studio|labs?)\b",
    re.IGNORECASE,
)

# Address keywords
_ADDRESS_KEYWORDS = re.compile(
    r"\b(street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|"
    r"nagar|colony|sector|block|plot|flat|floor|building|bldg|"
    r"phase|layout|district|taluk|mandal|village|town|city|"
    r"state|near|opp\.?|opposite|behind|beside|next to|"
    r"mumbai|delhi|bangalore|bengaluru|hyderabad|chennai|"
    r"kolkata|pune|ahmedabad|jaipur|lucknow|surat|india)\b",
    re.IGNORECASE,
)

# Name pattern: 2-4 words, each properly capitalized, no digits
_NAME_WORD_RE = re.compile(r"^[A-Z][a-zA-Z''\-]{1,}$")


# ---------------------------------------------------------------------------
# Result container
# ---------------------------------------------------------------------------

@dataclass
class ExtractionResult:
    emails: List[str] = field(default_factory=list)
    phones: List[str] = field(default_factory=list)
    name: str = ""
    company: str = ""
    address: str = ""

    # Per-field confidence flags
    email_found: bool = False
    phone_found: bool = False
    name_confident: bool = False
    company_confident: bool = False
    address_confident: bool = False


# ---------------------------------------------------------------------------
# Public extractor
# ---------------------------------------------------------------------------

def extract(text: str) -> ExtractionResult:
    """
    Run all rule-based extractors and return an ExtractionResult.
    """
    lines = get_lines(text)
    result = ExtractionResult()

    result.emails = _extract_emails(text)
    result.email_found = bool(result.emails)

    result.phones = _extract_phones(text)
    result.phone_found = bool(result.phones)

    result.name, result.name_confident = _extract_name(lines, result.emails, result.phones)
    result.company, result.company_confident = _extract_company(lines)
    result.address, result.address_confident = _extract_address(lines, text)

    return result


# ---------------------------------------------------------------------------
# Field extractors
# ---------------------------------------------------------------------------

def _extract_emails(text: str) -> List[str]:
    matches = _EMAIL_RE.findall(text)
    seen: set[str] = set()
    unique: List[str] = []
    for m in matches:
        key = m.lower()
        if key not in seen:
            seen.add(key)
            unique.append(m.lower())
    return unique


def _extract_phones(text: str) -> List[str]:
    raw_matches = _PHONE_RE.findall(text)
    normalized: List[str] = []
    seen: set[str] = set()
    for m in raw_matches:
        digits = re.sub(r"\D", "", m)
        # Normalise Indian numbers to 10 digits
        if digits.startswith("91") and len(digits) == 12:
            digits = digits[2:]
        if digits.startswith("0") and len(digits) == 11:
            digits = digits[1:]
        # Minimum 10 digits for validity
        if len(digits) < 10:
            continue
        if digits not in seen:
            seen.add(digits)
            normalized.append(digits)
    return normalized


def _extract_name(
    lines: List[str],
    emails: List[str],
    phones: List[str],
) -> Tuple[str, bool]:
    """
    Heuristic: look in top 6 lines for 2–4 capitalized words
    that are NOT email addresses, phone numbers, or company keywords.
    """
    email_prefixes = {e.split("@")[0].lower() for e in emails}
    phone_digits = {"".join(filter(str.isdigit, p)) for p in phones}

    for line in lines[:6]:
        line = line.strip()
        words = line.split()
        if not (2 <= len(words) <= 4):
            continue
        # All words must be capitalized alpha
        if not all(_NAME_WORD_RE.match(w) for w in words):
            continue
        # Must not match email prefix
        joined_lower = line.lower().replace(" ", "")
        if any(joined_lower in ep or ep in joined_lower for ep in email_prefixes):
            continue
        # Must not contain company keywords
        if _COMPANY_KEYWORDS.search(line):
            continue
        # Must not look like an address
        if _ADDRESS_KEYWORDS.search(line):
            continue
        return line, True

    # Soft fallback: first 2-word capitalized line anywhere
    for line in lines:
        words = line.split()
        if 2 <= len(words) <= 3 and all(_NAME_WORD_RE.match(w) for w in words):
            return line, False

    return "", False


def _extract_company(lines: List[str]) -> Tuple[str, bool]:
    """Search top 8 lines for lines containing company keywords."""
    for line in lines[:8]:
        if _COMPANY_KEYWORDS.search(line):
            return line.strip(), True
    # Fallback — maybe the company name is in all-caps
    for line in lines[:5]:
        if line.isupper() and len(line.split()) >= 2 and not _EMAIL_RE.search(line):
            return line.strip(), False
    return "", False


def _extract_address(lines: List[str], full_text: str) -> Tuple[str, bool]:
    """
    Combine consecutive lines that look like an address block.
    A block must contain at least 2 address signals (keyword, pincode, digits).
    """
    address_lines: List[str] = []
    in_block = False
    confidence = False

    for line in lines:
        has_keyword = bool(_ADDRESS_KEYWORDS.search(line))
        has_pincode = bool(_PINCODE_RE.search(line))
        has_digits = bool(re.search(r"\d", line))

        signals = sum([has_keyword, has_pincode, has_digits])

        if signals >= 2:
            in_block = True
            address_lines.append(line.strip())
            if has_pincode:
                confidence = True
        elif in_block and signals >= 1:
            address_lines.append(line.strip())
        elif in_block:
            break  # End of address block

    address = ", ".join(address_lines)
    return address, confidence and bool(address_lines)
