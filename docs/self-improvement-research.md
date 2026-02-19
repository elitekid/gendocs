# gendocs 자가개선 시스템 — 리서치 분석 보고서

> 작성일: 2026-02-13
> 목적: 현재 자가개선 아키텍처 분석 + 학술 리서치 기반 발전 방향 도출

---

## 1. 현재 시스템 분석

### 1.1 아키텍처: 3계층 자가개선

gendocs는 문서 생성 과정에서 3단계의 자가개선을 수행한다:

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: MD 셀프리뷰 (변환 전)                              │
│  lint-md.py (6가지 구조 검사) + AI 읽기 리뷰                  │
│  → CRITICAL/MINOR/STYLE 분류                                │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: AI 셀프리뷰 (변환 후)                              │
│  review-docx.py (6가지 검사) + AI 판단 리뷰                  │
│  → WARN/SUGGEST/INFO 분류                                   │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: 레이아웃 자가개선 루프 (변환 후, 최대 4회)           │
│  validate-docx.py (구조+페이지 시뮬레이션)                    │
│  → PASS/FIX/SKIP/ROLLBACK 판정                              │
└─────────────────────────────────────────────────────────────┘

보조 시스템:
  - regression-test.js: 29개 baseline 회귀 방지
  - extract-patterns.js: 성공 패턴 → patterns.json
  - check-rules.js: 규칙 문서 간 모순 감지
```

### 1.2 Layer 1: MD 셀프리뷰 (변환 전)

**위치**: SKILL.md "셀프리뷰 (필수 게이트)" 섹션, `tools/lint-md.py`

**Part A — 자동 린트 (lint-md.py)**

6가지 구조 검사를 자동 수행:

| 검사 | 함수 | 심각도 | 내용 |
|------|------|--------|------|
| metadata | `check_metadata()` | MINOR | H1 + 메타데이터 블록쿼트 완성도 (프로젝트/버전/작성일) |
| separator | `check_separators()` | MINOR | H2 섹션 사이 `---` 구분선 존재 |
| changeHistory | `check_change_history()` | STYLE | v1.0 변경 내용이 "초안 작성"인지 |
| codeBlockBalance | `check_code_block_balance()` | **CRITICAL** | 코드블록 열림/닫힘 균형 (닫히지 않으면 이후 전체 깨짐) |
| tocConsistency | `check_toc_consistency()` | MINOR | 목차 항목과 실제 H2 섹션 일치 |
| htmlArtifact | `check_html_artifacts()` | MINOR | 코드블록 외부 HTML 태그 잔여물 |

**Part B — AI 읽기 리뷰 (수동)**

Claude Code가 MD를 처음부터 끝까지 읽고 판단:
- 섹션 구조 논리성
- 표현 방식 적절성 (소규모 키-값 → 불릿 vs 테이블)
- 코드블록 언어 태그 정확성
- 누락/불완전 섹션

**강점**: CRITICAL 감지 (닫히지 않은 코드블록), 배치 처리 지원
**약점**: AI 리뷰가 비구조적, 피드백→규칙 업데이트 프로세스 미자동화

### 1.3 Layer 2: AI 셀프리뷰 (변환 후)

**위치**: SKILL.md 5-4 섹션, `tools/review-docx.py`

6가지 자동 품질 검사:

| 검사 | 유형 | 심각도 | 내용 |
|------|------|--------|------|
| 콘텐츠 정합성 | CONTENT_MISSING/EXTRA | WARN/INFO | 소스 MD vs DOCX 요소 수 비교 (9개 유형) |
| 컬럼 너비 불균형 | WIDTH_IMBALANCE | SUGGEST | 줄바꿈 컬럼 + 빈 인접 컬럼 감지 → 재분배 제안 |
| 넓은 낭비 | WIDE_WASTE | INFO | 컬럼 활용률 30% 미만 |
| 테이블 가독성 | TOO_MANY_COLUMNS/CELL_OVERFLOW/EMPTY_COLUMN | INFO | 8+ 컬럼, 4줄+ 셀, 빈 컬럼 |
| 코드 무결성 | TRUNCATED_JSON/EMPTY_CODE | WARN | 잘린 JSON, 빈 코드블록 |
| 제목 구조 | DUPLICATE_HEADING/LONG_SECTION | WARN/INFO | 연속 동일 제목, H3 없는 긴 섹션 |

**핵심 알고리즘**:
- 콘텐츠 정합성: `count_md_elements()` vs `count_docx_elements()` 비교
- 너비 추정: CJK(한글) 180 DXA/글자, 라틴 90 DXA/글자 기반
- `suggestedWidths` 배열을 직접 doc-config에 반영 가능

**Part B — AI 판단 리뷰**: WARN/SUGGEST 0건이어도 필수 수행 (의미론적 검토)

### 1.4 Layer 3: 레이아웃 자가개선 루프

**위치**: SKILL.md 6단계, `tools/validate-docx.py`

페이지 레이아웃 시뮬레이션:
- 가로 A4 가용 높이 ~457pt 기준
- 요소별 높이 추정: H2(42pt), H3(34pt), 테이블(헤더 28pt + 행 22pt), 이미지(실제 크기) 등
- 3가지 이슈 감지: IMAGE_NEEDS_PAGE_BREAK(WARN), ORPHAN_HEADING(INFO), TABLE_SPLIT(INFO)

**판정 로직**:

| 판정 | 조건 | 행동 |
|------|------|------|
| PASS | WARN 0건 | 완료 |
| FIX | WARN 있음 | doc-config 수정 → 재변환 → 재검증 |
| SKIP | INFO만 | 완료 (참고용) |
| ROLLBACK | 수정 후 페이지 +10% | 수정 취소 |

**안전장치**: 최대 4회 반복, 일괄 패턴 매칭 break 삽입 금지

### 1.5 보조 시스템

**회귀 테스트** (`regression-test.js`):
- 29개 baseline JSON 스냅샷 비교
- 허용 범위: pages ±2, bullets ±2, warnCount 감소만, 나머지 정확 일치
- converter-core, templates, 규칙 수정 후 반드시 실행

**성공 패턴 추출** (`extract-patterns.js`):
- 성공 doc-config에서 tableWidths 패턴 수집
- 3개+ 문서에서 공유 → common 승격 (현재 5개 common, 40+ byDocType)
- fallback 체인: doc-config → patterns.json common → byDocType → 가중치

**규칙 충돌 감지** (`check-rules.js`):
- SKILL.md/CLAUDE.md/MEMORY.md에서 모순 패턴 검색
- 4가지 알려진 충돌 패턴 정적 검사
- 핵심은 regression-test.js (행동 수준 충돌 감지)

---

## 2. 학술 리서치 기반 분석

### 2.1 현재 시스템이 잘 구현한 부분 (연구로 검증)

#### 외부 도구 기반 검증 — CRITIC 패턴

> **CRITIC** (Gou et al., ICLR 2024): LLM 단독 자기 비판은 불안정. 외부 도구(검색 엔진, 코드 인터프리터) 연동이 핵심.
> **When Can LLMs Correct?** (Kamoi et al., TACL 2024): 외부 피드백 없는 내재적 자기 수정은 실패. 외부 신호가 유일한 해결책.

gendocs의 `validate-docx.py`(XML 파싱 + 페이지 시뮬레이션)와 `review-docx.py`(콘텐츠 추출 + 비교)는 학계에서 가장 효과적이라고 검증된 "외부 도구 기반 자기 수정" 패턴의 구현체.

#### 구조화된 피드백 루프 — Self-Refine 패턴

> **Self-Refine** (Madaan et al., NeurIPS 2023): 단일 LLM이 생성-피드백-정제를 반복. "make it better"가 아닌 구체적 피드백이 수렴의 열쇠.

gendocs의 WARN/SUGGEST/INFO 체계가 정확히 이 "구조화된 피드백" 요건을 충족.

#### 골든 파일 회귀 테스트

> **Golden Tests in AI** (Shaped AI, 2024): 일관성(consistency) 검증에 효과적. 정확성(correctness)과 결합해야 함.

gendocs는 regression-test.js(일관성) + validate-docx.py(정확성) 조합으로 양쪽을 커버.

#### 패턴 학습 — Voyager 스킬 라이브러리

> **Voyager** (Wang et al., NeurIPS 2023): 성공한 코드를 스킬 라이브러리에 저장 → 복합적 능력 축적.
> **ExpeL** (Zhao et al., 2023): 완료된 작업에서 인사이트를 추출 → 미래 작업에 활용.

gendocs의 `extract-patterns.js` → `patterns.json`이 이 패턴의 구현체.

### 2.2 부족한 부분 (연구가 제시하는 개선 방향)

#### Gap 1: 에피소딕 메모리 부재

> **Reflexion** (Shinn et al., NeurIPS 2023): 수정 이력을 자연어 "반성"으로 저장 → 다음 시도에 주입. AlfWorld +22%, HotPotQA +20%.

현재 gendocs는 시맨틱 메모리(patterns.json)만 있고, "무엇이 실패했고 어떻게 고쳤는지"의 에피소딕 메모리가 없음. 유사 문서에서 같은 실수를 반복할 가능성.

#### Gap 2: 반복 품질 저하 위험

> **Feedback Loop Degradation** (ResearchGate 2024): 코드 생성에서 5회 반복 후 치명적 취약점 37.6% 증가. 3회 이상의 완전 자동 반복은 사람 검증 없이 위험.

gendocs의 4회 제한은 적절하나, 개선 델타가 0인 반복(진전 없음)을 조기 감지하는 메커니즘이 없음.

#### Gap 3: 이진 품질 판정

> **RLAIF** (Lee et al., 2023): 이진 판정보다 등급 평가가 더 효과적.
> **LLM-as-a-Judge** (Zheng et al., NeurIPS 2023): 다차원 점수화로 세밀한 평가.

WARN 0 = PASS 이진 판정은 문서 간 품질 비교, 시계열 추적, 패턴 가중치 적용이 불가.

#### Gap 4: 패턴 붕괴 위험

> **Model Collapse** (Shumailov et al., Nature 2024): AI 출력을 반복 학습하면 분포 꼬리 소실 → 다양성 붕괴.

patterns.json에 출처 추적이 없으므로, AI 생성 패턴이 계속 복제되면 다양성 감소 가능.

#### Gap 5: Layer 1 외부 도구 비율 낮음

> **Kamoi et al.**: 내재적 자기 수정은 신뢰 불가. 외부 도구 비율을 높여야.

Layer 1의 Part B(AI 읽기 리뷰)는 LLM이 자기 출력을 자기가 평가하는 "내재적 자기 수정" — 가장 약한 계층.

#### Gap 6: 파이프라인 전체 평가 없음

> **Agent-as-a-Judge** (2025): 최종 산출물이 아닌 전체 체인을 평가해야 근본 원인 발견.

MD 구조 문제가 레이아웃 WARN으로만 표면화됨 — 역방향 추적 불가.

---

## 3. 참고 논문 및 자료

### 3.1 자기 수정 / 반복 정제

| # | 제목 | 저자 | 발표 | 핵심 기여 |
|---|------|------|------|----------|
| 1 | [Self-Refine: Iterative Refinement with Self-Feedback](https://arxiv.org/abs/2303.17651) | Madaan et al. | NeurIPS 2023 | 생성-피드백-정제 반복 패턴 |
| 2 | [Reflexion: Language Agents with Verbal Reinforcement Learning](https://arxiv.org/abs/2303.11366) | Shinn et al. | NeurIPS 2023 | 에피소딕 메모리 기반 자기 개선 |
| 3 | [CRITIC: LLMs Can Self-Correct with Tool-Interactive Critiquing](https://arxiv.org/abs/2305.11738) | Gou et al. | ICLR 2024 | 외부 도구 연동 자기 수정 |
| 4 | [When Can LLMs Actually Correct Their Own Mistakes?](https://arxiv.org/abs/2406.01297) | Kamoi et al. | TACL 2024 | 외부 피드백 없는 자기 수정의 한계 |
| 5 | [Automatically Correcting LLMs: Diverse Strategies](https://aclanthology.org/2024.tacl-1.27/) | Pan et al. | TACL 2024 | 수정 전략 분류 체계 |
| 6 | [SCoRe: Self-Correction via Reinforcement Learning](https://arxiv.org/abs/2409.12917) | Google DeepMind | 2024 | RL 기반 자기 수정 학습 |
| 7 | [LLMLOOP: Iterative Feedback Loops for Code](https://valerio-terragni.github.io/assets/pdf/ravi-icsme-2025.pdf) | Ravi et al. | ICSME 2025 | 품질 차원별 개별 루프 |

### 3.2 Constitutional AI / 원칙 기반

| # | 제목 | 저자 | 발표 | 핵심 기여 |
|---|------|------|------|----------|
| 8 | [Constitutional AI: Harmlessness from AI Feedback](https://arxiv.org/abs/2212.08073) | Bai et al. (Anthropic) | 2022 | 명시적 원칙으로 자기 비판 체계화 |
| 9 | [Collective Constitutional AI](https://arxiv.org/abs/2406.07814) | Huang et al. | FAccT 2024 | 크라우드소싱 원칙 수집 |

### 3.3 LLM-as-a-Judge / 자동 평가

| # | 제목 | 저자 | 발표 | 핵심 기여 |
|---|------|------|------|----------|
| 10 | [Judging LLM-as-a-Judge](https://arxiv.org/abs/2306.05685) | Zheng et al. | NeurIPS 2023 | LLM 평가의 편향과 해법 |
| 11 | [Survey on LLM-as-a-Judge](https://arxiv.org/abs/2411.15594) | Gu et al. | 2025 | LLM 평가 편향 분류법, Multi-Trait |
| 12 | [Agent-as-a-Judge](https://arxiv.org/html/2508.02994v1) | — | 2025 | 체인 전체 평가 |
| 13 | [LLM-Rubric: Multidimensional Evaluation](https://arxiv.org/abs/2501.00274) | — | ACL 2024 | 루브릭 기반 다차원 평가 |

### 3.4 패턴 학습 / 경험 축적

| # | 제목 | 저자 | 발표 | 핵심 기여 |
|---|------|------|------|----------|
| 14 | [Voyager: Open-Ended Embodied Agent](https://arxiv.org/abs/2305.16291) | Wang et al. (NVIDIA) | NeurIPS 2023 | 스킬 라이브러리 = patterns.json |
| 15 | [ExpeL: LLM Agents Are Experiential Learners](https://arxiv.org/html/2308.10144v2) | Zhao et al. | 2023 | 작업 완료 후 인사이트 추출 |
| 16 | [ReMe: Dynamic Procedural Memory](https://arxiv.org/abs/2512.10696) | — | 2025 | 메모리 품질 > 모델 크기 |
| 17 | [EvolveR: Self-Evolving LLM Agents](https://arxiv.org/html/2510.16079v1) | — | 2025 | 오프라인/온라인 경험 순환 |
| 18 | [Experiential Co-Learning](https://aclanthology.org/2024.acl-long.305/) | — | ACL 2024 | 성공 궤적에서 숏컷 추출 |

### 3.5 자가 치유 / 소프트웨어 에이전트

| # | 제목 | 저자 | 발표 | 핵심 기여 |
|---|------|------|------|----------|
| 19 | [Self-Healing Software Survey](https://arxiv.org/abs/2403.00455) | Yan et al. | 2024 | MAPE-K 루프 아키텍처 |
| 20 | [RepairAgent: Autonomous Program Repair](https://arxiv.org/abs/2403.17134) | Bouzenia et al. | ICSE 2025 | 자유 인터리빙 진단-수리 |
| 21 | [SWE-agent](https://arxiv.org/abs/2405.15793) | Yang et al. | NeurIPS 2024 | Agent-Computer Interface 설계 |
| 22 | [Live-SWE-agent: Self-Evolve on the Fly](https://arxiv.org/abs/2511.13646) | Xia et al. | 2025 | 런타임 자기 진화 |

### 3.6 회귀 방지 / 품질 보증

| # | 제목 | 저자 | 발표 | 핵심 기여 |
|---|------|------|------|----------|
| 23 | [AI Model Collapse](https://www.nature.com/articles/s41586-024-07566-y) | Shumailov et al. | Nature 2024 | AI 출력 재학습 → 다양성 붕괴 |
| 24 | [Golden Tests in AI](https://www.shaped.ai/blog/golden-tests-in-ai) | Shaped AI | 2024 | AI 산출물 회귀 테스트 실무 |
| 25 | [Feedback Loop Degradation](https://www.researchgate.net/publication/390395485) | ResearchGate | 2024 | 5회 반복 후 취약점 37.6%↑ |
| 26 | [RLAIF: Scaling with AI Feedback](https://arxiv.org/abs/2309.00267) | Lee et al. (Google) | 2023 | 등급 평가 > 이진 판정 |

### 3.7 다중 에이전트 / 피드백 아키텍처

| # | 제목 | 저자 | 발표 | 핵심 기여 |
|---|------|------|------|----------|
| 27 | [Multi-Agent Debate](https://arxiv.org/abs/2305.14325) | Du et al. (MIT) | ICML 2024 | 다중 LLM 토론 → 사실성 향상 |
| 28 | [ReConcile: Round-Table Conference](https://arxiv.org/abs/2309.13007) | Chen et al. | ACL 2024 | 다양한 LLM 간 합의 도출 |
| 29 | [EvoMAC: Self-Evolving Multi-Agent](https://arxiv.org/abs/2410.16946) | Hu et al. | ICLR 2025 | 텍스트 역전파 |
| 30 | [Agent-in-the-Loop Data Flywheel](https://arxiv.org/abs/2510.06674) | Zhao et al. | EMNLP 2025 | 4가지 실시간 피드백 신호 |

### 3.8 문서 품질 / 코드 리뷰

| # | 제목 | 저자 | 발표 | 핵심 기여 |
|---|------|------|------|----------|
| 31 | [Paper SEA: Automated Peer Reviewing](https://arxiv.org/abs/2407.12857) | — | EMNLP 2024 | 표준화-평가-분석 3단계 |
| 32 | [Automating Code Review](https://arxiv.org/abs/2203.09095) | Li et al. | FSE 2022 | 품질 추정-리뷰-정제 3태스크 분해 |
| 33 | [LATS: Language Agent Tree Search](https://arxiv.org/abs/2310.04406) | Zhou et al. | ICML 2024 | MCTS + LLM 가치 함수 |

---

## 4. 발전 제안 (우선순위 순)

### Priority 1: 에피소딕 메모리 (`reflections.json`)

**문제**: 수정 경험이 소실됨. 유사 문서에서 같은 실수 반복.
**근거**: Reflexion (AlfWorld +22%, HotPotQA +20%), ExpeL, ReMe
**제안**: FIX 후 수정 이력을 구조화하여 저장. 새 문서 생성 시 유사 docType의 반성을 컨텍스트로 주입.

```json
{
  "reflections": [
    {
      "docType": "api-spec",
      "date": "2026-02-10",
      "issue": "8컬럼 테이블이 가로 A4에서도 읽기 어려움",
      "fix": "2개 테이블로 분리",
      "outcome": "WARN 0, 가독성 개선",
      "pattern": "8+ 컬럼 테이블은 분리 고려"
    }
  ]
}
```

### Priority 2: 루프 조기 종료 + 개선 델타 추적

**문제**: 고정 4회 반복, 진전 없는 반복도 계속 진행.
**근거**: AWS Evaluator 패턴, 피드백 루프 저하 연구 (5회 → 37.6% 취약점↑)
**제안**: 반복마다 WARN 수 추적, 개선 델타 0이면 조기 중단.

```
Iteration 1: WARN 3 → FIX
Iteration 2: WARN 1 → FIX (델타: -2)
Iteration 3: WARN 1 → STOP (델타: 0, 진전 없음)
```

### Priority 3: 문서 품질 다차원 점수화

**문제**: WARN 0 = PASS 이진 판정. 문서 간 비교 불가.
**근거**: RLAIF (등급 > 이진), LLM-as-a-Judge (다차원), LLM-Rubric
**제안**: 5개 차원의 1-10 점수 체계.

| 차원 | 측정 방법 | 자동화 도구 |
|------|----------|------------|
| 콘텐츠 충실도 | MD vs DOCX 요소 수 비교 | review-docx.py |
| 레이아웃 품질 | 고아 제목, 희소 페이지 비율 | validate-docx.py |
| 테이블 가독성 | 너비 불균형, 오버플로우 비율 | review-docx.py |
| 코드 무결성 | 잘린 JSON 0, 빈 코드블록 0 | review-docx.py |
| 구조 일관성 | 제목 계층 건너뛰기, 목차 일치 | lint-md.py + validate |

### Priority 4: 패턴 붕괴 방지

**문제**: AI 생성 패턴이 계속 복제되면 다양성 감소.
**근거**: Model Collapse (Nature 2024)
**제안**: 패턴에 출처(사람 vs AI) 추가, 다양성 메트릭, 주기적 감사.

### Priority 5: Layer 1 외부 도구 강화 (lint-md.py 확장)

**문제**: AI 읽기 리뷰가 "내재적 자기 수정" — 가장 약한 계층.
**근거**: Kamoi et al. (외부 도구 비율 높여야), CRITIC
**제안**: 새 린트 규칙 추가 (중첩 불릿, 컬럼 수 경고, 이미지 참조 유효성 등).

### Priority 6: 파이프라인 진단 모드

**문제**: 최종 DOCX만 평가. MD 구조 문제의 근본 원인 추적 불가.
**근거**: Agent-as-a-Judge, MAPE-K 루프
**제안**: `pipeline-audit.js`로 MD→config→변환→DOCX 전체 체인 평가.

---

## 5. 연구 ↔ 현재 시스템 매핑

| gendocs 컴포넌트 | 연구 패턴 | 핵심 참고 논문 | 현재 수준 | 발전 방향 |
|------------------|----------|---------------|----------|----------|
| Layer 1 (MD 린트) | Constitutional AI | Bai 2022 | 자동 6검사 + 비구조적 AI | 린트 확장 + 원칙 명문화 |
| Layer 2 (AI 리뷰) | LLM-as-a-Judge, CRITIC | Zheng 2023, Gou 2024 | 6검사 자동 + AI 판단 | 다차원 점수 + 참조 비교 |
| Layer 3 (레이아웃 루프) | Self-Refine, MAPE-K | Madaan 2023 | 최대 4회 FIX | 조기 종료 + 에피소딕 메모리 |
| patterns.json | Voyager 스킬 라이브러리 | Wang 2023 | 5 common + 40 byDocType | 출처 추적 + 다양성 보호 |
| regression-test.js | Golden File Testing | Shaped AI 2024 | 29 baseline 비교 | 시맨틱 diff + 속성 기반 |
| (없음) | Reflexion 에피소딕 메모리 | Shinn 2023 | — | reflections.json 신규 |
| (없음) | Agent-as-a-Judge | 2025 | — | pipeline-audit.js 신규 |
