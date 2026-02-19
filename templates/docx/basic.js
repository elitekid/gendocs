/**
 * DOCX 문서 템플릿 v2 — Factory Pattern (Basic)
 *
 * Usage: const createTemplate = require('./basic');
 *        const t = createTemplate(themeConfig);
 */

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, BorderStyle, WidthType, ShadingType, AlignmentType,
  LevelFormat, PageBreak
} = require('docx');
const fs = require('fs');

// ============================================================
// Defaults (basic template unique values)
// ============================================================

const DEFAULT_COLORS = {
  primary: "1F4E79",
  secondary: "2E75B6",
  text: "333333",
  textLight: "666666",
  textDark: "404040",
  white: "FFFFFF",
  border: "CCCCCC",
  codeBorder: "BFBFBF",
  altRow: "F2F2F2",
  codeBlock: "EAEAEA",
  infoBox: "E8F4FD",
  warningBox: "FFF3CD"
};

const DEFAULT_FONTS = { default: "\ub9d1\uc740 \uace0\ub515", code: "Consolas" };
const DEFAULT_SIZES = { title: 56, subtitle: 32, h1: 32, h2: 26, h3: 24, body: 22, small: 20, code: 18 };

// ============================================================
// Factory Function
// ============================================================

function createTemplate(theme = {}) {
  const _COLORS = { ...DEFAULT_COLORS, ...(theme.colors || {}) };
  const _FONTS = { ...DEFAULT_FONTS, ...(theme.fonts || {}) };
  const _SIZES = { ...DEFAULT_SIZES, ...(theme.sizes || {}) };

  const _border = { style: BorderStyle.SINGLE, size: 1, color: _COLORS.border };
  const _borders = { top: _border, bottom: _border, left: _border, right: _border };
  const _codeBorder = { style: BorderStyle.SINGLE, size: 8, color: _COLORS.codeBorder };
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
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } }
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
      size: { width: 12240, height: 15840 },
      margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
    }
  };

  // ============================================================
  // Internal helpers
  // ============================================================

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

  // ============================================================
  // Public API
  // ============================================================

  function h1(content) {
    return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(content)] });
  }

  function h2(content) {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(content)] });
  }

  function h3(content) {
    return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(content)] });
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

  function bullet(content, options = {}) {
    return new Paragraph({
      numbering: { reference: "bullets", level: 0 }, spacing: options.spacing || {},
      children: [new TextRun({ text: content, font: _FONTS.default, size: _SIZES.body, bold: options.bold || false })]
    });
  }

  function note(content) {
    return new Paragraph({
      children: [new TextRun({ text: content, font: _FONTS.default, size: _SIZES.small, italics: true, color: _COLORS.textLight })]
    });
  }

  function infoBox(content) {
    return new Paragraph({
      shading: { fill: _COLORS.infoBox, type: ShadingType.CLEAR }, spacing: { before: 100, after: 100 },
      children: [new TextRun({ text: content, font: _FONTS.code, size: _SIZES.body })]
    });
  }

  function warningBox(content) {
    return new Paragraph({
      shading: { fill: _COLORS.warningBox, type: ShadingType.CLEAR }, spacing: { before: 100, after: 100 },
      children: [new TextRun({ text: content, font: _FONTS.default, size: _SIZES.small, bold: true })]
    });
  }

  function pageBreak() {
    return new Paragraph({ children: [new PageBreak()] });
  }

  function spacer(before = 0) {
    return new Paragraph({ spacing: { before }, children: [] });
  }

  function createCodeBlock(lines) {
    return lines.map((line, i) => new Paragraph({
      spacing: {
        before: i === 0 ? 120 : 0,
        after: i === lines.length - 1 ? 120 : 0,
        line: 276
      },
      shading: {
        fill: _COLORS.codeBlock,
        type: ShadingType.CLEAR,
        color: "auto"
      },
      indent: { left: 200, right: 200 },
      children: [new TextRun({
        text: line || " ",
        font: _FONTS.code,
        size: _SIZES.code,
        color: _COLORS.text
      })]
    }));
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

  function createCoverPage(title, subtitle, projectInfo, author) {
    return [
      new Paragraph({ spacing: { before: 2000 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { after: 600 },
        children: [new TextRun({ text: title, bold: true, size: _SIZES.title, font: _FONTS.default, color: _COLORS.primary })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { after: 1500 },
        children: [new TextRun({ text: subtitle, size: _SIZES.subtitle, font: _FONTS.default, color: _COLORS.textLight })]
      }),
      new Paragraph({ spacing: { before: 1500 }, children: [] }),
      new Table({
        width: { size: 5000, type: WidthType.DXA }, alignment: AlignmentType.CENTER, columnWidths: [2000, 3000],
        rows: projectInfo.map((row, i) => new TableRow({
          children: [_headerCellCenter(row.label, 2000), _bodyCellCenter(row.value, 3000, i % 2 === 1)]
        }))
      }),
      new Paragraph({ spacing: { before: 2000 }, children: [] }),
      new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { before: 500 },
        children: [new TextRun({ text: author, size: 28, font: _FONTS.default, bold: true, color: _COLORS.primary })]
      }),
      new Paragraph({ children: [new PageBreak()] })
    ];
  }

  function createDocument(children) {
    return new Document({
      styles: _docStyles,
      numbering: _numbering,
      sections: [{ properties: _pageSettings, children: children.flat() }]
    });
  }

  async function saveDocument(doc, filepath) {
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(filepath, buffer);
    console.log(`Document saved: ${filepath}`);
  }

  // ============================================================
  // Return public API
  // ============================================================

  return {
    h1, h2, h3, text, bullet, note, infoBox, warningBox, pageBreak, spacer,
    createCodeBlock,
    createSimpleTable, createTable,
    createCoverPage,
    createDocument, saveDocument
  };
}

module.exports = createTemplate;
