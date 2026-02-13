# gendocs — Claude Code 문서 생성 툴킷

## 프로젝트 정의

gendocs는 **마크다운(MD)을 원본으로, 모든 형태의 비즈니스 문서를 자동 생성**하는 Claude Code 전용 툴킷이다.
사용자가 원본 파일과 요구사항을 제공하면, Claude Code가 변환 스크립트를 작성·실행하여 최종 산출물을 만든다.

> **핵심 원칙**: 이 프로젝트에서 Claude Code는 문서 생성 전문가다. 코드를 사람이 짜는 것이 아니라, Claude Code가 기존 템플릿과 예시를 참조하여 새로운 변환 스크립트를 작성하고 실행한다.

---

## 지원 산출물 포맷

### 문서 (Document)
| 포맷 | 확장자 | 기술 스택 | 용도 | 상태 |
|------|--------|-----------|------|------|
| **Word** | .docx | Node.js + `docx` | API 명세서, 요건 정의서, 기술 문서 | 검증 완료 |
| **Excel** | .xlsx | Node.js + `exceljs` | 데이터 명세, 코드 정의서, 대사 파일 규격 | 예정 |
| **PowerPoint** | .pptx | Node.js + `pptxgenjs` | 제안서, 발표 자료, 아키텍처 소개 | 예정 |
| **PDF** | .pdf | Node.js + `pdf-lib` 또는 Puppeteer | 최종 배포용 문서 | 예정 |

### 시각 자료 (Visual)
| 포맷 | 확장자 | 기술 스택 | 용도 | 상태 |
|------|--------|-----------|------|------|
| **시퀀스 다이어그램** | .png | Python + `matplotlib` | 시스템 간 통신 흐름도 | 검증 완료 |
| **아키텍처 다이어그램** | .png/.svg | Python + `matplotlib` / `diagrams` | 시스템 구성도, 인프라 구조도 | 예정 |
| **ERD / 플로우차트** | .png/.svg | Python + `matplotlib` / Mermaid | DB 설계, 업무 흐름 | 예정 |

### 데이터 (Data)
| 포맷 | 확장자 | 기술 스택 | 용도 | 상태 |
|------|--------|-----------|------|------|
| **CSV** | .csv | Node.js 내장 | 데이터 추출, 단순 목록 | 예정 |
| **JSON** | .json | Node.js 내장 | API 스키마, 설정 파일 | 예정 |
| **HTML** | .html | Node.js + 템플릿 엔진 | 웹 게시용 문서, 이메일 본문 | 예정 |

---

## 사용자 플로우

### 스킬 실행 (권장)

대화형 가이드 플로우로 문서를 생성하려면 슬래시 커맨드를 사용한다:

```
/gendocs                        → 대화형 문서 생성 (아무 소스 → MD → DOCX)
/gendocs source/내문서.md       → 특정 MD 파일을 원본으로 바로 시작
/gendocs C:/경로/기존문서.docx  → 기존 DOCX를 읽어서 깔끔하게 재생성
/validate                       → 생성된 DOCX 검증 (구조 + 레이아웃 분석)
/validate output/내문서.docx    → 특정 파일 검증
```

스킬 정의: `.claude/skills/gendocs/SKILL.md`, `.claude/skills/validate/SKILL.md`

### Flow A. 신규 DOCX 생성 — 핵심 플로우 (v0.2 Generic Converter)

> 사용자: `/gendocs` 또는 "source/내문서.md를 Word로 만들어줘"

```
① 소스 입력 (아무 포맷)
   - MD 파일 → 그대로 사용
   - 기존 DOCX → extract-docx.py로 추출 → MD 자동 생성
   - 텍스트 붙여넣기 / 구두 설명 → Claude Code가 MD 작성
                    ↓
①-1 MD 셀프리뷰 (필수 — 생략 금지)
   - 생성된 MD를 읽는 사람 관점으로 재검토
   - 표현 방식(테이블/불릿/본문)의 적절성 판단
   - 반복될 패턴 문제 발견 시 프로젝트 규칙도 수정
   ※ 이 단계를 완료하기 전에 ②로 진행하지 않는다
                    ↓
② Claude Code가 doc-configs/ 참조 → doc-configs/내문서.json 작성
   - docInfo 정의 (제목, 버전, 날짜, 저자)
   - tableWidths 정의 (헤더 패턴 → 너비 매핑)
   - pageBreaks 정의 (H2/H3 break 규칙)
   - images 정의 (섹션별 이미지 매핑)
                    ↓
③ 실행
   node lib/convert.js doc-configs/내문서.json
                    ↓
④ 검증 (JSON 피드백)
   python -X utf8 tools/validate-docx.py output/내문서.docx --json
                    ↓
⑤ 자가개선 루프 (최대 4회)
   ├─ WARN 0건 → 완료 (PASS)
   ├─ WARN 있음 → doc-config 수정 → ③ 재실행 → ④ 재검증 (FIX)
   ├─ INFO만 있음 → 완료 (SKIP, INFO는 참고용)
   └─ 페이지 수 10%↑ → 수정 롤백 (ROLLBACK)
```

**현재 상태**: 동작함. Generic Converter + doc-config JSON으로 코드 작성 없이 문서 변환 가능.

> **레거시 방식**: 커스텀 로직이 필요한 경우 기존 `converters/` 전용 converter도 계속 사용 가능.

### Flow B. 기존 문서 수정

> 사용자: "API 명세서에 새 엔드포인트 추가해줘"

```
① source/해당문서.md 수정
                    ↓
② 기존 doc-config 확인
   - doc-configs/ 에 있으면 그대로 사용
   - 새 테이블 패턴이 추가됐으면 tableWidths에 추가
                    ↓
③ node lib/convert.js doc-configs/해당문서.json --validate → 완료
```

**현재 상태**: 동작함. source↔config 매핑은 doc-config JSON의 `source` 필드로 관리.

### Flow C. 다이어그램 포함 문서

> 사용자: "시퀀스 다이어그램이 포함된 기술 문서 만들어줘"

```
① templates/diagram/sequence.py 참조 → diagrams/내다이어그램.py 작성
                    ↓
② 실행: python diagrams/내다이어그램.py → PNG 생성
                    ↓
③ source/내문서.md 에 이미지 참조 추가
   ![설명](examples/api-spec/1_1_CPM_결제.png)
                    ↓
④ converter 작성 (lookAheadForImage 포함) → Flow A의 ③~⑤ 진행
                    ↓
⑤ 검증에서 이미지 배치 확인
   - 이미지가 독립 페이지에 배치되었는지
   - 제목+이미지가 같은 페이지에 있는지
```

**현재 상태**: 동작함. 시퀀스 다이어그램 검증 완료 (matplotlib 기반).

### Flow D. 프로젝트 온보딩 (새 사용자)

```
① git clone → cd gendocs
                    ↓
② npm install && pip install -r requirements.txt
                    ↓
③ Claude Code 실행 → CLAUDE.md 자동 인식
                    ↓
④ examples/ 확인 (sample-api/, sample-batch/ 둘러보기)
                    ↓
⑤ 첫 문서 생성 시도 → Flow A 진행
```

**현재 상태**: 동작함. 의존성은 `docx`(npm) + `matplotlib`(pip) 2개.

### Flow E. 새 포맷 확장 (XLSX, PPTX, PDF)

> 사용자: "Excel 코드 정의서 만들어줘"

```
① templates/{format}/ 에 템플릿 모듈 작성
   - 스타일 정의 + 요소 생성 API (DOCX의 professional.js 패턴 참조)
                    ↓
② converter 패턴 정의 (해당 포맷용)
                    ↓
③ tools/validate-{format}.py 작성 (검증 도구 확장)
                    ↓
④ examples/ 에 성공 사례 추가
                    ↓
⑤ CLAUDE.md + 기술 스택 문서 업데이트
```

**현재 상태**: 미구현. 기술 스택 확정됨 (XLSX→openpyxl, PPTX→pptxgenjs, PDF→reportlab). `docs/기술_조사_및_도구_비교.md` 참조.

---

## 고도화 로드맵

### Phase 1 — DOCX 워크플로우 완성 (v0.1, 완료)

| 항목 | 상태 | 설명 |
|------|------|------|
| professional 템플릿 | 완료 | 가로, 다크코드, 표지, 머릿글/바닥글, 이미지 |
| 변환 스크립트 패턴 | 완료 | 문서별 전용 converter 작성 |
| 구조 검증 | 완료 | validate-docx.py (XML 파싱) |
| 레이아웃 시뮬레이션 | 완료 | 페이지 높이 추정, 이미지/제목/테이블 배치 분석 |
| 이미지 삽입 + 자동 페이지 나누기 | 완료 | lookAheadForImage 패턴 |
| source↔converter 매핑 관리 | 완료 | doc-configs/ JSON으로 관리 (v0.2에서 해결) |

### Phase 2 — 자가 개선 루프 (v0.2, 완료)

| 항목 | 상태 | 설명 |
|------|------|------|
| 검증 JSON 출력 | **완료** | `validate-docx.py --json` 플래그 |
| 범용 MD→DOCX 변환기 | **완료** | `lib/converter-core.js` + `lib/convert.js` + `doc-configs/*.json` |
| 검증 피드백 루프 | **완료** | `/gendocs` 스킬 6단계: PASS/FIX/SKIP/ROLLBACK 판정, 최대 4회 |
| XSD 스키마 검증 | 미완 | OOXML 규격 검증 |
| 역파싱 검증 | 미완 | DOCX→텍스트 추출 → 원본 MD 비교 |

### Phase 2.5 — 자가개선 고도화 (v0.3, 현재)

| 항목 | 상태 | 설명 |
|------|------|------|
| 회귀 테스트 | **완료** | `tools/regression-test.js` — 7개 baseline 비교 (Golden File) |
| 성공 패턴 추출 | **완료** | `tools/extract-patterns.js` → `lib/patterns.json` (common/byDocType) |
| 규칙 충돌 감지 | **완료** | `tools/check-rules.js` + regression-test 게이트 |
| 시각적 검증 | **완료** | `tools/visual-verify.py` (LibreOffice → PDF → 이미지, 선택적) |

### Phase 3 — 포맷 확장 (v0.4)

| 포맷 | 패키지 | 언어 | 우선순위 |
|------|--------|------|----------|
| XLSX | openpyxl | Python | 높음 (데이터 명세, 코드 정의서 수요) |
| PPTX | pptxgenjs | Node.js | 중간 (제안서, 발표 자료) |
| PDF | reportlab | Python | 낮음 (DOCX→PDF 변환으로 대체 가능) |

포맷별로 필요한 것: 템플릿 모듈 + converter 패턴 + 검증 도구 + 성공 사례

### Phase 4 — 자동화 (v0.4)

| 항목 | 설명 |
|------|------|
| 시각적 검증 | LibreOffice → PDF → 이미지 → Claude Code가 시각적으로 레이아웃 확인 |
| MD 내 다이어그램 구문 | mermaid/flowchart 구문 감지 → 자동으로 PNG 생성 후 삽입 |
| 배치 생성 | 여러 source 파일을 한번에 변환 |
| 변경 감지 | source/ 파일 변경 시 자동 재생성 |

---

## 폴더 구조

```
gendocs/
├── CLAUDE.md                        ← [핵심] 이 파일. Claude Code 지시서
├── PROJECT_PLAN.md                  ← 프로젝트 로드맵
├── package.json                     ← Node.js 의존성 (docx)
├── requirements.txt                 ← Python 의존성 (matplotlib)
│
├── .claude/skills/                  ← 슬래시 커맨드 (Skills)
│   ├── gendocs/SKILL.md             ← /gendocs — 대화형 문서 생성 플로우
│   └── validate/SKILL.md            ← /validate — 문서 검증
│
├── lib/                             ← [v0.2] Generic Converter 엔진
│   ├── converter-core.js            ← 공통 변환 로직 (파싱, 너비 계산, 변환, 빌드)
│   ├── convert.js                   ← 진입점: node lib/convert.js <config.json>
│   └── patterns.json                ← [v0.3] 공유 패턴 DB (tableWidths common/byDocType)
│
├── doc-configs/                     ← [v0.2] 문서별 설정 파일 (JSON, 사용자 생성)
│   └── (사용자가 /gendocs로 자동 생성)
│
├── source/                          ← 사용자 원본 파일 (입력)
│   └── (사용자의 원본 MD 파일)
│
├── output/                          ← 생성된 최종 문서 (출력)
│
├── templates/                       ← 포맷별 문서 템플릿
│   ├── docx/
│   │   ├── basic.js                 ← 기본 (세로, 심플)
│   │   └── professional.js          ← 고급 (가로, 다크코드, 머릿글/바닥글, 이미지)
│   ├── diagram/
│   │   └── sequence.py              ← 시퀀스 다이어그램 기본 템플릿
│   ├── xlsx/                        ← (예정)
│   ├── pptx/                        ← (예정)
│   └── pdf/                         ← (예정)
│
├── converters/                      ← 레거시 전용 변환 스크립트 (커스텀 로직용)
│
├── diagrams/                        ← 다이어그램 생성 스크립트 (사용자 생성)
│
├── examples/                        ← 성공 사례 (레퍼런스)
│   ├── sample-api/                  ← BookStore API 명세서 예제
│   │   ├── source.md                ← 원본 MD
│   │   └── doc-config.json          ← 변환 설정
│   └── sample-batch/                ← 주문처리 배치 규격서 예제
│       ├── source.md
│       └── doc-config.json
│
├── tests/                           ← [v0.3] 회귀 테스트
│   └── golden/                      ← baseline 스냅샷 (문서별 stats JSON)
│
└── tools/                           ← 검증·디버그·유틸리티
    ├── validate-docx.py             ← [핵심] DOCX 구조 검증 + 레이아웃 분석 (--json 지원)
    ├── extract-docx.py              ← [핵심] DOCX 텍스트 추출 (ZIP+XML, 의존성 없음, --json 지원)
    ├── regression-test.js           ← [v0.3] 회귀 테스트 (baseline 비교)
    ├── create-baselines.js          ← [v0.3] baseline 생성
    ├── extract-patterns.js          ← [v0.3] 성공 패턴 추출 → lib/patterns.json
    ├── check-rules.js               ← [v0.3] 규칙 충돌 감지
    ├── visual-verify.py             ← [v0.3] 시각적 검증 (LibreOffice 필요)
    ├── convert-to-docx.js           ← 초기 프로토타입 변환기
    ├── debug-convert.js             ← 변환 디버깅 도구
    └── debug-parser.js              ← MD 파싱 디버깅 도구
```

---

## 템플릿 시스템

### 설계 원칙
- 각 출력 포맷마다 독립된 템플릿 모듈이 존재한다
- 템플릿은 **스타일 정의 + 요소 생성 API**를 제공한다
- 변환 스크립트는 템플릿의 공개 API만 호출하여 문서를 조립한다
- 새 문서를 만들 때 템플릿을 수정하지 않는다. 변환 스크립트만 새로 작성한다

### Word (DOCX) 템플릿 — 검증 완료

**basic.js** — 세로 레이아웃, 심플 스타일
- 공개 API: `h1`, `h2`, `h3`, `text`, `bullet`, `note`, `infoBox`, `warningBox`, `pageBreak`, `spacer`, `createCodeBlock`, `createSimpleTable`, `createTable`, `createCoverPage`, `createDocument`, `saveDocument`

**saveDocument EBUSY 처리**: `saveDocument()`는 파일이 열려있을 때(EBUSY) 자동으로 해당 프로세스(Word 등)를 종료하고 최대 3회 재시도한다. Windows 환경에서 PowerShell로 프로세스 감지 후 종료, 실패 시 `taskkill /IM WINWORD.EXE /F` 폴백.

**맞춤법/문법 오류 숨기기**: `saveDocument()`는 `Packer.toBuffer()` 후 디스크에 쓰기 전에 `adm-zip`으로 DOCX 버퍼 내 `word/settings.xml`에 `<w:hideSpellingErrors/>`와 `<w:hideGrammaticalErrors/>`를 삽입한다. 이를 통해 생성된 문서를 Word에서 열 때 맞춤법/문법 오류 표시가 자동으로 비활성화된다.

**professional.js** — 가로 레이아웃, 프로페셔널 스타일
- 추가 API: `h4`, `labelText`, `flowBox`, `createImage`, `createJsonBlock`, `createSyntaxCodeBlock`
- 특징: 다크테마 코드블록, 로고 표지, 머릿글/바닥글(페이지 번호), 이미지 삽입

### Generic Converter 사용법 (v0.2, 권장)

새 문서를 변환할 때는 `doc-configs/` 에 JSON 설정 파일만 작성하면 된다.

```bash
# 실행
node lib/convert.js doc-configs/내문서.json

# 실행 + 검증
node lib/convert.js doc-configs/내문서.json --validate
```

**doc-config JSON 구조**:
```json
{
  "source": "source/내문서.md",
  "output": "output/내문서_{version}.docx",
  "template": "professional",
  "h1CleanPattern": "^# 문서제목",
  "headerCleanUntil": "## 변경 이력",
  "docInfo": {
    "title": "문서 제목", "subtitle": "부제목", "version": "v1.0",
    "author": "작성자", "company": "회사", "createdDate": "2026-01-01", "modifiedDate": "2026-01-01"
  },
  "tableWidths": {
    "헤더1|헤더2|헤더3": [w1, w2, w3]
  },
  "pageBreaks": {
    "afterChangeHistory": true,
    "h2BreakBeforeSection": 4,
    "imageH3AlwaysBreak": true,
    "changeDetailH3Break": false,
    "defaultH3Break": true,
    "h2Sections": [],
    "h3Sections": [],
    "noBreakH3Sections": []
  },
  "images": {
    "basePath": "examples/api-spec",
    "sectionMap": { "1.1": { "file": "image.png", "width": 780, "height": 486 } }
  }
}
```

**핵심 파일**:
- `lib/converter-core.js` — 공통 변환 엔진 (파싱, 너비 계산, 요소 변환, 빌드)
- `lib/convert.js` — CLI 진입점 (`node lib/convert.js <config.json> [--validate]`)

> **레거시 방식**: 커스텀 로직이 필요한 경우 `converters/` 에 전용 변환 스크립트를 작성할 수 있다. `examples/api-spec/convert.js`, `examples/hipass-batch/convert.js` 참조.

### 페이지 나누기 규칙

- **표지 → 변경이력**: 자동 (createCoverPage에 포함)
- **변경이력 → 본문**: 2번째 H2 앞에서만 명시적 pageBreak()
- **본문 내 H2 간**: 페이지 나누기 없음 (연속 흐름)
- **이미지 포함 섹션**: H3 파싱 시 look-ahead로 `![` 감지 → 해당 H3 앞에 pageBreak()하여 제목+이미지를 같은 페이지에 배치. 단, H2 직후 첫 H3이면 H2에서 이미 break했으므로 중복 break 생략
```javascript
// 이미지 섹션 look-ahead 패턴
function lookAheadForImage(lines, startIdx) {
  for (let j = startIdx; j < lines.length; j++) {
    const l = lines[j].trim();
    if (l.startsWith('#')) return false;  // 다음 섹션이면 중단
    if (l.match(/^!\[/)) return true;     // 이미지 발견
  }
  return false;
}

// H3 처리에서 사용 (이미지 섹션 + 중복 break 방지)
if (line.startsWith('### ')) {
  const hasImage = lookAheadForImage(lines, i + 1);
  if (hasImage && !isFirstH3AfterH2) {
    elements.push(t.pageBreak());
  }
  elements.push(t.h3(line.substring(4).trim()));
}
```

> **H4 고아 제목**: 검증기에서 INFO로 감지되지만, converter에서 일괄 break를 넣으면 페이지가 과도하게 늘어난다. INFO 권장사항은 참고용이며, 필요한 경우에만 특정 H4에 수동으로 break를 추가한다.

---

## 스타일 가이드

### 공통 디자인 토큰
| 요소 | 값 |
|------|-----|
| 기본 폰트 | Malgun Gothic (맑은 고딕) |
| 코드 폰트 | Consolas |
| 주 색상 (Primary) | #1B3664 (네이비 블루) |
| 보조 색상 (Secondary) | #2B5598 |
| 강조 색상 (Accent) | #F5A623 (골드) |
| 본문 색상 | #333333 |
| 테이블 헤더 배경 | Primary (#1B3664), 글자 White |
| 테이블 교대 행 | #F2F2F2 |
| 정보 박스 | #E8F0F7 배경, 좌측 네이비 바 |
| 경고 박스 | #FEF6E6 배경 |

### Word 문서 규칙
- 가로(Landscape) 레이아웃을 기본으로 사용 (테이블이 많은 기술 문서 특성)
- 표지 → 변경 이력 → 본문 순서
- 코드 블록: JSON은 회색 배경, 프로그래밍 코드는 다크테마
- 테이블 컬럼 너비는 헤더 패턴 매칭으로 자동 계산

---

## DOCX 텍스트 추출 (extract-docx.py)

기존 DOCX 파일에서 콘텐츠를 추출하여 MD를 자동 생성할 때 사용한다.
ZIP+XML 방식으로 내장 모듈만 사용하며(의존성 없음), python-docx 대비 **2.4~3.0배 빠르다**.

```bash
# 텍스트 리포트 (통계 + 구조화된 텍스트)
python -X utf8 tools/extract-docx.py output/문서.docx

# JSON 출력 (프로그래밍 활용)
python -X utf8 tools/extract-docx.py output/문서.docx --json
```

**추출 요소 분류** (셀 배경색 기반 자동 판별):
| 요소 | 판별 기준 |
|------|----------|
| `heading` | 스타일명 Heading1~6 |
| `table` | 데이터 테이블 (네이비/화이트 헤더) |
| `codeBlock` (dark) | 배경색 #1E1E1E / #2D2D2D |
| `codeBlock` (light) | 배경색 #F5F5F5 / #F0F0F0, 단일 컬럼 |
| `infoBox` | 배경색 #E8F0F7, 단일 컬럼 |
| `warningBox` | 배경색 #FEF6E6, 단일 컬럼 |
| `listItem` | ListParagraph 스타일 |
| `paragraph` | 일반 텍스트 |

---

## 검증 체계

### 개요

DOCX를 생성한 후 반드시 `tools/validate-docx.py`로 검증한다. 이 스크립트는 DOCX(ZIP)를 해체하여 XML을 파싱하고, **구조 검증 + 페이지 레이아웃 시뮬레이션**을 수행한다.

```bash
# 텍스트 리포트 (사람이 읽을 때)
python -X utf8 tools/validate-docx.py output/문서.docx

# JSON 리포트 (자가개선 루프용)
python -X utf8 tools/validate-docx.py output/문서.docx --json

# 변환 + 검증 한 번에
node lib/convert.js doc-configs/문서.json --validate
```

**자동 수정 원칙**:
- **WARN**만 자동 수정 대상 (이미지 배치 등 명확한 레이아웃 문제)
- **INFO**는 참고용 — 일괄 수정 금지 (시뮬레이션 추정치와 실제 Word 렌더링은 다를 수 있음)
- 수정 후 페이지 수가 10% 이상 증가하면 과도한 수정. 롤백 후 개별 검토
- 패턴 매칭 일괄 break 삽입 금지 — 특정 위치만 수정

```
생성 → 검증(JSON) → WARN 분석 → config 수정 → 재생성 → 재검증 (최대 4회)
```

### 검증 항목

**구조 검증** (자동)
- 머릿글/바닥글 존재 여부
- 제목 계층 건너뛰기 감지 (H2 → H4 등)
- 연속 페이지 나누기 감지 (빈 페이지 발생)
- 요소 통계: 제목, 테이블, 코드블록, 이미지, 불릿 카운트

**페이지 레이아웃 시뮬레이션** (자동)

XML에서 각 요소의 높이를 추정하여 가로 A4 기준(가용 높이 ~457pt)으로 페이지 배치를 시뮬레이션한다.

| 요소 | 추정 높이 |
|------|----------|
| H2 | 42pt |
| H3 | 34pt |
| 일반 단락 | 22pt × 줄 수 |
| 불릿 | 20pt |
| 테이블 | 헤더 28pt + 행당 22pt |
| 이미지 | XML extent에서 실제 크기 읽음 (EMU→pt) + 30pt |
| 빈 단락/spacer | 8pt |

**레이아웃 권장사항** (3가지 규칙)

| 규칙 | 감지 조건 | 심각도 | 조치 |
|------|----------|--------|------|
| 이미지 독립 배치 | 이미지가 명시적 break 없이 다른 콘텐츠와 같은 페이지 | WARN | 이미지 섹션 앞에 pageBreak() 추가 |
| 고아 제목 | 제목 아래 60pt 미만 공간 (제목만 달랑 남음) | INFO | 제목 앞에 pageBreak() 추가 고려 |
| 테이블 분할 | 큰 테이블이 페이지 40% 이하 공간에서 시작 | INFO | 테이블 앞 break 또는 크기 조정 |

**오버플로우 허용 규칙**: 이미지가 시뮬레이션 상 자동 오버플로우로 다음 페이지에 배치되더라도, 이전 페이지가 명시적 break로 시작되었고 해당 이미지의 섹션 제목이 이전 페이지에 있으면 의도된 배치로 판단하여 WARN을 발생시키지 않는다. (제목+이미지가 break 이후 연속 배치된 경우)

### 검증 리포트 예시

```
페이지 레이아웃 분석 (추정, 가용 높이 457pt)
──────────────────────────────────────────
  p. 1  ███░░░░░░░░░░░░░░░░░  17.9% (82pt)
  p. 2  █████░░░░░░░░░░░░░░░  26.7% (122pt) [표1]
  p. 3  ██████████████████░░  90.6% (414pt) [표1]
  p. 6  ██████████████████░░  94.7% (433pt) [이미지]

  [WARN] p.6 이미지(510x315pt)가 이전 콘텐츠와 같은 페이지에 배치됨
       → 섹션 "3.3 예시 다이어그램" 앞에 페이지 나누기를 추가하면 깔끔하게 표시됩니다
```

### 회귀 테스트 (v0.3)

converter-core.js, templates, SKILL.md 등 공통 코드를 수정할 때 기존 7개 문서가 깨지지 않는지 자동 검증한다.

```bash
# baseline 생성 (최초 1회 또는 갱신 시)
node tools/create-baselines.js
node tools/create-baselines.js --force  # 기존 baseline 덮어쓰기

# 회귀 테스트 실행
node tools/regression-test.js
node tools/regression-test.js --verbose         # 상세 diff
node tools/regression-test.js --name api-spec   # 특정 문서만
```

**비교 허용 범위**:

| 항목 | 허용 범위 |
|------|----------|
| estimatedPages | ±2 |
| headings, headingsByLevel | 정확 일치 |
| tables, codeBlocks, images, infoBoxes | 정확 일치 |
| bullets | ±2 |
| pageBreaks | 정확 일치 |
| warnCount | 같거나 감소만 |

**사용 시점**: converter-core.js, templates, doc-config 공통 로직, 규칙(SKILL.md/MEMORY.md) 수정 후 반드시 실행.

### 성공 패턴 DB (v0.3)

성공한 doc-config에서 재사용 가능한 tableWidths 패턴을 추출하여 `lib/patterns.json`에 저장한다.

```bash
# 패턴 추출 (변환 성공 후 실행)
node tools/extract-patterns.js
```

**fallback 체인** (converter-core.js `calculateTableWidths`):
1. doc-config `tableWidths` (명시적 설정)
2. `lib/patterns.json` common (3개+ 문서에서 공유)
3. `lib/patterns.json` byDocType (문서 유형별)
4. defaultTableWidths (가중치 기반)

**승격 규칙**: 3개 이상 doc-config에서 동일 너비로 사용 → common 승격.

### 규칙 충돌 감지 (v0.3)

규칙(SKILL.md, MEMORY.md, CLAUDE.md) 변경 시 기존 규칙과 모순되지 않는지 검증한다.

```bash
# 정적 규칙 스캔 (보조)
node tools/check-rules.js

# 핵심 메커니즘: 회귀 테스트 게이트
node tools/regression-test.js
```

**플로우**: 규칙 변경 → regression-test → FAIL이면 충돌 의심 → 원복 또는 조정.

### 시각적 검증 (v0.3, 선택적)

XML 시뮬레이션이 아닌 실제 렌더링 결과로 레이아웃을 검증한다. LibreOffice + pdf2image + Poppler 필요.

```bash
python -X utf8 tools/visual-verify.py output/문서.docx
python -X utf8 tools/visual-verify.py output/문서.docx --json
python -X utf8 tools/visual-verify.py output/문서.docx --save-images
```

**검증 단계**:
- 4a: 페이지 수 비교 (validate 추정 vs 실제 렌더링)
- 4b: 빈 페이지 감지 (95% 이상 흰색 픽셀)
- 4c: 플래그된 페이지 이미지를 Claude Code가 시각 리뷰

---

## 검증된 성공 사례

### 1. BookStore API 연동 명세서 (Word)
- **위치**: `examples/sample-api/`
- **원본**: `source.md`
- **설정**: `doc-config.json`
- **특징**: REST API CRUD, JSON 코드블록, 인증 흐름, 공통 객체 정의, 정보/경고 박스

### 2. 주문처리 배치 연동 규격서 (Word)
- **위치**: `examples/sample-batch/`
- **원본**: `source.md`
- **설정**: `doc-config.json`
- **특징**: 고정길이 전문 규격, S/D/E 레코드 테이블, SFTP 연동, 코드 예시
