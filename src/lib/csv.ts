/**
 * One CSV cell. Text starting with = + - @ (or a tab/CR) would run as a
 * formula when the file is opened in Excel/Sheets, so it's prefixed with an
 * apostrophe (OWASP CSV injection, audit #8). Numbers are left as numbers.
 */
export function csvCell(value: string | number | null): string {
  if (value == null) return "";
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  return [headers.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n") + "\n";
}
