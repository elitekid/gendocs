const fs = require('fs');
const path = require('path');

const mdPath = process.argv[2] || path.join(__dirname, '../examples/sample-api/source.md');
const content = fs.readFileSync(mdPath, 'utf-8');
const lines = content.split('\n');

let codeBlockCount = 0;
let inCodeBlock = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.trim().startsWith('```')) {
    if (!inCodeBlock) {
      codeBlockCount++;
      console.log(`\n=== Code Block #${codeBlockCount} at line ${i + 1} ===`);
      console.log(`Opening: "${line}"`);
      inCodeBlock = true;
    } else {
      console.log(`Closing: "${line}"`);
      inCodeBlock = false;
    }
  } else if (inCodeBlock && codeBlockCount <= 3) {
    // 처음 3개 코드블록만 내용 출력
    console.log(`  ${line.substring(0, 60)}${line.length > 60 ? '...' : ''}`);
  }
}

console.log(`\n총 코드블록 수: ${codeBlockCount}`);
