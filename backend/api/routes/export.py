"""
POST /export — Export results to Excel or Google Sheets.
"""
from __future__ import annotations

import io

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models.schemas import ExportFormat, ExportRequest, ExportResponse
from services.excel_export import generate_excel
from services.sheets_export import append_to_sheet
from utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.post("/export")
async def export_results(req: ExportRequest):
    if not req.results:
        raise HTTPException(status_code=400, detail="No results to export.")

    if req.format == ExportFormat.EXCEL:
        buf = generate_excel(req.results)
        filename = f"cards_{req.job_id[:8]}.xlsx"
        return StreamingResponse(
            io.BytesIO(buf),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    elif req.format == ExportFormat.SHEETS:
        try:
            sheet_url = await append_to_sheet(req.results, sheet_id=req.sheet_id)
            return ExportResponse(
                message="Data appended to Google Sheets successfully.",
                url=sheet_url,
            )
        except Exception as exc:
            logger.error("Google Sheets export failed: %s", exc)
            raise HTTPException(status_code=500, detail=f"Sheets export failed: {exc}")

    raise HTTPException(status_code=400, detail=f"Unknown format: {req.format}")
