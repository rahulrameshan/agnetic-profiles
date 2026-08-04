"""
seed.py
-------
Creates the owner account for the existing single-tenant portfolio and attaches
RR.pdf as its active CV, so /u/rahul works straight after migrating.

The password is read from SEED_PASSWORD — never hardcode one here.

    SEED_PASSWORD='...' .venv/bin/python seed.py

Re-running is safe: an existing account is left alone.
"""

import os
import sys

from dotenv import load_dotenv
from sqlalchemy import select

from auth import hash_password
from db import SessionLocal
from extractor import run_extraction
from models import CV, Profile, User
from storage import InvalidCV, store_cv

load_dotenv()

USERNAME = os.getenv("SEED_USERNAME", "rahul")
EMAIL = os.getenv("SEED_EMAIL", "rahulrameshan82@gmail.com")
DISPLAY_NAME = os.getenv("SEED_DISPLAY_NAME", "Rahul Rameshan")
HEADLINE = os.getenv("SEED_HEADLINE", "Lead Software Engineer")
LOCATION = os.getenv("SEED_LOCATION", "Luxembourg")
CV_FILE = os.getenv("SEED_CV", "RR.pdf")


def main() -> int:
    password = os.getenv("SEED_PASSWORD")
    if not password:
        print("SEED_PASSWORD is not set. Re-run with SEED_PASSWORD='...' set.")
        return 1
    if len(password) < 8:
        print("SEED_PASSWORD must be at least 8 characters.")
        return 1

    cv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), CV_FILE)
    if not os.path.exists(cv_path):
        print(f"CV not found: {cv_path}")
        return 1

    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.username == USERNAME))
        if user is None:
            user = User(
                username=USERNAME,
                email=EMAIL,
                password_hash=hash_password(password),
                display_name=DISPLAY_NAME,
                headline=HEADLINE,
                location=LOCATION,
            )
            db.add(user)
            db.flush()
            print(f"Created user '{USERNAME}'.")
        else:
            print(f"User '{USERNAME}' already exists — leaving it as is.")

        with open(cv_path, "rb") as f:
            contents = f.read()

        try:
            stored_path, text = store_cv(user.id, contents, os.path.basename(cv_path))
        except InvalidCV as e:
            print(f"Could not use {CV_FILE}: {e}")
            return 1

        db.query(CV).filter(CV.user_id == user.id, CV.is_active.is_(True)).update(
            {"is_active": False}
        )

        cv = CV(
            user_id=user.id,
            original_filename=os.path.basename(cv_path),
            stored_path=stored_path,
            size_bytes=len(contents),
            extracted_text=text,
            is_active=True,
        )
        db.add(cv)
        db.flush()

        profile = db.scalar(select(Profile).where(Profile.user_id == user.id))
        if profile is None:
            profile = Profile(user_id=user.id)
            db.add(profile)
        profile.cv_id = cv.id
        profile.status = "pending"
        profile.error = None

        db.commit()
        user_id, cv_id = user.id, cv.id
    finally:
        db.close()

    print(f"Attached {CV_FILE} as the active CV. Generating profile...")
    run_extraction(user_id, cv_id)

    db = SessionLocal()
    try:
        profile = db.scalar(select(Profile).where(Profile.user_id == user_id))
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
