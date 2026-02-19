"""
gendocs MD 구조 린트 도구 — 변환 전 MD 파일의 구조적 이슈를 자동 검출.

11가지 구조 검사:
  - 메타데이터 완성도
  - 구분선(---) 존재
  - 변경 이력 용어 ("초안 작성" 준수)
  - 코드블록 균형 (열림/닫힘)
  - 목차-본문 일치
  - HTML 아티팩트
  - 중첩 불릿 감지
  - 테이블 8+ 컬럼
  - 이미지 파일 참조 존재
  - 코드블록 언어 태그 유효성
  - 섹션 분량 균형

사용법:
  python -X utf8 tools/lint-md.py source/문서.md
  python -X utf8 tools/lint-md.py source/문서.md --json
  python -X utf8 tools/lint-md.py source/*.md              # 배치 모드
  python -X utf8 tools/lint-md.py source/*.md --json       # 배치 JSON
"""

import sys
import os
import io
import re
import json
import glob

# Windows 터미널 한글 출력 보장
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


def lint_md(md_path):
    """MD 파일을 린트하여 이슈 목록 반환"""
    if not os.path.exists(md_path):
        return {'file': md_path, 'error': '파일 없음', 'issues': [], 'summary': {}}

    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    issues = []

    # === 1. 메타데이터 블록쿼트 검사 ===
    check_metadata(lines, issues)

    # === 2. 구분선(---) 검사 ===
    check_separators(lines, issues)

    # === 3. 변경 이력 용어 검사 ===
    check_change_history(lines, issues)

    # === 4. 코드블록 균형 검사 ===
    check_code_block_balance(lines, issues)

    # === 5. 목차-본문 일치 검사 ===
    check_toc_consistency(lines, issues)

    # === 6. HTML 아티팩트 검사 ===
    check_html_artifacts(lines, issues)

    # === 7. 중첩 불릿 검사 ===
    check_nested_bullets(lines, issues)

    # === 8. 테이블 컬럼 수 검사 ===
    check_table_column_count(lines, issues)

    # === 9. 이미지 참조 검사 ===
    check_image_references(lines, issues, md_path)

    # === 10. 코드블록 언어 태그 검사 ===
    check_code_language_tag(lines, issues)

    # === 11. 섹션 분량 균형 검사 ===
    check_section_balance(lines, issues)

    # 심각도별 집계
    summary = {}
    for issue in issues:
        sev = issue['severity']
        summary[sev] = summary.get(sev, 0) + 1

    return {
        'file': os.path.basename(md_path),
        'path': md_path,
        'issues': issues,
        'summary': summary,
    }


# ============================================================
# 검사 함수들
# ============================================================

def check_metadata(lines, issues):
    """메타데이터 블록쿼트(> **프로젝트**: ...) 완성도 검사"""
    # H1 찾기
    h1_line = None
    for i, line in enumerate(lines):
        if line.strip().startswith('# ') and not line.strip().startswith('## '):
            h1_line = i
            break

    if h1_line is None:
        issues.append({
            'check': 'metadata',
            'severity': 'WARN',
            'line': 1,
            'message': 'H1 제목이 없습니다',
        })
        return

    # H1 다음 블록쿼트 영역에서 키 확인
    meta_keys_found = set()
    required_keys = {'프로젝트', '버전', '작성일'}
    for i in range(h1_line + 1, min(h1_line + 10, len(lines))):
        stripped = lines[i].strip()
        if not stripped.startswith('>'):
            if stripped == '' or stripped == '---':
                continue
            break
        # > **키**: 값 패턴
        m = re.match(r'>\s*\*\*(.+?)\*\*', stripped)
        if m:
            meta_keys_found.add(m.group(1).strip())

    missing = required_keys - meta_keys_found
    if missing:
        issues.append({
            'check': 'metadata',
            'severity': 'MINOR',
            'line': h1_line + 1,
            'message': f'메타데이터 누락: {", ".join(sorted(missing))}',
            'missing': sorted(missing),
        })


def check_separators(lines, issues):
    """주요 구간 사이 --- 구분선 존재 검사

    gendocs MD 규칙: 메타데이터/목차/변경이력/본문 사이, 그리고 H2 섹션 사이에 --- 필요.
    """
    # H2 제목 위치 수집
    h2_positions = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('## ') and not stripped.startswith('### '):
            h2_positions.append(i)

    # 각 H2 위에 --- 가 있는지 확인 (2줄 이내)
    for pos in h2_positions:
        found_separator = False
        for j in range(max(0, pos - 3), pos):
            if lines[j].strip() == '---':
                found_separator = True
                break
        if not found_separator and pos > 0:
            heading_text = lines[pos].strip()
            issues.append({
                'check': 'separator',
                'severity': 'MINOR',
                'line': pos + 1,
                'message': f'"{heading_text}" 위에 --- 구분선 없음',
            })


def check_change_history(lines, issues):
    """변경 이력 테이블에서 v1.0 항목의 변경 내용이 "초안 작성"인지 검사"""
    in_change_history = False
    in_table = False
    table_header_cols = []
    change_content_col = -1
    version_col = -1

    for i, line in enumerate(lines):
        stripped = line.strip()

        # "## 변경 이력" 섹션 감지
        if stripped == '## 변경 이력':
            in_change_history = True
            continue

        # 다른 H2가 나오면 변경 이력 섹션 종료
        if in_change_history and stripped.startswith('## ') and stripped != '## 변경 이력':
            break

        if not in_change_history:
            continue

        # 테이블 파싱
        if stripped.startswith('|'):
            if not in_table:
                # 헤더 행
                table_header_cols = [c.strip() for c in stripped.strip('|').split('|')]
                in_table = True

                # "변경 내용" 컬럼 인덱스 찾기
                for ci, col in enumerate(table_header_cols):
                    if '변경' in col and '내용' in col:
                        change_content_col = ci
                    if '버전' in col:
                        version_col = ci
                continue

            # 구분선 스킵
            if re.match(r'^\|[\s\-:|]+\|$', stripped):
                continue

            # 데이터 행
            if change_content_col >= 0 and version_col >= 0:
                cols = [c.strip() for c in stripped.strip('|').split('|')]
                if len(cols) > max(change_content_col, version_col):
                    version = cols[version_col].strip()
                    content = cols[change_content_col].strip()

                    # v1.0이 유일한 행이면 "초안 작성"이어야 함
                    if version == 'v1.0' and content != '초안 작성':
                        # 이전 버전이 없는지 확인 (이 행이 첫 행이면)
                        issues.append({
                            'check': 'changeHistory',
                            'severity': 'STYLE',
                            'line': i + 1,
                            'message': f'v1.0 변경 내용이 "{content}" → "초안 작성"이어야 합니다',
                            'actual': content,
                            'expected': '초안 작성',
                        })
        else:
            if in_table:
                in_table = False


def check_code_block_balance(lines, issues):
    """코드블록 열림/닫힘 ``` 균형 검사"""
    opens = []
    in_code = False

    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('```'):
            if in_code:
                in_code = False
            else:
                in_code = True
                opens.append(i)

    if in_code:
        # 마지막으로 열린 코드블록이 닫히지 않음
        last_open = opens[-1] if opens else 0
        lang_match = re.match(r'^```(\w+)', lines[last_open].strip()) if last_open < len(lines) else None
        lang = lang_match.group(1) if lang_match else ''
        issues.append({
            'check': 'codeBlockBalance',
            'severity': 'CRITICAL',
            'line': last_open + 1,
            'message': f'닫히지 않은 코드블록 (```{lang}) — 이후 모든 콘텐츠가 코드블록 안에 렌더링됩니다',
            'language': lang,
        })


def check_toc_consistency(lines, issues):
    """목차(## 목차) 항목과 실제 H2 섹션 일치 검사"""
    # 목차 섹션 찾기
    toc_start = None
    toc_end = None
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped == '## 목차':
            toc_start = i
            continue
        if toc_start is not None and toc_end is None:
            # 다음 H2 또는 --- 로 끝남
            if (stripped.startswith('## ') and stripped != '## 목차') or stripped == '---':
                toc_end = i
                break

    if toc_start is None:
        return  # 목차 없음 — 별도 이슈 아님

    if toc_end is None:
        toc_end = len(lines)

    # 목차에서 링크 텍스트 추출: - [텍스트](#anchor)
    toc_entries = []
    for i in range(toc_start + 1, toc_end):
        stripped = lines[i].strip()
        m = re.match(r'^-\s*\[(.+?)\]\(#.+?\)', stripped)
        if m:
            toc_entries.append(m.group(1).strip())

    # 실제 H2 제목 수집 (## 목차, ## 변경 이력 제외)
    actual_h2s = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('## ') and not stripped.startswith('### '):
            h2_text = stripped[3:].strip()
            if h2_text not in ('목차',):
                actual_h2s.append(h2_text)

    # 목차에 있지만 본문에 없는 항목 (H2 수준만 비교 — H3 이하는 노이즈)
    actual_set = set(actual_h2s)
    for entry in toc_entries:
        # H3 이하 패턴 스킵: "1.1 ..." "2.3.1 ..." 등 소수점 포함 번호는 H3 이하
        if re.match(r'^\d+\.\d+', entry):
            continue
        if entry not in actual_set:
            issues.append({
                'check': 'tocConsistency',
                'severity': 'MINOR',
                'line': toc_start + 1,
                'message': f'목차에 "{entry}" 항목이 있지만 본문에 해당 H2 섹션 없음',
                'entry': entry,
            })

    # 본문에 있지만 목차에 없는 항목
    toc_set = set(toc_entries)
    for h2 in actual_h2s:
        if h2 not in toc_set and h2 != '변경 이력':
            # 변경 이력은 목차에 없을 수도 있으므로 관대하게
            pass  # 너무 엄격하면 노이즈가 됨


def check_html_artifacts(lines, issues):
    """코드블록 외부의 HTML 태그 잔여물 검사"""
    in_code = False

    # 허용 패턴: 마크다운에서 사용하는 태그 + 기술 문서 플레이스홀더
    allowed_pattern = re.compile(r'^<(br|hr|sub|sup|!--|img\s)')
    # 플레이스홀더 패턴: <word>, <word-word>, <WORD> (속성 없는 단순 단어)
    placeholder_pattern = re.compile(r'^</?[a-zA-Z][a-zA-Z0-9_-]*>$')

    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('```'):
            in_code = not in_code
            continue

        if in_code:
            continue

        # HTML 태그 감지 (< 로 시작하고 > 로 끝나는 패턴)
        html_tags = re.findall(r'</?[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9.]+)?[^>]*>', stripped)
        for tag in html_tags:
            clean_tag = tag.lstrip('</')
            if allowed_pattern.match(clean_tag):
                continue
            # 플레이스홀더(<hash>, <pod-name>, <file> 등)는 무시
            if placeholder_pattern.match(tag):
                continue
            # URL 자동링크 (<https://...>) 무시
            if tag.startswith('<http'):
                continue
            issues.append({
                'check': 'htmlArtifact',
                'severity': 'MINOR',
                'line': i + 1,
                'message': f'HTML 아티팩트 감지: {tag}',
                'tag': tag,
            })
            break  # 같은 줄에서 하나만 보고


def check_nested_bullets(lines, issues):
    """중첩 불릿 감지 — converter가 들여쓰기를 무시하므로 구조 손실됨"""
    in_code = False
    in_toc = False

    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('```'):
            in_code = not in_code
            continue

        if in_code:
            continue

        # 목차 섹션 추적 (TOC 내 들여쓰기는 정상)
        if stripped == '## 목차':
            in_toc = True
            continue
        if in_toc and (stripped.startswith('## ') or stripped == '---'):
            in_toc = False
        if in_toc:
            continue

        # 블록쿼트 내부 스킵
        if stripped.startswith('>'):
            continue

        # 2+ space 또는 tab으로 시작하는 불릿/번호 리스트
        m = re.match(r'^( {2,}|\t)[-*+] ', line) or re.match(r'^( {2,}|\t)\d+\. ', line)
        if m:
            issues.append({
                'check': 'nestedBullet',
                'severity': 'CRITICAL',
                'line': i + 1,
                'message': '중첩 불릿 감지 — converter가 들여쓰기를 무시하므로 테이블이나 일반 불릿으로 변환하세요',
            })


def check_table_column_count(lines, issues):
    """8개 이상 컬럼 테이블 감지"""
    in_code = False

    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('```'):
            in_code = not in_code
            continue

        if in_code:
            continue

        # 테이블 헤더 감지: | 로 시작하고 다음 줄이 |--- 패턴
        if stripped.startswith('|') and i + 1 < len(lines):
            next_stripped = lines[i + 1].strip()
            if re.match(r'^\|[\s\-:|]+\|$', next_stripped):
                cols = stripped.strip('|').split('|')
                col_count = len(cols)
                if col_count >= 8:
                    issues.append({
                        'check': 'tableColumnCount',
                        'severity': 'WARN',
                        'line': i + 1,
                        'message': f'테이블 컬럼 {col_count}개 — 가로 레이아웃에서도 가독성이 저하됩니다',
                        'columnCount': col_count,
                    })


def check_image_references(lines, issues, md_path):
    """이미지 파일 참조 존재 여부 검사"""
    in_code = False

    # 프로젝트 루트 탐색: md_path에서 위로 올라가며 CLAUDE.md 찾기
    project_root = None
    search_dir = os.path.dirname(os.path.abspath(md_path))
    for _ in range(10):  # 최대 10단계
        if os.path.exists(os.path.join(search_dir, 'CLAUDE.md')):
            project_root = search_dir
            break
        parent = os.path.dirname(search_dir)
        if parent == search_dir:
            break
        search_dir = parent

    md_dir = os.path.dirname(os.path.abspath(md_path))

    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('```'):
            in_code = not in_code
            continue

        if in_code:
            continue

        # 이미지 참조 추출
        refs = re.findall(r'!\[.*?\]\((.+?)\)', line)
        for ref in refs:
            # URL 스킵
            if ref.startswith('http://') or ref.startswith('https://'):
                continue

            # 쿼리스트링/타이틀 제거
            path = ref.split('?')[0].split('"')[0].split("'")[0].strip()
            if not path:
                continue

            # 경로 해석: ① MD 파일 기준 상대 → ② 프로젝트 루트 기준 상대
            resolved = os.path.normpath(os.path.join(md_dir, path))
            if os.path.exists(resolved):
                continue

            if project_root:
                resolved_root = os.path.normpath(os.path.join(project_root, path))
                if os.path.exists(resolved_root):
                    continue

            issues.append({
                'check': 'imageReference',
                'severity': 'CRITICAL',
                'line': i + 1,
                'message': f'이미지 파일 없음: "{path}"',
                'path': path,
            })


def check_code_language_tag(lines, issues):
    """코드블록 언어 태그 유효성 검사"""
    in_code = False

    for i, line in enumerate(lines):
        stripped = line.strip()

        if stripped.startswith('```'):
            if not in_code:
                in_code = True
                # 언어 태그 추출
                m = re.match(r'^`{3,}([\w.+#-]+)', stripped)
                if m:
                    tag = m.group(1)
                    if tag.lower() not in KNOWN_LANGUAGES:
                        issues.append({
                            'check': 'codeLanguageTag',
                            'severity': 'MINOR',
                            'line': i + 1,
                            'message': f'알려지지 않은 코드블록 언어 태그: "{tag}"',
                            'tag': tag,
                        })
            else:
                in_code = False


def check_section_balance(lines, issues):
    """H2 섹션 간 분량 불균형 감지"""
    # H2 위치 수집 (목차, 변경 이력 제외)
    h2_sections = []
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('## ') and not stripped.startswith('### '):
            name = stripped[3:].strip()
            if name in ('목차', '변경 이력'):
                continue
            h2_sections.append({'name': name, 'line': i})

    # 콘텐츠 H2가 2개 미만이면 스킵
    if len(h2_sections) < 2:
        return

    # 각 섹션 줄 수 계산
    for idx, sec in enumerate(h2_sections):
        start = sec['line']
        end = h2_sections[idx + 1]['line'] if idx + 1 < len(h2_sections) else len(lines)
        sec['lines'] = end - start

    max_sec = max(h2_sections, key=lambda s: s['lines'])
    min_sec = min(h2_sections, key=lambda s: s['lines'])

    if min_sec['lines'] > 0 and max_sec['lines'] / min_sec['lines'] > 3.0:
        ratio = max_sec['lines'] / min_sec['lines']
        issues.append({
            'check': 'sectionBalance',
            'severity': 'INFO',
            'line': max_sec['line'] + 1,
            'message': f'섹션 분량 불균형: "{max_sec["name"]}" ({max_sec["lines"]}줄) vs "{min_sec["name"]}" ({min_sec["lines"]}줄) — {ratio:.1f}배 차이',
        })


# ============================================================
# 출력 포맷터
# ============================================================

SEVERITY_COLORS = {
    'CRITICAL': '\033[91m',  # 빨간색
    'WARN': '\033[93m',      # 노란색
    'MINOR': '\033[33m',     # 주황색
    'STYLE': '\033[36m',     # 시안
    'INFO': '\033[37m',      # 회색
}
RESET = '\033[0m'

# 코드블록 언어 태그 유효성 검사용 (~80개)
KNOWN_LANGUAGES = {
    # 주요 언어
    'python', 'py', 'javascript', 'js', 'typescript', 'ts', 'java', 'kotlin', 'kt',
    'csharp', 'cs', 'c', 'cpp', 'c++', 'go', 'rust', 'rs', 'ruby', 'rb', 'php',
    'swift', 'scala', 'r', 'perl', 'pl', 'lua', 'dart', 'elixir', 'ex', 'erlang',
    'haskell', 'hs', 'clojure', 'clj', 'fsharp', 'fs', 'ocaml', 'ml',
    # 쉘/스크립트
    'bash', 'sh', 'zsh', 'fish', 'powershell', 'ps1', 'pwsh', 'bat', 'cmd',
    'shell', 'console',
    # 웹
    'html', 'css', 'scss', 'sass', 'less', 'jsx', 'tsx', 'vue', 'svelte',
    # 데이터/설정
    'json', 'jsonc', 'json5', 'yaml', 'yml', 'toml', 'xml', 'ini', 'cfg',
    'properties', 'env', 'dotenv',
    # 쿼리/DB
    'sql', 'mysql', 'postgresql', 'plsql', 'nosql', 'mongodb', 'redis',
    'graphql', 'gql',
    # 마크업/문서
    'markdown', 'md', 'latex', 'tex', 'rst', 'asciidoc', 'text', 'txt',
    'plaintext', 'plain',
    # DevOps/인프라
    'dockerfile', 'docker', 'terraform', 'tf', 'hcl', 'nginx', 'apache',
    'kubernetes', 'k8s', 'helm', 'ansible', 'vagrant',
    # 기타 도구
    'makefile', 'make', 'cmake', 'gradle', 'groovy', 'maven',
    'mermaid', 'plantuml', 'dot', 'graphviz',
    # 데이터 교환
    'csv', 'tsv', 'protobuf', 'proto', 'thrift', 'avro',
    # diff/log
    'diff', 'patch', 'log', 'http', 'curl',
    # 기타
    'regex', 'regexp', 'cron', 'promql', 'rego',
    'gitignore', 'editorconfig',
    'objective-c', 'objc', 'assembly', 'asm', 'nasm',
    'vb', 'vbnet', 'pascal', 'delphi', 'fortran', 'cobol', 'lisp',
    'solidity', 'sol', 'wasm', 'zig',
}


def print_text_report(results):
    """텍스트 형식으로 리포트 출력"""
    total_issues = 0
    total_files = len(results)
    pass_count = 0

    for r in results:
        if r.get('error'):
            print(f"\n{'='*60}")
            print(f"  {r['file']}  [ERROR: {r['error']}]")
            continue

        issue_count = len(r['issues'])
        total_issues += issue_count

        if issue_count == 0:
            pass_count += 1
            if total_files <= 5:
                print(f"\n  {r['file']}  ✓ PASS")
            continue

        print(f"\n{'='*60}")
        print(f"  {r['file']}  [{issue_count}건]")
        print(f"{'='*60}")

        for issue in r['issues']:
            sev = issue['severity']
            color = SEVERITY_COLORS.get(sev, '')
            line_info = f"L{issue['line']}" if 'line' in issue else ''
            print(f"  {color}[{sev}]{RESET} {line_info:>5}  {issue['message']}")

    # 요약
    print(f"\n{'─'*60}")
    print(f"  파일: {total_files}개 | PASS: {pass_count}개 | 이슈: {total_issues}건")

    if total_issues > 0:
        # 심각도별 집계
        all_severities = {}
        for r in results:
            for sev, cnt in r.get('summary', {}).items():
                all_severities[sev] = all_severities.get(sev, 0) + cnt
        parts = [f"{sev} {cnt}" for sev, cnt in sorted(all_severities.items())]
        print(f"  분포: {' / '.join(parts)}")

    print(f"{'─'*60}")


# ============================================================
# CLI
# ============================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description='gendocs MD 구조 린트 도구')
    parser.add_argument('files', nargs='+', help='검사할 MD 파일 (글로빙 지원)')
    parser.add_argument('--json', action='store_true', help='JSON 형식 출력')
    args = parser.parse_args()

    # 글로빙 확장 (Windows에서 셸이 글로빙 안 할 수 있음)
    md_files = []
    for pattern in args.files:
        expanded = glob.glob(pattern)
        if expanded:
            md_files.extend(expanded)
        else:
            md_files.append(pattern)

    # 린트 실행
    results = [lint_md(f) for f in md_files]

    if args.json:
        if len(results) == 1:
            print(json.dumps(results[0], ensure_ascii=False, indent=2))
        else:
            # 배치: 요약 + 개별 결과
            total_issues = sum(len(r['issues']) for r in results)
            all_sev = {}
            for r in results:
                for sev, cnt in r.get('summary', {}).items():
                    all_sev[sev] = all_sev.get(sev, 0) + cnt
            output = {
                'totalFiles': len(results),
                'totalIssues': total_issues,
                'passCount': sum(1 for r in results if not r['issues'] and not r.get('error')),
                'severityCounts': all_sev,
                'results': results,
            }
            print(json.dumps(output, ensure_ascii=False, indent=2))
    else:
        print_text_report(results)


if __name__ == '__main__':
    main()
