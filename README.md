# 🪪 CardScan AI — Visiting Card Data Extractor

A production-ready full-stack app that extracts structured contact data from business card images using a **hybrid OCR + LLM pipeline**.

```
Upload → Preprocess → OCR → Rule-based Extraction → Confidence Score
    → IF score ≥ 0.7 → Accept   ELSE → LLM Fallback (OpenRouter)
    → Normalize → Export (Excel / Google Sheets)
```

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, Tailwind CSS, React Dropzone |
| Backend | Python FastAPI (async) |
| OCR | Tesseract + OpenCV |
| LLM | OpenRouter (GPT-4o-mini by default) |
| Export | openpyxl (Excel), Google Sheets API v4 |

---

## 📁 Project Structure

```
card_to_google/
├── backend/
│   ├── main.py                  # FastAPI entrypoint
│   ├── requirements.txt
│   ├── .env.example
│   ├── core/
│   │   ├── preprocessor.py      # OpenCV: grayscale, denoise, deskew
│   │   ├── ocr.py               # Tesseract wrapper (multi-PSM)
│   │   ├── cleaner.py           # Text normalization
│   │   ├── extractor.py         # Regex + heuristic extraction
│   │   ├── confidence.py        # 0.0–1.0 scoring
│   │   ├── llm_fallback.py      # OpenRouter async call
│   │   ├── normalizer.py        # Final CardResult assembly
│   │   └── pipeline.py          # Full async orchestrator
│   ├── api/routes/
│   │   ├── upload.py            # POST /upload
│   │   ├── process.py           # POST /process, GET /status/{id}
│   │   ├── results.py           # GET /results/{id}
│   │   └── export.py            # POST /export
│   ├── services/
│   │   ├── excel_export.py
│   │   └── sheets_export.py
│   ├── models/schemas.py
│   └── utils/
│       ├── job_store.py
│       └── logger.py
└── frontend/
    ├── app/
    │   ├── page.tsx             # 3-stage UI: Upload → Processing → Results
    │   ├── layout.tsx
    │   └── globals.css
    ├── components/
    │   ├── UploadZone.tsx       # Drag & drop with previews
    │   ├── BatchProgress.tsx    # Per-image status tracker
    │   ├── ResultCard.tsx       # Editable result card
    │   └── ExportPanel.tsx      # Excel + Sheets export
    ├── hooks/
    │   ├── useUpload.ts
    │   └── useJobPolling.ts
    └── lib/api.ts               # Typed API client
```

---

## ⚙️ Backend Setup

### 1. Install Tesseract OCR (Windows)

Download and install from: https://github.com/UB-Mannheim/tesseract/wiki

Default install path: `C:\Program Files\Tesseract-OCR\tesseract.exe`

### 2. Create Python virtual environment

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure environment variables

```powershell
copy .env.example .env
```

Edit `.env`:

```env
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=openai/gpt-4o-mini

# Google Sheets (paste full URL or bare spreadsheet ID)
GOOGLE_SHEET_ID=https://docs.google.com/spreadsheets/d/YOUR_ID/edit
GOOGLE_CREDENTIALS_PATH=credentials.json

TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
CONFIDENCE_THRESHOLD=0.7
```

### 4. Google Sheets Service Account Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → Enable **Google Sheets API**
3. Create a **Service Account** → Download JSON key → save as `backend/credentials.json`
4. Open your Google Sheet → **Share** with the service account email (editor access)

### 5. Run the backend

```powershell
uvicorn main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

---

## 🖥️ Frontend Setup

```powershell
cd frontend
npm install
npm run dev
```

App runs at: http://localhost:3000

---

## 🔌 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload` | Upload 1–25 card images |
| `POST` | `/process` | Start async pipeline |
| `GET` | `/status/{job_id}` | Poll per-image progress |
| `GET` | `/results/{job_id}` | Get extracted data |
| `POST` | `/export` | Download Excel or push to Sheets |

---

## 🧠 Confidence Scoring

| Field | Score |
|-------|-------|
| Email found | +0.25 |
| Phone found | +0.25 |
| Name confident | +0.20 |
| Company confident | +0.20 |
| Address confident | +0.10 |
| **Threshold** | **≥ 0.70 → rule-based accepted** |

If score < 0.70 → card is sent to OpenRouter LLM for structured extraction.

---

## 📊 Output Format (per card)

```json
{
  "image": "card.jpg",
  "name": "Rahul Sharma",
  "company": "TechCorp Solutions Pvt Ltd",
  "emails": ["rahul@techcorp.com"],
  "phones": ["+919876543210"],
  "address": "42 MG Road, Bengaluru 560001",
  "confidence": 0.9,
  "method": "rule-based"
}
```

---

## ⚠️ Edge Cases Handled

- Blurry images → OpenCV denoising
- Rotated cards → Hough-based deskew (±30°)
- Multiple phone numbers → all extracted
- Missing fields → empty string / empty list (no hallucination)
- Low confidence → automatic LLM fallback
- Duplicate cards → each added as a new row

---

## 🚀 Running Both Together

Open two terminals:

```powershell
# Terminal 1 — Backend
cd backend && .venv\Scripts\activate && uvicorn main:app --reload

# Terminal 2 — Frontend
cd frontend && npm run dev
```
