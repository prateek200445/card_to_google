"""
Google Cloud Vision OCR fallback.

Uses the SAME service account credentials already configured for Google Sheets.
Requires the "Cloud Vision API" to be enabled in your Google Cloud project.

Enable it at:
  https://console.cloud.google.com/apis/library/vision.googleapis.com

Cost: 1,000 images/month FREE, then ~$1.50 per 1,000 images.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

from utils.logger import get_logger

logger = get_logger(__name__)


def _build_vision_client():
    """Build Google Vision client using the same credentials as Sheets."""
    from google.cloud import vision
    from google.oauth2 import service_account

    raw_json = os.getenv("GOOGLE_CREDENTIALS_JSON", "").strip()
    if raw_json:
        info = json.loads(raw_json)
        creds = service_account.Credentials.from_service_account_info(info)
    else:
        creds_path = os.getenv("GOOGLE_CREDENTIALS_PATH", "credentials.json")
        creds = service_account.Credentials.from_service_account_file(creds_path)

    return vision.ImageAnnotatorClient(credentials=creds)


def extract_text(image_path: str) -> Optional[str]:
    """
    Run Google Vision DOCUMENT_TEXT_DETECTION on an image.

    Returns the full extracted text string, or None if extraction fails.
    DOCUMENT_TEXT_DETECTION is preferred over TEXT_DETECTION for dense card text.
    """
    try:
        from google.cloud import vision

        client = _build_vision_client()

        with open(image_path, "rb") as f:
            content = f.read()

        image = vision.Image(content=content)
        response = client.document_text_detection(image=image)

        if response.error.message:
            logger.warning(
                "Google Vision API error for %s: %s", image_path, response.error.message
            )
            return None

        text = response.full_text_annotation.text
        if not text or not text.strip():
            logger.warning("Google Vision returned empty text for %s", image_path)
            return None

        logger.info(
            "Google Vision extracted %d chars from %s", len(text), Path(image_path).name
        )
        return text.strip()

    except ImportError:
        logger.warning("google-cloud-vision not installed. Run: pip install google-cloud-vision")
        return None
    except Exception as exc:
        logger.warning("Google Vision failed for %s: %s", image_path, exc)
        return None
