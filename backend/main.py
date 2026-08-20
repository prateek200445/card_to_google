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

from api.routes import contacts, export, process, results, upload  # noqa: E402 — after dotenv

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
# Read extra allowed origins from env (comma-separated), fall back to * for open APIs
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
if _raw_origins == "*":
    _allow_origins = ["*"]
else:
    _allow_origins = [o.strip() for o in _raw_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=_allow_origins != ["*"],   # credentials not allowed with wildcard
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────
app.include_router(upload.router,   tags=["Upload"])
app.include_router(process.router,  tags=["Processing"])
app.include_router(results.router,  tags=["Results"])
app.include_router(export.router,   tags=["Export"])
app.include_router(contacts.router, tags=["Contacts"])


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "message": "Visiting Card Extractor API is running."}


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy"}
