/**
 * create-score-baselines.js — 전체 문서 품질 점수 baseline 생성
 *
 * 사용법: node tools/create-score-baselines.js
 *         node tools/create-score-baselines.js --force  (기존 덮어쓰기)
 *
 * 각 doc-config에 대해:
 * 1. node lib/convert.js 실행 (DOCX 생성)
 * 2. validate-docx.py + review-docx.py 실행
 * 3. lib/scoring.js로 점수 산출
 * 4. tests/scores/{name}.scores.json 저장
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const scoring = require('../lib/scoring');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DOC_CONFIGS_DIR = path.join(PROJECT_ROOT, 'doc-configs');
const SCORES_DIR = path.join(PROJECT_ROOT, 'tests', 'scores');

function getConfigName(configPath) {
  return path.basename(configPath, '.json');
}

function resolveOutputPath(config) {
  let outputFile = config.output;
  if (outputFile.includes('{version}')) {
    outputFile = outputFile.replace('{version}', config.docInfo?.version || 'v1.0');
  }
  return path.join(PROJECT_ROOT, outputFile);
}

function main() {
  const force = process.argv.includes('--force');

  // tests/scores 디렉토리 생성
  if (!fs.existsSync(SCORES_DIR)) {
    fs.mkdirSync(SCORES_DIR, { recursive: true });
  }

  // doc-configs 수집
  const configFiles = fs.readdirSync(DOC_CONFIGS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(DOC_CONFIGS_DIR, f));

  if (configFiles.length === 0) {
    console.log('doc-configs/ 에 JSON 파일이 없습니다.');
    process.exit(0);
  }

  console.log(`\n=== 점수 Baseline 생성 시작 (${configFiles.length}개 문서) ===\n`);

  const results = [];

  for (const configPath of configFiles) {
    const name = getConfigName(configPath);
    const scorePath = path.join(SCORES_DIR, `${name}.scores.json`);

    // 기존 baseline 존재 확인
    if (fs.existsSync(scorePath) && !force) {
      console.log(`[SKIP] ${name} — scores 이미 존재 (--force로 덮어쓰기)`);
      results.push({ name, status: 'SKIP' });
      continue;
    }

    console.log(`[BUILD] ${name} — 변환 중...`);

    try {
      // 1. DOCX 변환
      execSync(`node lib/convert.js "${configPath}"`, {
        cwd: PROJECT_ROOT,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const outputPath = resolveOutputPath(config);

      if (!fs.existsSync(outputPath)) {
        console.log(`  [ERROR] 출력 파일 없음: ${outputPath}`);
        results.push({ name, status: 'ERROR', message: '출력 파일 없음' });
        continue;
      }

      // 2. 검증
      console.log(`  검증 중...`);
      let validateJson = null;
      try {
        const vOut = execSync(
          `python -X utf8 tools/validate-docx.py "${outputPath}" --json`,
          { cwd: PROJECT_ROOT, encoding: 'utf-8', stdio: 'pipe' }
        );
        validateJson = JSON.parse(vOut);
      } catch (err) {
        console.log(`  [ERROR] validate 실패: ${err.message.split('\n')[0]}`);
        results.push({ name, status: 'ERROR', message: 'validate 실패' });
        continue;
      }

      let reviewJson = null;
      try {
        const rOut = execSync(
          `python -X utf8 tools/review-docx.py "${outputPath}" --config "${configPath}" --json`,
          { cwd: PROJECT_ROOT, encoding: 'utf-8', stdio: 'pipe' }
        );
        reviewJson = JSON.parse(rOut);
      } catch (err) {
        // review 실패는 치명적이지 않음 — content 7점 고정
        console.log(`  [WARN] review 실패 (content=7.0 고정): ${err.message.split('\n')[0]}`);
      }

      // 3. 점수 산출
      console.log(`  채점 중...`);
      const contentResult = scoring.scoreContent(reviewJson);
      const layoutResult = scoring.scoreLayout(validateJson);
      const tableResult = scoring.scoreTable(reviewJson);
      const codeResult = scoring.scoreCode(reviewJson);
      const structureResult = scoring.scoreStructure(validateJson, reviewJson);

      const scores = {
        content: contentResult.score,
        layout: layoutResult.score,
        table: tableResult.score,
        code: codeResult.score,
        structure: structureResult.score,
      };
      scores.overall = scoring.computeOverall(scores);

      const validateIssues = validateJson.issues || [];
      const reviewIssues = (reviewJson && reviewJson.issues) || [];

      const stats = {
        estimatedPages: validateJson.stats?.estimatedPages || 0,
        warnCount: validateIssues.filter(i => i.severity === 'WARN').length +
                   reviewIssues.filter(i => i.severity === 'WARN').length,
        infoCount: validateIssues.filter(i => i.severity === 'INFO').length +
                   reviewIssues.filter(i => i.severity === 'INFO').length,
        suggestCount: reviewIssues.filter(i => i.severity === 'SUGGEST').length,
      };

      // 4. 저장
      const scoreData = {
        docConfig: name,
        history: [
          {
            scoredAt: new Date().toISOString().slice(0, 10),
            scores,
            stats,
            trigger: 'baseline',
          },
        ],
        latestOverall: scores.overall,
        trend: 'stable',
      };

      fs.writeFileSync(scorePath, JSON.stringify(scoreData, null, 2), 'utf-8');

      console.log(`  [OK] overall=${scores.overall} (C=${scores.content} L=${scores.layout} T=${scores.table} Co=${scores.code} S=${scores.structure})`);
      results.push({ name, status: 'OK', overall: scores.overall });

    } catch (err) {
      console.log(`  [ERROR] ${err.message.split('\n')[0]}`);
      results.push({ name, status: 'ERROR', message: err.message.split('\n')[0] });
    }
  }

  // 요약
  console.log('\n=== 요약 ===\n');
  const ok = results.filter(r => r.status === 'OK').length;
  const skip = results.filter(r => r.status === 'SKIP').length;
  const error = results.filter(r => r.status === 'ERROR').length;

  for (const r of results) {
    const icon = r.status === 'OK' ? '✓' : r.status === 'SKIP' ? '-' : '✗';
    const detail = r.overall ? `overall=${r.overall}` : r.message || '';
    console.log(`  ${icon} ${r.name}: ${r.status} ${detail}`);
  }

  console.log(`\n합계: OK ${ok}, SKIP ${skip}, ERROR ${error} / 총 ${results.length}개`);

  if (error > 0) process.exit(1);
}

main();
