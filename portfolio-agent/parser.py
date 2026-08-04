import sys
from pypdf import PdfReader

def parse_pdf(file_path):
    try:
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        if not text.strip():
            print("No text found in the PDF.")
            sys.exit(1)
        return text

    except FileNotFoundError as e:
        print(f"File not found: {e}")
        return None

    except Exception as e:
        print(f"Error parsing PDF: {e}")
        return None