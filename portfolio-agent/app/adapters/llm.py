"""
Adapter: the language model.

Two jobs, both isolated here so no service imports the OpenAI SDK:

  answer_question — one conversational turn on behalf of a candidate
  extract_profile — turn a CV into the structured content the page renders

The prompt rules themselves live in app/prompts.py, because they are business
rules about how the agent must behave, not a detail of which vendor we call.
"""

import json
from typing import Any

from openai import OpenAI

from app.adapters import github
from app.config import settings
from app.errors import AgentUnavailable
from app.prompts import build_system_prompt
from app.profile_schema import PROFILE_SCHEMA, EXTRACTION_PROMPT

client = OpenAI()

NO_GITHUB = "No GitHub profile found in CV."


# ── conversation ────────────────────────────────────────────────────────────


def _tools_for(github_username: str | None) -> list[Any] | None:
    """
    Only offer the GitHub tool when there is an account to fetch.

    Sending the schema for a CV with no GitHub link wastes tokens on every turn
    and invites a call that can only fail.
    """
    return github.TOOL_DEFINITIONS if github_username else None


def _run_tool_calls(choice: Any, github_username: str | None) -> list[dict[str, Any]]:
    """Execute the tools the model asked for, as tool messages to append."""
    messages = []

    for call in choice.message.tool_calls:
        if call.function.name != "fetch_github":
            continue
        # The username comes from the CV, never from the model's argument, so the
        # agent cannot be talked into fetching somebody else's account.
        result = github.fetch(github_username) if github_username else NO_GITHUB
        messages.append(
            {
                "role": "tool",
                "tool_call_id": call.id,
                "content": json.dumps(result),
            }
        )

    return messages


def _complete(messages: list[Any], tools: list[Any] | None = None) -> Any:
    """One completion. Tools are only offered when there are any to offer."""
    try:
        if tools:
            response = client.chat.completions.create(
                model=settings.openai_model,
                max_tokens=settings.max_answer_tokens,
                messages=messages,
                tools=tools,
            )
        else:
            response = client.chat.completions.create(
                model=settings.openai_model,
                max_tokens=settings.max_answer_tokens,
                messages=messages,
            )
        return response.choices[0]
    except Exception as e:
        raise AgentUnavailable(f"The agent is unavailable right now: {e}")


def answer_question(
    cv_text: str,
    history: list[dict[str, Any]],
    question: str,
    display_name: str | None = None,
) -> tuple[str, list[dict[str, Any]]]:
    """
    Run one turn and return (answer, messages_to_persist).

    The system prompt is rebuilt from the CV on every turn and never stored, so
    replacing a CV takes effect mid-conversation instead of going stale.
    """
    github_username = github.username_in(cv_text)

    question_message = {"role": "user", "content": question}
    messages = [
        {"role": "system", "content": build_system_prompt(cv_text, display_name)},
        *history,
        question_message,
    ]
    appended = [question_message]

    choice = _complete(messages, tools=_tools_for(github_username))

    if choice.finish_reason == "tool_calls":
        # exclude_none keeps null SDK bookkeeping fields out of stored JSON.
        assistant_message = choice.message.model_dump(exclude_none=True)
        tool_messages = _run_tool_calls(choice, github_username)

        messages.extend([assistant_message, *tool_messages])
        appended.extend([assistant_message, *tool_messages])

        # Second pass, without tools, turns the tool result into an answer.
        choice = _complete(messages)

    answer = choice.message.content
    appended.append({"role": "assistant", "content": answer})

    return answer, appended


# ── extraction ──────────────────────────────────────────────────────────────


def extract_profile(cv_text: str) -> dict[str, Any]:
    """Turn a CV into the structured page content. Raises on failure."""
    try:
        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "user", "content": EXTRACTION_PROMPT.format(cv_text=cv_text)}
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "portfolio_profile",
                    "strict": True,
                    "schema": PROFILE_SCHEMA,
                },
            },
        )
    except Exception as e:
        raise AgentUnavailable(f"Profile generation failed: {e}")

    content = response.choices[0].message.content
    if content is None:
        raise AgentUnavailable("Profile generation returned an empty response.")

    return json.loads(content)
