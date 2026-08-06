"""
What a generated profile *is*.

This is a business definition, not a vendor detail: the shape mirrors the props
the page components consume, so generated content drops straight into the
existing markup. Change this and you change the product, not the plumbing.

Two rules carry real weight in the prompt — omit what the CV doesn't state, and
never emit contact details, because this payload is served to anonymous visitors.

Project card sizing is deliberately absent: that is layout, decided by the
frontend, not a fact about the candidate.
"""

PROFILE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "headline",
        "location",
        "about",
        "stats",
        "skills",
        "experience",
        "projects",
    ],
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
                    "value": {
                        "type": "string",
                        "description": "Short figure, e.g. '40M+', '7K/s', '9+'.",
                    },
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
                "required": [
                    "company",
                    "role",
                    "period",
                    "location",
                    "stack",
                    "highlights",
                ],
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
