import ExcelJS from "exceljs";

export type Cell = string | number | null | undefined;

function csvEscape(v: Cell): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  // Neutralize spreadsheet formula injection
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(headers: string[], rows: Cell[][]): string {
  return "﻿" + [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n");
}

export async function toXLSX(sheet: string, headers: string[], rows: Cell[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "OFFSPRING ERP";
  const ws = wb.addWorksheet(sheet.slice(0, 31));
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF065F46" } };
  for (const r of rows) ws.addRow(r.map((c) => (typeof c === "string" && /^[=+\-@]/.test(c) && !/^-?\d/.test(c) ? `'${c}` : c ?? "")));
  ws.columns.forEach((col, i) => { col.width = Math.min(40, Math.max(10, headers[i].length + 2, ...rows.slice(0, 200).map((r) => String(r[i] ?? "").length + 2))); });
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function exportResponse(name: string, format: string, headers: string[], rows: Cell[][]) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "xlsx") {
    const buf = await toXLSX(name, headers, rows);
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name}-${stamp}.xlsx"`, "Cache-Control": "no-store" } });
  }
  return new Response(toCSV(headers, rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}-${stamp}.csv"`, "Cache-Control": "no-store" } });
}
