/**
 * check-rules.js — 규칙 충돌 감지 (보조 도구)
 *
 * 사용법: node tools/check-rules.js
 *
 * SKILL.md, MEMORY.md, CLAUDE.md에서 규칙성 문장을 추출하고
 * 알려진 충돌 패턴을 검사한다.
 *
 * 핵심 메커니즘은 regression-test.js이며, 이 도구는 보조적 정적 분석.
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// 검사할 규칙 파일들
const RULE_FILES = [
  { path: '.claude/skills/gendocs/SKILL.md', label: 'gendocs SKILL.md' },
  { path: '.claude/skills/validate/SKILL.md', label: 'validate SKILL.md' },
  { path: 'CLAUDE.md', label: 'CLAUDE.md' },
];

// MEMORY.md는 사용자 홈 디렉토리에 위치
const MEMORY_FILE = {
  path: path.join(process.env.USERPROFILE || process.env.HOME || '', '.claude', 'projects', 'C--opt-gendocs', 'memory', 'MEMORY.md'),
  label: 'MEMORY.md',
};

// 알려진 충돌 패턴 정의
const CONFLICT_RULES = [
  {
    id: 'WARN_ONLY_FIX',
    description: 'WARN만 자동 수정 vs INFO도 수정',
    positive: /WARN만\s*자동\s*수정|WARN\s*only/i,
    negative: /INFO도?\s*(자동\s*)?수정|INFO\s*also\s*fix/i,
  },
  {
    id: 'NO_BULK_BREAK',
    description: '일괄 패턴 매칭 break 금지 vs 일괄 break 허용',
    positive: /일괄.*break.*금지|일괄.*패턴.*금지|bulk.*break.*forbid/i,
    negative: /일괄.*break.*추가|모든.*H[34].*break|all.*H[34].*break/i,
  },
  {
    id: 'PAGE_INCREASE_LIMIT',
    description: '페이지 수 증가 임계값 충돌',
    pattern: /페이지.*(\d+)%.*증가|page.*(\d+)%.*increase/gi,
    check: (matches) => {
      const values = matches.map(m => {
        const num = m.match(/(\d+)%/);
        return num ? parseInt(num[1]) : null;
      }).filter(v => v !== null);
      const unique = [...new Set(values)];
      return unique.length > 1 ? `다른 임계값: ${unique.join('%, ')}%` : null;
    },
  },
  {
    id: 'DEFAULT_H3_BREAK',
    description: 'defaultH3Break 기본값 충돌',
    pattern: /defaultH3Break[^.]*(?:true|false)/gi,
    check: (matches) => {
      const values = matches.map(m => m.includes('true') ? 'true' : 'false');
      const unique = [...new Set(values)];
      return unique.length > 1 ? `다른 기본값: ${unique.join(', ')}` : null;
    },
  },
];

function extractRuleSentences(content) {
  const lines = content.split('\n');
  const rules = [];
  const ruleKeywords = ['금지', '하지 않', '만 ', '항상', '반드시', '절대', '않는다', '않음',
                         'always', 'never', 'must', 'only', 'forbidden', '수정하지'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#') || line.startsWith('|') || line.startsWith('```')) continue;

    const hasKeyword = ruleKeywords.some(kw => line.includes(kw));
    if (hasKeyword) {
      rules.push({ line: i + 1, text: line });
    }
  }
  return rules;
}

function main() {
  console.log('\n=== 규칙 충돌 검사 ===\n');

  // 규칙 파일 읽기
  const allContent = [];
  const fileContents = {};

  const filesToCheck = [...RULE_FILES];
  if (fs.existsSync(MEMORY_FILE.path)) {
    filesToCheck.push(MEMORY_FILE);
  }

  for (const file of filesToCheck) {
    const fullPath = file.path.startsWith('/') || file.path.includes(':')
      ? file.path
      : path.join(PROJECT_ROOT, file.path);

    if (!fs.existsSync(fullPath)) {
      console.log(`  [SKIP] ${file.label} — 파일 없음`);
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    fileContents[file.label] = content;
    allContent.push({ label: file.label, content });
    console.log(`  [READ] ${file.label} (${content.split('\n').length}줄)`);
  }

  console.log('');

  const issues = [];

  // 충돌 패턴 검사
  for (const rule of CONFLICT_RULES) {
    if (rule.positive && rule.negative) {
      // positive/negative 모순 검사
      const positiveHits = [];
      const negativeHits = [];

      for (const { label, content } of allContent) {
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (rule.positive.test(lines[i])) {
            positiveHits.push({ file: label, line: i + 1, text: lines[i].trim() });
          }
          // Reset lastIndex for global regex
          rule.positive.lastIndex = 0;

          if (rule.negative.test(lines[i])) {
            negativeHits.push({ file: label, line: i + 1, text: lines[i].trim() });
          }
          rule.negative.lastIndex = 0;
        }
      }

      if (positiveHits.length > 0 && negativeHits.length > 0) {
        issues.push({
          id: rule.id,
          severity: 'WARN',
          description: rule.description,
          details: [
            ...positiveHits.map(h => `  + ${h.file}:${h.line} "${h.text.substring(0, 80)}"`),
            ...negativeHits.map(h => `  - ${h.file}:${h.line} "${h.text.substring(0, 80)}"`),
          ],
        });
      }
    }

    if (rule.pattern && rule.check) {
      // 패턴 수집 + 일관성 검사
      const allMatches = [];
      for (const { label, content } of allContent) {
        const matches = content.match(rule.pattern) || [];
        allMatches.push(...matches);
      }

      if (allMatches.length > 0) {
        const conflict = rule.check(allMatches);
        if (conflict) {
          issues.push({
            id: rule.id,
            severity: 'WARN',
            description: rule.description,
            details: [`  ${conflict}`],
          });
        }
      }
    }
  }

  // 규칙 문장 추출 (참고용)
  let totalRules = 0;
  for (const { label, content } of allContent) {
    const rules = extractRuleSentences(content);
    totalRules += rules.length;
  }

  // 결과 출력
  console.log('=== 결과 ===\n');

  if (issues.length === 0) {
    console.log(`  [OK] 충돌 없음 (규칙 문장 ${totalRules}개 검사)`);
  } else {
    for (const issue of issues) {
      console.log(`  [${issue.severity}] ${issue.id}: ${issue.description}`);
      for (const detail of issue.details) {
        console.log(`  ${detail}`);
      }
      console.log('');
    }
  }

  console.log(`\n규칙 문장 총 ${totalRules}개 스캔, 충돌 ${issues.length}건 감지`);

  if (issues.some(i => i.severity === 'WARN')) {
    console.log('\n[TIP] 충돌이 감지되면 node tools/regression-test.js 로 실제 영향을 확인하세요.');
  }

  // exit code: WARN이 있으면 1
  process.exit(issues.some(i => i.severity === 'WARN') ? 1 : 0);
}

main();
