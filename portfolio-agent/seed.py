"""
seed.py
-------
Creates an account from the command line and attaches a CV to it.

Now that no account is privileged this is only a convenience — signing up
through the UI does the same thing. Useful for bootstrapping a fresh database.

    SEED_PASSWORD='...' uv run python seed.py

The password is read from the environment; never hardcode one here.
Re-running is safe: an existing account is left alone.
"""

import os
import sys

from app.db import SessionLocal
from app.errors import DomainError
from app.repositories import UnitOfWork
from app.services import accounts, cvs
from app.services.generation import regenerate

USERNAME = os.getenv("SEED_USERNAME", "rahul")
EMAIL = os.getenv("SEED_EMAIL", "rahulrameshan82@gmail.com")
DISPLAY_NAME = os.getenv("SEED_DISPLAY_NAME", "Rahul Rameshan")
HEADLINE = os.getenv("SEED_HEADLINE", "Lead Software Engineer")
LOCATION = os.getenv("SEED_LOCATION", "Luxembourg")
CV_FILE = os.getenv("SEED_CV", "RR.pdf")


def main() -> int:
    password = os.getenv("SEED_PASSWORD")
    if not password or len(password) < 8:
        print("Set SEED_PASSWORD to at least 8 characters and re-run.")
        return 1

    cv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), CV_FILE)
    if not os.path.exists(cv_path):
        print(f"CV not found: {cv_path}")
        return 1

    db = SessionLocal()
    try:
        uow = UnitOfWork(db)

        user = uow.users.find_by_username(USERNAME)
        if user is None:
            user, _ = accounts.register(
                uow,
                username=USERNAME,
                email=EMAIL,
                password=password,
                display_name=DISPLAY_NAME,
                headline=HEADLINE,
                location=LOCATION,
            )
            print(f"Created user '{USERNAME}'.")
        else:
            print(f"User '{USERNAME}' already exists — leaving it as is.")

        with open(cv_path, "rb") as f:
            contents = f.read()

        try:
            # Generate inline rather than in the background: this is a script,
            # and there is no response to return before the work is done.
            cv = cvs.replace(
                uow,
                user,
                contents=contents,
                filename=os.path.basename(cv_path),
                schedule=lambda *_: None,
            )
        except DomainError as e:
            print(f"Could not use {CV_FILE}: {e.message}")
            return 1

        user_id, cv_id = user.id, cv.id
    finally:
        db.close()

    print(f"Attached {CV_FILE}. Generating profile...")
    regenerate(user_id, cv_id)

    db = SessionLocal()
    try:
        profile = UnitOfWork(db).profiles.for_user(user_id)
        if profile is None:
            print("No profile was created — nothing to report.")
            return 1

        print(f"Profile status: {profile.status}")
        if profile.status == "failed":
            print(f"  error: {profile.error}")
            return 1
    finally:
        db.close()

    print(f"Done. Visit /u/{USERNAME}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
