"""
extractor.py
------------
Turns a CV into the structured content the public page renders.

The schema deliberately mirrors the props the React section components already
consume (stats -> {value,label}, experience -> {company,role,period,...}), so
generated data drops straight into the existing markup and CSS.

Two hard rules live in the prompt:
  * omit anything the CV doesn't state — never invent a metric or an employer
  * never emit contact details; this payload is served to anonymous visitors

The dev-setup card from the hand-written Skills page has no equivalent here on
purpose: a CV doesn't say which laptop someone owns.
"""

import json
from datetime import datetime, timezone

from agent import MODEL, client
from db import SessionLocal
from models import CV, Profile

PROFILE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["headline", "location", "about", "stats", "skills", "experience", "projects"],
    "properties": {
        "headline": {
            "type": "string",
            "description": "Short professional title, e.g. 'Lead Software Engineer'. Empty string if unclear.",
        },
        "location": {
            "type": "string",
            "description": "City and/or country only. Never a street address. Empty string if absent.",
        },
        "about": {
            "type": "object",
            "additionalProperties": False,
            "required": ["paragraphs", "facts"],
            "properties": {
                "paragraphs": {
                    "type": "array",
                    "description": "2-3 first-person paragraphs summarising the career.",
                    "items": {"type": "string"},
                },
                "facts": {
                    "type": "array",
                    "description": "Up to 5 scannable facts, e.g. Location, Experience, Specialisation, Languages.",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["label", "value"],
                        "properties": {
                            "label": {"type": "string"},
                            "value": {"type": "string"},
                        },
                    },
                },
            },
        },
        "stats": {
            "type": "array",
            "description": "Up to 6 headline metrics explicitly stated in the CV. Empty if the CV has no numbers.",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["value", "label"],
                "properties": {
                    "value": {"type": "string", "description": "Short figure, e.g. '40M+', '7K/s', '9+'."},
                    "label": {"type": "string", "description": "What the figure measures."},
                },
            },
        },
        "skills": {
            "type": "array",
            "description": "Technologies and tools named in the CV, up to 30.",
            "items": {"type": "string"},
        },
        "experience": {
            "type": "array",
            "description": "Roles, most recent first.",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["company", "role", "period", "location", "stack", "highlights"],
                "properties": {
                    "company": {"type": "string"},
                    "role": {"type": "string"},
                    "period": {"type": "string", "description": "e.g. '2022 — Present'."},
                    "location": {"type": "string", "description": "Empty string if not stated."},
                    "stack": {"type": "array", "items": {"type": "string"}},
                    "highlights": {
                        "type": "array",
                        "description": "2-3 achievements, taken from the CV.",
                        "items": {"type": "string"},
                    },
                },
            },
        },
        "projects": {
            "type": "array",
            "description": "Named projects. Empty array if the CV lists none.",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["name", "tagline", "stack", "metrics"],
                "properties": {
                    "name": {"type": "string"},
                    "tagline": {"type": "string", "description": "One line on what it does."},
                    "stack": {"type": "array", "items": {"type": "string"}},
                    "metrics": {
                        "type": "array",
                        "description": "Only figures stated in the CV. Empty if none.",
                        "items": {"type": "string"},
                    },
                },
            },
        },
    },
}

EXTRACTION_PROMPT = """You convert a CV into structured content for the candidate's public portfolio page.

Rules:
- Use ONLY what the CV states. Never invent employers, dates, metrics or technologies.
- If a section has no support in the CV, return an empty array rather than filling it.
- NEVER include contact details: no phone numbers, email addresses, street addresses,
  postal codes or personal URLs. City and country are fine.
- Keep figures in the form the CV uses ("40M+", "7K/s"), don't reformat or round them.
- Write the About paragraphs in the first person, professionally and without hype.

CV:
{cv_text}
"""


def generate_profile(cv_text: str) -> dict:
    """Call the model and return the structured profile. Raises on failure."""
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": EXTRACTION_PROMPT.format(cv_text=cv_text)}],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "portfolio_profile",
                "strict": True,
                "schema": PROFILE_SCHEMA,
            },
        },
    )
    return json.loads(response.choices[0].message.content)


def run_extraction(user_id, cv_id) -> None:
    """
    Background task: generate a profile and record the outcome.

    Opens its own session — background tasks run after the response is sent, by
    which point the request-scoped session is already closed.
    """
    db = SessionLocal()
    try:
        profile = db.query(Profile).filter(Profile.user_id == user_id).one_or_none()
        cv = db.get(CV, cv_id)

        if profile is None or cv is None:
            return

        try:
            data = generate_profile(cv.extracted_text)
            profile.data = data
            profile.status = "ready"
            profile.error = None
            profile.generated_at = datetime.now(timezone.utc)
        except Exception as e:
            profile.status = "failed"
            profile.error = str(e)[:1000]

        db.commit()
    finally:
        db.close()
