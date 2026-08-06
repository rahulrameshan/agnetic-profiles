"""
Adapter: the GitHub REST API.

Also owns the tool definition the model sees, because the schema and the call
that satisfies it belong together — change one and you must change the other.
"""

import re

import requests

API = "https://api.github.com"
HEADERS = {"Accept": "application/vnd.github.v3+json"}
TIMEOUT = 10
RECENT_REPO_COUNT = 10

USERNAME_PATTERN = re.compile(r"github\.com/([a-zA-Z0-9_-]+)")


def username_in(cv_text: str) -> str | None:
    """The GitHub account this CV links to, if any."""
    match = USERNAME_PATTERN.search(cv_text)
    return match.group(1) if match else None


def _get(path: str) -> dict | list:
    response = requests.get(f"{API}{path}", headers=HEADERS, timeout=TIMEOUT)
    response.raise_for_status()
    return response.json()


def _summarise_repos(repos: list[dict]) -> list[dict]:
    return [
        {
            "name": repo["name"],
            "description": repo["description"],
            "language": repo["language"],
            "stars": repo["stargazers_count"],
            "url": repo["html_url"],
        }
        for repo in repos
    ]


def fetch(username: str) -> dict | str:
    """
    Profile and recent repositories for a username.

    Returns a readable string rather than raising on failure: the result is fed
    back to the model, which handles "couldn't reach GitHub" better than it
    handles an exception trace.
    """
    try:
        profile = _get(f"/users/{username}")
        repos = _get(f"/users/{username}/repos?sort=updated&per_page={RECENT_REPO_COUNT}")
    except requests.Timeout:
        return "fetch_github failed: GitHub took too long to respond."
    except Exception as e:
        return f"fetch_github failed: {e}"

    return {
        "username": profile.get("login"),
        "name": profile.get("name"),
        "bio": profile.get("bio"),
        "public_repos": profile.get("public_repos"),
        "followers": profile.get("followers"),
        "repos": _summarise_repos(repos),
    }


TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "fetch_github",
            "description": (
                "Fetch GitHub profile and repositories of the candidate. Use this when "
                "the user asks about projects, code, technical work, or anything not "
                "found in the CV."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "username": {
                        "type": "string",
                        "description": "The GitHub username of the candidate",
                    }
                },
                "required": ["username"],
            },
        },
    }
]
