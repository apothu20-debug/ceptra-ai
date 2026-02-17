/**
 * Ceptra AI — File Generators
 *
 * These functions take structured JSON from the LLM and generate
 * real downloadable files (PPTX, DOCX, XLSX, PDF).
 *
 * Flow: User request → LLM outputs JSON → Generator creates file → User downloads
 */

import { GeneratedFile } from './tool-engine';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const OUTPUT_BASE = '/tmp/ceptra-outputs';

async function ensureOutputDir(): Promise<string> {
  const dir = join(OUTPUT_BASE, uuidv4().slice(0, 8));
  await mkdir(dir, { recursive: true });
  return dir;
}

// ═══════════════════════════════════════
// PPTX Generator
// ═══════════════════════════════════════
export async function generatePPTX(data: {
  title: string;
  slides: Array<{
    title: string;
    content: string[];
    notes?: string;
    layout?: string;
  }>;
}): Promise<GeneratedFile> {
  const pptxgen = (await import('pptxgenjs')).default;
  const pres = new pptxgen();

  pres.layout = 'LAYOUT_WIDE';
  pres.defineLayout({ name: 'CUSTOM', width: 13.33, height: 7.5 });

  // Title slide
  const titleSlide = pres.addSlide();
  titleSlide.background = { fill: '0a0a1a' };
  titleSlide.addText(data.title, {
    x: 0.8, y: 2.5, w: 11.7, h: 1.5,
    fontSize: 40, fontFace: 'Arial', color: 'FFFFFF',
    bold: true, align: 'center',
  });
  titleSlide.addText('Created by Ceptra AI', {
    x: 0.8, y: 4.2, w: 11.7, h: 0.5,
    fontSize: 14, fontFace: 'Arial', color: '6366f1',
    align: 'center',
  });

  // Content slides
  for (const slide of data.slides) {
    const s = pres.addSlide();
    s.background = { fill: '0e0e18' };

    // Title
    s.addText(slide.title, {
      x: 0.8, y: 0.4, w: 11.7, h: 0.8,
      fontSize: 28, fontFace: 'Arial', color: 'FFFFFF', bold: true,
    });

    // Accent line
    s.addShape(pres.ShapeType.rect, {
      x: 0.8, y: 1.2, w: 2, h: 0.04, fill: { color: '6366f1' },
    });

    // Content bullets
    const bullets = slide.content.map(text => ({
      text,
      options: { fontSize: 18, fontFace: 'Arial', color: 'C0C0D0', bullet: true, breakType: 'n' as const },
    }));

    s.addText(bullets, {
      x: 0.8, y: 1.6, w: 11.7, h: 5,
      valign: 'top', lineSpacing: 32,
    });

    // Speaker notes
    if (slide.notes) {
      s.addNotes(slide.notes);
    }
  }

  const dir = await ensureOutputDir();
  const filename = data.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40) + '.pptx';
  const filepath = join(dir, filename);
  await pres.writeFile({ fileName: filepath });

  return {
    name: filename,
    path: filepath,
    size: 0, // Will be calculated
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    downloadUrl: `/api/download?file=${encodeURIComponent(filepath)}`,
  };
}

// ═══════════════════════════════════════
// DOCX Generator
// ═══════════════════════════════════════
export async function generateDOCX(data: {
  title: string;
  sections: Array<{
    heading?: string;
    content: string;
    type: 'heading' | 'paragraph' | 'list' | 'table';
  }>;
}): Promise<GeneratedFile> {
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    AlignmentType, LevelFormat,
  } = await import('docx');

  const children: any[] = [];

  // Title
  children.push(new Paragraph({
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: data.title, bold: true, size: 48, font: 'Arial' })],
  }));

  // Sections
  for (const section of data.sections) {
    if (section.heading) {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: section.heading, bold: true, size: 28, font: 'Arial' })],
      }));
    }

    if (section.type === 'list') {
      const items = section.content.split('\n').filter(Boolean);
      for (const item of items) {
        children.push(new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: `• ${item.replace(/^[-•]\s*/, '')}`, size: 22, font: 'Arial' })],
        }));
      }
    } else {
      // Split content into paragraphs
      const paragraphs = section.content.split('\n\n').filter(Boolean);
      for (const para of paragraphs) {
        children.push(new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: para.trim(), size: 22, font: 'Arial' })],
        }));
      }
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const dir = await ensureOutputDir();
  const filename = data.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40) + '.docx';
  const filepath = join(dir, filename);
  await writeFile(filepath, buffer);

  return {
    name: filename,
    path: filepath,
    size: buffer.length,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    downloadUrl: `/api/download?file=${encodeURIComponent(filepath)}`,
  };
}

// ═══════════════════════════════════════
// XLSX Generator
// ═══════════════════════════════════════
export async function generateXLSX(data: {
  title: string;
  sheets: Array<{
    name: string;
    headers: string[];
    rows: (string | number)[][];
    formulas?: Record<string, string>;
  }>;
}): Promise<GeneratedFile> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ceptra AI';
  workbook.created = new Date();

  for (const sheetData of data.sheets) {
    const sheet = workbook.addWorksheet(sheetData.name);

    // Headers
    const headerRow = sheet.addRow(sheetData.headers);
    headerRow.font = { bold: true, size: 12 };
    headerRow.fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: 'FF1a1a2e' },
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };

    // Data rows
    for (const row of sheetData.rows) {
      sheet.addRow(row);
    }

    // Formulas
    if (sheetData.formulas) {
      for (const [cell, formula] of Object.entries(sheetData.formulas)) {
        sheet.getCell(cell).value = { formula } as any;
      }
    }

    // Auto-width columns
    sheet.columns.forEach(col => {
      col.width = 16;
    });
  }

  const dir = await ensureOutputDir();
  const filename = data.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40) + '.xlsx';
  const filepath = join(dir, filename);
  await workbook.xlsx.writeFile(filepath);

  return {
    name: filename,
    path: filepath,
    size: 0,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    downloadUrl: `/api/download?file=${encodeURIComponent(filepath)}`,
  };
}

// ═══════════════════════════════════════
// PDF Generator
// ═══════════════════════════════════════
export async function generatePDF(data: {
  title: string;
  content: string;
  fields?: Record<string, string>; // For form filling
}): Promise<GeneratedFile> {
  const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([612, 792]); // US Letter

  // Title
  page.drawText(data.title, {
    x: 50, y: 720, size: 24, font: boldFont, color: rgb(0.1, 0.1, 0.15),
  });

  // Line
  page.drawLine({
    start: { x: 50, y: 710 }, end: { x: 562, y: 710 },
    thickness: 1, color: rgb(0.39, 0.4, 0.95),
  });

  // Content — simple line wrapping
  const lines = data.content.split('\n');
  let y = 685;
  const lineHeight = 16;

  for (const line of lines) {
    if (y < 50) {
      const newPage = pdfDoc.addPage([612, 792]);
      y = 740;
    }

    const isHeading = line.startsWith('#');
    const text = line.replace(/^#+\s*/, '');

    if (isHeading) {
      page.drawText(text, {
        x: 50, y, size: 14, font: boldFont, color: rgb(0.1, 0.1, 0.15),
      });
      y -= lineHeight * 1.5;
    } else if (text.trim()) {
      // Simple word wrap at ~80 chars
      const words = text.split(' ');
      let currentLine = '';

      for (const word of words) {
        if ((currentLine + ' ' + word).length > 80) {
          page.drawText(currentLine.trim(), {
            x: 50, y, size: 11, font, color: rgb(0.2, 0.2, 0.25),
          });
          y -= lineHeight;
          currentLine = word;
        } else {
          currentLine += ' ' + word;
        }
      }

      if (currentLine.trim()) {
        page.drawText(currentLine.trim(), {
          x: 50, y, size: 11, font, color: rgb(0.2, 0.2, 0.25),
        });
        y -= lineHeight;
      }
    } else {
      y -= lineHeight * 0.5;
    }
  }

  // Footer
  page.drawText('Generated by Ceptra AI', {
    x: 50, y: 30, size: 8, font, color: rgb(0.6, 0.6, 0.65),
  });

  const pdfBytes = await pdfDoc.save();
  const dir = await ensureOutputDir();
  const filename = data.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40) + '.pdf';
  const filepath = join(dir, filename);
  await writeFile(filepath, pdfBytes);

  return {
    name: filename,
    path: filepath,
    size: pdfBytes.length,
    mimeType: 'application/pdf',
    downloadUrl: `/api/download?file=${encodeURIComponent(filepath)}`,
  };
}
