import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface PdfParty { title: string; lines: (string | null | undefined)[] }
export interface PdfTable { columns: { header: string; width: number; align?: "left" | "right" }[]; rows: string[][] }
export interface PdfDoc {
  title: string; // e.g. QUOTATION
  number: string;
  company: { name: string; address?: string; phone?: string; email?: string; website?: string; taxId?: string; bank?: string };
  meta: [string, string][];
  parties: PdfParty[];
  table: PdfTable;
  totals: [string, string, boolean?][]; // label, value, bold
  sections?: { title: string; body: string }[];
  footer?: string;
  watermark?: string;
}

const GREEN = rgb(0.024, 0.306, 0.231);
const EMERALD = rgb(0.063, 0.725, 0.506);
const GRAY = rgb(0.42, 0.45, 0.45);
const LIGHT = rgb(0.95, 0.97, 0.96);
const BLACK = rgb(0.1, 0.12, 0.12);

/** Standard PDF fonts only support WinAnsi; strip characters that cannot be encoded (e.g. Arabic) to avoid crashes. */
function safe(s: string): string {
  return s.replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/→/g, "->").replace(/…/g, "...").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of safe(text).split(/\n/)) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > width && line) { out.push(line); line = word; } else line = test;
    }
    out.push(line);
  }
  return out;
}

export async function renderPdf(doc: PdfDoc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${doc.title} ${doc.number}`);
  pdf.setProducer("OFFSPRING ERP");
  pdf.setCreator("OFFSPRING ERP");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 40;
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const pages: PDFPage[] = [page];

  const text = (s: string, x: number, yy: number, size = 9, f = font, color = BLACK) => page.drawText(safe(s), { x, y: yy, size, font: f, color });
  const rightText = (s: string, xr: number, yy: number, size = 9, f = font, color = BLACK) => text(s, xr - f.widthOfTextAtSize(safe(s), size), yy, size, f, color);

  const header = () => {
    page.drawRectangle({ x: 0, y: H - 6, width: W, height: 6, color: EMERALD });
    page.drawRectangle({ x: M, y: H - M - 30, width: 30, height: 30, color: GREEN });
    text("O", M + 9, H - M - 22, 16, bold, rgb(0.6, 0.95, 0.8));
    text(doc.company.name, M + 40, H - M - 12, 13, bold, GREEN);
    text([doc.company.address, doc.company.phone, doc.company.email, doc.company.website].filter(Boolean).join("  |  "), M + 40, H - M - 26, 7.5, font, GRAY);
    rightText(doc.title, W - M, H - M - 12, 16, bold, GREEN);
    rightText(doc.number, W - M, H - M - 27, 9, font, GRAY);
    if (doc.watermark) {
      page.drawText(safe(doc.watermark), { x: 120, y: 350, size: 70, font: bold, color: rgb(0.85, 0.9, 0.88), opacity: 0.35, rotate: degrees(30) });
    }
    y = H - M - 50;
  };
  const newPage = () => { page = pdf.addPage([W, H]); pages.push(page); header(); };
  const ensure = (h: number) => { if (y - h < M + 40) newPage(); };
  header();

  // Meta grid
  const metaCols = 3;
  const colW = (W - 2 * M) / metaCols;
  doc.meta.forEach(([k, v], i) => {
    const cx = M + (i % metaCols) * colW;
    const cy = y - Math.floor(i / metaCols) * 24;
    text(k.toUpperCase(), cx, cy, 6.5, bold, GRAY);
    text(v || "-", cx, cy - 10, 9, font);
  });
  y -= Math.ceil(doc.meta.length / metaCols) * 24 + 6;

  // Parties
  const pw = (W - 2 * M - 12) / Math.max(doc.parties.length, 1);
  let maxH = 0;
  doc.parties.forEach((p, i) => {
    const px = M + i * (pw + 12);
    const lines = p.lines.filter(Boolean) as string[];
    const h = 18 + lines.length * 11 + 6;
    maxH = Math.max(maxH, h);
    page.drawRectangle({ x: px, y: y - h, width: pw, height: h, color: LIGHT });
    text(p.title.toUpperCase(), px + 8, y - 12, 6.5, bold, GREEN);
    lines.forEach((l, j) => text(l.slice(0, 70), px + 8, y - 25 - j * 11, j === 0 ? 9.5 : 8.5, j === 0 ? bold : font));
  });
  y -= maxH + 16;

  // Table
  const tw = W - 2 * M;
  const totalW = doc.table.columns.reduce((a, c) => a + c.width, 0);
  const cols = doc.table.columns.map((c) => ({ ...c, w: (c.width / totalW) * tw }));
  const drawHead = () => {
    page.drawRectangle({ x: M, y: y - 16, width: tw, height: 18, color: GREEN });
    let cx = M;
    for (const c of cols) {
      if (c.align === "right") rightText(c.header, cx + c.w - 5, y - 11, 7.5, bold, rgb(1, 1, 1));
      else text(c.header, cx + 5, y - 11, 7.5, bold, rgb(1, 1, 1));
      cx += c.w;
    }
    y -= 20;
  };
  drawHead();
  doc.table.rows.forEach((r, ri) => {
    const wrapped = r.map((cell, i) => wrap(cell, font, 8.5, cols[i].w - 10));
    const h = Math.max(...wrapped.map((w) => w.length)) * 11 + 6;
    if (y - h < M + 40) { newPage(); drawHead(); }
    if (ri % 2 === 1) page.drawRectangle({ x: M, y: y - h + 2, width: tw, height: h, color: rgb(0.98, 0.99, 0.985) });
    let cx = M;
    wrapped.forEach((lines, i) => {
      lines.forEach((l, li) => {
        if (cols[i].align === "right") rightText(l, cx + cols[i].w - 5, y - 9 - li * 11, 8.5);
        else text(l, cx + 5, y - 9 - li * 11, 8.5);
      });
      cx += cols[i].w;
    });
    y -= h;
    page.drawLine({ start: { x: M, y: y + 2 }, end: { x: W - M, y: y + 2 }, thickness: 0.4, color: rgb(0.88, 0.9, 0.89) });
  });

  // Totals
  y -= 8;
  ensure(doc.totals.length * 15 + 10);
  for (const [k, v, b] of doc.totals) {
    if (b) page.drawRectangle({ x: W - M - 220, y: y - 5, width: 220, height: 17, color: LIGHT });
    text(k, W - M - 214, y, b ? 10 : 9, b ? bold : font, b ? GREEN : GRAY);
    rightText(v, W - M - 6, y, b ? 10 : 9, b ? bold : font);
    y -= 16;
  }
  y -= 10;

  for (const s of doc.sections ?? []) {
    const lines = wrap(s.body, font, 8.5, tw);
    ensure(16 + lines.length * 11);
    text(s.title.toUpperCase(), M, y, 7, bold, GREEN);
    y -= 12;
    for (const l of lines) { ensure(12); text(l, M, y, 8.5); y -= 11; }
    y -= 8;
  }

  // Footer on every page
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: M + 18 }, end: { x: W - M, y: M + 18 }, thickness: 0.5, color: rgb(0.85, 0.88, 0.87) });
    const foot = safe(doc.footer ?? `${doc.company.name}${doc.company.taxId ? ` | Tax ID ${doc.company.taxId}` : ""}`);
    p.drawText(foot.slice(0, 140), { x: M, y: M + 6, size: 7, font, color: GRAY });
    const pg = `Page ${i + 1} of ${pages.length}`;
    p.drawText(pg, { x: W - M - font.widthOfTextAtSize(pg, 7), y: M + 6, size: 7, font, color: GRAY });
  });
  return pdf.save();
}

export function pdfResponse(bytes: Uint8Array, filename: string, download: boolean) {
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
