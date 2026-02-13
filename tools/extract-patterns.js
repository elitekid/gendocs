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

const COMMON_THRESHOLD = 3; // 3개 이상이면 common 승격

function getConfigName(configPath) {
  return path.basename(configPath, '.json');
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

  // 분류: common vs byDocType
  const common = {};
  const byDocType = {};

  for (const [pattern, widthVariants] of Object.entries(patternMap)) {
    // 가장 많이 사용된 너비를 선택
    const variants = Object.values(widthVariants);
    variants.sort((a, b) => b.usedBy.length - a.usedBy.length);
    const best = variants[0];

    if (best.usedBy.length >= COMMON_THRESHOLD) {
      common[pattern] = best.widths;
      console.log(`  [COMMON] "${pattern}" — ${best.usedBy.length}개 문서에서 사용`);
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
