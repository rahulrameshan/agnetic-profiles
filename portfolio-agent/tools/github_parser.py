import requests
import re

def extract_github_username(cv_text):
    pattern = r'github\.com/([a-zA-Z0-9_-]+)'
    match = re.search(pattern, cv_text)
    if match:
        return match.group(1)
    return None

def fetch_github(username):
    try:
        profile_response = requests.get(
            f"https://api.github.com/users/{username}",
            headers={"Accept": "application/vnd.github.v3+json"},
            timeout=10
        )
        profile_response.raise_for_status()
        profile = profile_response.json()

        repos_response = requests.get(
            f"https://api.github.com/users/{username}/repos?sort=updated&per_page=10",
            headers={"Accept": "application/vnd.github.v3+json"},
            timeout=10
        )
        repos_response.raise_for_status()
        repos = repos_response.json()

        repo_list = [
            {
                "name": r["name"],
                "description": r["description"],
                "language": r["language"],
                "stars": r["stargazers_count"],
                "url": r["html_url"]
            }
            for r in repos
        ]

        return {
            "username": profile.get("login"),
            "name": profile.get("name"),
            "bio": profile.get("bio"),
            "public_repos": profile.get("public_repos"),
            "followers": profile.get("followers"),
            "repos": repo_list
        }

    except requests.Timeout:
        return "fetch_github failed: GitHub took too long to respond."
    except requests.HTTPError as e:
        return f"fetch_github failed: {str(e)}"
    except Exception as e:
        return f"fetch_github failed: {str(e)}"


TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "fetch_github",
            "description": "Fetch GitHub profile and repositories of the candidate. Use this when the user asks about projects, code, technical work, or anything not found in the CV.",
            "parameters": {
                "type": "object",
                "properties": {
                    "username": {
                        "type": "string",
                        "description": "The GitHub username of the candidate"
                    }
                },
                "required": ["username"]
            }
        }
    }
]