---
name: validate
description: 생성된 DOCX 파일의 구조 검증 및 레이아웃 분석
argument-hint: "[output/파일명.docx]"
allowed-tools: Bash, Read, Edit, Glob, AskUserQuestion
---

# gendocs 문서 검증

생성된 DOCX 파일을 검증합니다.

## 실행 절차

### 1. 대상 파일 확인

$ARGUMENTS 가 있으면 해당 파일을 검증하세요.
없으면 output/ 폴더를 조회하여 DOCX 파일 목록을 보여주고 AskUserQuestion으로 선택받으세요.

### 2. 검증 실행

텍스트 리포트 (사용자에게 보여줄 때):
```bash
python -X utf8 tools/validate-docx.py {대상 파일}
```

JSON 리포트 (자동 처리/피드백 루프용):
```bash
python -X utf8 tools/validate-docx.py {대상 파일} --json
```

### 3. 결과 해석

검증 결과를 사용자에게 설명하세요:

**구조 이슈가 있으면:**
- 어떤 문제인지 한국어로 설명
- 해결 방법 제안

**레이아웃 권장사항이 있으면:**
- 각 권장사항의 의미를 설명
- AskUserQuestion으로 물어보세요:
  - "자동으로 수정하시겠습니까?"
  - "이대로 유지하시겠습니까?"

자동 수정을 선택한 경우:
- 해당 doc-config JSON 파일을 찾아서 수정 (doc-configs/ 확인)
- 없으면 해당 converter 파일을 찾아서 수정
- 재생성 → 재검증 → 결과 보고
