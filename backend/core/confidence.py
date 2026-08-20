"""
Confidence scoring system for extracted card data.
"""
from __future__ import annotations

from core.extractor import ExtractionResult


def compute_confidence(result: ExtractionResult) -> float:
    """
    Compute a 0.0–1.0 confidence score based on what was extracted.

    Scoring breakdown:
        email_found       → +0.25
        phone_found       → +0.25
        name_confident    → +0.20
        company_confident → +0.20
        address_confident → +0.10
    """
    score = 0.0

    if result.email_found:
        score += 0.25

    if result.phone_found:
        score += 0.25

    if result.name_confident:
        score += 0.20
    elif result.name:          # Soft credit — name found but not confident
        score += 0.05

    if result.company_confident:
        score += 0.20
    elif result.company:
        score += 0.05

    if result.address_confident:
        score += 0.10
    elif result.address:
        score += 0.03

    return round(min(score, 1.0), 4)
