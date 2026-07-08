"""Shared Pydantic models crossing the API boundary."""
from typing import Literal

from pydantic import BaseModel, Field

# What kind of application document to generate.
DocKind = Literal["cv_bullets", "cover_letter", "scholarship_essay"]


class GenerateRequest(BaseModel):
    """Ask the AI to write a tailored application document."""

    kind: DocKind
    # Who the applicant is: background, skills, experience (any language).
    profile: str = Field(min_length=1)
    # The specific opportunity: job/scholarship name, requirements, org.
    opportunity: str = Field(min_length=1)
    # Optional extra instructions (tone, length, things to emphasize).
    notes: str = ""


class GenerateResponse(BaseModel):
    kind: DocKind
    output: str
    provider: str  # "gemini" or "mock" — transparency about what produced it


class AnalyzeRequest(BaseModel):
    """Ask the AI which opportunity keywords the profile does/doesn't cover."""

    profile: str = Field(min_length=1)
    opportunity: str = Field(min_length=1)


class AnalyzeResponse(BaseModel):
    """Real keyword match. Empty lists + analyzed=False means no real analysis
    was possible (e.g. mock mode) — the UI must not fake chips in that case."""

    matched: list[str] = []   # requirement keywords the profile demonstrates
    missing: list[str] = []   # requirement keywords the profile lacks
    analyzed: bool = False    # True only when a real model produced the match
    provider: str = "unknown"


class PolishRequest(BaseModel):
    """Turn an Indonesian (or rough English) draft into strong English."""

    text: str = Field(min_length=1)
    # "translate" = ID -> natural EN; "improve" = fix/strengthen existing EN.
    mode: Literal["translate", "improve"] = "translate"


class PolishResponse(BaseModel):
    output: str
    provider: str


class FetchJobRequest(BaseModel):
    """Read a job/scholarship posting from a URL."""

    url: str = Field(min_length=1)


class FetchJobResponse(BaseModel):
    text: str  # extracted, cleaned posting text (fills the "opportunity" field)


class ApplicationIn(BaseModel):
    """A row in the application tracker."""

    organization: str = Field(min_length=1)
    role: str = ""  # job title or scholarship name
    kind: str = "job"  # "job" | "scholarship" | "internship"
    status: str = "planned"  # planned | applied | interview | accepted | rejected
    deadline: str = ""  # ISO date string, e.g. "2026-08-01"; free-form ok
    link: str = ""
    notes: str = ""


class Application(ApplicationIn):
    id: int
    created_at: str
