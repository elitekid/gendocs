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
- [x] AI 셀프리뷰 스크립트 (review-docx.py — 콘텐츠 정합성 + 너비 불균형 + 품질)
- [x] MD 구조 린트 (lint-md.py — 6가지 자동 검사)
- [x] 테마 시스템 (themes/ — 5개 프리셋, factory 패턴)

### Phase 3: 자가개선 심화 (v0.4) — 마스터플랜

> 리서치 근거: `docs/self-improvement-research.md` (30개 논문/자료 분석)
> 핵심 원칙: 외부 도구 우선 (CRITIC), 경험 기억 (Reflexion), 다양성 보존 (Model Collapse), 조기 중단 (피드백 루프 저하 연구)

#### Sprint 1: 에피소딕 메모리 (Reflexion 패턴)

**목표**: 수정 경험을 구조화하여 저장하고, 유사 문서에서 재활용
**근거**: Reflexion (NeurIPS 2023) — AlfWorld +22%, HotPotQA +20%

| 항목 | 파일 | 설명 |
|------|------|------|
| reflections.json 스키마 정의 | `lib/reflections.json` | docType, issue, fix, outcome, pattern 필드 |
| 자동 기록 | SKILL.md FIX 단계 | FIX 후 수정 이력을 reflections.json에 자동 추가 |
| 컨텍스트 주입 | SKILL.md 5-1 단계 | 새 문서 생성 시 유사 docType의 반성을 참조 |
| 패턴 승격 | `tools/extract-patterns.js` | reflection에서 반복되는 패턴 → patterns.json에 승격 |

검증 게이트:
- [ ] reflections.json에 기록 후 regression-test.js PASS
- [ ] 유사 문서 2회차 생성에서 1회차 대비 FIX 횟수 감소 확인

#### Sprint 2: 루프 조기 종료 + 개선 델타 추적

**목표**: 진전 없는 반복을 조기 감지하고 중단
**근거**: AWS Evaluator 패턴, 피드백 루프 저하 연구 (5회 → 37.6% 취약점↑)

| 항목 | 파일 | 설명 |
|------|------|------|
| 개선 델타 추적 | SKILL.md 6단계 | 반복마다 WARN 수 기록, 델타 0이면 조기 STOP |
| 진동 감지 | SKILL.md 6단계 | WARN 수가 증가↔감소 반복하면 STOP |
| 최적 결과 보존 | SKILL.md 6단계 | 각 반복의 DOCX를 보존, 최소 WARN 버전 선택 |
| SKILL.md 업데이트 | SKILL.md | 조기 종료 판정 규칙 추가 |

검증 게이트:
- [ ] 기존 29개 문서에서 FIX 루프 진입 시 조기 종료 올바르게 작동
- [ ] 불필요한 반복이 줄어들고, 최종 품질은 유지

#### Sprint 3: 다차원 품질 점수

**목표**: 이진 판정(WARN 0 = PASS)을 다차원 점수로 확장
**근거**: RLAIF (등급 > 이진), LLM-as-a-Judge (다차원), LLM-Rubric

| 항목 | 파일 | 설명 |
|------|------|------|
| 점수 산출 함수 | `tools/score-docx.js` (신규) | 5차원 1-10 점수 (콘텐츠/레이아웃/테이블/코드/구조) |
| validate + review 통합 | `tools/score-docx.js` | 기존 검증 결과를 점수로 변환 |
| 점수 DB | `tests/scores/` | 문서별 점수 히스토리 (시계열 추적) |
| 패턴 가중치 | `tools/extract-patterns.js` | 9점 문서 패턴 > 6점 문서 패턴 |

검증 게이트:
- [ ] 기존 29개 문서의 점수 산출 + baseline 저장
- [ ] 테마 변경 등 비기능 변경에서 점수 변동 없음 확인

#### Sprint 4: 패턴 붕괴 방지

**목표**: AI 생성 패턴의 다양성 감소를 방지
**근거**: Model Collapse (Nature 2024)

| 항목 | 파일 | 설명 |
|------|------|------|
| 출처 추적 | `lib/patterns.json` | 각 패턴에 provenance (human/ai) 필드 추가 |
| 다양성 메트릭 | `tools/extract-patterns.js` | 동일 헤더에 variant 2개+ 유지 경고 |
| 패턴 감사 리포트 | `tools/extract-patterns.js` | `--audit` 플래그로 다양성 보고서 |
| doc-config 출처 | `doc-configs/*.json` | `"source_origin": "human"` / `"ai_generated"` 필드 |

검증 게이트:
- [ ] extract-patterns.js --audit 실행 시 현재 다양성 수준 확인
- [ ] AI 생성 패턴 비율 50% 미만 유지 정책 반영

#### Sprint 5: Layer 1 외부 도구 강화 (lint-md.py 확장)

**목표**: MD 셀프리뷰에서 외부 도구 검사 비율 높이기
**근거**: Kamoi et al. (외부 피드백 없는 내재적 자기 수정 실패)

| 항목 | 파일 | 설명 |
|------|------|------|
| 중첩 불릿 감지 | `tools/lint-md.py` | CRITICAL — converter가 들여쓰기 무시 |
| 테이블 컬럼 수 경고 | `tools/lint-md.py` | WARN — 8+ 컬럼 사전 감지 |
| 이미지 참조 유효성 | `tools/lint-md.py` | CRITICAL — 존재하지 않는 파일 참조 |
| 코드블록 언어 태그 | `tools/lint-md.py` | MINOR — 알려지지 않은 언어 |
| 섹션 분량 균형 | `tools/lint-md.py` | INFO — H2 간 분량 3배 차이 |

검증 게이트:
- [ ] 기존 29개 source MD에서 새 린트 규칙 false positive 없음
- [ ] 알려진 문제를 정확히 감지하는지 테스트 케이스 추가

#### Sprint 6: 파이프라인 진단 모드

**목표**: MD→config→변환→DOCX 전체 체인 평가로 근본 원인 추적
**근거**: Agent-as-a-Judge (2025), MAPE-K 루프 (Self-Healing Survey)

| 항목 | 파일 | 설명 |
|------|------|------|
| pipeline-audit.js | `tools/pipeline-audit.js` (신규) | lint + convert + validate + review + score 통합 실행 |
| 단계별 점수 | pipeline-audit.js | 각 단계 결과를 개별 점수화 |
| 근본 원인 매핑 | pipeline-audit.js | 레이아웃 WARN → 원인이 MD/config/변환 중 어디인지 |
| SKILL.md 통합 | SKILL.md | `/gendocs --audit` 옵션으로 진단 모드 |

검증 게이트:
- [ ] 기존 29개 문서에서 pipeline-audit 실행 가능
- [ ] 알려진 WARN의 근본 원인이 올바르게 매핑되는지 확인

---

#### 구현 순서 및 의존성

```
Sprint 1 (에피소딕 메모리)        ← 독립, 먼저 시작
    ↓
Sprint 2 (조기 종료)              ← Sprint 1 이후 (반성 데이터 활용)
    ↓
Sprint 3 (다차원 점수)            ← Sprint 2 이후 (델타 추적에 점수 활용)
    ↓
Sprint 4 (패턴 붕괴 방지)         ← Sprint 3 이후 (점수 가중치 적용)

Sprint 5 (lint-md.py 확장)        ← 독립, Sprint 1과 병렬 가능
Sprint 6 (파이프라인 진단)         ← Sprint 3 + 5 완료 후 (점수 + 린트 통합)
```

각 Sprint 완료 후:
1. `node tools/regression-test.js` — 회귀 없음 확인
2. `node tools/create-baselines.js --force` — baseline 갱신
3. CLAUDE.md + SKILL.md + MEMORY.md 업데이트
4. 커밋

### Phase 4: 포맷 확장 — 예정 (v0.4 이후)
- [ ] Excel (xlsx) 템플릿 및 변환기
- [ ] PowerPoint (pptx) 템플릿 및 변환기
- [ ] PDF 생성

### Phase 5: GitHub 공개 — 진행 중
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
