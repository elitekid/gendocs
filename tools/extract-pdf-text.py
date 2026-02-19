#!/usr/bin/env python3
"""Extract text from PDF files using PyMuPDF."""
import sys
import os
import json
import io

# Suppress PyMuPDF layout recommendation message by redirecting stdout during import
_real_stdout = sys.stdout
sys.stdout = io.StringIO()
try:
    import fitz  # PyMuPDF
finally:
    sys.stdout = _real_stdout

def extract_pdf(path, max_pages=10):
    doc = fitz.open(path)
    total = doc.page_count
    pages = []
    text_page_count = 0
    image_page_count = 0
    for i in range(min(total, max_pages)):
        page = doc[i]
        text = page.get_text("text")
        has_images = len(page.get_images()) > 0
        if text.strip():
            text_page_count += 1
        if has_images:
            image_page_count += 1
        tables = []
        try:
            tabs = page.find_tables()
            for t in tabs:
                table_data = t.extract()
                if table_data:
                    tables.append(table_data)
        except:
            pass
        pages.append({
            "page": i + 1,
            "text": text,
            "tables": tables,
            "has_images": has_images
        })
    doc.close()
    checked = min(total, max_pages)
    is_scanned = text_page_count < 2 and image_page_count > checked * 0.5

    return {
        "file": path,
        "total_pages": total,
        "extracted_pages": checked,
        "text_pages": text_page_count,
        "is_scanned": is_scanned,
        "pages": pages
    }

if __name__ == "__main__":
    path = sys.argv[1]
    max_pages = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    out_file = sys.argv[3] if len(sys.argv) > 3 else None
    result = extract_pdf(path, max_pages)
    output = json.dumps(result, ensure_ascii=False, indent=2)
    if out_file:
        with open(out_file, 'w', encoding='utf-8') as f:
            f.write(output)
    else:
        print(output)
