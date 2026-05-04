"""
FastAPI application entrypoint.
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from api.routes import export, process, results, upload  # noqa: E402 — after dotenv

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="Visiting Card Extractor API",
    description="Hybrid OCR + LLM pipeline for extracting structured data from business cards.",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────
app.include_router(upload.router, tags=["Upload"])
app.include_router(process.router, tags=["Processing"])
app.include_router(results.router, tags=["Results"])
app.include_router(export.router, tags=["Export"])


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "message": "Visiting Card Extractor API is running."}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}
