"""
Text cleaning and normalisation after OCR.
Preserves line structure — critical for positional heuristics.
"""
from __future__ import annotations

import re
import unicodedata


def clean_text(raw: str) -> str:
    """
    Full cleaning pipeline.
    Returns cleaned text with original line structure preserved.
    """
    text = _normalize_unicode(raw)
    text = _fix_common_ocr_errors(text)
    text = _normalize_whitespace(text)
    text = _remove_junk_lines(text)
    return text.strip()


def get_lines(cleaned_text: str) -> list[str]:
    """Split text into non-empty lines."""
    return [ln.strip() for ln in cleaned_text.splitlines() if ln.strip()]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _normalize_unicode(text: str) -> str:
    """NFKC normalization handles ligatures, half-width chars, etc."""
    return unicodedata.normalize("NFKC", text)


def _fix_common_ocr_errors(text: str) -> str:
    """Correct systematic OCR mistakes common in business cards."""
    replacements = {
        r"\|": "I",         # Pipe confused for I
        r"(\d)l(\d)": r"\1l\2",  # Keep l between digits (phone numbers)
        r"\bI\/\b": "IV",   # Roman numerals
        r"(?<=[a-zA-Z])0(?=[a-zA-Z])": "O",  # Zero → O in words
    }
    for pattern, repl in replacements.items():
        text = re.sub(pattern, repl, text)
    return text


def _normalize_whitespace(text: str) -> str:
    """
    - Collapse multiple spaces on the same line to one
    - Preserve single newlines
    - Collapse 3+ newlines to 2
    """
    lines = text.splitlines()
    lines = [re.sub(r"[ \t]+", " ", line) for line in lines]
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text


def _remove_junk_lines(text: str) -> str:
    """Remove lines that are pure noise (e.g. all dashes, dots, single chars)."""
    lines = text.splitlines()
    cleaned = []
    for line in lines:
        stripped = line.strip()
        # Keep line if it has at least 2 alphanumeric characters
        if len(re.findall(r"[a-zA-Z0-9]", stripped)) >= 2:
            cleaned.append(line)
        elif stripped == "":
            cleaned.append("")  # Preserve blank separators
    return "\n".join(cleaned)
