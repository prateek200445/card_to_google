"""
Google Sheets export using the Sheets API v4 with a service account.
Appends rows to a configured sheet. Sheet ID can come from env or request.
"""
from __future__ import annotations

import asyncio
import os
from typing import List, Optional

from utils.logger import get_logger

logger = get_logger(__name__)

_CREDS_PATH = os.getenv("GOOGLE_CREDENTIALS_PATH", "credentials.json")
_DEFAULT_SHEET_ID = os.getenv("GOOGLE_SHEET_ID", "")
_SHEET_TAB = os.getenv("GOOGLE_SHEET_TAB", "Sheet1")

_HEADERS = ["Image", "Name", "Company", "Emails", "Phones", "Address", "Remarks"]


def _get_service():
    """Build the Sheets API service.

    Credentials priority:
      1. GOOGLE_CREDENTIALS_JSON env var — full JSON string (used on Render/cloud)
      2. GOOGLE_CREDENTIALS_PATH       — path to credentials.json file (local dev)
    """
    import json as _json
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    scopes = ["https://www.googleapis.com/auth/spreadsheets"]

    raw_json = os.getenv("GOOGLE_CREDENTIALS_JSON", "").strip()
    if raw_json:
        info = _json.loads(raw_json)
        creds = service_account.Credentials.from_service_account_info(info, scopes=scopes)
    else:
        creds = service_account.Credentials.from_service_account_file(
            _CREDS_PATH, scopes=scopes
        )

    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def _extract_sheet_id(sheet_id_or_url: str) -> str:
    """Accept either a full Google Sheets URL or a bare spreadsheet ID."""
    if "docs.google.com" in sheet_id_or_url:
        # https://docs.google.com/spreadsheets/d/<ID>/edit...
        parts = sheet_id_or_url.split("/d/")
        if len(parts) >= 2:
            return parts[1].split("/")[0]
    return sheet_id_or_url.strip()


def _sync_append(results, sheet_id: str, batch_remarks: str = "", batch_purpose: str = "") -> str:
    from models.schemas import CardResult

    service = _get_service()
    spreadsheet_id = _extract_sheet_id(sheet_id)
    range_name = f"{_SHEET_TAB}!A1"

    # Check if header row exists — read first row
    existing = service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=f"{_SHEET_TAB}!A1:G1",
    ).execute()

    rows_present = existing.get("values", [])
    values_to_write: list[list] = []

    if not rows_present:
        values_to_write.append(_HEADERS)

    for r in results:
        values_to_write.append([
            r.image,
            r.name,
            r.company,
            "; ".join(r.emails),
            "; ".join(r.phones),
            r.address,
            r.remarks if r.remarks is not None else batch_remarks,
        ])

    body = {"values": values_to_write}
    service.spreadsheets().values().append(
        spreadsheetId=spreadsheet_id,
        range=range_name,
        valueInputOption="RAW",
        insertDataOption="INSERT_ROWS",
        body=body,
    ).execute()

    logger.info("Appended %d rows to sheet %s", len(results), spreadsheet_id)
    return f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit"


async def append_to_sheet(results, sheet_id: Optional[str] = None,
                          batch_remarks: str = "", batch_purpose: str = "") -> str:
    """Async wrapper — runs the blocking Sheets API call in a thread."""
    sid = sheet_id or _DEFAULT_SHEET_ID
    if not sid:
        raise ValueError(
            "No Google Sheet ID configured. Set GOOGLE_SHEET_ID in .env "
            "or pass sheet_id in the export request."
        )
    return await asyncio.to_thread(_sync_append, results, sid, batch_remarks, batch_purpose)
