# ApplyMate — AI Application Assistant

Write and tailor CVs, cover letters, and scholarship essays in strong English.
Polish Indonesian drafts into natural English. Track every application and
deadline — in one place. Built for students and job seekers in Indonesia.

## Why this exists

Applying to jobs and scholarships means endless English drafts (bouncing through
translators), rewriting the same documents for each opportunity, and juggling
deadlines in a messy spreadsheet. ApplyMate turns that into three simple tools.

## Features

- **Write** — generate a tailored cover letter, CV bullets, or scholarship essay
  from your profile + the specific opportunity.
- **Polish & Translate** — turn an Indonesian draft into natural English, or
  improve rough English.
- **Tracker** — add applications, set deadlines, update status. Real persistence
  (SQLite), replacing the manual spreadsheet.

## Tech

- **Backend:** FastAPI (Python), clean router → service → provider layering.
- **AI:** pluggable `LLMProvider`. Today: Google Gemini (free tier) or an offline
  mock. Built to swap in **AWS Bedrock** in production — this is what AWS Activate
  credits fund.
- **Storage:** SQLite (stdlib, no external DB).
- **Frontend:** static HTML/CSS/JS served by the app.

## Run locally

```bash
python -m venv .venv && . .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # optional: add GEMINI_API_KEY for real AI
PYTHONPATH=src uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000. Without a Gemini key it runs in mock mode so the whole
app is usable offline. Add `GEMINI_API_KEY` (free at
https://aistudio.google.com/app/apikey) for real AI output.

## Test

```bash
PYTHONPATH=src pytest -q
```

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Status + active AI provider |
| POST | `/api/generate` | Generate a tailored document (needs `X-API-Key`) |
| POST | `/api/polish` | Translate/improve text (needs `X-API-Key`) |
| GET/POST | `/api/applications` | List / add tracked applications |
| PATCH/DELETE | `/api/applications/{id}` | Update status / delete |
