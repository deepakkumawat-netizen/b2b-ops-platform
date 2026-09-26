// Client-side CSV export — builds the file from data the page already has
// (or one extra fetch) and hands it to the browser as a download, so exports
// need no server-side file generation.

type Cell = string | number | boolean | null | undefined;

function escapeCell(value: Cell): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  // Stops Excel/Sheets from running a cell as a formula (CSV injection) when
  // the text starts with =, +, - or @.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

export function downloadCsv(filename: string, headers: string[], rows: Cell[][]): void {
  // The BOM makes Excel read the file as UTF-8 (school names with ā, é, …).
  const blob = new Blob(['﻿' + toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function dateStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function formatDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString('en-IN') : '';
}
