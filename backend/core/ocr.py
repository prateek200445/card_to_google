"""
Tesseract OCR wrapper — extracts raw text from preprocessed images.
"""
from __future__ import annotations

import os
from pathlib import Path

import pytesseract
from PIL import Image

from utils.logger import get_logger

logger = get_logger(__name__)

# Allow override via env var (important for Windows)
_tesseract_cmd = os.getenv("TESSERACT_CMD", r"C:\Program Files\Tesseract-OCR\tesseract.exe")
if os.path.exists(_tesseract_cmd):
    pytesseract.pytesseract.tesseract_cmd = _tesseract_cmd


# Tesseract configs to try (in order of preference for business cards)
_CONFIGS = [
    "--psm 6 --oem 3",   # Uniform block of text
    "--psm 4 --oem 3",   # Single column, variable sizes
    "--psm 3 --oem 3",   # Fully automatic
]


def run_ocr(pil_image: Image.Image, filename: str = "") -> str:
    """
    Run Tesseract OCR on a PIL image.
    Tries multiple PSM modes and returns the best (longest clean) result.
    """
    best_text = ""
    for config in _CONFIGS:
        try:
            text = pytesseract.image_to_string(pil_image, config=config, lang="eng")
            text = text.strip()
            if len(text) > len(best_text):
                best_text = text
        except Exception as exc:
            logger.warning(f"OCR failed with config '{config}' for {filename}: {exc}")

    logger.info(
        f"OCR complete for {filename!r} — {len(best_text)} chars extracted"
    )
    return best_text


def get_ocr_data(pil_image: Image.Image) -> dict:
    """
    Return detailed OCR data (word-level bounding boxes + confidence).
    Useful for future position-based heuristics.
    """
    try:
        data = pytesseract.image_to_data(
            pil_image,
            config="--psm 6 --oem 3",
            lang="eng",
            output_type=pytesseract.Output.DICT,
        )
        return data
    except Exception as exc:
        logger.warning(f"get_ocr_data failed: {exc}")
        return {}
