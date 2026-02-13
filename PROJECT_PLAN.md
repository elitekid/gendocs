# gendocs 프로젝트 계획서

## 프로젝트 개요

**gendocs**는 Claude Code 기반 문서 생성 툴킷이다.
사용자가 MD 파일(또는 설명)을 입력하면, Claude Code가 변환 스크립트를 작성·실행하여 최종 문서(Word, Excel, PPT 등)를 생성한다.

일반 개발 프로젝트가 아니다. **CLAUDE.md가 핵심이며**, Claude Code가 이 프로젝트의 주 실행자다.

---

## 보유 자산

| 구분 | 파일 | 역할 |
|------|------|------|
| 변환 엔진 | lib/converter-core.js | 공통 MD→DOCX 변환 로직 |
| CLI 진입점 | lib/convert.js | `node lib/convert.js <config.json>` |
| 템플릿 | templates/docx/professional.js | 가로 레이아웃, 다크코드, 머릿글/바닥글 |
| 템플릿 | templates/docx/basic.js | 세로 레이아웃, 심플 |
| 검증 | tools/validate-docx.py | DOCX 구조 검증 + 레이아웃 시뮬레이션 |
| 추출 | tools/extract-docx.py | DOCX → 텍스트 추출 (ZIP+XML) |
| 회귀 테스트 | tools/regression-test.js | baseline 비교 |
| 패턴 추출 | tools/extract-patterns.js | 성공 패턴 → patterns.json |
| 다이어그램 | templates/diagram/sequence.py | 시퀀스 다이어그램 템플릿 |
| 디버그 | tools/debug-convert.js, debug-parser.js | MD 파싱 디버그 |

### 검증된 기술 스택
- **DOCX 생성**: Node.js + `docx` npm 패키지
- **다이어그램**: Python + `matplotlib`
- **MD 파싱**: 라인 단위 자체 파서 (제목/테이블/코드블록/인용문/불릿)

---

## 폴더 구조

```
gendocs/
├── CLAUDE.md                    # [핵심] Claude Code 지시서
├── PROJECT_PLAN.md              # 이 파일
├── package.json                 # npm 의존성 (docx, adm-zip)
├── requirements.txt             # Python 의존성 (matplotlib)
│
├── .claude/skills/              # 슬래시 커맨드 (Skills)
│   ├── gendocs/SKILL.md         # /gendocs — 대화형 문서 생성
│   └── validate/SKILL.md        # /validate — 문서 검증
│
├── lib/                         # Generic Converter 엔진
│   ├── converter-core.js        # 공통 변환 로직
│   └── convert.js               # CLI 진입점
│
├── templates/                   # 문서 템플릿 모음
│   ├── docx/
│   │   ├── basic.js             # 기본 DOCX 템플릿 (세로, 심플)
│   │   └── professional.js      # 고급 DOCX 템플릿 (가로, 다크코드)
│   └── diagram/
│       └── sequence.py          # 시퀀스 다이어그램 템플릿
│
├── doc-configs/                 # 문서별 설정 파일 (사용자 생성)
├── source/                      # 사용자 원본 파일 (입력)
├── output/                      # 생성된 최종 문서 (출력)
│
├── examples/                    # 레퍼런스 예시
│   ├── sample-api/              # BookStore API 명세서
│   │   ├── source.md
│   │   └── doc-config.json
│   └── sample-batch/            # 주문처리 배치 규격서
│       ├── source.md
│       └── doc-config.json
│
├── tests/                       # 회귀 테스트
│   └── golden/                  # baseline 스냅샷
│
└── tools/                       # 검증·디버그·유틸리티
    ├── validate-docx.py         # DOCX 구조 검증 (--json)
    ├── extract-docx.py          # DOCX 텍스트 추출 (--json)
    ├── regression-test.js       # 회귀 테스트
    ├── create-baselines.js      # baseline 생성
    ├── extract-patterns.js      # 성공 패턴 추출
    ├── check-rules.js           # 규칙 충돌 감지
    └── visual-verify.py         # 시각적 검증 (LibreOffice 필요)
```

---

## 사용자 워크플로우

```
1. 사용자가 gendocs를 clone
2. npm install && pip install -r requirements.txt
3. Claude Code 실행 후 대화:

   사용자: "/gendocs" 또는 "source/내문서.md를 Word로 만들어줘"

   Claude Code:
   - CLAUDE.md 읽음 → 역할 인식
   - source/내문서.md 분석
   - examples/ 참조하여 패턴 파악
   - doc-configs/내문서.json 작성
   - node lib/convert.js 실행 → output/내문서.docx 생성
   - 자동 검증 + 자가개선 루프

4. 사용자가 output/ 에서 결과물 확인
```

---

## 진행 현황

### Phase 1: DOCX 워크플로우 완성 (v0.1) — 완료
- [x] 폴더 구조 생성
- [x] professional 템플릿 (가로, 다크코드, 표지, 머릿글/바닥글)
- [x] 구조 검증 (validate-docx.py)
- [x] 레이아웃 시뮬레이션

### Phase 2: 자가개선 루프 (v0.2) — 완료
- [x] Generic Converter (lib/converter-core.js + lib/convert.js)
- [x] doc-config JSON 기반 변환 (코드 작성 불필요)
- [x] 검증 JSON 출력 + 피드백 루프 (PASS/FIX/SKIP/ROLLBACK)
- [x] DOCX 텍스트 추출 (extract-docx.py)

### Phase 2.5: 자가개선 고도화 (v0.3) — 완료
- [x] 회귀 테스트 (regression-test.js + baseline)
- [x] 성공 패턴 추출 (extract-patterns.js → patterns.json)
- [x] 규칙 충돌 감지 (check-rules.js + 회귀 테스트 게이트)
- [x] 셀프리뷰 필수 게이트 (SKILL.md + CLAUDE.md)
- [x] 시각적 검증 (visual-verify.py, 선택적)

### Phase 3: 포맷 확장 — 예정
- [ ] Excel (xlsx) 템플릿 및 변환기
- [ ] PowerPoint (pptx) 템플릿 및 변환기
- [ ] PDF 생성

### Phase 4: GitHub 공개 — 진행 중
- [x] .gitignore 설정
- [x] 회사 문서 분리 (gitignore)
- [x] 제네릭 예제 작성
- [x] README.md 작성
- [ ] LICENSE 선택

---

## 핵심 원칙

1. **Claude Code가 주 실행자** — 코드를 사람이 직접 짜는 게 아니라, Claude Code가 짠다
2. **CLAUDE.md가 설계도** — 프로젝트의 품질은 CLAUDE.md의 품질에 달려 있다
3. **examples가 교과서** — Claude Code는 기존 성공 사례를 보고 새 문서를 만든다
4. **templates가 부품** — 매번 처음부터 만들지 않고, 검증된 템플릿을 재사용한다
