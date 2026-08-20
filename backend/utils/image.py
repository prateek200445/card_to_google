"""
Image processing utilities for backend memory optimization.
"""
from __future__ import annotations

import base64
import io
from pathlib import Path
from PIL import Image, ImageOps

def encode_and_compress_image(
    path: str | Path,
    max_dim: int = 1200,
    quality: int = 80,
) -> tuple[str, str]:
    """
    Read image, downscale if it exceeds max_dim on either side,
    compress it as JPEG/PNG in-memory, and return (base64_string, mime_type).
    
    This prevents high-resolution camera uploads (e.g. 10MB-15MB) from causing
    RAM exhaustion (OOM) during base64 encoding and transmission to LLM APIs.
    """
    p = Path(path)
    suffix = p.suffix.lower()
    
    # Map suffixes to mime-types
    mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}
    mime = mime_map.get(suffix, "image/jpeg")
    
    save_format = "PNG" if mime == "image/png" else "JPEG"
    
    with Image.open(p) as img:
        # Correct orientation based on EXIF data if present
        try:
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass

        # Downscale if larger than max_dim
        w, h = img.size
        if w > max_dim or h > max_dim:
            scale = max_dim / max(w, h)
            new_w = int(w * scale)
            new_h = int(h * scale)
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        # Save to buffer with compression
        buf = io.BytesIO()
        if save_format == "JPEG":
            # Convert RGBA to RGB for JPEG compatibility
            if img.mode in ("RGBA", "LA", "P"):
                img = img.convert("RGB")
            img.save(buf, format=save_format, quality=quality, optimize=True)
        else:
            img.save(buf, format=save_format, optimize=True)
            
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        return b64, mime
