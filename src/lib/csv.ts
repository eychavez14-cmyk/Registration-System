// CSV that opens cleanly in Excel: BOM for ₱/accents, quoted cells, and formula-injection guard.
const cell = (v: unknown) => {
  const s = v == null ? "" : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // leading = + - @ would run as a formula in Excel
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function downloadCsv(rows: unknown[][], filename: string) {
  const csv = "﻿" + rows.map((l) => l.map(cell).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
