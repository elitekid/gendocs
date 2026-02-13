/**
 * DOCX Document Template v2
 */

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, BorderStyle, WidthType, ShadingType, AlignmentType,
  LevelFormat, PageBreak, ImageRun, Header, Footer, PageNumber, TabStopType, TabStopPosition
} = require('docx');
const fs = require('fs');
const path = require('path');

const _COLORS = {
  primary: "1B3664",      // 네이비 블루
  secondary: "2B5598",    // 밝은 네이비
  accent: "F5A623",       // 옐로우/골드
  text: "333333",
  textLight: "666666",
  textDark: "404040",
  white: "FFFFFF",
  border: "CCCCCC",
  codeBorder: "BFBFBF",
  altRow: "F2F2F2",
  codeBlock: "EAEAEA",
  infoBox: "E8F0F7",      // 네이비 톤 연하게
  warningBox: "FEF6E6"    // 옐로우 톤 연하게
};

const _FONTS = { default: "Malgun Gothic", code: "Consolas" };
const _SIZES = { title: 48, subtitle: 26, h1: 28, h2: 24, h3: 22, body: 20, small: 18, code: 16 };

const _border = { style: BorderStyle.SINGLE, size: 1, color: _COLORS.border };
const _borders = { top: _border, bottom: _border, left: _border, right: _border };
const _codeBorder = { style: BorderStyle.SINGLE, size: 1, color: _COLORS.codeBorder };
const _headerShading = { fill: _COLORS.primary, type: ShadingType.CLEAR };
const _altShading = { fill: _COLORS.altRow, type: ShadingType.CLEAR };
const _codeShading = { fill: _COLORS.codeBlock, type: ShadingType.CLEAR };
const _cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

const _docStyles = {
  default: { document: { run: { font: _FONTS.default, size: _SIZES.body } } },
  paragraphStyles: [
    { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: _SIZES.h1, bold: true, font: _FONTS.default, color: _COLORS.primary },
      paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
    { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: _SIZES.h2, bold: true, font: _FONTS.default, color: _COLORS.secondary },
      paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 1 } },
    { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: _SIZES.h3, bold: true, font: _FONTS.default, color: _COLORS.textDark },
      paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
    { id: "Heading4", name: "Heading 4", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: _SIZES.body, bold: true, font: _FONTS.default, color: _COLORS.text },
      paragraph: { spacing: { before: 150, after: 80 }, outlineLevel: 3 } }
  ]
};

const _numbering = {
  config: [{
    reference: "bullets",
    levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } } }]
  }]
};

const _pageSettings = {
  page: {
    size: { width: 15840, height: 12240 },  // 가로 페이지 (Letter Landscape)
    margin: { top: 1080, right: 1440, bottom: 1080, left: 1440 }  // 상하 여백 축소
  }
};

function _headerCell(text, width) {
  return new TableCell({
    borders: _borders, width: { size: width, type: WidthType.DXA }, shading: _headerShading, margins: _cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: _COLORS.white, font: _FONTS.default, size: _SIZES.small })] })]
  });
}

function _bodyCell(text, width, useAlt = false) {
  return new TableCell({
    borders: _borders, width: { size: width, type: WidthType.DXA }, shading: useAlt ? _altShading : null, margins: _cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text, font: _FONTS.default, size: _SIZES.small })] })]
  });
}

function _headerCellCenter(text, width) {
  return new TableCell({
    borders: _borders, width: { size: width, type: WidthType.DXA }, shading: _headerShading, margins: _cellMargins,
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, color: _COLORS.white, font: _FONTS.default, size: _SIZES.body })] })]
  });
}

function _bodyCellCenter(text, width, useAlt = false) {
  return new TableCell({
    borders: _borders, width: { size: width, type: WidthType.DXA }, shading: useAlt ? _altShading : null, margins: _cellMargins,
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, font: _FONTS.default, size: _SIZES.body })] })]
  });
}

function h1(content) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(content)] });
}

function h2(content) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(content)] });
}

function h3(content) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(content)] });
}

function h4(content) {
  return new Paragraph({ heading: HeadingLevel.HEADING_4, children: [new TextRun(content)] });
}

function text(content, options = {}) {
  return new Paragraph({
    spacing: options.spacing || {},
    children: [new TextRun({
      text: content, font: _FONTS.default, size: options.size || _SIZES.body,
      bold: options.bold || false, italics: options.italics || false, color: options.color || _COLORS.text
    })]
  });
}

// 인라인 서식 파싱 (**bold**, `code`)
function parseInlineFormatting(text, fontSize = _SIZES.body) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/);
  return parts.filter(p => p).map(part => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return new TextRun({ text: part.slice(2, -2), font: _FONTS.default, size: fontSize, bold: true, color: _COLORS.text });
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return new TextRun({ text: part.slice(1, -1), font: _FONTS.code, size: fontSize - 2, color: "555555" });
    }
    return new TextRun({ text: part, font: _FONTS.default, size: fontSize, color: _COLORS.text });
  });
}

function bullet(content, options = {}) {
  const children = parseInlineFormatting(content, _SIZES.body);
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 }, spacing: options.spacing || {},
    children
  });
}

// 라벨 텍스트 (예: "발생 시나리오:", "주의사항:" 등)
function labelText(label, content = '') {
  const children = [
    new TextRun({ text: label, font: _FONTS.default, size: _SIZES.body, bold: true, color: _COLORS.primary })
  ];
  if (content) {
    children.push(new TextRun({ text: ' ' + content, font: _FONTS.default, size: _SIZES.body, color: _COLORS.text }));
  }
  return new Paragraph({
    spacing: { before: 150, after: 80 },
    children
  });
}

function note(content) {
  return new Paragraph({
    children: [new TextRun({ text: content, font: _FONTS.default, size: _SIZES.small, italics: true, color: _COLORS.textLight })]
  });
}

// 참고 박스 - 파란색 왼쪽 보더 + 연한 파란 배경
function infoBox(content) {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const leftBorder = { style: BorderStyle.SINGLE, size: 18, color: _COLORS.primary };  // 네이비 왼쪽 보더

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    indent: { size: 0, type: WidthType.DXA },  // 왼쪽 들여쓰기 제거
    borders: { top: noBorder, bottom: noBorder, left: leftBorder, right: noBorder },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { top: noBorder, bottom: noBorder, left: leftBorder, right: noBorder },
            shading: { fill: "E8F4FD", type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 150, right: 150 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({ text: content, font: _FONTS.default, size: _SIZES.small, color: _COLORS.primary })
                ]
              })
            ]
          })
        ]
      })
    ]
  });
}

// 주의/중요 박스 - 주황색 왼쪽 보더 + 연한 노란 배경
function warningBox(content) {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const leftBorder = { style: BorderStyle.SINGLE, size: 18, color: _COLORS.accent };  // 골드 왼쪽 보더

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    indent: { size: 0, type: WidthType.DXA },  // 왼쪽 들여쓰기 제거
    borders: { top: noBorder, bottom: noBorder, left: leftBorder, right: noBorder },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { top: noBorder, bottom: noBorder, left: leftBorder, right: noBorder },
            shading: { fill: _COLORS.warningBox, type: ShadingType.CLEAR },
            margins: { top: 100, bottom: 100, left: 150, right: 150 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({ text: content, font: _FONTS.default, size: _SIZES.small, color: "8B4513", italics: true })
                ]
              })
            ]
          })
        ]
      })
    ]
  });
}

// 처리흐름 박스 - 회색 왼쪽 보더 + 연한 회색 배경 (여러 줄 지원)
function flowBox(contentLines) {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const leftBorder = { style: BorderStyle.SINGLE, size: 18, color: "666666" };  // 회색 왼쪽 보더

  // contentLines 배열을 Paragraph 배열로 변환
  const paragraphs = contentLines.map((line, idx) => {
    // Step 라인인지 확인
    const isStepLine = /^\*\*Step \d|^Step \d/.test(line);
    const isBullet = line.startsWith('- ');
    const isNumbered = /^\d+\.\s/.test(line);

    // **bold** 와 `code` 처리 함수
    const parseInlineFormatting = (text) => {
      const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/);
      return parts.map(part => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return new TextRun({ text: part.slice(2, -2), font: _FONTS.default, size: _SIZES.small, color: "404040", bold: true });
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return new TextRun({ text: part.slice(1, -1), font: _FONTS.code, size: _SIZES.code, color: "555555" });
        }
        return new TextRun({ text: part, font: _FONTS.default, size: _SIZES.small, color: "505050" });
      });
    };

    if (isBullet) {
      const bulletText = line.substring(2);
      const runs = parseInlineFormatting(bulletText);
      return new Paragraph({
        spacing: { before: 40, after: 40 },
        indent: { left: 300 },
        children: [new TextRun({ text: "• ", font: _FONTS.default, size: _SIZES.small, color: "666666" }), ...runs]
      });
    } else if (isNumbered) {
      // 숫자 목록 (1. 2. 3.)
      const match = line.match(/^(\d+)\.\s(.*)$/);
      const num = match[1];
      const content = match[2];
      const runs = parseInlineFormatting(content);
      return new Paragraph({
        spacing: { before: 60, after: 40 },
        indent: { left: 100 },
        children: [new TextRun({ text: `${num}. `, font: _FONTS.default, size: _SIZES.small, color: "666666", bold: true }), ...runs]
      });
    } else if (isStepLine) {
      // **Step X: Title** 형식 처리
      const cleanLine = line.replace(/\*\*/g, '');
      return new Paragraph({
        spacing: { before: idx === 0 ? 0 : 120, after: 40 },
        children: [
          new TextRun({ text: "▶ ", font: _FONTS.default, size: _SIZES.small, color: "666666" }),
          new TextRun({ text: cleanLine, font: _FONTS.default, size: _SIZES.small, color: "333333", bold: true })
        ]
      });
    } else {
      // 일반 텍스트
      const runs = parseInlineFormatting(line);
      return new Paragraph({
        spacing: { before: 40, after: 40 },
        children: runs
      });
    }
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    indent: { size: 0, type: WidthType.DXA },
    borders: { top: noBorder, bottom: noBorder, left: leftBorder, right: noBorder },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: { top: noBorder, bottom: noBorder, left: leftBorder, right: noBorder },
            shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
            margins: { top: 120, bottom: 120, left: 180, right: 150 },
            children: paragraphs
          })
        ]
      })
    ]
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function spacer(before = 0) {
  return new Paragraph({ spacing: { before }, children: [] });
}

// JSON code block (light background with visible border)
function createCodeBlock(lines) {
  const codeBorder = { style: BorderStyle.SINGLE, size: 12, color: _COLORS.codeBorder };
  const codeShading = { fill: _COLORS.codeBlock, type: ShadingType.CLEAR };
  const rows = lines.map((line, i) => new TableRow({
    children: [new TableCell({
      borders: {
        top: i === 0 ? codeBorder : { style: BorderStyle.NONE },
        bottom: i === lines.length - 1 ? codeBorder : { style: BorderStyle.NONE },
        left: codeBorder,
        right: codeBorder
      },
      shading: codeShading,
      margins: { top: 30, bottom: 30, left: 200, right: 200 },
      width: { size: 12960, type: WidthType.DXA },
      children: [new Paragraph({
        children: [new TextRun({
          text: line || " ",
          font: _FONTS.code,
          size: _SIZES.code,
          color: _COLORS.text
        })]
      })]
    })]
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [12960],
    rows
  });
}

// Flow diagram block (처리흐름 - 깔끔한 회색 스타일, bold 텍스트)
function createFlowBlock(lines) {
  const blockBorder = { style: BorderStyle.SINGLE, size: 6, color: "D0D0D0" };
  const blockShading = { fill: "FAFAFA", type: ShadingType.CLEAR };

  const paragraphs = lines.map(line => new Paragraph({
    spacing: { before: 0, after: 0, line: 300 },
    children: [new TextRun({
      text: line || " ",
      font: "Malgun Gothic",
      size: _SIZES.small,
      color: "444444",
      bold: true
    })]
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [12960],
    rows: [new TableRow({
      children: [new TableCell({
        borders: { top: blockBorder, bottom: blockBorder, left: blockBorder, right: blockBorder },
        shading: blockShading,
        margins: { top: 100, bottom: 100, left: 200, right: 200 },
        width: { size: 12960, type: WidthType.DXA },
        children: paragraphs
      })]
    })]
  });
}

// JSON block (회색 배경)
function createJsonBlock(lines) {
  const noBorder = { style: BorderStyle.NONE, size: 0, color: "F5F5F5" };

  const paragraphs = lines.map(line => new Paragraph({
    spacing: { before: 0, after: 0, line: 260 },
    children: [new TextRun({
      text: line || " ",
      font: _FONTS.code,
      size: _SIZES.code,
      color: "333333"  // 검은색 글씨
    })]
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [12960],
    rows: [new TableRow({
      children: [new TableCell({
        borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
        shading: { fill: "F5F5F5", type: ShadingType.CLEAR },  // 회색 배경
        margins: { top: 100, bottom: 100, left: 200, right: 200 },
        width: { size: 12960, type: WidthType.DXA },
        children: paragraphs
      })]
    })]
  });
}

// Syntax highlighting colors (dark theme)
const _SYNTAX = {
  keyword: "569CD6",     // blue - public, class, return etc
  annotation: "DCDCAA",  // yellow - @Service etc
  type: "4EC9B0",        // cyan - class/type name
  string: "CE9178",      // orange - string
  number: "B5CEA8",      // light green - number
  comment: "6A9955",     // green - comment
  default: "D4D4D4"      // default gray
};

const _KEYWORDS = new Set([
  'public', 'private', 'protected', 'class', 'interface', 'fun', 'func', 'function',
  'val', 'var', 'let', 'const', 'return', 'if', 'else', 'when', 'switch', 'case',
  'for', 'while', 'do', 'break', 'continue', 'true', 'false', 'null', 'nil',
  'this', 'self', 'super', 'new', 'void', 'async', 'await', 'override', 'final',
  'static', 'extends', 'implements', 'import', 'package', 'guard', 'in', 'is', 'as',
  'try', 'catch', 'throw', 'throws', 'object', 'companion', 'data', 'sealed', 'enum'
]);

function _tokenizeLine(line) {
  const tokens = [];
  let i = 0;
  
  while (i < line.length) {
    // whitespace
    if (/\s/.test(line[i])) {
      let space = '';
      while (i < line.length && /\s/.test(line[i])) space += line[i++];
      tokens.push({ text: space, color: _SYNTAX.default });
      continue;
    }
    
    // comment (//, /*, *)
    if (line.slice(i, i+2) === '//' || line.slice(i, i+2) === '/*' || (line[i] === '*' && (i === 0 || /\s/.test(line[i-1])))) {
      tokens.push({ text: line.slice(i), color: _SYNTAX.comment });
      break;
    }
    
    // annotation (starts with @)
    if (line[i] === '@') {
      let anno = '@';
      i++;
      while (i < line.length && /\w/.test(line[i])) anno += line[i++];
      tokens.push({ text: anno, color: _SYNTAX.annotation });
      continue;
    }
    
    // string ("..." or '...')
    if (line[i] === '"' || line[i] === "'") {
      const quote = line[i];
      let str = quote;
      i++;
      while (i < line.length && line[i] !== quote) {
        if (line[i] === '\\' && i + 1 < line.length) { str += line[i++]; }
        str += line[i++];
      }
      if (i < line.length) str += line[i++];
      tokens.push({ text: str, color: _SYNTAX.string });
      continue;
    }
    
    // number
    if (/\d/.test(line[i])) {
      let num = '';
      while (i < line.length && /[\d.]/.test(line[i])) num += line[i++];
      tokens.push({ text: num, color: _SYNTAX.number });
      continue;
    }
    
    // word (keyword, type, identifier)
    if (/\w/.test(line[i])) {
      let word = '';
      while (i < line.length && /\w/.test(line[i])) word += line[i++];
      
      if (_KEYWORDS.has(word)) {
        tokens.push({ text: word, color: _SYNTAX.keyword });
      } else if (/^[A-Z]/.test(word)) {
        tokens.push({ text: word, color: _SYNTAX.type });
      } else {
        tokens.push({ text: word, color: _SYNTAX.default });
      }
      continue;
    }
    
    // other characters
    tokens.push({ text: line[i], color: _SYNTAX.default });
    i++;
  }
  
  return tokens;
}

// Code block (dark theme + syntax highlighting)
function createSyntaxCodeBlock(lines) {
  const codeBorder = { style: BorderStyle.SINGLE, size: 8, color: "3C3C3C" };
  const darkBg = { fill: "1E1E1E", type: ShadingType.CLEAR };
  
  const paragraphs = lines.map(line => {
    const tokens = _tokenizeLine(line || " ");
    const runs = tokens.map(t => new TextRun({ 
      text: t.text, 
      font: _FONTS.code, 
      size: _SIZES.code, 
      color: t.color 
    }));
    return new Paragraph({ 
      spacing: { before: 0, after: 0, line: 276 },
      children: runs.length ? runs : [new TextRun({ text: " ", font: _FONTS.code, size: _SIZES.code })]
    });
  });
  
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [12960],
    rows: [new TableRow({
      children: [new TableCell({
        borders: { top: codeBorder, bottom: codeBorder, left: codeBorder, right: codeBorder },
        shading: darkBg,
        margins: { top: 150, bottom: 150, left: 200, right: 200 },
        width: { size: 12960, type: WidthType.DXA },
        children: paragraphs
      })]
    })]
  });
}

function createSimpleTable(rows, labelWidth = 2500) {
  const valueWidth = 9360 - labelWidth;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [labelWidth, valueWidth],
    rows: [
      new TableRow({ children: [_headerCell("\ud56d\ubaa9", labelWidth), _headerCell("\uc124\uba85", valueWidth)] }),
      ...rows.map((row, i) => new TableRow({
        children: [_bodyCell(row.label, labelWidth, i % 2 === 0), _bodyCell(row.value, valueWidth, i % 2 === 0)]
      }))
    ]
  });
}

function createTable(headers, widths, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: widths,
    rows: [
      new TableRow({ children: headers.map((h, i) => _headerCell(h, widths[i])) }),
      ...rows.map((row, ri) => new TableRow({
        children: row.map((cell, ci) => _bodyCell(cell, widths[ci], ri % 2 === 0))
      }))
    ]
  });
}

function createCoverPage(title, subtitle, projectInfo, author, logoPath = null) {
  const elements = [];

  // 로고 이미지 추가 (있는 경우) - 작게, 브랜딩 역할
  if (logoPath && fs.existsSync(logoPath)) {
    const imageBuffer = fs.readFileSync(logoPath);
    const ext = path.extname(logoPath).toLowerCase().replace('.', '');
    const imageType = ext === 'jpg' ? 'jpeg' : ext;
    elements.push(new Paragraph({ spacing: { before: 2000 }, children: [] }));
    elements.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 800 },
      children: [
        new ImageRun({
          type: imageType,
          data: imageBuffer,
          transformation: { width: 180, height: 54 }  // 작게 (브랜딩 역할)
        })
      ]
    }));
  } else {
    elements.push(new Paragraph({ spacing: { before: 3000 }, children: [] }));
  }

  // 제목 (secondary 색상 - 밝은 네이비)
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 400 },
    children: [new TextRun({ text: title, bold: true, size: _SIZES.title, font: _FONTS.default, color: _COLORS.secondary })]
  }));

  // 부제목
  elements.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 800 },
    children: [new TextRun({ text: subtitle, size: _SIZES.subtitle, font: _FONTS.default, color: _COLORS.textLight })]
  }));

  // 프로젝트 정보 (가로 한 줄, 라벨 포함)
  const metaText = projectInfo.map(row => `${row.label} ${row.value}`).join("  ·  ");
  elements.push(
    new Paragraph({ spacing: { before: 800 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: metaText, font: _FONTS.default, size: 18, color: _COLORS.textLight })]
    }),
    new Paragraph({ children: [new PageBreak()] })
  );

  return elements;
}

function createDocument(children, docInfo = null) {
  const headerFooterColor = "666666";  // 조금 더 진한 회색
  const rightTabPosition = 13500;  // 가로 페이지 기준 오른쪽 끝 위치 (DXA)

  const sectionProps = {
    properties: _pageSettings,
    children: children.flat()
  };

  // 머릿글/바닥글 추가 (docInfo가 있는 경우)
  if (docInfo) {
    sectionProps.headers = {
      default: new Header({
        children: [
          new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: rightTabPosition }],
            children: [
              new TextRun({ text: docInfo.title, font: _FONTS.default, size: 18, color: headerFooterColor }),
              new TextRun({ text: "\t" }),
              new TextRun({ text: docInfo.version, font: _FONTS.default, size: 18, color: headerFooterColor })
            ]
          })
        ]
      })
    };
    sectionProps.footers = {
      default: new Footer({
        children: [
          new Paragraph({
            tabStops: [{ type: TabStopType.RIGHT, position: rightTabPosition }],
            children: [
              new TextRun({ text: docInfo.company, font: _FONTS.default, size: 18, color: headerFooterColor }),
              new TextRun({ text: "\t" }),
              new TextRun({ font: _FONTS.default, size: 18, color: headerFooterColor, children: [PageNumber.CURRENT] }),
              new TextRun({ text: "/", font: _FONTS.default, size: 18, color: headerFooterColor }),
              new TextRun({ font: _FONTS.default, size: 18, color: headerFooterColor, children: [PageNumber.TOTAL_PAGES] })
            ]
          })
        ]
      })
    };
  }

  return new Document({
    styles: _docStyles,
    numbering: _numbering,
    sections: [sectionProps]
  });
}

async function saveDocument(doc, filepath) {
  const rawBuffer = await Packer.toBuffer(doc);
  // 맞춤법/문법 오류 숨기기 설정을 버퍼 단계에서 적용
  const buffer = _applyDocSettings(rawBuffer);
  try {
    fs.writeFileSync(filepath, buffer);
  } catch (err) {
    if (err.code === 'EBUSY' && process.platform === 'win32') {
      const filename = path.basename(filepath);
      console.log(`[WARN] 파일이 열려 있음: ${filename}`);
      console.log(`[INFO] 파일을 잡고 있는 프로세스를 종료합니다...`);
      const { execSync } = require('child_process');
      try {
        let killed = false;
        try {
          execSync(
            `powershell -Command "Get-Process | Where-Object { $_.MainWindowTitle -like '*${filename.replace('.docx','')}*' } | Stop-Process -Force"`,
            { timeout: 5000, stdio: 'pipe' }
          );
          killed = true;
        } catch (e) {
          try {
            execSync('taskkill /IM WINWORD.EXE /F', { timeout: 5000, stdio: 'pipe' });
            killed = true;
          } catch (e2) {}
        }
        if (killed) {
          // Word 강제 종료 시 남는 ~$ 임시 파일 정리
          const dir = path.dirname(filepath);
          const lockFile = path.join(dir, '~$' + filename.substring(2));
          try { if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile); } catch (_) {}
          for (let retry = 0; retry < 3; retry++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            try {
              fs.writeFileSync(filepath, buffer);
              break;
            } catch (retryErr) {
              if (retry === 2) throw retryErr;
            }
          }
        }
      } catch (killErr) {}
      if (!fs.existsSync(filepath) || fs.statSync(filepath).size === 0) {
        throw new Error(`파일이 잠겨 있어 저장할 수 없습니다: ${filepath}\n파일을 수동으로 닫고 다시 시도하세요.`);
      }
    } else {
      throw err;
    }
  }
  console.log(`Document saved: ${filepath}`);
}

function _applyDocSettings(docxBuffer) {
  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(docxBuffer);
    const entry = zip.getEntry('word/settings.xml');
    if (!entry) return docxBuffer;
    let xml = zip.readAsText(entry);
    if (xml.includes('hideSpellingErrors')) return docxBuffer;
    xml = xml.replace(
      '</w:settings>',
      '  <w:hideSpellingErrors/>\n  <w:hideGrammaticalErrors/>\n</w:settings>'
    );
    zip.updateFile(entry, Buffer.from(xml, 'utf-8'));
    return zip.toBuffer();
  } catch (err) {
    return docxBuffer;
  }
}

/**
 * Create an image paragraph
 * @param {string} imagePath - Absolute path to the image file
 * @param {number} width - Image width in pixels (default: 580)
 * @param {number} height - Image height in pixels (default: 450)
 * @returns {Paragraph} - Paragraph containing the image, or a note if image not found
 */
function createImage(imagePath, width = 580, height = 450) {
  if (!fs.existsSync(imagePath)) {
    console.log(`Image not found: ${imagePath}`);
    return note(`[이미지 없음: ${path.basename(imagePath)}]`);
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase().replace('.', '');
  // ImageRun requires 'type' property: png, jpeg, gif, bmp
  const imageType = ext === 'jpg' ? 'jpeg' : ext;

  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
    children: [
      new ImageRun({
        type: imageType,  // CRITICAL: Required property
        data: imageBuffer,
        transformation: { width, height }
      })
    ]
  });
}

module.exports = {
  h1, h2, h3, h4, text, bullet, note, labelText, infoBox, warningBox, flowBox, pageBreak, spacer,
  createCodeBlock, createFlowBlock, createJsonBlock, createSyntaxCodeBlock, createImage,
  createSimpleTable, createTable,
  createCoverPage,
  createDocument, saveDocument
};
