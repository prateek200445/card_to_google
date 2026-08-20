"""
GET /contacts — Read all contacts stored in the Google Sheet and return as JSON.
"""
from __future__ import annotations

import asyncio
import os
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

_DEFAULT_SHEET_ID = os.getenv("GOOGLE_SHEET_ID", "")
_SHEET_TAB = os.getenv("GOOGLE_SHEET_TAB", "Sheet1")


class SheetContact(BaseModel):
    image:   str = ""
    name:    str = ""
    company: str = ""
    emails:  str = ""
    phones:  str = ""
    address: str = ""
    remarks: str = ""
    city:    str = ""
    job_title: str = ""


def _sync_read(sheet_id: str) -> List[SheetContact]:
    import json as _json
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    _CREDS_PATH = os.getenv("GOOGLE_CREDENTIALS_PATH", "credentials.json")
    scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

    raw_json = os.getenv("GOOGLE_CREDENTIALS_JSON", "").strip()
    if raw_json:
        info = _json.loads(raw_json)
        creds = service_account.Credentials.from_service_account_info(info, scopes=scopes)
    else:
        creds = service_account.Credentials.from_service_account_file(_CREDS_PATH, scopes=scopes)

    service = build("sheets", "v4", credentials=creds, cache_discovery=False)

    # Extract spreadsheet ID from URL if needed
    sid = sheet_id
    if "docs.google.com" in sheet_id:
        parts = sheet_id.split("/d/")
        if len(parts) >= 2:
            sid = parts[1].split("/")[0]

    result = service.spreadsheets().values().get(
        spreadsheetId=sid,
        range=f"{_SHEET_TAB}!A:I",
    ).execute()

    rows = result.get("values", [])
    if not rows:
        return []

    # First row is the header — skip it
    data_rows = rows[1:]
    contacts: List[SheetContact] = []
    for row in data_rows:
        # Pad row to 9 columns (A to I)
        r = row + [""] * (9 - len(row))
        contacts.append(SheetContact(
            image=r[0], name=r[1], company=r[2],
            emails=r[3], phones=r[4], address=r[5], remarks=r[6],
            city=r[7], job_title=r[8]
        ))
    return contacts


@router.get("/contacts", response_model=List[SheetContact])
async def get_contacts():
    """Return all contacts stored in the configured Google Sheet."""
    sid = _DEFAULT_SHEET_ID
    if not sid:
        raise HTTPException(
            status_code=503,
            detail="Google Sheet ID not configured. Set GOOGLE_SHEET_ID in .env.",
        )
    try:
        contacts = await asyncio.to_thread(_sync_read, sid)
        return contacts
    except Exception as exc:
        logger.error("Failed to read contacts from sheet: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to read sheet: {exc}")
