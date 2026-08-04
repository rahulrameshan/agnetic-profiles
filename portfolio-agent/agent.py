"""
agent.py
--------
The conversational agent that answers questions about one candidate.

run_agent      — interactive CLI loop (used by main.py)
run_agent_once — one turn, used by the API. Owner-aware: every call is scoped to
                 a specific user's CV, name and GitHub account.
"""

import json
import os

from dotenv import load_dotenv
from openai import OpenAI

from prompts import build_system_prompt
from tools.github_parser import TOOL_DEFINITIONS, extract_github_username, fetch_github

load_dotenv()

client = OpenAI()

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")
MAX_TOKENS = 1024

NO_GITHUB = "No GitHub profile found in CV."


def _run_tool_calls(choice, github_username):
    """Execute the tool calls in a response, returning the messages to append."""
    appended = []

    for tool_call in choice.message.tool_calls:
        if tool_call.function.name == "fetch_github":
            # Guard the no-GitHub case: fetching /users/None would 404 and the
            # model would have to interpret an HTTP error as "not present".
            result = fetch_github(github_username) if github_username else NO_GITHUB
            appended.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(result),
                }
            )

    return appended


def run_agent_once(cv_text, history, user_input, display_name=None):
    """
    Run one turn of conversation.

    history is the prior messages for this session, without a system message —
    the system prompt is rebuilt from the current CV on every turn, so a freshly
    uploaded CV takes effect mid-conversation instead of going stale.

    Returns (answer, appended) where appended is the new messages the caller
    should persist.
    """
    system_prompt = build_system_prompt(cv_text, display_name)
    github_username = extract_github_username(cv_text)

    user_message = {"role": "user", "content": user_input}
    messages = [{"role": "system", "content": system_prompt}, *history, user_message]
    appended = [user_message]

    response = client.chat.completions.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        tools=TOOL_DEFINITIONS,
        messages=messages,
    )
    choice = response.choices[0]

    if choice.finish_reason == "tool_calls":
        # exclude_none keeps null OpenAI bookkeeping fields out of the stored JSON.
        assistant_message = choice.message.model_dump(exclude_none=True)
        messages.append(assistant_message)
        appended.append(assistant_message)

        tool_messages = _run_tool_calls(choice, github_username)
        messages.extend(tool_messages)
        appended.extend(tool_messages)

        follow_up = client.chat.completions.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            messages=messages,
        )
        answer = follow_up.choices[0].message.content
    else:
        answer = choice.message.content

    appended.append({"role": "assistant", "content": answer})
    return answer, appended


def run_agent(cv_text, display_name=None):
    """Interactive terminal loop over a single CV."""
    github_username = extract_github_username(cv_text)
    history = []

    print("\nCV loaded. You can now ask questions about the candidate.")
    if github_username:
        print(f"GitHub profile found: {github_username}")
    else:
        print("No GitHub profile found in CV.")
    print("Type 'exit' to quit.\n")

    while True:
        user_input = input("You: ").strip()

        if user_input.lower() == "exit":
            print("Ending session.")
            break

        if not user_input:
            continue

        answer, appended = run_agent_once(cv_text, history, user_input, display_name)
        history.extend(appended)
        print(f"\nAgent: {answer}\n")
