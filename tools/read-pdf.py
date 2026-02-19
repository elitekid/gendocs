#!/usr/bin/env python3
"""Extract text from PDF using PyMuPDF (fitz)."""
import sys
import fitz  # PyMuPDF

def main():
    if len(sys.argv) < 2:
        print("Usage: python read-pdf.py <file.pdf> [start_page] [end_page]")
        sys.exit(1)

    pdf_path = sys.argv[1]
    start_page = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    end_page = int(sys.argv[3]) if len(sys.argv) > 3 else None

    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    print(f"[INFO] Total pages: {total_pages}")

    if end_page is None:
        end_page = min(start_page + 15, total_pages)
    end_page = min(end_page, total_pages)

    for page_num in range(start_page, end_page):
        page = doc[page_num]
        text = page.get_text()
        if text.strip():
            print(f"\n--- PAGE {page_num + 1} ---")
            print(text)

    doc.close()

if __name__ == "__main__":
    main()
