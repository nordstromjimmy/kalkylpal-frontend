/**
 * BatchResultsModal.jsx — Full-screen modal showing complete batch scan results.
 *
 * Features:
 *   - Full results table (all drawings × all codes)
 *   - Export to Excel (.xlsx)
 *   - Export to PDF
 *   - Click a row to navigate to that drawing
 *
 * Props:
 *   batchState      — { codes, results, ... }
 *   projectName     — string, used in export filename and PDF header
 *   projectDrawings — array of drawings (to resolve id → filename)
 *   onClose         — callback() → close modal
 *   onSelectDrawing — callback(drawing) → navigate + close
 */
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function BatchResultsModal({
  batchState,
  projectName = "Projekt",
  projectDrawings = [],
  onClose,
  onSelectDrawing,
}) {
  const codes = batchState?.codes || [];
  const results = batchState?.results || {};
  const rows = Object.entries(results);

  // Per-code totals
  const codeTotals = codes.reduce((acc, code) => {
    acc[code] = rows.reduce((sum, [, row]) => sum + (row.counts[code] ?? 0), 0);
    return acc;
  }, {});
  const grandTotal = rows.reduce((sum, [, row]) => sum + row.total, 0);

  // ── Excel export ──────────────────────────────────────────────────────────
  function exportExcel() {
    const header = ["Ritning", ...codes, "Totalt"];
    const data = rows.map(([, row]) => [
      row.filename,
      ...codes.map((c) => row.counts[c] ?? 0),
      row.total,
    ]);
    const totalsRow = [
      "Totalt",
      ...codes.map((c) => codeTotals[c]),
      grandTotal,
    ];

    const ws = XLSX.utils.aoa_to_sheet([header, ...data, totalsRow]);

    // Column widths
    ws["!cols"] = [{ wch: 36 }, ...codes.map(() => ({ wch: 10 })), { wch: 10 }];

    // Bold the header row and totals row
    const boldStyle = { font: { bold: true } };
    header.forEach((_, ci) => {
      const cell = XLSX.utils.encode_cell({ r: 0, c: ci });
      if (ws[cell]) ws[cell].s = boldStyle;
    });
    totalsRow.forEach((_, ci) => {
      const cell = XLSX.utils.encode_cell({ r: data.length + 1, c: ci });
      if (ws[cell]) ws[cell].s = boldStyle;
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Komponenter");
    XLSX.writeFile(wb, `${projectName}_komponenter.xlsx`);
  }

  // ── PDF export ────────────────────────────────────────────────────────────
  function exportPDF() {
    const doc = new jsPDF({
      orientation: codes.length > 4 ? "landscape" : "portrait",
    });

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(projectName, 14, 18);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(`KalkylPal — Komponentöversikt`, 14, 25);
    doc.text(
      new Date().toLocaleDateString("sv-SE"),
      doc.internal.pageSize.width - 14,
      25,
      { align: "right" },
    );
    doc.setTextColor(0);

    // Table
    const head = [["Ritning", ...codes, "Totalt"]];
    const body = rows.map(([, row]) => [
      row.filename,
      ...codes.map((c) => row.counts[c] ?? 0),
      row.total,
    ]);
    const foot = [["Totalt", ...codes.map((c) => codeTotals[c]), grandTotal]];

    autoTable(doc, {
      startY: 30,
      head,
      body,
      foot,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: {
        fillColor: [13, 19, 33],
        textColor: 255,
        fontStyle: "bold",
      },
      footStyles: {
        fillColor: [26, 34, 54],
        textColor: 255,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: "auto" },
        ...codes.reduce((acc, _, i) => {
          acc[i + 1] = { halign: "right", cellWidth: 20 };
          return acc;
        }, {}),
        [codes.length + 1]: {
          halign: "right",
          fontStyle: "bold",
          cellWidth: 20,
        },
      },
      alternateRowStyles: { fillColor: [240, 243, 248] },
    });

    doc.save(`${projectName}_komponenter.pdf`);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-2)",
          border: "1px solid var(--border-bright)",
          borderRadius: "var(--radius-lg)",
          width: "min(92vw, 900px)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ── Modal header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                fontSize: 13,
                color: "var(--ui-white)",
              }}
            >
              Skanningsresultat — {projectName}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-secondary)",
                marginTop: 2,
                fontFamily: "var(--font-mono)",
              }}
            >
              {rows.length} ritning{rows.length !== 1 ? "ar" : ""} ·{" "}
              {codes.join(", ")}
            </div>
          </div>

          {/* Export buttons */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn btn-ghost" onClick={exportExcel}>
              ↓ Excel
            </button>
            <button className="btn btn-ghost" onClick={exportPDF}>
              ↓ PDF
            </button>
            <div
              style={{ width: 1, height: 20, background: "var(--border)" }}
            />
            <button className="btn btn-ghost" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* ── Table ── */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            <thead>
              <tr
                style={{
                  background: "var(--bg-0)",
                  position: "sticky",
                  top: 0,
                }}
              >
                <th style={{ ...thStyle, textAlign: "left" }}>Ritning</th>
                {codes.map((code) => (
                  <th key={code} style={{ ...thStyle, textAlign: "right" }}>
                    {code}
                  </th>
                ))}
                <th
                  style={{
                    ...thStyle,
                    textAlign: "right",
                    color: "var(--ui-white)",
                  }}
                >
                  Totalt
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([drawingId, row], i) => {
                const drawing = projectDrawings.find(
                  (d) => d.id === parseInt(drawingId),
                );
                return (
                  <tr
                    key={drawingId}
                    onClick={() => {
                      onSelectDrawing(drawing);
                      onClose();
                    }}
                    style={{
                      background: i % 2 === 0 ? "transparent" : "var(--bg-1)",
                      cursor: "pointer",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background =
                        "var(--ui-white-hover)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background =
                        i % 2 === 0 ? "transparent" : "var(--bg-1)")
                    }
                  >
                    <td
                      style={{
                        ...tdStyle,
                        color: "var(--text-secondary)",
                        maxWidth: 300,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.filename}
                    </td>
                    {codes.map((code) => (
                      <td
                        key={code}
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                          color:
                            (row.counts[code] ?? 0) > 0
                              ? "var(--text-primary)"
                              : "var(--text-dim)",
                        }}
                      >
                        {row.counts[code] ?? 0}
                      </td>
                    ))}
                    <td
                      style={{
                        ...tdStyle,
                        textAlign: "right",
                        fontWeight: 700,
                        color: "var(--ui-white)",
                      }}
                    >
                      {row.total}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr
                style={{
                  background: "var(--bg-3)",
                  borderTop: "2px solid var(--border-bright)",
                }}
              >
                <td
                  style={{
                    ...tdStyle,
                    fontWeight: 700,
                    color: "var(--ui-white)",
                  }}
                >
                  Totalt
                </td>
                {codes.map((code) => (
                  <td
                    key={code}
                    style={{
                      ...tdStyle,
                      textAlign: "right",
                      fontWeight: 700,
                      color: "var(--ui-white)",
                      fontSize: 13,
                    }}
                  >
                    {codeTotals[code]}
                  </td>
                ))}
                <td
                  style={{
                    ...tdStyle,
                    textAlign: "right",
                    fontWeight: 700,
                    color: "var(--ui-white)",
                    fontSize: 15,
                  }}
                >
                  {grandTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

// Shared cell styles
const thStyle = {
  padding: "10px 16px",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-dim)",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "9px 16px",
  borderBottom: "1px solid var(--border)",
  fontSize: 12,
};
