/**
 * Converts an array of objects to a CSV string and triggers a browser download.
 */
export function exportToCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;

  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    const str = String(val).replace(/\r?\n/g, " ");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.map((h) => escape(h)).join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];

  const blob = new Blob([csvLines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
