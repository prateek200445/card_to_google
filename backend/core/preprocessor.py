"""
Image preprocessing pipeline using OpenCV.
Steps: grayscale → denoise → deskew → threshold → resize
"""
from __future__ import annotations

import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from utils.logger import get_logger

logger = get_logger(__name__)


def preprocess_image(image_path: str | Path) -> np.ndarray:
    """
    Full preprocessing pipeline. Returns a clean numpy array
    ready for Tesseract OCR.
    """
    img = cv2.imread(str(image_path))
    if img is None:
        raise ValueError(f"Cannot read image: {image_path}")

    logger.info(f"Preprocessing {Path(image_path).name} — shape {img.shape}")

    img = _to_grayscale(img)
    img = _resize_for_ocr(img)
    img = _denoise(img)
    img = _deskew(img)
    img = _adaptive_threshold(img)

    return img


# ---------------------------------------------------------------------------
# Internal steps
# ---------------------------------------------------------------------------

def _to_grayscale(img: np.ndarray) -> np.ndarray:
    if len(img.shape) == 3:
        return cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    return img


def _resize_for_ocr(img: np.ndarray, target_height: int = 1200) -> np.ndarray:
    """Scale image so it's at least target_height pixels tall (Tesseract loves 300 DPI)."""
    h, w = img.shape[:2]
    if h < target_height:
        scale = target_height / h
        new_w = int(w * scale)
        img = cv2.resize(img, (new_w, target_height), interpolation=cv2.INTER_CUBIC)
    return img


def _denoise(img: np.ndarray) -> np.ndarray:
    """Fast Non-Local Means Denoising for grayscale."""
    return cv2.fastNlMeansDenoising(img, h=10, templateWindowSize=7, searchWindowSize=21)


def _deskew(img: np.ndarray) -> np.ndarray:
    """
    Detect skew angle via Hough line transform and rotate to correct it.
    Only corrects angles within ±30° to avoid flipping portrait cards.
    """
    try:
        edges = cv2.Canny(img, 50, 150, apertureSize=3)
        lines = cv2.HoughLines(edges, 1, np.pi / 180, threshold=100)

        if lines is None:
            return img

        angles: list[float] = []
        for line in lines[:50]:  # Use top 50 strongest lines
            rho, theta = line[0]
            angle = math.degrees(theta) - 90
            if -30 < angle < 30:
                angles.append(angle)

        if not angles:
            return img

        median_angle = float(np.median(angles))
        if abs(median_angle) < 0.5:
            return img  # Negligible skew

        logger.info(f"Deskewing by {median_angle:.2f}°")
        h, w = img.shape[:2]
        centre = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(centre, median_angle, 1.0)
        rotated = cv2.warpAffine(
            img, M, (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE,
        )
        return rotated
    except Exception as exc:
        logger.warning(f"Deskew failed, skipping: {exc}")
        return img


def _adaptive_threshold(img: np.ndarray) -> np.ndarray:
    """
    Adaptive thresholding for uneven lighting — produces clean B&W card.
    """
    return cv2.adaptiveThreshold(
        img,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=31,
        C=15,
    )


def numpy_to_pil(img: np.ndarray) -> Image.Image:
    """Convert OpenCV numpy array to PIL Image for Tesseract."""
    return Image.fromarray(img)
