/**
 * extract-patterns.js — 성공한 doc-config에서 재사용 가능한 패턴 추출
 *
 * 사용법: node tools/extract-patterns.js
 *
 * 전체 doc-config의 tableWidths를 스캔하여:
 * - 3개 이상 doc-config에서 동일 너비로 사용 → common 승격
 * - 1~2개에서만 사용 → byDocType에 유지
 *
 * 결과: lib/patterns.json
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DOC_CONFIGS_DIR = path.join(PROJECT_ROOT, 'doc-configs');
const PATTERNS_PATH = path.join(PROJECT_ROOT, 'lib', 'patterns.json');
const SCORES_DIR = path.join(PROJECT_ROOT, 'tests', 'scores');

const COMMON_THRESHOLD = 3; // 3개 이상이면 common 승격
const QUALITY_GATE = 7.0;   // common 승격 시 평균 점수 게이트

function getConfigName(configPath) {
  return path.basename(configPath, '.json');
}

/**
 * tests/scores/ 에서 점수 맵 로드
 * @returns {{ [docName: string]: number } | null} — 점수 파일이 없으면 null
 */
function loadScoreMap() {
  if (!fs.existsSync(SCORES_DIR)) return null;

  const scoreFiles = fs.readdirSync(SCORES_DIR).filter(f => f.endsWith('.scores.json'));
  if (scoreFiles.length === 0) return null;

  const scoreMap = {};
  for (const f of scoreFiles) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(SCORES_DIR, f), 'utf-8'));
      const name = data.docConfig || path.basename(f, '.scores.json');
      if (data.latestOverall !== undefined) {
        scoreMap[name] = data.latestOverall;
      }
    } catch (err) {
      // 파싱 실패는 무시
    }
  }

  return Object.keys(scoreMap).length > 0 ? scoreMap : null;
}

/**
 * usedBy 목록의 평균 점수 계산
 */
function avgScore(usedBy, scoreMap) {
  if (!scoreMap) return 0;
  const scores = usedBy.map(name => scoreMap[name]).filter(s => s !== undefined);
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function main() {
  // doc-configs 수집
  const configFiles = fs.readdirSync(DOC_CONFIGS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(DOC_CONFIGS_DIR, f));

  if (configFiles.length === 0) {
    console.log('doc-configs/ 에 JSON 파일이 없습니다.');
    process.exit(0);
  }

  console.log(`\n=== 패턴 추출 시작 (${configFiles.length}개 문서) ===\n`);

  // 패턴 수집: { "헤더패턴": { widths: [...], usedBy: ["config1", "config2"] } }
  const patternMap = {};

  for (const configPath of configFiles) {
    const name = getConfigName(configPath);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const tableWidths = config.tableWidths || {};

    for (const [pattern, widths] of Object.entries(tableWidths)) {
      const key = pattern;
      const widthsKey = JSON.stringify(widths);

      if (!patternMap[key]) {
        patternMap[key] = {};
      }

      if (!patternMap[key][widthsKey]) {
        patternMap[key][widthsKey] = { widths, usedBy: [] };
      }

      patternMap[key][widthsKey].usedBy.push(name);
    }
  }

  // ===== Reflection-based pattern extraction =====
  const REFLECTIONS_PATH = path.join(PROJECT_ROOT, 'lib', 'reflections.json');

  if (fs.existsSync(REFLECTIONS_PATH)) {
    const refData = JSON.parse(fs.readFileSync(REFLECTIONS_PATH, 'utf-8'));
    const reflections = refData.reflections || [];

    const widthFixes = reflections.filter(r =>
      (r.outcome === 'FIX' || r.outcome === 'SUGGEST_APPLIED') &&
      r.fix && r.fix.target === 'doc-config' &&
      r.fix.field === 'tableWidths' &&
      r.fix.value && typeof r.fix.value === 'object'
    );

    for (const r of widthFixes) {
      for (const [pattern, widths] of Object.entries(r.fix.value)) {
        const widthsKey = JSON.stringify(widths);
        if (!patternMap[pattern]) patternMap[pattern] = {};
        if (!patternMap[pattern][widthsKey]) {
          patternMap[pattern][widthsKey] = { widths, usedBy: [] };
        }
        if (!patternMap[pattern][widthsKey].usedBy.includes(r.docName)) {
          patternMap[pattern][widthsKey].usedBy.push(r.docName);
        }
      }
    }

    console.log(`  reflections.json에서 ${widthFixes.length}개 너비 수정 기록 병합`);
  }

  // 점수 맵 로드 (없으면 null — 하위 호환)
  const scoreMap = loadScoreMap();
  if (scoreMap) {
    console.log(`  tests/scores/ 에서 ${Object.keys(scoreMap).length}개 문서 점수 로드`);
  }

  // 분류: common vs byDocType
  const common = {};
  const byDocType = {};

  for (const [pattern, widthVariants] of Object.entries(patternMap)) {
    // 가장 많이 사용된 너비를 선택 (동일 usedBy 수일 때 점수로 tiebreak)
    const variants = Object.values(widthVariants);
    variants.sort((a, b) => {
      if (b.usedBy.length !== a.usedBy.length) return b.usedBy.length - a.usedBy.length;
      return avgScore(b.usedBy, scoreMap) - avgScore(a.usedBy, scoreMap);
    });
    const best = variants[0];

    if (best.usedBy.length >= COMMON_THRESHOLD) {
      // 품질 게이트: 점수 파일이 있으면 평균 7.0 이상이어야 common 승격
      const avg = avgScore(best.usedBy, scoreMap);
      if (!scoreMap || avg >= QUALITY_GATE) {
        common[pattern] = best.widths;
        const scoreInfo = scoreMap ? ` (avg=${avg.toFixed(1)})` : '';
        console.log(`  [COMMON] "${pattern}" — ${best.usedBy.length}개 문서에서 사용${scoreInfo}`);
      } else {
        console.log(`  [SKIP-COMMON] "${pattern}" avg score ${avg.toFixed(1)} < ${QUALITY_GATE}`);
      }
    } else {
      // byDocType에 분류
      for (const variant of variants) {
        for (const docName of variant.usedBy) {
          if (!byDocType[docName]) {
            byDocType[docName] = {};
          }
          // common에 이미 있으면 byDocType에서는 생략
          if (!common[pattern]) {
            byDocType[docName][pattern] = variant.widths;
          }
        }
      }
    }
  }

  // 빈 byDocType 엔트리 제거
  for (const docName of Object.keys(byDocType)) {
    if (Object.keys(byDocType[docName]).length === 0) {
      delete byDocType[docName];
    }
  }

  const patterns = {
    _generated: new Date().toISOString().slice(0, 10),
    _description: "doc-config에서 추출된 공유 패턴. node tools/extract-patterns.js 로 재생성.",
    tableWidths: {
      common,
      byDocType,
    },
  };

  // 저장
  fs.writeFileSync(PATTERNS_PATH, JSON.stringify(patterns, null, 2), 'utf-8');

  // 통계
  const commonCount = Object.keys(common).length;
  const docTypeCount = Object.keys(byDocType).length;
  const totalPatterns = Object.keys(patternMap).length;

  console.log(`\n=== 결과 ===\n`);
  console.log(`  총 패턴: ${totalPatterns}개`);
  console.log(`  common (${COMMON_THRESHOLD}개+ 문서 공유): ${commonCount}개`);
  console.log(`  byDocType: ${docTypeCount}개 문서에 개별 패턴`);
  console.log(`\n  저장: ${PATTERNS_PATH}`);
}

main();
