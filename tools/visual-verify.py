#!/usr/bin/env python3
"""
visual-verify.py — DOCX 시각적 검증 도구

DOCX → PDF → 이미지 변환 후 기본 레이아웃 분석을 수행한다.
LibreOffice headless + pdf2image(Poppler) 필요.

사용법:
  python -X utf8 tools/visual-verify.py output/문서.docx
  python -X utf8 tools/visual-verify.py output/문서.docx --json
  python -X utf8 tools/visual-verify.py output/문서.docx --save-images

단계:
  4a. 페이지 수 비교 (validate 추정 vs 실제 렌더링)
  4b. 빈 페이지 감지 (95% 이상 흰색 픽셀)
  4c. 플래그된 페이지 이미지 저장 (Claude Code가 시각 리뷰)

의존성:
  - LibreOffice (soffice 명령어)
  - pip install pdf2image Pillow
  - Poppler 바이너리 (pdf2image 요구사항)
"""

import sys
import os
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

# 의존성 체크 플래그
HAS_PDF2IMAGE = False
HAS_PIL = False

try:
    from pdf2image import convert_from_path
    HAS_PDF2IMAGE = True
except ImportError:
    pass

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    pass


def find_soffice():
    """LibreOffice soffice 경로 탐색"""
    # PATH에서 찾기
    soffice = shutil.which("soffice")
    if soffice:
        return soffice

    # Windows 기본 설치 경로
    win_paths = [
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    ]
    for p in win_paths:
        if os.path.exists(p):
            return p

    # macOS
    mac_path = "/Applications/LibreOffice.app/Contents/MacOS/soffice"
    if os.path.exists(mac_path):
        return mac_path

    return None


def convert_docx_to_pdf(docx_path, output_dir):
    """LibreOffice headless로 DOCX → PDF 변환"""
    soffice = find_soffice()
    if not soffice:
        return None, "LibreOffice가 설치되어 있지 않습니다. soffice 명령어를 찾을 수 없습니다."

    cmd = [
        soffice,
        "--headless",
        "--convert-to", "pdf",
        "--outdir", str(output_dir),
        str(docx_path),
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            return None, f"LibreOffice 변환 실패: {result.stderr}"

        pdf_name = Path(docx_path).stem + ".pdf"
        pdf_path = os.path.join(output_dir, pdf_name)

        if os.path.exists(pdf_path):
            return pdf_path, None
        else:
            return None, f"PDF 파일이 생성되지 않았습니다: {pdf_path}"

    except subprocess.TimeoutExpired:
        return None, "LibreOffice 변환 타임아웃 (120초)"
    except Exception as e:
        return None, f"변환 오류: {e}"


def analyze_page_image(img):
    """페이지 이미지 기본 분석: 빈 페이지 감지 + 채움 비율 추정"""
    width, height = img.size
    pixels = img.load()
    total = width * height
    white_count = 0

    # 샘플링 (전체 대비 10% 랜덤 검사로 속도 향상)
    step = max(1, int(total ** 0.5) // 30)
    sample_total = 0

    for y in range(0, height, step):
        for x in range(0, width, step):
            r, g, b = pixels[x, y][:3]
            sample_total += 1
            if r > 240 and g > 240 and b > 240:
                white_count += 1

    white_ratio = white_count / sample_total if sample_total > 0 else 0
    fill_ratio = 1.0 - white_ratio

    return {
        "whiteRatio": round(white_ratio, 4),
        "fillRatio": round(fill_ratio, 4),
        "isBlank": white_ratio >= 0.95,
    }


def load_validate_report(docx_path):
    """대응하는 validate JSON 리포트 로드"""
    report_path = str(docx_path).replace(".docx", ".validate.json")
    if os.path.exists(report_path):
        with open(report_path, "r", encoding="utf-8") as f:
            return json.load(f)

    # --validate로 실행했을 때 생성되는 위치
    return None


def main():
    if len(sys.argv) < 2:
        print("사용법: python -X utf8 tools/visual-verify.py <docx_path> [--json] [--save-images]")
        sys.exit(1)

    docx_path = sys.argv[1]
    output_json = "--json" in sys.argv
    save_images = "--save-images" in sys.argv

    if not os.path.exists(docx_path):
        print(f"[ERROR] 파일을 찾을 수 없습니다: {docx_path}", file=sys.stderr)
        sys.exit(1)

    # 결과 구조
    report = {
        "file": docx_path,
        "renderedPages": 0,
        "estimatedPages": 0,
        "pageDiff": 0,
        "flags": [],
        "pages": [],
        "pageImages": [],
        "errors": [],
    }

    # validate 리포트에서 estimatedPages 로드
    validate_report = load_validate_report(docx_path)
    if validate_report:
        report["estimatedPages"] = validate_report.get("stats", {}).get("estimatedPages", 0)

    # 의존성 체크
    soffice = find_soffice()
    if not soffice:
        report["errors"].append("LibreOffice가 설치되어 있지 않습니다.")
        if output_json:
            print(json.dumps(report, ensure_ascii=False, indent=2))
        else:
            print("[ERROR] LibreOffice가 설치되어 있지 않습니다.")
            print("  설치: https://www.libreoffice.org/download/download/")
            print("  또는: choco install libreoffice-fresh (Windows)")
        sys.exit(1)

    if not HAS_PDF2IMAGE:
        report["errors"].append("pdf2image 패키지가 설치되어 있지 않습니다.")
        if output_json:
            print(json.dumps(report, ensure_ascii=False, indent=2))
        else:
            print("[ERROR] pdf2image 패키지가 설치되어 있지 않습니다.")
            print("  설치: pip install pdf2image Pillow")
            print("  Poppler도 필요: https://github.com/oschwartz10612/poppler-windows/releases")
        sys.exit(1)

    if not HAS_PIL:
        report["errors"].append("Pillow 패키지가 설치되어 있지 않습니다.")
        if output_json:
            print(json.dumps(report, ensure_ascii=False, indent=2))
        else:
            print("[ERROR] Pillow 패키지가 설치되어 있지 않습니다.")
            print("  설치: pip install Pillow")
        sys.exit(1)

    # 임시 디렉토리에서 작업
    with tempfile.TemporaryDirectory() as tmpdir:
        # 4a. DOCX → PDF
        if not output_json:
            print(f"[1/3] DOCX → PDF 변환 중...")
        pdf_path, error = convert_docx_to_pdf(docx_path, tmpdir)
        if error:
            report["errors"].append(error)
            if output_json:
                print(json.dumps(report, ensure_ascii=False, indent=2))
            else:
                print(f"[ERROR] {error}")
            sys.exit(1)

        # PDF → 이미지
        if not output_json:
            print(f"[2/3] PDF → 이미지 변환 중...")
        try:
            images = convert_from_path(pdf_path, dpi=150)
        except Exception as e:
            report["errors"].append(f"PDF → 이미지 변환 실패: {e}")
            if output_json:
                print(json.dumps(report, ensure_ascii=False, indent=2))
            else:
                print(f"[ERROR] PDF → 이미지 변환 실패: {e}")
                print("  Poppler가 설치되어 있는지 확인하세요.")
            sys.exit(1)

        report["renderedPages"] = len(images)
        report["pageDiff"] = report["renderedPages"] - report["estimatedPages"]

        # 4b. 각 페이지 분석
        if not output_json:
            print(f"[3/3] {len(images)}페이지 분석 중...")

        image_save_dir = None
        if save_images:
            image_save_dir = str(docx_path).replace(".docx", "_visual")
            os.makedirs(image_save_dir, exist_ok=True)

        for idx, img in enumerate(images):
            page_num = idx + 1
            analysis = analyze_page_image(img)

            page_info = {
                "page": page_num,
                "fillRatio": analysis["fillRatio"],
                "isBlank": analysis["isBlank"],
            }
            report["pages"].append(page_info)

            # 플래그 조건
            if analysis["isBlank"]:
                flag = {
                    "type": "BLANK_PAGE",
                    "severity": "WARN",
                    "page": page_num,
                    "message": f"p.{page_num}: 빈 페이지 감지 (흰색 {analysis['whiteRatio']:.1%})",
                }
                report["flags"].append(flag)

            # 이미지 저장 (플래그된 페이지 또는 전체)
            if save_images:
                img_path = os.path.join(image_save_dir, f"page_{page_num:03d}.png")
                img.save(img_path, "PNG")
                report["pageImages"].append(img_path)
            elif analysis["isBlank"]:
                # 플래그된 페이지만 저장
                flagged_dir = str(docx_path).replace(".docx", "_flagged")
                os.makedirs(flagged_dir, exist_ok=True)
                img_path = os.path.join(flagged_dir, f"page_{page_num:03d}.png")
                img.save(img_path, "PNG")
                report["pageImages"].append(img_path)

        # 페이지 수 차이 플래그
        if report["estimatedPages"] > 0 and abs(report["pageDiff"]) > 2:
            flag = {
                "type": "PAGE_COUNT_MISMATCH",
                "severity": "WARN" if abs(report["pageDiff"]) > 5 else "INFO",
                "page": 0,
                "message": f"페이지 수 차이: 추정 {report['estimatedPages']}p vs 렌더링 {report['renderedPages']}p (차이 {report['pageDiff']:+d}p)",
            }
            report["flags"].append(flag)

    # 출력
    if output_json:
        # pageImages는 절대경로로 변환
        report["pageImages"] = [os.path.abspath(p) for p in report["pageImages"]]
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(f"\n=== 시각적 검증 결과 ===\n")
        print(f"  파일: {docx_path}")
        print(f"  렌더링 페이지: {report['renderedPages']}p")
        if report["estimatedPages"] > 0:
            print(f"  추정 페이지:   {report['estimatedPages']}p (차이: {report['pageDiff']:+d})")
        print()

        # 페이지 채움 비율
        print(f"  페이지 채움 비율:")
        for p in report["pages"]:
            bar_len = int(p["fillRatio"] * 20)
            bar = "█" * bar_len + "░" * (20 - bar_len)
            blank_mark = " [BLANK]" if p["isBlank"] else ""
            print(f"    p.{p['page']:2d}  {bar}  {p['fillRatio']:.1%}{blank_mark}")
        print()

        # 플래그
        if report["flags"]:
            print(f"  플래그: {len(report['flags'])}건")
            for f in report["flags"]:
                print(f"    [{f['severity']}] {f['message']}")
        else:
            print(f"  플래그: 없음")

        if report["pageImages"]:
            print(f"\n  이미지 저장: {len(report['pageImages'])}장")
            for img_path in report["pageImages"][:5]:
                print(f"    {img_path}")
            if len(report["pageImages"]) > 5:
                print(f"    ... 외 {len(report['pageImages']) - 5}장")


if __name__ == "__main__":
    main()
