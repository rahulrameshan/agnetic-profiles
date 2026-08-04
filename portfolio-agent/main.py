import sys
import argparse
from parser import parse_pdf
from agent import run_agent


def main():
    parser = argparse.ArgumentParser(description="Portfolio Agent — Chat with a CV")
    parser.add_argument("--cv", required=True, help="Path to the CV PDF file")
    args = parser.parse_args()

    print(f"Loading CV from: {args.cv}")
    cv_text = parse_pdf(args.cv)
    print("CV parsed successfully.")

    run_agent(cv_text)


if __name__ == "__main__":
    main()