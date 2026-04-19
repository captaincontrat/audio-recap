import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";

import { mimeTypeFor } from "./formats";

const PAGE_MARGIN = 48;
const BODY_FONT_SIZE = 11;
const H1_FONT_SIZE = 16;
const H2_FONT_SIZE = 13;
const BODY_LINE_HEIGHT = 15;
const HEADING_LINE_HEIGHT = 20;

type StyledLine = {
  text: string;
  fontSize: number;
  lineHeight: number;
  bold: boolean;
  afterGap: number;
};

export async function convertToPdfBlob(markdown: string): Promise<Blob> {
  const pdf = await PDFDocument.create();
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage();
  let { width, height } = page.getSize();
  const maxTextWidth = width - PAGE_MARGIN * 2;
  let cursorY = height - PAGE_MARGIN;

  const lines = markdownToStyledLines(markdown);
  for (const line of lines) {
    const font = line.bold ? boldFont : regularFont;
    const wrapped = wrapLine(line.text, font, line.fontSize, maxTextWidth);
    const parts = wrapped.length > 0 ? wrapped : [""];
    for (const part of parts) {
      if (cursorY - line.lineHeight < PAGE_MARGIN) {
        page = pdf.addPage();
        ({ width, height } = page.getSize());
        cursorY = height - PAGE_MARGIN;
      }
      page.drawText(part, {
        x: PAGE_MARGIN,
        y: cursorY,
        size: line.fontSize,
        font,
      });
      cursorY -= line.lineHeight;
    }
    cursorY -= line.afterGap;
  }

  const bytes = await pdf.save();
  const byteCopy = new Uint8Array(bytes.length);
  byteCopy.set(bytes);
  return new Blob([byteCopy.buffer], { type: mimeTypeFor("pdf") });
}

function markdownToStyledLines(markdown: string): StyledLine[] {
  const rawLines = markdown.split(/\r?\n/u);
  const lines: StyledLine[] = [];

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (trimmed.length === 0) {
      lines.push({ text: "", fontSize: BODY_FONT_SIZE, lineHeight: BODY_LINE_HEIGHT, bold: false, afterGap: 3 });
      continue;
    }

    if (trimmed.startsWith("# ")) {
      lines.push({
        text: stripInlineMarkdown(trimmed.slice(2).trim()),
        fontSize: H1_FONT_SIZE,
        lineHeight: HEADING_LINE_HEIGHT,
        bold: true,
        afterGap: 6,
      });
      continue;
    }

    if (trimmed.startsWith("## ")) {
      lines.push({
        text: stripInlineMarkdown(trimmed.slice(3).trim()),
        fontSize: H2_FONT_SIZE,
        lineHeight: HEADING_LINE_HEIGHT - 2,
        bold: true,
        afterGap: 4,
      });
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*+]\s+(.*)$/u);
    if (bulletMatch) {
      const text = stripInlineMarkdown(bulletMatch[1] ?? "");
      lines.push({
        text: `• ${text}`,
        fontSize: BODY_FONT_SIZE,
        lineHeight: BODY_LINE_HEIGHT,
        bold: false,
        afterGap: 2,
      });
      continue;
    }

    lines.push({
      text: stripInlineMarkdown(trimmed),
      fontSize: BODY_FONT_SIZE,
      lineHeight: BODY_LINE_HEIGHT,
      bold: false,
      afterGap: 2,
    });
  }

  return lines;
}

function stripInlineMarkdown(input: string): string {
  const withoutLinks = input.replace(/\[([^\]]+)\]\(([^)]+)\)/gu, "$1");
  const withoutCode = withoutLinks.replace(/`([^`]+)`/gu, "$1");
  const withoutStrong = withoutCode.replace(/\*\*([^*]+)\*\*/gu, "$1");
  const withoutEmphasis = withoutStrong.replace(/[_*]([^_*]+)[_*]/gu, "$1");
  return withoutEmphasis.replace(/\s+/gu, " ").trim();
}

function wrapLine(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (text.length === 0) return [];
  const words = text.split(/\s+/u).filter((word) => word.length > 0);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = words[0] ?? "";

  for (const word of words.slice(1)) {
    const candidate = `${current} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
  }

  lines.push(current);
  return lines;
}
