const t = require('../templates/docx/professional');
const fs = require('fs');
const path = require('path');

const mdPath = process.argv[2] || path.join(__dirname, '../examples/sample-api/source.md');
const markdown = fs.readFileSync(mdPath, 'utf-8');
const lines = markdown.split('\n');

let codeBlocksAdded = 0;
let i = 0;

while (i < lines.length) {
  const line = lines[i];

  // ```코드블록```
  if (line.trim().startsWith('```')) {
    const codeLines = [];
    const openLine = line;
    i++;
    while (i < lines.length && !lines[i].trim().startsWith('```')) {
      codeLines.push(lines[i]);
      i++;
    }
    i++; // ``` 닫는 줄 스킵

    if (codeLines.length > 0) {
      codeBlocksAdded++;
      if (codeBlocksAdded <= 5) {
        console.log(`\nCode block #${codeBlocksAdded}:`);
        console.log(`  Opening: "${openLine}"`);
        console.log(`  Lines: ${codeLines.length}`);
        console.log(`  First line: "${codeLines[0].substring(0, 50)}..."`);
      }
    } else {
      console.log(`Empty code block at line, opening: "${openLine}"`);
    }
    continue;
  }
  i++;
}

console.log(`\n총 추가된 코드블록: ${codeBlocksAdded}`);
