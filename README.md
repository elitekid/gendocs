# gendocs

Claude Code 전용 문서 생성 툴킷. 마크다운(MD)을 원본으로 비즈니스 문서(DOCX)를 자동 생성합니다.

## 특징

- **코드 작성 불필요** — JSON 설정 파일만 작성하면 MD → DOCX 변환
- **자가개선 루프** — 생성 → 검증 → 수정 → 재생성 (최대 4회 자동 반복)
- **셀프리뷰 게이트** — 변환 전 콘텐츠 품질을 자동 검토
- **회귀 테스트** — 공통 코드 수정 시 기존 문서가 깨지지 않는지 자동 검증
- **대화형 플로우** — `/gendocs` 슬래시 커맨드로 단계별 가이드

## 요구사항

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (CLI)
- Node.js 18+
- Python 3.10+

## 설치

```bash
git clone https://github.com/user/gendocs.git
cd gendocs
npm install
pip install -r requirements.txt
```

## 빠른 시작

### 1. 예제 실행

```bash
# BookStore API 명세서 예제 변환
node lib/convert.js examples/sample-api/doc-config.json --validate

# 주문처리 배치 규격서 예제 변환
node lib/convert.js examples/sample-batch/doc-config.json --validate
```

`output/` 폴더에 DOCX 파일이 생성됩니다.

### 2. 내 문서 만들기

Claude Code를 실행하고 대화하세요:

```
/gendocs                          # 대화형 가이드 시작
/gendocs source/내문서.md         # 특정 MD 파일로 바로 시작
/gendocs C:/경로/기존문서.docx    # 기존 DOCX를 깔끔하게 재생성
```

또는 직접 요청:

```
"API 명세서를 Word로 만들어줘"
"source/내문서.md를 DOCX로 변환해줘"
```

### 3. 수동 실행

```bash
# 1. source/ 에 MD 파일 작성
# 2. doc-configs/ 에 JSON 설정 파일 작성 (examples/ 참조)
# 3. 변환 실행
node lib/convert.js doc-configs/내문서.json

# 변환 + 검증 한 번에
node lib/convert.js doc-configs/내문서.json --validate

# 검증만
python -X utf8 tools/validate-docx.py output/내문서.docx
```

## 작동 방식

```
source/*.md ──→ Generic Converter ──→ output/*.docx
                    │                        │
              doc-config.json          validate --json
                    ▲                        │
                    │                        ▼
              Claude Code ◄──── 검증 리포트 (JSON)
              (자가개선 루프)
                    │
                    ├─ WARN 0건 → 완료 (PASS)
                    ├─ WARN 있음 → config 수정 → 재변환 (FIX)
                    ├─ INFO만 → 완료 (SKIP)
                    └─ 페이지 10%↑ → 롤백 (ROLLBACK)
```

### 자가개선 3계층

| 계층 | 역할 | 시점 |
|------|------|------|
| 셀프리뷰 | MD 콘텐츠 품질 검토 (코드 오류, 논리 결함 등) | 변환 전 |
| 콘텐츠 검증 | 원본 MD 대비 요소 수(제목/테이블/코드블록) 일치 확인 | 변환 후 |
| 레이아웃 루프 | WARN 기반 자동 수정 (이미지 배치, 페이지 나누기) | 검증 후 |

## doc-config.json 구조

```json
{
  "source": "source/내문서.md",
  "output": "output/내문서_{version}.docx",
  "template": "professional",
  "h1CleanPattern": "^# 문서제목",
  "headerCleanUntil": "## 변경 이력",
  "docInfo": {
    "title": "문서 제목",
    "subtitle": "부제목",
    "version": "v1.0",
    "author": "작성자",
    "company": "회사명",
    "createdDate": "2026-01-01",
    "modifiedDate": "2026-01-01"
  },
  "tableWidths": {
    "헤더1|헤더2|헤더3": [3000, 5000, 4960]
  },
  "pageBreaks": {
    "afterChangeHistory": true,
    "h2BreakBeforeSection": 4,
    "defaultH3Break": false,
    "h3Sections": ["4.1", "4.2"]
  }
}
```

자세한 설정 옵션은 `CLAUDE.md`의 "Generic Converter 사용법" 섹션을 참조하세요.

## 프로젝트 구조

```
gendocs/
├── CLAUDE.md                 # Claude Code 지시서 (핵심)
├── lib/
│   ├── converter-core.js     # 공통 변환 엔진
│   └── convert.js            # CLI 진입점
├── templates/docx/
│   ├── professional.js       # 가로 레이아웃, 다크코드, 표지
│   └── basic.js              # 세로 레이아웃, 심플
├── tools/
│   ├── validate-docx.py      # DOCX 구조 검증 + 레이아웃 시뮬레이션
│   ├── extract-docx.py       # DOCX → 텍스트 추출
│   ├── regression-test.js    # 회귀 테스트
│   └── ...
├── examples/
│   ├── sample-api/           # BookStore API 명세서 예제
│   └── sample-batch/         # 주문처리 배치 규격서 예제
├── .claude/skills/
│   ├── gendocs/SKILL.md      # /gendocs 슬래시 커맨드
│   └── validate/SKILL.md     # /validate 슬래시 커맨드
├── source/                   # 사용자 원본 MD (gitignored)
├── doc-configs/              # 문서별 설정 JSON (gitignored)
└── output/                   # 생성된 DOCX (gitignored)
```

## 도구

| 도구 | 용도 | 사용법 |
|------|------|--------|
| `validate-docx.py` | DOCX 구조 검증 + 레이아웃 분석 | `python -X utf8 tools/validate-docx.py output/문서.docx` |
| `extract-docx.py` | DOCX → 텍스트/구조 추출 | `python -X utf8 tools/extract-docx.py output/문서.docx --json` |
| `regression-test.js` | 기존 문서 회귀 테스트 | `node tools/regression-test.js` |
| `create-baselines.js` | 회귀 테스트 baseline 생성 | `node tools/create-baselines.js` |
| `extract-patterns.js` | 성공 패턴 추출 | `node tools/extract-patterns.js` |
| `check-rules.js` | 규칙 충돌 감지 | `node tools/check-rules.js` |
| `visual-verify.py` | 시각적 검증 (LibreOffice 필요) | `python -X utf8 tools/visual-verify.py output/문서.docx` |

## 지원 산출물

| 포맷 | 상태 | 설명 |
|------|------|------|
| **Word (.docx)** | 검증 완료 | API 명세서, 요건 정의서, 기술 문서 |
| Excel (.xlsx) | 예정 | 데이터 명세, 코드 정의서 |
| PowerPoint (.pptx) | 예정 | 제안서, 발표 자료 |
| PDF (.pdf) | 예정 | 최종 배포용 |

## 라이선스

MIT
