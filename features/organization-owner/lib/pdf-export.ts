"use client";

export async function exportToPDF(title: string, tableData: Record<string, unknown>[], columns: { key: string; label: string }[], filename: string) {
  const win = window.open("", "_blank");
  if (!win) return;

  const rows = tableData.slice(0, 100).map((row) =>
    `<tr>${columns.map((c) => `<td style="border:1px solid #ddd;padding:6px 10px;font-size:12px">${row[c.key] ?? ""}</td>`).join("")}</tr>`
  ).join("\n");

  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        @page { margin: 20mm; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; padding: 20px; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        .meta { font-size: 11px; color: #666; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #111; color: #fff; padding: 8px 10px; font-size: 11px; text-align: left; text-transform: uppercase; letter-spacing: 0.5px; }
        td { font-size: 12px; }
        tr:nth-child(even) { background: #f9f9f9; }
        .footer { margin-top: 30px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 10px; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p class="meta">Generated ${new Date().toLocaleString("en-IN")} · ${tableData.length} records</p>
      <table>
        <thead><tr>${columns.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="footer">Apex Gym Management System · Organization Owner Portal</p>
      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `);
  win.document.close();
}
