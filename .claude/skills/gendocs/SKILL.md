---
name: gendocs
description: 아무 소스(파일, 텍스트, 구두 설명)로부터 비즈니스 문서(DOCX 등)를 생성하는 가이드 플로우
argument-hint: "[파일 경로 또는 설명]"
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion
---

# gendocs 문서 생성 플로우

이 스킬은 대화형으로 문서를 생성하는 가이드 플로우를 실행합니다.
아래 단계를 순서대로 진행하세요. 각 단계에서 AskUserQuestion으로 사용자 선택을 받습니다.

$ARGUMENTS 가 있으면:
- `.md` 파일이면 해당 파일을 원본으로 사용하고 2단계를 건너뛰세요.
- 다른 파일 확장자(`.docx`, `.pdf`, `.txt`, `.xlsx`, `.hwp` 등)면 2단계의 "기존 파일 변환"으로 진행하세요.
- 파일 경로가 아닌 텍스트면 문서 주제 설명으로 간주하고 2단계의 "구두 설명"으로 진행하세요.

---

## 1단계: 출력 포맷 선택

AskUserQuestion으로 물어보세요:

| 선택지 | 설명 |
|--------|------|
| Word (.docx) | API 명세서, 요건 정의서, 기술 문서 (검증 완료) |
| Excel (.xlsx) | 데이터 명세, 코드 정의서 (예정) |
| PowerPoint (.pptx) | 제안서, 발표 자료 (예정) |
| PDF (.pdf) | 최종 배포용 (예정) |

> 현재 Word(.docx)만 검증 완료 상태입니다. 다른 포맷 선택 시 "아직 지원되지 않는 포맷입니다. DOCX를 먼저 생성하시겠습니까?" 로 안내하세요.

---

## 2단계: 소스 입력

**AskUserQuestion으로 물어보세요: "어떤 소스를 가지고 계신가요?"**

| 선택지 | 설명 |
|--------|------|
| 기존 파일 변환 | 가지고 있는 파일(Word, PDF, 텍스트, 엑셀 등)을 깔끔한 문서로 재작성 |
| 텍스트 붙여넣기 | 대화창에 내용을 직접 붙여넣기 |
| 구두 설명 | 만들고 싶은 문서를 설명하면 Claude Code가 작성 |
| source/ 폴더의 MD 파일 | 이미 준비된 마크다운 파일 사용 |

각 선택지별 처리:

### A. 기존 파일 변환

1. 사용자에게 파일 경로를 물어보세요.
2. 파일 포맷에 따라 내용을 추출하세요:
   - `.docx` → `python -X utf8 tools/extract-docx.py <파일> --json [--extract-images <dir>]` 실행 (ZIP+XML 방식, 의존성 없음). 제목/테이블/코드블록/인포박스/이미지를 구조화된 JSON으로 추출합니다. 이미지가 있으면 `--extract-images`로 함께 추출합니다.
   - `.pdf` → Read 도구로 내용 추출. 아래 **PDF 구조화 규칙**을 반드시 따르세요.
   - `.txt` / `.csv` / `.json` / `.yaml` → Read 도구로 텍스트 직접 읽기.
   - `.xlsx` → Read 도구로 읽기 (시트 내용 추출).
   - `.hwp` → 읽기 불가 시 사용자에게 텍스트로 붙여넣기를 안내하세요.
3. 추출된 내용을 분석하여 **문서 구조를 파악**하세요:
   - 제목 계층 (heading level)
   - 테이블 헤더 패턴 (doc-config tableWidths에 활용)
   - 코드블록 (dark/light), 인포박스, 경고박스
4. gendocs 마크다운 규칙에 맞춰 `source/` 에 MD 파일을 자동 생성하세요.
5. 생성된 MD를 사용자에게 간략히 보고: "N개 섹션, M개 테이블로 구성된 MD를 생성했습니다."
6. **원본 소스 카운트를 기록**하세요 (섹션 수, 테이블 수, 코드블록 수, 이미지 수 등). 5단계 콘텐츠 검증에서 사용합니다.
7. 3단계로 진행.

#### PDF 구조화 규칙

PDF는 DOCX와 달리 heading level, 테이블 구조 등의 메타데이터가 없으므로 내용을 추론하여 구조화합니다. **converter가 지원하는 요소만** 사용하세요:

**지원 요소**: H2, H3, H4, 불릿(`-`), 테이블, 코드블록, 인포박스(`> 참고:`), 경고박스(`> 주의:`), 이미지, 본문 텍스트

**금지**: 중첩 불릿 리스트 (converter가 들여쓰기를 무시하므로 구조가 손실됨)

**구조 변환 원칙**:
- 중첩 리스트(3단계 이상, 다차원 구조) → **테이블**로 변환
- 단순 키-값 1~3개 → `- **키** — 값` 형식의 불릿 사용 (소규모 2컬럼 테이블 남용 금지)
- 코드, 명령어, 설정 값은 코드블록(` ``` `)으로 감싸기
- 주의/참고 사항은 인용문(`> 주의:`, `> 참고:`)으로 표현

**heading level 판단**:
- PDF에서 가장 큰 제목 → H2 (H1은 문서 제목 1개만)
- 그 아래 소제목 → H3
- 그 아래 세부 항목 → H4
- 볼드 텍스트가 독립 줄에 있으면 heading 후보

### B. 텍스트 붙여넣기

1. 사용자에게 내용을 붙여넣어 달라고 안내하세요.
2. 붙여넣어진 텍스트를 분석하여 구조화하세요:
   - 줄바꿈, 들여쓰기, 구분자 패턴으로 섹션 분리
   - 탭/콤마 구분 데이터는 테이블로 변환
   - 코드 패턴 감지 시 코드블록으로 감싸기
3. gendocs MD 형식으로 `source/` 에 저장.
4. 셀프리뷰 단계로 진행.

### C. 구두 설명

1. 사용자에게 물어보세요:
   - "어떤 종류의 문서인가요?" (API 명세서, 요건 정의서, 제안서, 가이드 등)
   - "어떤 내용을 포함해야 하나요?" (섹션, 주요 항목)
   - "특별히 포함할 데이터가 있나요?" (테이블, 코드 예시 등)
2. 사용자 답변을 기반으로 MD를 작성하여 `source/`에 저장.
3. 셀프리뷰 단계로 진행.

### D. source/ 폴더의 MD 파일

1. source/ 폴더를 조회하여 기존 MD 파일 목록을 AskUserQuestion으로 보여주세요.
2. 사용자가 파일을 선택하면 셀프리뷰 단계로 진행.

---

### MD 생성 규칙

기존 파일 변환, 텍스트 붙여넣기, 구두 설명 모두 최종적으로 MD를 생성합니다.
생성되는 MD는 다음 구조를 따르세요:

```markdown
# 문서 제목

> **프로젝트**: ...
> **버전**: v1.0
> **작성일**: YYYY-MM-DD

---

## 목차

- [변경 이력](#변경-이력)
- [1. 섹션명](#1-섹션명)
- ...

---

## 변경 이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| v1.0 | YYYY-MM-DD | 작성자 | 초안 작성 |

> **변경 이력 작성 규칙**: v1.0 이전 버전(v0.8, v0.9 등)이 존재하면 v1.0의 변경 내용은 "초안 작성"이 아닌 "정식 릴리스" 또는 "전체 문서 통합"으로 표기하세요. "초안 작성"은 변경 이력이 1건뿐일 때만 사용합니다.

---

## 1. 섹션명

### 1.1 소제목

본문 내용...

| 헤더1 | 헤더2 | 헤더3 |
|-------|-------|-------|
| 값1 | 값2 | 값3 |
```

핵심 규칙:
- H1은 문서 제목 (1개만)
- H2는 대분류 섹션 (`## 변경 이력`, `## 1. 개요`, ...)
- H3는 소분류 (`### 1.1 목적`)
- 테이블은 마크다운 표준 문법
- 인용문: `> 주의:` → 경고 박스, `> 참고:` / `> 중요:` → 정보 박스
- 코드블록: ` ```언어 ` 형식
- 이미지: `![설명](경로)`
- 흐름도: `**Step 1**: 설명` 형식

---

## 셀프리뷰 (필수 게이트 — 생략 금지)

**MD를 생성하거나 선택한 후, 이 단계를 완료하기 전에 3단계로 진행하지 마세요.**

2단계에서 MD가 준비되면(생성, 변환, 선택 모두 해당), 반드시 아래 셀프리뷰를 수행합니다:

1. **MD 구조 린트 (자동)**

   ```bash
   python -X utf8 tools/lint-md.py source/{파일}.md --json
   ```

   lint-md.py가 6가지 구조 검사를 수행합니다:
   - **metadata** — 메타데이터 블록쿼트(프로젝트/버전/작성일) 완성도
   - **separator** — H2 섹션 사이 `---` 구분선 존재
   - **changeHistory** — v1.0 변경 내용이 "초안 작성"인지
   - **codeBlockBalance** — 코드블록 열림/닫힘 균형 (CRITICAL)
   - **tocConsistency** — 목차 항목과 실제 H2 섹션 일치
   - **htmlArtifact** — 코드블록 외부 HTML 태그 잔여물

   결과 처리:
   - **CRITICAL** (닫히지 않은 코드블록) → **즉시 수정** (변환하면 이후 콘텐츠 전부 깨짐)
   - **MINOR/STYLE** → source MD 직접 편집으로 수정
   - 배치 모드: `python -X utf8 tools/lint-md.py source/*.md --json`

2. **읽는 사람 관점으로 MD를 처음부터 끝까지 읽기**
   - 섹션 구조가 논리적인가? (목차 → 변경 이력 → 본문 순서)
   - 각 요소의 표현 방식이 적절한가?
     - 소규모 키-값(1~3행 2컬럼)은 테이블 대신 불릿이 자연스러운지
     - 긴 설명문은 테이블 안에 억지로 넣지 않았는지
     - 코드블록의 언어 태그가 올바른지
   - 누락된 섹션이나 불완전한 내용이 없는지

3. **어색한 부분 수정** → source/ MD 파일 직접 편집

4. **반복 패턴 여부 판단**
   - 발견한 문제가 이 문서만의 문제가 아니라 반복될 패턴이면, 원인이 된 규칙(SKILL.md, MEMORY.md 등)도 함께 수정
   - 규칙 수정 시: `node tools/regression-test.js`를 실행하여 기존 문서가 깨지지 않는지 확인

5. **배치(batch) 처리 시에도 예외 없음**
   - 여러 문서를 한 번에 처리하더라도, 각 MD에 대해 셀프리뷰를 수행
   - 시간 제약 시 최소한 샘플 3~5개를 대표로 검토
   - 린트(1번)는 전수 실행, AI 리뷰(2번)는 샘플 허용

> 셀프리뷰 완료 후 3단계로 진행합니다.

---

## 3단계: 템플릿 선택

AskUserQuestion으로 물어보세요:

| 선택지 | 설명 |
|--------|------|
| Professional (권장) | 가로 레이아웃, 다크테마 코드블록, 표지, 머릿글/바닥글 |
| Basic | 세로 레이아웃, 심플 스타일 |

---

## 3.5단계: 테마 선택

AskUserQuestion으로 물어보세요: "문서 테마를 선택하세요"

| 선택지 | 설명 |
|--------|------|
| Navy Professional (기본) | 네이비 헤더, 골드 강조 — 기존 스타일과 동일 |
| Slate Modern | 쿨그레이, 모던한 느낌 |
| Teal Corporate | 티얼/그린, 기업 문서용 |
| Wine Elegant | 와인/버건디, 포멀한 느낌 |
| Blue Standard | 블루 기본, 심플 |

> "기본값으로" 또는 선택하지 않으면 Navy Professional이 적용됩니다.

doc-config에 `"theme"` 필드를 포함하세요:
- Navy Professional → `"theme"` 생략 (기본값)
- Slate Modern → `"theme": "slate-modern"`
- Teal Corporate → `"theme": "teal-corporate"`
- Wine Elegant → `"theme": "wine-elegant"`
- Blue Standard → `"theme": "blue-standard"`

특정 색상만 오버라이드하려면 `"style"` 필드를 추가:
```json
{
  "theme": "teal-corporate",
  "style": { "colors": { "accent": "FF6B35" } }
}
```

---

## 4단계: 문서 정보 입력

AskUserQuestion으로 물어보세요:

- **문서 제목**: 기본값은 MD 파일의 H1 제목
- **부제목**: 선택사항
- **버전**: 기본값 v1.0
- **작성자/회사**: 선택사항

> 사용자가 "기본값으로" 또는 "그냥 진행해"라고 하면 MD에서 추출한 기본값으로 진행하세요.

---

## 자가개선 3계층

문서 생성 과정에서 3단계의 자가개선이 동작합니다.

| 계층 | 시점 | 무엇을 | 어떻게 |
|------|------|--------|--------|
| ① MD 셀프리뷰 | 변환 전 | MD 구조 + 표현 적절성 | lint-md.py 자동 검사 → AI 읽기 리뷰 → 수정 |
| ② AI 셀프리뷰 | 변환 후 | 콘텐츠 정합성 + 품질 | review-docx.py 자동 분석 + AI 판단 |
| ③ 레이아웃 루프 | 변환 후 | 페이지 배치 | WARN 기반 doc-config 수정 반복 (최대 4회) |
| ④ 경험 기억 | 세션 간 | 교정 경험 재활용 | reflections.json 조회 → doc-config 사전 설정 |

- 계층 ①: 2단계 후 **필수 게이트** → [셀프리뷰](#셀프리뷰-필수-게이트--생략-금지)
- 계층 ②: 5단계 변환 후 실행 → [5-4. AI 셀프리뷰](#5-4-계층--ai-셀프리뷰-콘텐츠--품질)
- 계층 ③: 6단계에서 실행 → [6단계. 레이아웃 자가개선 루프](#6단계-계층--레이아웃-자가개선-루프-최대-4회)

---

## 5단계: doc-config 생성 + 변환 실행

이 단계는 자동으로 진행합니다. 사용자에게 진행 상황을 알려주세요.

### 5-1. doc-config JSON 작성

기존 doc-configs/ 에서 유사한 설정 파일을 참조하여 `doc-configs/{파일명}.json`을 작성하세요.

**참조할 것** (우선순위 순):

1. **경험 기억 (Reflexion)**: `lib/reflections.json`이 있으면 현재 문서와 유사한 경험 조회:
   - 동일 `docType` 항목 필터링
   - `outcome`이 "FIX"/"SUGGEST_APPLIED" → `reflection`과 `fix` 참조하여 doc-config에 사전 반영
   - `outcome`이 "ROLLBACK" → **하지 말아야 할 것**으로 참조
   - 매칭: 동일 docType > 동일 tags > 동일 issue.type
   - 예: 과거 api-spec에서 `imageH3AlwaysBreak: true`가 FIX 기록 → 새 API 문서에 기본 포함
   - 예: 과거 batch-spec에서 H4 일괄 break ROLLBACK 기록 → 같은 시도 금지
   > reflections.json이 없거나 빈 배열이면 이 단계 건너뛰기

2. **기존 doc-configs**: `examples/sample-api/doc-config.json`, `examples/sample-batch/doc-config.json`
3. **패턴 DB**: `lib/patterns.json` (자동 fallback — converter-core.js가 처리)
4. **변환 로직**: `lib/converter-core.js` — config JSON 스키마

doc-config JSON에 포함할 내용:
```json
{
  "source": "source/파일명.md",
  "output": "output/파일명_{version}.docx",
  "template": "professional",
  "theme": "navy-professional",
  "h1CleanPattern": "^# 문서제목패턴",
  "headerCleanUntil": "## 변경 이력",
  "docInfo": { "title": "...", "subtitle": "...", "version": "v1.0", ... },
  "tableWidths": { "헤더1|헤더2|헤더3": [w1, w2, w3], ... },
  "pageBreaks": { ... },
  "images": { "basePath": "...", "sectionMap": { ... } },
  "style": { "colors": { "accent": "FF6B35" } }
}
```

### 5-2. 실행
```bash
node lib/convert.js doc-configs/{파일명}.json
```

### 5-3. 레이아웃 검증 (JSON 리포트)
```bash
python -X utf8 tools/validate-docx.py output/{파일명}.docx --json
```

또는 한 번에 실행+검증:
```bash
node lib/convert.js doc-configs/{파일명}.json --validate
```

### 5-4. 계층 ② — AI 셀프리뷰 (콘텐츠 + 품질)

**Part A: 자동 리뷰 (review-docx.py)**

```bash
python -X utf8 tools/review-docx.py output/{파일}.docx --config doc-configs/{파일}.json --json
```

스크립트가 6가지 검사를 수행합니다:
1. **콘텐츠 정합성** — 소스 MD vs DOCX 요소 수 비교 (H2/H3/H4, 테이블, 코드블록, 이미지, 불릿, 인포/경고박스)
2. **컬럼 너비 불균형** — 한 컬럼이 줄바꿈되는데 인접 컬럼은 빈 공간이 많은 경우 감지 + 너비 재분배 제안
3. **테이블 가독성** — 8개 이상 컬럼, 빈 컬럼, 셀 오버플로우
4. **코드블록 무결성** — 잘린 JSON, 빈 코드블록
5. **페이지 분포** — 희소 페이지, 연속 희소 페이지
6. **제목 구조** — 동일 연속 제목, H3 없는 긴 H2 섹션

결과 처리:
- **WARN** (콘텐츠 누락, 잘린 코드 등) → 즉시 수정 (source MD 또는 doc-config)
- **SUGGEST** (너비 재분배) → 명확한 개선이면 적용 (doc-config tableWidths 업데이트 → 재변환)
  - SUGGEST를 적용한 경우 `lib/reflections.json`에 기록: `layer`: 2, `outcome`: "SUGGEST_APPLIED", `fix`: 적용한 너비 변경 내용
- **INFO** (많은 컬럼, 희소 페이지 등) → 5-5 리포트에 포함

**Part B: AI 판단 리뷰**

review-docx.py 결과를 검토한 후, `extract-docx.py --json` 출력을 읽고 추가 판단:
1. 테이블 데이터가 문맥상 맞는가?
2. 인포/경고 박스가 적절한 위치인가?
3. 문서 전체 흐름이 논리적인가?
4. 구조적으로 "이상해 보이는" 부분이 있는가?

> Part B는 WARN/SUGGEST가 0건일 때도 반드시 수행합니다.

### 5-5. 결과 리포트
검증 결과를 사용자에게 보고하세요:
- 추정 페이지 수
- WARN/INFO 건수
- 주요 이슈 내용
- 콘텐츠 검증 결과 (원본 대비 일치 여부)

---

## 6단계: 계층 ③ — 레이아웃 자가개선 루프 (최대 4회)

검증 결과에 따라 판정하세요:

| 판정 | 조건 | 행동 |
|------|------|------|
| **PASS** | WARN 0건 | 루프 종료, 완료 안내 |
| **FIX** | WARN 있음 | doc-config 수정 → 재실행 → 재검증 |
| **SKIP** | INFO만 있음 | 루프 종료 (INFO는 참고용) |
| **ROLLBACK** | 수정 후 페이지 수 10%↑ | 수정 취소, 사용자 확인 |

### FIX 시 수정 대상
- **WARN만 자동 수정** (이미지 배치 등 명확한 문제)
- **INFO는 수정하지 않음** (고아 제목 등은 시뮬레이션 추정치이므로 실제 Word 렌더링과 다를 수 있음)
- 수정: doc-config JSON의 `pageBreaks`, `tableWidths` 등을 조정
- 일괄 패턴 매칭으로 break를 넣지 말 것 (특정 위치만 수정)

### FIX 성공 후 경험 기록 (Reflexion)

FIX가 성공하면 (WARN이 해결되면) `lib/reflections.json`에 기록하세요:

1. `lib/reflections.json`을 읽기 (없으면 빈 구조 `{"_version":1,"reflections":[]}` 생성)
2. 해결된 WARN마다 엔트리 생성:
   - `id`: 기존 최대 ID + 1 (`ref-NNN`)
   - `outcome`: "FIX"
   - `issue`: 원래 WARN 정보
   - `fix`: 실제 수행한 수정 (필드, 액션, 값)
   - `reflection`: **핵심 교훈** 1~2문장 (왜 발생, 어떻게 방지)
   - `tags`: issue type + config field + doc type
3. 저장 (`_lastUpdated` 갱신)

> 200개 초과 시 가장 오래된 PASS 엔트리부터 삭제. ROLLBACK은 보존.

### ROLLBACK 판정
- 수정 전 페이지 수를 기록
- 수정 후 페이지 수가 10% 이상 증가하면 과도한 수정
- 수정을 되돌리고 사용자에게 에스컬레이션

### ROLLBACK 경험 기록 (Anti-pattern)

ROLLBACK 발생 시 반드시 `lib/reflections.json`에 기록:
- `outcome`: "ROLLBACK"
- `reflection`: 왜 실패했는지, 어떤 수정이 과도했는지
- `tags`에 `"anti-pattern"` 포함

### 4회 초과 시
- 자동 수정을 중단하고 사용자에게 보고
- 남은 WARN을 나열하고 AskUserQuestion으로 선택받기:

| 선택지 | 설명 |
|--------|------|
| 이대로 완료 | 현재 결과물을 최종으로 확정 |
| 직접 피드백 | 사용자가 추가 수정사항을 직접 지시 |

"직접 피드백"을 선택한 경우:
- 사용자의 피드백을 듣고 doc-config 또는 source MD를 수정
- 5단계를 다시 진행

---

## 완료

최종 산출물 경로를 안내하세요:
```
output/{파일명}.docx 생성 완료
```

변환이 성공(WARN 0)하면 패턴 DB를 갱신하세요:
```bash
node tools/extract-patterns.js
```

변환 성공(WARN 0)이고 FIX 없이 통과한 경우 `lib/reflections.json`에 기록:
- `outcome`: "PASS", `iteration`: 0, `fix.action`: "none"
- `reflection`: "이 doc-config 설정으로 WARN 0. 주요: [핵심 설정 요약]"

재실행 방법도 알려주세요:
```
재실행: node lib/convert.js doc-configs/{파일명}.json
검증:   node lib/convert.js doc-configs/{파일명}.json --validate
재검증: python -X utf8 tools/validate-docx.py output/{파일명}.docx
회귀:   node tools/regression-test.js
```
