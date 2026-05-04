"""
Pydantic schemas for the Visiting Card Extractor API.
Updated for OpenRouter-based pipeline: added 'status' field, simplified method enum.
"""
from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class ProcessingStatus(str, Enum):
    QUEUED = "queued"
    OCR = "ocr"               # Actively calling OpenRouter model
    LLM = "llm"               # Retrying with fallback model
    DONE = "done"
    FAILED = "failed"


class ExtractionMethod(str, Enum):
    RULE_BASED = "rule-based"  # Extracted by primary model
    LLM = "llm"                # Required fallback model


class ExportFormat(str, Enum):
    EXCEL = "excel"
    SHEETS = "sheets"


# ---------------------------------------------------------------------------
# Core card result
# ---------------------------------------------------------------------------

class CardResult(BaseModel):
    image: str = Field(..., description="Original filename")
    name: str = ""
    company: str = ""
    emails: List[str] = []
    phones: List[str] = []
    address: str = ""
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    method: ExtractionMethod = ExtractionMethod.RULE_BASED
    status: str = "success"     # "success" | "failed"
    raw_text: str = ""
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Job tracking
# ---------------------------------------------------------------------------

class ImageStatus(BaseModel):
    filename: str
    status: ProcessingStatus = ProcessingStatus.QUEUED
    result: Optional[CardResult] = None
    error: Optional[str] = None


class JobStatus(BaseModel):
    job_id: str
    total: int
    completed: int
    failed: int
    images: List[ImageStatus]


# ---------------------------------------------------------------------------
# API request / response models
# ---------------------------------------------------------------------------

class UploadResponse(BaseModel):
    job_id: str
    filenames: List[str]
    message: str


class ProcessRequest(BaseModel):
    job_id: str


class ProcessResponse(BaseModel):
    job_id: str
    message: str


class ExportRequest(BaseModel):
    job_id: str
    format: ExportFormat
    results: List[CardResult]
    sheet_id: Optional[str] = None


class ExportResponse(BaseModel):
    message: str
    url: Optional[str] = None
    filename: Optional[str] = None
